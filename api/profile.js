/* POST /api/profile — the starter dog profile, filled in the modal that
   opens once a waitlist signup has gone through.

   The whole profile goes to the lead's row in Supabase (see
   supabase/migrations). Fields 1–5 (dog's name, breed, age, birthday,
   the owner's name) also go to the contact in Loops: the owner's name
   as firstName, the rest as custom properties. Fields 6 and 7 (what
   the dog loves and struggles with) live only in Supabase.

   Only the profile fields are written to Loops. The contact's source,
   UTMs, user group and list subscriptions are untouched, whichever
   contact this is. */

'use strict';

const {
  MAX_BODY_BYTES, FRIENDLY_ERROR, loops, loopsFailure, readBody,
  normaliseEmail, cleanString, maskEmail, sendJson,
} = require('./_lib/loops.js');
const supabase = require('./_lib/supabase.js');

// Custom contact properties to create in Loops before this ships:
//   dogName (string), dogBreed (string), dogAge (number),
//   dogBirthday (string, "MM-DD")
// firstName is a Loops default property and needs no setup.
const MAX_NAME = 60;
const MAX_BREED = 80;
const MAX_AGE = 30;

// The chip values the modal offers. Anything else is dropped.
const LOVES = ['walks', 'food', 'swimming', 'other dogs', 'toys', 'cuddles', 'training', 'car rides', 'other'];
const STRUGGLES = ['being left alone', 'pulling on lead', 'rainy days', 'teeth', 'weight', 'anxiety', 'grooming', 'other'];

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

  const apiKey = process.env.LOOPS_API_KEY;
  if (!apiKey || !supabase.configured()) {
    console.error('[profile] missing configuration', {
      LOOPS_API_KEY: Boolean(apiKey),
      SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
    return sendJson(res, 500, { ok: false, message: FRIENDLY_ERROR });
  }

  const logContext = { email: maskEmail(email) };

  // Supabase first: it is the store. Both writes are upserts, so a
  // retry after a failure is safe.
  try {
    await supabase.upsertLead(Object.assign(
      { email: email, form: cleanString(body.form, 40) || undefined },
      profile.row,
      supabase.attributionColumns(body)
    ));
  } catch (err) {
    console.error('[profile] supabase write failed', Object.assign({}, logContext, {
      status: err && err.status,
      error: String(err && err.message),
      detail: err && err.detail,
    }));
    return sendJson(res, 502, { ok: false, message: FRIENDLY_ERROR });
  }

  try {
    await loops(apiKey, 'PUT', '/contacts/update', Object.assign({ email: email }, profile.loops));
    console.info('[profile] saved', Object.assign({}, logContext, profile.loops));
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('[profile] loops request failed', Object.assign({}, logContext, {
      status: err && err.status,
      error: String(err && err.message),
      detail: err && err.detail,
    }));
    const failure = loopsFailure(err);
    return sendJson(res, failure.status, { ok: false, message: failure.message });
  }
};

/* Returns { loops, row } or { error }. `loops` holds the fields that go
   to the contact, only the ones with a value; `row` holds every field
   for the Supabase row, in its column names. */
function validateProfile(body) {
  const dogName = cleanString(body.dogName, MAX_NAME);
  const dogBreed = cleanString(body.dogBreed, MAX_BREED);
  const ownerName = cleanString(body.ownerName, MAX_NAME);
  if (!dogName) return { error: "Please tell us your dog's name." };
  if (!dogBreed) return { error: "Please tell us your dog's breed." };
  if (!ownerName) return { error: 'Please tell us your name.' };

  const out = { firstName: ownerName, dogName: dogName, dogBreed: dogBreed };
  const row = { owner_name: ownerName, dog_name: dogName, dog_breed: dogBreed };

  if (body.dogAge !== undefined && body.dogAge !== null && body.dogAge !== '') {
    const age = Number(body.dogAge);
    if (!Number.isFinite(age) || age < 0 || age > MAX_AGE) {
      return { error: 'Please enter an age between 0 and ' + MAX_AGE + '.' };
    }
    out.dogAge = Math.round(age * 2) / 2;
    row.dog_age = out.dogAge;
  }

  const day = Number(body.dogBirthdayDay || 0);
  const month = Number(body.dogBirthdayMonth || 0);
  if (day || month) {
    const valid = Number.isInteger(month) && month >= 1 && month <= 12
      && Number.isInteger(day) && day >= 1 && day <= DAYS_IN_MONTH[month - 1];
    if (!valid) return { error: 'Please choose a real day and month for the birthday.' };
    out.dogBirthday = String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    row.dog_birthday_day = day;
    row.dog_birthday_month = month;
  }

  row.loves = pickChips(body.loves, LOVES);
  row.struggles = pickChips(body.struggles, STRUGGLES);

  return { loops: out, row: row };
}

function pickChips(value, allowed) {
  if (!Array.isArray(value)) return [];
  return allowed.filter((option) => value.includes(option));
}
