/* Shared by the functions in api/: the Loops client, request parsing and
   the response helpers. The underscore keeps Vercel from deploying this
   file as a function of its own. */

'use strict';

const LOOPS_API = 'https://app.loops.so/api/v1';
const MAX_BODY_BYTES = 16 * 1024;
const REQUEST_TIMEOUT_MS = 8000;

const FRIENDLY_ERROR = 'Something went wrong — please try again.';
const BUSY_ERROR = 'Too many signups right now — please try again in a moment.';

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

// The status and message to answer with when a Loops call throws.
function loopsFailure(err) {
  if (err && err.status === 429) return { status: 503, message: BUSY_ERROR };
  return { status: 502, message: FRIENDLY_ERROR };
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

module.exports = {
  MAX_BODY_BYTES,
  FRIENDLY_ERROR,
  loops,
  loopsFailure,
  readBody,
  normaliseEmail,
  cleanString,
  maskEmail,
  sendJson,
  redirect,
};
