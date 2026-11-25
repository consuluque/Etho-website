/* POST /api/partner — the partners page's form: a business that wants to
   be part of Etho's launch network. The answers go into the
   partner_leads table in Supabase (supabase/migrations/
   20261125_partner_leads.sql) and nowhere else: no Loops, no mailing
   list.

   Same guards as the waitlist, from api/_lib/guards.js:
   Honeypot filled:  dropped, but answered as if it worked.
   Not from our form: no known form name, landing page or same-site
                     Origin: dropped the same way.
   Turnstile:        with TURNSTILE_SECRET_KEY set, a post needs a token
                     Cloudflare confirms; none is dropped, a bad one is
                     refused with 403.
   Too many posts:   from one connection in an hour, refused with 429.

   Dependency-free: Node's global fetch, nothing installed. */

'use strict';

const {
  MAX_BODY_BYTES, FRIENDLY_ERROR, readBody, normaliseEmail, cleanString, maskEmail,
  sendJson, debugDetail,
} = require('./_lib/loops.js');
const supabase = require('./_lib/supabase.js');
const guards = require('./_lib/guards.js');

const TAG = 'partner';
const HONEYPOT_FIELD = 'hp_field';

// partners.html names the button that opened the form.
const KNOWN_FORMS = ['hero', 'footer', 'sticky'];

// Past a couple of tries (a typo, a colleague on the same office
// network) a connection is a script.
const RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };
const RATE_LIMITED_MESSAGE = 'Too many submissions from your connection. Please try again later.';
const TURNSTILE_ACTION = 'waitlist'; // the action landing.js renders its widget with
const TURNSTILE_FAILED_MESSAGE = "We couldn't confirm the submission. Please try again.";

const MAX_NAME = 80;
const MAX_PHONE = 30;

// The choices the form offers. Anything else is dropped.
const BOOKINGS = ['0–5', '6–10', '11–20', '21–30', '30+'];
const METHODS = ['online booking platform', 'website', 'whatsapp', 'phone calls', 'instagram/dms', 'email', 'other'];

const ATTRIBUTION_FIELDS = {
  utmSource: ['utm_source', 200],
  utmMedium: ['utm_medium', 200],
  utmCampaign: ['utm_campaign', 200],
  utmContent: ['utm_content', 200],
  utmTerm: ['utm_term', 200],
  referrer: ['referrer', 500],
  landingPage: ['landing_page', 500],
};

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
    console.warn('[partner] unreadable body', { error: String(err && err.message) });
    return sendJson(res, 400, { ok: false, message: FRIENDLY_ERROR });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return sendJson(res, 400, { ok: false, message: FRIENDLY_ERROR });
  }

  // Validate first, so a person with a typo is told, and only then
  // look at whether it is a bot (which is told nothing).
  const lead = validate(body);
  if (lead.error) {
    return sendJson(res, 400, { ok: false, message: lead.error });
  }

  if (typeof body[HONEYPOT_FIELD] === 'string' && body[HONEYPOT_FIELD].trim() !== '') {
    console.info('[partner] honeypot hit');
    return sendJson(res, 200, { ok: true });
  }

  const botReason = guards.notFromOurForm(req, body, KNOWN_FORMS);
  if (botReason) {
    console.info('[partner] dropped, not from the site form', { reason: botReason });
    return sendJson(res, 200, { ok: true });
  }

  const turnstile = await guards.checkTurnstile(req, body, TAG, TURNSTILE_ACTION);
  if (turnstile === 'missing') {
    console.info('[partner] dropped, no turnstile token');
    return sendJson(res, 200, { ok: true });
  }
  if (turnstile === 'failed') {
    return sendJson(res, 403, { ok: false, message: TURNSTILE_FAILED_MESSAGE });
  }

  if (await guards.overRateLimit(req, TAG, RATE_LIMIT)) {
    return sendJson(res, 429, { ok: false, message: RATE_LIMITED_MESSAGE });
  }

  if (!supabase.configured()) {
    const missing = {
      SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    };
    console.error('[partner] missing configuration', missing);
    return sendJson(res, 500, Object.assign({ ok: false, message: FRIENDLY_ERROR }, debugDetail({ missingConfiguration: missing })));
  }

  const row = Object.assign({}, lead.row, attribution(body), {
    form: cleanString(body.form, 40),
  });
  const logContext = { email: maskEmail(lead.row.email), form: row.form };
  try {
    await supabase.insertPartnerLead(row);
    console.info('[partner] saved', logContext);
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    const failure = {
      status: err && err.status,
      error: String(err && err.message),
      cause: err && err.cause ? String(err.cause.message || err.cause) : undefined,
      detail: err && err.detail,
    };
    console.error('[partner] supabase write failed', Object.assign({}, logContext, failure));
    return sendJson(res, 502, Object.assign({ ok: false, message: FRIENDLY_ERROR }, debugDetail({ supabase: failure })));
  }
};

/* Returns { row } or { error }: the columns of the partner_leads row. */
function validate(body) {
  const name = cleanString(body.name, MAX_NAME);
  if (!name) return { error: 'Please tell us your name.' };

  const email = normaliseEmail(body.email);
  if (!email) return { error: 'Please enter a valid email address.' };

  let phone = cleanString(body.phone, MAX_PHONE);
  if (phone) {
    const digits = phone.replace(/\D/g, '').length;
    if (!/^[0-9+()\-.\s]+$/.test(phone) || digits < 6 || digits > 15) {
      return { error: 'Please enter a valid phone number, or skip this one.' };
    }
  } else {
    phone = null;
  }

  if (body.consent !== true) {
    return { error: 'Please tick the box so we know we can get in touch.' };
  }

  const bookings = cleanString(body.bookingsPerWeek, 20);
  return {
    row: {
      name: name,
      email: email,
      phone: phone,
      weekly_bookings_wanted: BOOKINGS.includes(bookings) ? bookings : null,
      booking_methods: pickChoices(body.bookingMethods, METHODS),
      consent: true,
      consent_at: new Date().toISOString(),
    },
  };
}

// The allowed choices that were sent, in the form's order.
function pickChoices(value, allowed) {
  if (!Array.isArray(value)) return [];
  return allowed.filter((option) => value.includes(option));
}

function attribution(body) {
  const out = {};
  Object.keys(ATTRIBUTION_FIELDS).forEach((key) => {
    const column = ATTRIBUTION_FIELDS[key][0];
    const value = cleanString(body[key], ATTRIBUTION_FIELDS[key][1]);
    if (value) out[column] = value;
  });
  return out;
}
