-- Waitlist leads from the marketing site.
--
-- One row per email. The waitlist form creates it with the email and
-- the first-touch attribution; the dog profile modal fills in the rest.
-- A lead is a row whose user_id is null. When the same email signs up
-- in the app and confirms it, the trigger below links the row to the
-- account, and from then on it is a user.
--
-- Run in the Supabase SQL editor (or `supabase db push`). The site's
-- functions write with the service role key; RLS is on with no
-- policies, so nothing else can read or write the table.

create table if not exists public.waitlist_leads (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null unique,
  owner_name         text,
  dog_name           text,
  dog_breed          text,
  dog_age            numeric(4, 1) check (dog_age is null or (dog_age >= 0 and dog_age <= 30)),
  dog_birthday_day   smallint check (dog_birthday_day is null or dog_birthday_day between 1 and 31),
  dog_birthday_month smallint check (dog_birthday_month is null or dog_birthday_month between 1 and 12),
  loves              text[] not null default '{}',
  struggles          text[] not null default '{}',
  form               text,
  utm_source         text,
  utm_medium         text,
  utm_campaign       text,
  utm_content        text,
  referrer           text,
  landing_page       text,
  -- Set when the email becomes a verified app account; null means lead.
  user_id            uuid references auth.users (id) on delete set null,
  converted_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.waitlist_leads is
  'Website waitlist signups and their starter dog profile. user_id null = lead; set = converted to a user.';

create index if not exists waitlist_leads_user_id_idx on public.waitlist_leads (user_id);

alter table public.waitlist_leads enable row level security;
-- No policies on purpose: only the service role (the site's functions) touches it.

-- Link a lead to the account the moment its email is confirmed.
create or replace function public.link_waitlist_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null
     and (tg_op = 'INSERT' or old.email_confirmed_at is null) then
    update public.waitlist_leads
       set user_id = new.id,
           converted_at = coalesce(converted_at, now()),
           updated_at = now()
     where lower(email) = lower(new.email)
       and user_id is null;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.link_waitlist_lead();
