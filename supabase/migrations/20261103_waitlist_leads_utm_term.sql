-- The Meta ad set behind a signup.
--
-- Meta ads carry utm_term={{adset.id}} in their URL parameters; the site
-- stores it here beside the other first-touch UTMs, so the paid growth
-- reports can show sign-ups per ad set. It is written to Supabase only,
-- not to Loops.
--
-- Run in the Supabase SQL editor. Safe to run twice.

alter table public.waitlist_leads add column if not exists utm_term text;
