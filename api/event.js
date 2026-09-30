/* POST /api/event — one first-party analytics event into Supabase.

   landing.js sends every waitlist_* event here (the signup and the dog
   profile funnels). Nothing else is accepted: the name must start with
   waitlist_, properties are capped and cleaned, and the row carries a
   per-visit session id rather than anything that follows a person. It
   always answers 204: analytics must never get in a visitor's way. */

'use strict';

const { MAX_BODY_BYTES, readBody, cleanString } = require('./_lib/loops.js');
const supabase = require('./_lib/supabase.js');

const EVENT_NAME = /^waitlist_[a-z_]{1,50}$/;
const PROP_NAME = /^[a-zA-Z_]{1,40}$/;
const MAX_PROPS = 20;
const MAX_VALUE = 200;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.statusCode = 405;
    return res.end();
  }

  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  let body = null;
  if (contentType.includes('application/json') && Number(req.headers['content-length'] || 0) <= MAX_BODY_BYTES) {
    try { body = await readBody(req, contentType); } catch (_) { body = null; }
  }

  const row = body && toRow(body);
  if (!row) {
    res.statusCode = 204;
    return res.end();
  }

  if (!supabase.configured()) {
    console.error('[event] supabase not configured; event dropped', { event: row.event });
  } else {
    try {
      await supabase.insertEvent(row);
    } catch (err) {
      console.error('[event] insert failed', { event: row.event, status: err && err.status, error: String(err && err.message), detail: err && err.detail });
    }
  }
  res.statusCode = 204;
  res.end();
};

// The row to store, or null when the event is not one of ours.
function toRow(body) {
  const event = typeof body.event === 'string' && EVENT_NAME.test(body.event) ? body.event : null;
  if (!event) return null;

  const props = {};
  const given = body.props && typeof body.props === 'object' && !Array.isArray(body.props) ? body.props : {};
  Object.keys(given).slice(0, MAX_PROPS).forEach((key) => {
    if (!PROP_NAME.test(key)) return;
    const value = given[key];
    if (typeof value === 'number' && Number.isFinite(value)) props[key] = value;
    else if (typeof value === 'boolean') props[key] = value;
    else if (typeof value === 'string') props[key] = cleanString(value, MAX_VALUE);
  });

  return {
    source: 'website',
    event: event,
    props: props,
    session_id: cleanString(body.session, 64).replace(/[^A-Za-z0-9-]/g, '') || null,
    page: cleanString(body.page, 200) || null,
  };
}
