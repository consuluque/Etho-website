-- Business partner enquiries from the partners page (etho.pet/partners).
--
-- One row per submission of the partner form, which replaced the
-- Typeform. Nothing here is synced to Loops: the answers live in this
-- table only. The same business may submit twice, so email is not
-- unique; read the newest row.
--
-- Run in the Supabase SQL editor (or `supabase db push`). The site's
-- /api/partner function writes with the service role key; RLS is on
-- with no policies, so nothing else can read or write the table. Safe
-- to run twice.

create table if not exists public.partner_leads (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  email                   text not null,
  phone                   text,
  -- "Approximately how many extra bookings/customers per week?"
  -- One of '0–5', '6–10', '11–20', '21–30', '30+'; null when skipped.
  weekly_bookings_wanted  text,
  -- "How do you currently take bookings?" Any of: online booking
  -- platform, website, whatsapp, phone calls, instagram/dms, email, other.
  booking_methods         text[] not null default '{}',
  -- The box is required, so this is always true; kept with its time as
  -- the record that they agreed to be contacted.
  consent                 boolean not null default false,
  consent_at              timestamptz,
  -- Which button opened the form: hero, footer or sticky.
  form                    text,
  utm_source              text,
  utm_medium              text,
  utm_campaign            text,
  utm_content             text,
  utm_term                text,
  referrer                text,
  landing_page            text,
  created_at              timestamptz not null default now()
);

comment on table public.partner_leads is
  'Business partner enquiries from the partners page form. One row per submission; not synced to Loops.';

create index if not exists partner_leads_email_idx on public.partner_leads (lower(email));
create index if not exists partner_leads_created_at_idx on public.partner_leads (created_at desc);

alter table public.partner_leads enable row level security;
-- No policies on purpose: only the service role (the site's functions) touches it.
