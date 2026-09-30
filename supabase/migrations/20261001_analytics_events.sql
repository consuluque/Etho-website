-- First-party analytics events, with no vendor and no cookies.
--
-- One table for every surface, told apart by `source`: 'website' for the
-- marketing site (event names start with waitlist_), 'app' for the app
-- (event names start with app_). `session_id` is a random id per page
-- visit, never stored in a cookie, so a funnel can be followed within a
-- visit and nothing follows a person between visits.
--
-- Run in the Supabase SQL editor. The site's function writes with the
-- service role key; RLS is on with no policies.

create table if not exists public.analytics_events (
  id         bigint generated always as identity primary key,
  source     text not null check (source in ('website', 'app')),
  event      text not null,
  props      jsonb not null default '{}'::jsonb,
  session_id text,
  page       text,
  created_at timestamptz not null default now()
);

comment on table public.analytics_events is
  'First-party analytics. source: website (waitlist_* events) or app (app_* events). session_id is per page visit, not a cookie.';

create index if not exists analytics_events_source_event_idx
  on public.analytics_events (source, event, created_at desc);
create index if not exists analytics_events_session_idx
  on public.analytics_events (session_id);

alter table public.analytics_events enable row level security;
-- No policies on purpose: only the service role writes, and reads happen in the dashboard.
