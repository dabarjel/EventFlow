-- Phase 2: CRM clients, proposals, and payments.
-- Run this in the Supabase Dashboard's SQL Editor, same as prior migrations.
-- No legacy_id/legacy_key columns — clean start, no existing data to map
-- (confirmed: all prior localStorage data across every device tested was
-- fake/test data, nothing worth preserving).

-- ── CLIENTS ───────────────────────────────────────────────────────────────────
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  initials text,
  color text,
  type text,
  event_date text,
  value numeric not null default 0,
  status text,
  source text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── PROPOSALS ─────────────────────────────────────────────────────────────────
create table proposals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  client_name text not null,         -- denormalized snapshot at save time, matches current behavior
  status text not null default 'draft',
  total numeric not null default 0,
  fields jsonb not null default '{}',   -- child/phone/email/venue/colors/planner/adults/kids/pickup/notes
  schedule jsonb not null default '[]',
  ship_rate numeric,
  tax_rate numeric,
  deposit numeric,
  items jsonb not null default '[]',    -- always a full-array rewrite, never per-item CRUD — same reasoning as Phase 1's inventory items
  mockup_image_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── PROPOSAL PAYMENTS ─────────────────────────────────────────────────────────
create table proposal_payments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  amount numeric not null,
  note text,
  paid_on date,                      -- one real date column — replaces the old display-string/ISO-string pair
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table clients enable row level security;
alter table proposals enable row level security;
alter table proposal_payments enable row level security;

create policy "staff can do anything" on clients
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staff can do anything" on proposals
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staff can do anything" on proposal_payments
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ── GRANTS — in the same migration this time, per the Phase 1 lesson ─────────
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.proposals to authenticated;
grant select, insert, update, delete on public.proposal_payments to authenticated;

-- ── TRIGGERS (created_by/updated_by, same pattern as Phase 1) ────────────────
create or replace function public.touch_clients()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
  return new;
end; $$;
create trigger clients_touch before insert or update on clients
  for each row execute procedure public.touch_clients();

create or replace function public.touch_proposals()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
  return new;
end; $$;
create trigger proposals_touch before insert or update on proposals
  for each row execute procedure public.touch_proposals();

create or replace function public.touch_proposal_payments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
  return new;
end; $$;
create trigger proposal_payments_touch before insert or update on proposal_payments
  for each row execute procedure public.touch_proposal_payments();

-- ── VERIFY BEFORE DECLARING ANYTHING DONE ────────────────────────────────────
-- select grantee, table_name, privilege_type
-- from information_schema.role_table_grants
-- where table_name in ('clients','proposals','proposal_payments')
--   and grantee = 'authenticated'
-- order by table_name, privilege_type;
