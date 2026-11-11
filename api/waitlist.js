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
   Too many signups: from one connection in an hour, refused with 429
                     and a message saying to try again later.
   Turnstile:        with TURNSTILE_SECRET_KEY set, a post from the page
                     script must carry a Cloudflare Turnstile token that
                     Cloudflare confirms. No-JS form posts cannot run
                     Turnstile, so they are let through without one.

   Dependency-free: Node's global fetch, nothing installed. */

'use strict';

const {
  MAX_BODY_BYTES, FRIENDLY_ERROR, loops, loopsFailure, readBody,
  normaliseEmail, cleanString, maskEmail, signEmail, sendJson, redirect,
} = require('./_lib/loops.js');
const { createHmac } = require('crypto');
const supabase = require('./_lib/supabase.js');

// The off-screen field in the markup. Humans never see it; bots fill it.
const HONEYPOT_FIELD = 'hp_field';

// Every form on the site names itself (data-form-name, sent by
// landing.js, and a hidden "form" input for when scripting is off). A
// request naming none of them did not come from one of our forms.
const KNOWN_FORMS = new Set(['hero', 'sticky', 'holding', 'home_v2', 'waitlist']);

// At most this many signups per connection (IP address) per hour. Room
// for a family adding several emails ("Add another email?") or people
// sharing one address (a mobile network, an office); far below
// what a script sends. Counted in
// Supabase (waitlist_attempts), keyed by a hash of the IP, never the IP.
const RATE_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 };
const RATE_LIMITED_MESSAGE = 'Too many sign-ups from your connection. Please try again later.';

// Cloudflare Turnstile: landing.js gets an invisible token in the
// browser and sends it as turnstileToken; this asks Cloudflare whether
// it is genuine. A token is single-use and lasts five minutes, and only
// a real browser on etho.pet can get one, so a script cannot copy it.
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_ACTION = 'waitlist'; // matches the action in landing.js
const TURNSTILE_TIMEOUT_MS = 5000;
const TURNSTILE_FAILED_MESSAGE = "We couldn't confirm the sign-up. Please try again.";

// The attribution the form sends, and the longest value each may carry.
// A URL can be long; a campaign name cannot. All of them are custom
// properties in Loops except those in SUPABASE_ONLY, which go to the
// lead row alone: Loops rejects a contact carrying a property it does
// not have, so a new field must never put a signup at risk.
const ATTRIBUTION_FIELDS = {
  utmSource: 200,
  utmMedium: 200,
  utmCampaign: 200,
  utmContent: 200,
  utmTerm: 200,
  referrer: 500,
  landingPage: 500,
};

// utm_term carries the Meta ad set ({{adset.id}}); the growth reports
// read it from Supabase, so Loops has no need for it.
const SUPABASE_ONLY = new Set(['utmTerm']);

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

  // Scripts that post straight to this function, skipping the page, never
  // see the honeypot. They also send no form name and no same-site
  // Origin or Referer, which every browser submitting our forms does.
  // Same answer as the honeypot: looks like success, nothing is stored.
  const botReason = notFromOurForm(req, body, isNativeForm);
  if (botReason) {
    console.info('[waitlist] dropped, not from a site form', { reason: botReason, form: cleanString(body.form, 40) });
    return reply(200, { ok: true });
  }

  const turnstile = await checkTurnstile(req, body, isNativeForm);
  if (turnstile === 'missing') {
    // Our script always sends a token when Turnstile is on (and falls
    // back to a plain form post when it cannot get one), so a script
    // post without one is a bot: the same quiet answer as above.
    console.info('[waitlist] dropped, no turnstile token', { form: cleanString(body.form, 40) });
    return reply(200, { ok: true });
  }
  if (turnstile === 'failed') {
    // Could be a forged token, or a real person whose token expired:
    // say so, and the next click gets a fresh one.
    return reply(403, { ok: false, message: TURNSTILE_FAILED_MESSAGE });
  }

  if (await overRateLimit(req, cleanString(body.form, 40))) {
    return reply(429, { ok: false, message: RATE_LIMITED_MESSAGE });
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
  // What the profile modal will need to save against this email.
  const secret = process.env.LOOPS_SYNC_SECRET;
  if (!secret) console.error('[waitlist] LOOPS_SYNC_SECRET missing; profiles cannot be saved', logContext);
  const answer = { ok: true, token: secret ? signEmail(email, secret) : null };

  try {
    const found = await loops(apiKey, 'GET', '/contacts/find?email=' + encodeURIComponent(email));
    if (Array.isArray(found) && found.length > 0) {
      console.info('[waitlist] existing contact, left unchanged', logContext);
      await recordLead(email, body, attribution, logContext);
      return reply(200, answer);
    }

    const mailingLists = {};
    lists.forEach((id) => { mailingLists[id] = true; });

    await loops(apiKey, 'PUT', '/contacts/update', Object.assign(
      { email: email, source: 'website', userGroup: 'lead', subscribed: true },
      forLoops(attribution),
      { mailingLists: mailingLists }
    ));

    console.info('[waitlist] contact created', Object.assign({}, logContext, attribution));
    await recordLead(email, body, attribution, logContext);
    return reply(200, answer);
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

// Why a request did not come from one of the site's forms, or null if it
// did. Same site means the Origin (or, failing that, the Referer) names
// the host this function is served on, so previews work too.
function notFromOurForm(req, body, isNativeForm) {
  if (!KNOWN_FORMS.has(cleanString(body.form, 40))) return 'unknown form';
  // landing.js always sends the page the visit landed on (at least "/"),
  // so a JSON post without one was not sent by the page. A no-JS form
  // post has no script to add it, so it is let through on the other
  // checks. Since 11 Nov a script has been posting JSON with a real
  // form name and Origin but no landing page.
  if (!isNativeForm && !cleanString(body.landingPage, 500)) return 'no landing page';

  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  const origin = String(req.headers.origin || '');
  const source = origin && origin !== 'null' ? origin : String(req.headers.referer || '');
  if (!source) return 'no origin';
  let sourceHost;
  try {
    sourceHost = new URL(source).host.toLowerCase();
  } catch (_) {
    return 'bad origin';
  }
  return host && sourceHost === host ? null : 'other site';
}

// The Turnstile verdict: 'off' (no secret key set yet), 'passed',
// 'no-js' (a native form post without a token, let through), 'missing'
// (a script post without a token), 'failed' (Cloudflare said no) or
// 'skipped' (Cloudflare could not be asked). Like the rate limit, it
// fails open: an outage at Cloudflare must never block people.
async function checkTurnstile(req, body, isNativeForm) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return 'off';

  const token = cleanString(body.turnstileToken || body['cf-turnstile-response'], 2048);
  const form = cleanString(body.form, 40);
  if (!token) {
    if (isNativeForm) {
      console.info('[waitlist] no-JS signup, no turnstile token', { form: form });
      return 'no-js';
    }
    return 'missing';
  }

  const params = new URLSearchParams({ secret: secret, response: token });
  const ip = clientIp(req);
  if (ip) params.set('remoteip', ip);

  let result;
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error('siteverify returned ' + res.status);
    result = await res.json();
  } catch (err) {
    console.error('[waitlist] turnstile check skipped', { form: form, error: String(err && err.message) });
    return 'skipped';
  }

  if (result && result.success === true && (!result.action || result.action === TURNSTILE_ACTION)) {
    return 'passed';
  }
  console.info('[waitlist] turnstile failed', {
    form: form,
    codes: result && result['error-codes'],
    action: result && result.action,
    hostname: result && result.hostname,
  });
  return 'failed';
}

// True when this connection has used up its signups for the hour;
// otherwise records this attempt and returns false. Fails open: with
// Supabase unconfigured, the table not created yet, or any error, the
// signup goes ahead, because a broken limit must never block people.
async function overRateLimit(req, form) {
  const key = process.env.LOOPS_SYNC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ip = clientIp(req);
  if (!supabase.configured() || !key || !ip) return false;

  const ipHash = createHmac('sha256', key).update(ip).digest('base64url');
  try {
    const since = new Date(Date.now() - RATE_LIMIT.windowMs).toISOString();
    const count = await supabase.countAttempts(ipHash, since);
    if (count >= RATE_LIMIT.max) {
      console.info('[waitlist] rate limited', { count: count, form: form });
      return true;
    }
    await supabase.recordAttempt(ipHash);
  } catch (err) {
    console.error('[waitlist] rate limit skipped', { status: err && err.status, error: String(err && err.message) });
  }
  return false;
}

// Vercel puts the visitor's address in x-real-ip, and first in
// x-forwarded-for.
function clientIp(req) {
  const real = String(req.headers['x-real-ip'] || '').trim();
  if (real) return real;
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
}

function forLoops(attribution) {
  const out = {};
  Object.keys(attribution).forEach((key) => {
    if (!SUPABASE_ONLY.has(key)) out[key] = attribution[key];
  });
  return out;
}

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
