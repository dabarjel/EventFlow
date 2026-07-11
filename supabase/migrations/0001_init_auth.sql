-- Phase 0: auth only. No business tables yet — those land in later phases
-- (inventory overrides in phase 1, clients/proposals/payments in phase 2,
-- venue visualizer in phase 3). Run this in the Supabase Dashboard's SQL
-- Editor (Project → SQL Editor → New query), or via `supabase db push` if
-- you're using the CLI.

create extension if not exists pgcrypto;

-- One row per invited staff account, keyed to auth.users. Holds just the
-- display name shown in the sidebar — everything else about the user lives
-- in Supabase's own auth.users table.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Shared org-wide data model: any signed-in staff member can see every
-- profile (needed to show "who created/edited this" attribution once later
-- phases add created_by columns), but can only edit their own row.
create policy "profiles are readable by any signed-in staff member"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Auto-create a profiles row the moment a new auth.users row appears (i.e.
-- when you invite someone from the Dashboard or they accept the invite).
-- display_name defaults to the part of their email before the @ sign;
-- rename it any time via `update profiles set display_name = '...' where id = '...'`.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
