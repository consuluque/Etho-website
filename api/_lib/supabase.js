/* The leads table in Supabase, written through PostgREST with the
   service role key, so it needs no SDK. The key never leaves the
   functions. Schema: supabase/migrations/20260929_waitlist_leads.sql */

'use strict';

const REQUEST_TIMEOUT_MS = 8000;
const TABLE = 'waitlist_leads';

function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Insert the row, or merge it into the row that already has this email.
// Only the columns present in `row` are written, so a later call with
// more fields enriches the row and a call with fewer leaves them be.
//
// A column added after launch (utm_term) may not exist yet if its
// migration has not been run. Then PostgREST refuses the whole row, so
// the row is written again without the newer columns rather than lost.
const NEWER_COLUMNS = ['utm_term'];

async function upsertLead(row) {
  try {
    await postLead(row);
  } catch (err) {
    const missing = NEWER_COLUMNS.filter((c) => c in row && String(err.detail || '').includes(c));
    if (!missing.length) throw err;
    console.error('[supabase] column missing, run the migration; row saved without it', { columns: missing });
    const fallback = Object.assign({}, row);
    missing.forEach((c) => { delete fallback[c]; });
    await postLead(fallback);
  }
}

async function postLead(row) {
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const res = await fetch(base + '/rest/v1/' + TABLE + '?on_conflict=email', {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(Object.assign({}, row, { updated_at: new Date().toISOString() })),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const err = new Error('Supabase upsert returned ' + res.status);
    err.status = res.status;
    err.detail = await res.text().catch(() => '');
    throw err;
  }
}

// camelCase attribution from the browser to the table's snake_case.
function attributionColumns(attribution) {
  const map = {
    utmSource: 'utm_source',
    utmMedium: 'utm_medium',
    utmCampaign: 'utm_campaign',
    utmContent: 'utm_content',
    utmTerm: 'utm_term',
    referrer: 'referrer',
    landingPage: 'landing_page',
  };
  const out = {};
  Object.keys(map).forEach((key) => {
    if (attribution[key]) out[map[key]] = attribution[key];
  });
  return out;
}

// One analytics event; the row is never read back.
async function insertEvent(row) {
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(base + '/rest/v1/analytics_events', {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = new Error('Supabase insert returned ' + res.status);
    err.status = res.status;
    err.detail = await res.text().catch(() => '');
    throw err;
  }
}

// Sign-up attempts per connection, for the waitlist's rate limit.
// Schema: supabase/migrations/20261111_waitlist_attempts.sql
const ATTEMPTS_TABLE = 'waitlist_attempts';

// How many attempts this connection made since `sinceIso`.
async function countAttempts(ipHash, sinceIso) {
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const query = 'select=id&ip_hash=eq.' + encodeURIComponent(ipHash) +
    '&created_at=gte.' + encodeURIComponent(sinceIso);
  const res = await fetch(base + '/rest/v1/' + ATTEMPTS_TABLE + '?' + query, {
    method: 'HEAD',
    headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: 'count=exact' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = new Error('Supabase count returned ' + res.status);
    err.status = res.status;
    throw err;
  }
  // Content-Range: 0-4/5, or */0 when there are none.
  const total = Number(String(res.headers.get('content-range') || '').split('/')[1]);
  if (!Number.isFinite(total)) throw new Error('Supabase count had no total');
  return total;
}

async function recordAttempt(ipHash) {
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(base + '/rest/v1/' + ATTEMPTS_TABLE, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ ip_hash: ipHash }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = new Error('Supabase insert returned ' + res.status);
    err.status = res.status;
    throw err;
  }
}

module.exports = { configured, upsertLead, insertEvent, attributionColumns, countAttempts, recordAttempt };
