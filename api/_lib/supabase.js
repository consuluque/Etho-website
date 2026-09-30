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
async function upsertLead(row) {
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
    referrer: 'referrer',
    landingPage: 'landing_page',
  };
  const out = {};
  Object.keys(map).forEach((key) => {
    if (attribution[key]) out[map[key]] = attribution[key];
  });
  return out;
}

module.exports = { configured, upsertLead, attributionColumns };
