/* POST /api/waitlist — puts a website signup into Loops.

   The browser sends JSON (landing.js) or, with scripting off, the
   form's own urlencoded POST. Either way the body carries the email,
   the honeypot field and whatever first-touch attribution the page
   captured. The Loops key never leaves this function.

   New contact:      created via /contacts/update with source, userGroup,
                     the attribution properties and both mailing lists.
   Existing contact: left exactly as it is. Nothing here may overwrite
                     a source, a UTM, a user group or a list subscription
                     that is already set, so the request is a no-op that
                     still reads as success to the person submitting.
   Honeypot filled:  dropped, but answered as if it worked.

   Dependency-free: Node's global fetch, nothing installed. */

'use strict';

const {
  MAX_BODY_BYTES, FRIENDLY_ERROR, loops, loopsFailure, readBody,
  normaliseEmail, cleanString, maskEmail, sendJson, redirect,
} = require('./_lib/loops.js');
const supabase = require('./_lib/supabase.js');

// The off-screen field in the markup. Humans never see it; bots fill it.
const HONEYPOT_FIELD = 'hp_field';

// The custom properties created in Loops, and the longest value each
// may carry. A URL can be long; a campaign name cannot.
const ATTRIBUTION_FIELDS = {
  utmSource: 200,
  utmMedium: 200,
  utmCampaign: 200,
  utmContent: 200,
  referrer: 500,
  landingPage: 500,
};

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, message: 'Method not allowed.' });
  }

  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  const isNativeForm = contentType.includes('application/x-www-form-urlencoded');

  // A native form POST cannot read JSON, so it is answered with a
  // redirect back to the page, which shows the message for ?joined=.
  const reply = (status, body) => {
    if (isNativeForm) return redirect(res, body.ok ? '/?joined=1' : '/?joined=0');
    return sendJson(res, status, body);
  };

  const length = Number(req.headers['content-length'] || 0);
  if (length > MAX_BODY_BYTES) {
    return reply(413, { ok: false, message: FRIENDLY_ERROR });
  }

  let body;
  try {
    body = await readBody(req, contentType);
  } catch (err) {
    console.warn('[waitlist] unreadable body', { error: String(err && err.message) });
    return reply(400, { ok: false, message: FRIENDLY_ERROR });
  }

  const email = normaliseEmail(body.email);
  if (!email) {
    return reply(400, { ok: false, message: 'Please enter a valid email address.' });
  }

  // A filled honeypot is a bot. It gets the same answer a person would,
  // so it learns nothing, and nothing reaches Loops.
  if (typeof body[HONEYPOT_FIELD] === 'string' && body[HONEYPOT_FIELD].trim() !== '') {
    console.info('[waitlist] honeypot hit', { form: cleanString(body.form, 40) });
    return reply(200, { ok: true });
  }

  const apiKey = process.env.LOOPS_API_KEY;
  const lists = [process.env.LOOPS_LIST_FRIENDS, process.env.LOOPS_LIST_DEALS].filter(Boolean);
  if (!apiKey || lists.length !== 2) {
    console.error('[waitlist] missing configuration', {
      LOOPS_API_KEY: Boolean(apiKey),
      LOOPS_LIST_FRIENDS: Boolean(process.env.LOOPS_LIST_FRIENDS),
      LOOPS_LIST_DEALS: Boolean(process.env.LOOPS_LIST_DEALS),
    });
    return reply(500, { ok: false, message: FRIENDLY_ERROR });
  }

  const attribution = pickAttribution(body);
  const logContext = { email: maskEmail(email), form: cleanString(body.form, 40) };

  try {
    const found = await loops(apiKey, 'GET', '/contacts/find?email=' + encodeURIComponent(email));
    if (Array.isArray(found) && found.length > 0) {
      console.info('[waitlist] existing contact, left unchanged', logContext);
      await recordLead(email, body, attribution, logContext);
      return reply(200, { ok: true });
    }

    const mailingLists = {};
    lists.forEach((id) => { mailingLists[id] = true; });

    await loops(apiKey, 'PUT', '/contacts/update', Object.assign(
      { email: email, source: 'website', userGroup: 'lead', subscribed: true },
      attribution,
      { mailingLists: mailingLists }
    ));

    console.info('[waitlist] contact created', Object.assign({}, logContext, attribution));
    await recordLead(email, body, attribution, logContext);
    return reply(200, { ok: true });
  } catch (err) {
    console.error('[waitlist] loops request failed', Object.assign({}, logContext, {
      status: err && err.status,
      error: String(err && err.message),
      detail: err && err.detail,
    }));
    const failure = loopsFailure(err);
    return reply(failure.status, { ok: false, message: failure.message });
  }
};

function pickAttribution(body) {
  const out = {};
  Object.keys(ATTRIBUTION_FIELDS).forEach((key) => {
    const value = cleanString(body[key], ATTRIBUTION_FIELDS[key]);
    if (value) out[key] = value;
  });
  return out;
}

// The lead row in Supabase: email, which form, and the attribution. A
// failure here is logged and does not fail the signup, which is in
// Loops by now; the profile modal's own write will merge into the row.
async function recordLead(email, body, attribution, logContext) {
  if (!supabase.configured()) {
    console.error('[waitlist] supabase not configured; lead row not written', logContext);
    return;
  }
  try {
    await supabase.upsertLead(Object.assign(
      { email: email, form: cleanString(body.form, 40) || null },
      supabase.attributionColumns(attribution)
    ));
  } catch (err) {
    console.error('[waitlist] lead row failed', Object.assign({}, logContext, {
      status: err && err.status,
      error: String(err && err.message),
      cause: err && err.cause ? String(err.cause.message || err.cause) : undefined,
      detail: err && err.detail,
    }));
  }
}
