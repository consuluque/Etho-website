/* The checks a public form endpoint runs before it stores anything: was
   it posted from one of our pages, is it a real browser (Turnstile), and
   has this connection posted too often. Used by /api/partner. The
   waitlist function carries its own copies of the same checks.

   The underscore keeps Vercel from deploying this file as a function. */

'use strict';

const { createHmac } = require('crypto');
const { cleanString } = require('./loops.js');
const supabase = require('./supabase.js');

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TIMEOUT_MS = 5000;

// Vercel puts the visitor's address in x-real-ip, and first in
// x-forwarded-for.
function clientIp(req) {
  const real = String(req.headers['x-real-ip'] || '').trim();
  if (real) return real;
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
}

// Why a request did not come from one of the site's forms, or null if
// it did. It must name one of `forms`, carry the page it landed on (the
// page script always sends it) and an Origin (or, failing that, a
// Referer) naming the host this function is served on, so previews work
// too. A script posting straight to the function has none of these.
function notFromOurForm(req, body, forms) {
  if (!forms.includes(cleanString(body.form, 40))) return 'unknown form';
  if (!cleanString(body.landingPage, 500)) return 'no landing page';

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

// The Turnstile verdict: 'off' (no secret key set), 'passed', 'missing'
// (no token), 'failed' (Cloudflare said no) or 'skipped' (Cloudflare
// could not be asked). It fails open: an outage at Cloudflare must
// never block people. `action` is the one the page's widget was
// rendered with (landing.js).
async function checkTurnstile(req, body, tag, action) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return 'off';

  const token = cleanString(body.turnstileToken || body['cf-turnstile-response'], 2048);
  if (!token) return 'missing';

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
    console.error('[' + tag + '] turnstile check skipped', { error: String(err && err.message) });
    return 'skipped';
  }

  if (result && result.success === true && (!result.action || result.action === action)) {
    return 'passed';
  }
  console.info('[' + tag + '] turnstile failed', {
    codes: result && result['error-codes'],
    action: result && result.action,
    hostname: result && result.hostname,
  });
  return 'failed';
}

// True when this connection has used up its submissions for the window;
// otherwise records this attempt and returns false. Attempts are kept in
// Supabase (waitlist_attempts) as a keyed hash of the IP, never the IP.
// Fails open: with Supabase unconfigured, the table not created, or any
// error, the submission goes ahead, because a broken limit must never
// block people. The hash is keyed with the Supabase key, so this
// endpoint's counts are separate from the waitlist's.
async function overRateLimit(req, tag, limit) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ip = clientIp(req);
  if (!supabase.configured() || !key || !ip) return false;

  const ipHash = createHmac('sha256', key).update(tag + ':' + ip).digest('base64url');
  try {
    const since = new Date(Date.now() - limit.windowMs).toISOString();
    const count = await supabase.countAttempts(ipHash, since);
    if (count >= limit.max) {
      console.info('[' + tag + '] rate limited', { count: count });
      return true;
    }
    await supabase.recordAttempt(ipHash);
  } catch (err) {
    console.error('[' + tag + '] rate limit skipped', { status: err && err.status, error: String(err && err.message) });
  }
  return false;
}

module.exports = { clientIp, notFromOurForm, checkTurnstile, overRateLimit };
