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

const LOOPS_API = 'https://app.loops.so/api/v1';
const MAX_BODY_BYTES = 16 * 1024;
const REQUEST_TIMEOUT_MS = 8000;

// The off-screen field in the markup. Humans never see it; bots fill it.
const HONEYPOT_FIELD = 'website';

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

const FRIENDLY_ERROR = 'Something went wrong — please try again.';
const BUSY_ERROR = 'Too many signups right now — please try again in a moment.';

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
    return reply(200, { ok: true });
  } catch (err) {
    const status = err && err.status;
    console.error('[waitlist] loops request failed', Object.assign({}, logContext, {
      status: status,
      error: String(err && err.message),
      detail: err && err.detail,
    }));
    if (status === 429) return reply(503, { ok: false, message: BUSY_ERROR });
    return reply(502, { ok: false, message: FRIENDLY_ERROR });
  }
};

/* ---------------------------------------------------------------
   Loops
   --------------------------------------------------------------- */

async function loops(apiKey, method, path, payload) {
  const res = await fetch(LOOPS_API + path, {
    method: method,
    headers: {
      Authorization: 'Bearer ' + apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }

  if (!res.ok) {
    const err = new Error('Loops ' + method + ' ' + path.split('?')[0] + ' returned ' + res.status);
    err.status = res.status;
    err.detail = data;
    throw err;
  }
  return data;
}

/* ---------------------------------------------------------------
   Request parsing
   --------------------------------------------------------------- */

// Vercel's Node runtime parses JSON and urlencoded bodies into req.body
// before the handler runs; a plain Node server (or a test) hands over
// the raw stream instead. Both are accepted.
async function readBody(req, contentType) {
  let raw = req.body;

  if (raw === undefined) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) throw new Error('Body too large');
      chunks.push(chunk);
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }

  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;

  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw || '');
  if (contentType.includes('application/json')) return text ? JSON.parse(text) : {};
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  throw new Error('Unsupported content type: ' + (contentType || '(none)'));
}

function normaliseEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;
  // Loose on purpose: the browser's own type="email" check has already
  // run for humans, and Loops validates again on its side.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

function pickAttribution(body) {
  const out = {};
  Object.keys(ATTRIBUTION_FIELDS).forEach((key) => {
    const value = cleanString(body[key], ATTRIBUTION_FIELDS[key]);
    if (value) out[key] = value;
  });
  return out;
}

// Strings only, control characters stripped, capped in length. Anything
// else becomes an empty string and is dropped.
function cleanString(value, max) {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

function maskEmail(email) {
  const at = email.indexOf('@');
  return email[0] + '***' + email.slice(at);
}

/* ---------------------------------------------------------------
   Responses
   --------------------------------------------------------------- */

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function redirect(res, location) {
  res.statusCode = 303;
  res.setHeader('Location', location);
  res.end();
}
