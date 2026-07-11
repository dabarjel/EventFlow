-- Phase 1: Inventory overrides, custom items, and images.
-- Run this in the Supabase Dashboard's SQL Editor, same as 0001_init_auth.sql.
-- No dependency on 0001 beyond auth.users/auth.role() already existing.

-- ── TABLES ────────────────────────────────────────────────────────────────────

-- Overrides layered on top of the static 775-row catalog baked into
-- inventory.js — the base catalog itself is NOT migrated, only edits to it.
create table inventory_overrides (
  sku text primary key,             -- matches inventory.js's baked-in sku (EF-0001, ...)
  name text,
  price text,
  category text,
  image_url text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- User-added rows that don't exist in the base catalog at all.
create table inventory_custom_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,         -- keeps the 'CUST-' prefix convention (addInvItemFromModal)
  name text not null,
  category text,
  price text,
  notes text,
  image_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table inventory_overrides enable row level security;
alter table inventory_custom_items enable row level security;

-- Shared org-wide data: any signed-in staff member can read/write either
-- table, same "authenticated" pattern as profiles in Phase 0. created_by/
-- updated_by give the accountability trail; they are not an access boundary.
create policy "staff can do anything" on inventory_overrides
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staff can do anything" on inventory_custom_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ── TRIGGERS ──────────────────────────────────────────────────────────────────
-- Don't trust the client to remember to stamp who/when — set it server-side
-- on every write, same reasoning as Phase 0's handle_new_user trigger.

create or replace function public.touch_inventory_override()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger inventory_overrides_touch
  before insert or update on inventory_overrides
  for each row execute procedure public.touch_inventory_override();

create or replace function public.touch_inventory_custom_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger inventory_custom_items_touch
  before insert or update on inventory_custom_items
  for each row execute procedure public.touch_inventory_custom_item();

-- ── STORAGE ───────────────────────────────────────────────────────────────────
-- Public-read bucket (matches the existing exposure level of the static
-- media rentals/ and media floral/ catalog images, already served with zero
-- auth via GitHub Pages) — write access is what's actually restricted.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inventory-images', 'inventory-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "anyone can view inventory images"
on storage.objects for select
using (bucket_id = 'inventory-images');

create policy "staff can upload inventory images"
on storage.objects for insert
with check (bucket_id = 'inventory-images' and auth.role() = 'authenticated');

create policy "staff can replace inventory images"
on storage.objects for update
using (bucket_id = 'inventory-images' and auth.role() = 'authenticated');

create policy "staff can delete inventory images"
on storage.objects for delete
using (bucket_id = 'inventory-images' and auth.role() = 'authenticated');
