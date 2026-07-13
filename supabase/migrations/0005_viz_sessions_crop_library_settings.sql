-- Phase 3: Venue Visualizer sessions, crop library, and the contract
-- template settings singleton. Run in the SQL Editor, same as prior migrations.
-- API key proxy work is a separate, later phase — not included here.

-- ── VIZ SESSIONS ──────────────────────────────────────────────────────────────
create table viz_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- on delete set null, NOT the Postgres default (effectively restrict) —
  -- deleting a proposal today silently leaves a session's proposalKey
  -- dangling with no error; the default FK behavior would instead BLOCK
  -- deleting any proposal that has a linked session, a new and worse
  -- failure mode that doesn't exist today. set null preserves current
  -- lenient behavior exactly.
  proposal_id uuid references proposals(id) on delete set null,
  stage text,
  venue_image_url text,
  current_image_url text,
  current_claude_desc text,
  versions jsonb not null default '[]',   -- [{thumb_url, desc}]
  callouts jsonb not null default '[]',
  from_proposal boolean not null default false,
  vza_img_url text,
  vza_items jsonb not null default '[]',  -- [{id,name,category,qty,description,region,colorIdx,added,skipped,thumb_url}]
  vza_added_count int not null default 0,
  crop_editor_visible boolean not null default false,
  crop_mode text,
  thumbnail_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── CROP LIBRARY ──────────────────────────────────────────────────────────────
create table crop_library (
  key text primary key,   -- keeps the existing invSku-or-generated-slug scheme
  name text not null,
  category text,
  image_url text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── SETTINGS (contract template) ──────────────────────────────────────────────
create table settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table viz_sessions enable row level security;
alter table crop_library enable row level security;
alter table settings enable row level security;

create policy "staff can do anything" on viz_sessions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staff can do anything" on crop_library
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staff can do anything" on settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ── GRANTS — in this migration, not a follow-up ──────────────────────────────
grant select, insert, update, delete on public.viz_sessions to authenticated;
grant select, insert, update, delete on public.crop_library to authenticated;
grant select, insert, update, delete on public.settings to authenticated;

-- ── TRIGGERS ──────────────────────────────────────────────────────────────────
create or replace function public.touch_viz_sessions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
  return new;
end; $$;
create trigger viz_sessions_touch before insert or update on viz_sessions
  for each row execute procedure public.touch_viz_sessions();

create or replace function public.touch_crop_library()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
  return new;
end; $$;
create trigger crop_library_touch before insert or update on crop_library
  for each row execute procedure public.touch_crop_library();

create or replace function public.touch_settings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end; $$;
create trigger settings_touch before insert or update on settings
  for each row execute procedure public.touch_settings();

-- ── STORAGE ───────────────────────────────────────────────────────────────────
-- Public-read, same reasoning as Phase 1's inventory-images bucket — and now
-- load-bearing for a second reason: proposal mockups are shown in the
-- client-facing printable Proposal Document, which needs a URL viewable
-- without the client authenticating.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('viz-images', 'viz-images', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "anyone can view viz images" on storage.objects for select
using (bucket_id = 'viz-images');
create policy "staff can upload viz images" on storage.objects for insert
with check (bucket_id = 'viz-images' and auth.role() = 'authenticated');
create policy "staff can replace viz images" on storage.objects for update
using (bucket_id = 'viz-images' and auth.role() = 'authenticated');
create policy "staff can delete viz images" on storage.objects for delete
using (bucket_id = 'viz-images' and auth.role() = 'authenticated');

-- ── VERIFY BEFORE DECLARING ANYTHING DONE ────────────────────────────────────
-- select grantee, table_name, privilege_type
-- from information_schema.role_table_grants
-- where table_name in ('viz_sessions','crop_library','settings')
--   and grantee = 'authenticated'
-- order by table_name, privilege_type;
