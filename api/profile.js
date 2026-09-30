/* POST /api/profile — the starter dog profile, filled in the modal that
   opens once a waitlist signup has gone through. It merges into the
   lead's row in Supabase (see supabase/migrations); the Database
   Webhook on that table then carries the fields Loops holds across via
   /api/loops-sync. What the dog loves and struggles with stays in
   Supabase only. */

'use strict';

const {
  MAX_BODY_BYTES, FRIENDLY_ERROR, readBody, normaliseEmail, cleanString, maskEmail, sendJson, debugDetail,
} = require('./_lib/loops.js');
const supabase = require('./_lib/supabase.js');

const MAX_NAME = 60;
const MAX_BREED = 80;
const MAX_AGE = 30;

// The chip values the modal offers. Anything else is dropped.
const LOVES = ['walks', 'food', 'swimming', 'other dogs', 'toys', 'cuddles', 'learning tricks', 'car rides', 'sleeping'];
const STRUGGLES = ['being left alone', 'pulling on lead', 'rainy days', 'weight', 'anxiety', 'allergies', 'grooming', 'health issues', 'car', 'nail trimming'];

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, message: 'Method not allowed.' });
  }

  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return sendJson(res, 415, { ok: false, message: FRIENDLY_ERROR });
  }
  if (Number(req.headers['content-length'] || 0) > MAX_BODY_BYTES) {
    return sendJson(res, 413, { ok: false, message: FRIENDLY_ERROR });
  }

  let body;
  try {
    body = await readBody(req, contentType);
  } catch (err) {
    console.warn('[profile] unreadable body', { error: String(err && err.message) });
    return sendJson(res, 400, { ok: false, message: FRIENDLY_ERROR });
  }

  const email = normaliseEmail(body.email);
  if (!email) {
    return sendJson(res, 400, { ok: false, message: 'Please enter a valid email address.' });
  }

  const profile = validateProfile(body);
  if (profile.error) {
    return sendJson(res, 400, { ok: false, message: profile.error });
  }

  if (!supabase.configured()) {
    const missing = {
      SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    };
    console.error('[profile] missing configuration', missing);
    return sendJson(res, 500, Object.assign({ ok: false, message: FRIENDLY_ERROR }, debugDetail({ missingConfiguration: missing })));
  }

  const logContext = { email: maskEmail(email) };
  try {
    await supabase.upsertLead(Object.assign(
      { email: email, form: cleanString(body.form, 40) || undefined },
      profile.row
    ));
    console.info('[profile] saved', Object.assign({}, logContext, profile.row));
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    const failure = {
      status: err && err.status,
      error: String(err && err.message),
      // Node wraps a connection failure as "fetch failed" with the real
      // reason (unknown scheme, host not found, ...) in cause.
      cause: err && err.cause ? String(err.cause.message || err.cause) : undefined,
      detail: err && err.detail,
    };
    console.error('[profile] supabase write failed', Object.assign({}, logContext, failure));
    return sendJson(res, 502, Object.assign({ ok: false, message: FRIENDLY_ERROR }, debugDetail({ supabase: failure })));
  }
};

/* Returns { row } or { error }: the fields for the Supabase row, in its
   column names, only the ones with a value. */
function validateProfile(body) {
  const dogName = cleanString(body.dogName, MAX_NAME);
  const dogBreed = cleanString(body.dogBreed, MAX_BREED);
  const ownerName = cleanString(body.ownerName, MAX_NAME);
  if (!dogName) return { error: "Please tell us your dog's name." };
  if (!dogBreed) return { error: "Please tell us your dog's breed." };
  if (!ownerName) return { error: 'Please tell us your name.' };

  const row = { owner_name: ownerName, dog_name: dogName, dog_breed: dogBreed };

  if (body.dogAge !== undefined && body.dogAge !== null && body.dogAge !== '') {
    const age = Number(body.dogAge);
    if (!Number.isFinite(age) || age < 0 || age > MAX_AGE) {
      return { error: 'Please enter an age between 0 and ' + MAX_AGE + '.' };
    }
    row.dog_age = Math.round(age * 2) / 2;
  }

  const day = Number(body.dogBirthdayDay || 0);
  const month = Number(body.dogBirthdayMonth || 0);
  if (day || month) {
    const valid = Number.isInteger(month) && month >= 1 && month <= 12
      && Number.isInteger(day) && day >= 1 && day <= DAYS_IN_MONTH[month - 1];
    if (!valid) return { error: 'Please choose a real day and month for the birthday.' };
    row.dog_birthday_day = day;
    row.dog_birthday_month = month;
  }

  row.loves = pickChips(body.loves, LOVES);
  row.struggles = pickChips(body.struggles, STRUGGLES);

  return { row: row };
}

function pickChips(value, allowed) {
  if (!Array.isArray(value)) return [];
  return allowed.filter((option) => value.includes(option));
}
