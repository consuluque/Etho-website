/* POST /api/loops-sync — keeps the Loops contact in step with a row in
   waitlist_leads. Called by a Supabase Database Webhook on INSERT and
   UPDATE of that table, so every Loops update after the initial signup
   flows through here: the dog profile, the link to an account, and any
   column added later (add it to toLoops() below).

   The webhook must send the shared secret in the x-etho-webhook-secret
   header; anything else is refused. Nothing in the payload is trusted
   beyond the row's own columns, and only mapped columns reach Loops.

   Not touched here: source, the UTMs and the mailing lists, which the
   signup sets once and which no later change should overwrite. */

'use strict';

const { timingSafeEqual } = require('crypto');
const {
  MAX_BODY_BYTES, loops, loopsFailure, readBody, normaliseEmail, maskEmail, sendJson,
} = require('./_lib/loops.js');

const SECRET_HEADER = 'x-etho-webhook-secret';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false });
  }

  const secret = process.env.LOOPS_SYNC_SECRET;
  const apiKey = process.env.LOOPS_API_KEY;
  if (!secret || !apiKey) {
    console.error('[loops-sync] missing configuration', { LOOPS_SYNC_SECRET: Boolean(secret), LOOPS_API_KEY: Boolean(apiKey) });
    return sendJson(res, 500, { ok: false });
  }
  if (!sameSecret(req.headers[SECRET_HEADER], secret)) {
    return sendJson(res, 401, { ok: false });
  }

  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('application/json') || Number(req.headers['content-length'] || 0) > MAX_BODY_BYTES) {
    return sendJson(res, 400, { ok: false });
  }

  let event;
  try {
    event = await readBody(req, contentType);
  } catch (err) {
    return sendJson(res, 400, { ok: false });
  }

  // Supabase sends { type, table, record, old_record }. Deletions are
  // not mirrored: a contact in Loops outlives a row on purpose.
  if (event.table !== 'waitlist_leads' || (event.type !== 'INSERT' && event.type !== 'UPDATE')) {
    return sendJson(res, 200, { ok: true, skipped: 'not a lead insert or update' });
  }

  const row = event.record || {};
  const email = normaliseEmail(row.email);
  if (!email) return sendJson(res, 400, { ok: false });

  // Every insert or update syncs, so touching a row (bumping its
  // updated_at) is how a contact is re-synced by hand.
  const props = toLoops(row);

  const logContext = { email: maskEmail(email), type: event.type };
  try {
    await loops(apiKey, 'PUT', '/contacts/update', Object.assign({ email: email }, props));
    console.info('[loops-sync] synced', Object.assign({}, logContext, props));
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('[loops-sync] loops request failed', Object.assign({}, logContext, {
      status: err && err.status,
      error: String(err && err.message),
      detail: err && err.detail,
    }));
    return sendJson(res, loopsFailure(err).status, { ok: false });
  }
};

/* The row's columns to the contact's properties. Only set values are
   included, so a partial row never blanks a property. userGroup follows
   user_id: null is a lead, set is a user. */
function toLoops(row) {
  const props = { userGroup: row.user_id ? 'user' : 'lead' };
  if (row.user_id) props.userId = String(row.user_id);
  if (row.converted_at) props.appSignupDate = row.converted_at;
  if (row.owner_name) props.firstName = row.owner_name;
  if (row.dog_name) props.dogName = row.dog_name;
  if (row.dog_breed) props.dogBreed = row.dog_breed;
  if (row.dog_age !== null && row.dog_age !== undefined && row.dog_age !== '') props.dogAge = Number(row.dog_age);
  if (row.dog_birthday_day && row.dog_birthday_month) {
    props.dogBirthday = String(row.dog_birthday_month).padStart(2, '0') + '-' + String(row.dog_birthday_day).padStart(2, '0');
  }
  return props;
}

function sameSecret(given, expected) {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
