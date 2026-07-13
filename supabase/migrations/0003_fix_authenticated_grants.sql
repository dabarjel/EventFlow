-- Fixes a gap present in every migration so far: 0001 and 0002 both created
-- tables and RLS policies but never granted the `authenticated` role any
-- table-level privileges. In Postgres, a GRANT is checked BEFORE RLS policies
-- are ever evaluated — with no grant, every request fails with "permission
-- denied for table X" regardless of how correct the RLS policy is. This
-- affected profiles (Phase 0) as well as inventory_overrides and
-- inventory_custom_items (Phase 1) — profiles' apparent success was actually
-- _authRenderUser silently swallowing the resulting PostgREST error and
-- falling back to displaying the raw auth email (see index.html fix).
--
-- Storage (storage.objects) does NOT need this fix — Supabase pre-configures
-- its own grants as part of the Storage extension, which is why the anon-key
-- Storage upload test in Phase 1 correctly hit a real RLS policy violation
-- (403) rather than a grant-level 401. This gap is specific to tables we
-- create ourselves in the public schema.
--
-- Run this in the SQL Editor now, and treat "grant the privileges this
-- table's operations need to authenticated" as a mandatory line item on
-- every future migration (Phase 2 onward) — see the checklist note at the
-- bottom of this file.

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.inventory_overrides to authenticated;
grant select, insert, update, delete on public.inventory_custom_items to authenticated;

-- ── STANDARD STEP FOR EVERY FUTURE MIGRATION ─────────────────────────────────
-- Every `create table` for a client-writable table must be followed by an
-- explicit `grant select, insert, update, delete on <table> to authenticated`
-- (trim to just the operations the app actually performs against that table —
-- e.g. a table only ever read, never written, only needs `select`). RLS
-- policies restrict WHAT authenticated can do; the GRANT is what lets
-- authenticated touch the table AT ALL. Do not rely on assuming a previous
-- migration's grants (or Supabase's project defaults) extend to a new table
-- — they do not, as this file exists to prove. Verify with:
--
--   select grantee, table_name, privilege_type
--   from information_schema.role_table_grants
--   where table_name = '<new_table>' and grantee = 'authenticated';
--
-- before declaring a new table's RLS "verified" — a clean anon-denial test
-- is necessary but not sufficient; it does not prove authenticated access
-- actually works, only that anon is blocked.
