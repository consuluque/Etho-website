-- Sign-up attempts per connection, for the waitlist's rate limit.
--
-- /api/waitlist records one row per sign-up it accepts and refuses a
-- connection that already has too many in the last hour (see
-- RATE_LIMIT in api/waitlist.js). The IP address is never stored: only
-- a keyed hash of it, which cannot be turned back into the address.
--
-- Until this has been run, the function skips the limit and signups
-- work as before. Run in the Supabase SQL editor. Safe to run twice.

create table if not exists public.waitlist_attempts (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);

create index if not exists waitlist_attempts_ip_hash_created_at
  on public.waitlist_attempts (ip_hash, created_at);

-- The functions use the service role key; nothing else may read or write.
alter table public.waitlist_attempts enable row level security;
