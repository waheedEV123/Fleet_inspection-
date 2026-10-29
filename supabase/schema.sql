-- Vehicle Return Inspection: database setup
-- Run this once in Supabase: SQL Editor > New query > paste > Run.

-- ---------- Tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  region text,
  role text not null default 'inspector' check (role in ('inspector','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  fleet_no text primary key,
  plate text not null default '',
  emirate text not null default '',
  model text not null default '',
  powertrain text not null default 'Fuel' check (powertrain in ('Fuel','EV')),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  ref text not null,
  fleet_no text not null,
  plate text not null,
  emirate text,
  model text,
  powertrain text not null default 'Fuel',
  returned_by text not null,
  staff_email text,
  staff_mobile text,
  type text not null default 'handover',
  staff_id text,
  odometer numeric,
  energy text,
  inspector_id uuid references public.profiles(id),
  inspector_name text,
  inspector_email text,
  region text,
  inspected_at timestamptz not null default now(),
  checks jsonb not null default '{}'::jsonb,
  notes jsonb not null default '{}'::jsonb,
  damage boolean not null default false,
  photos jsonb not null default '[]'::jsonb,
  remarks text,
  created_at timestamptz not null default now()
);
create index if not exists inspections_fleet_idx on public.inspections (fleet_no, inspected_at desc);
create index if not exists inspections_date_idx on public.inspections (inspected_at desc);

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  manager_email text,
  cc text
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ---------- Helpers ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active);
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

-- The inspector name, email and region always come from the signed-in account,
-- so nobody can save an inspection under someone else's name.
create or replace function public.stamp_inspector() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  new.inspector_id := auth.uid();
  new.inspector_name := p.name;
  new.inspector_email := p.email;
  new.region := p.region;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists inspections_stamp on public.inspections;
create trigger inspections_stamp before insert on public.inspections
  for each row execute function public.stamp_inspector();

-- ---------- Row level security ----------
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.inspections enable row level security;
alter table public.settings enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (public.is_active_user());
drop policy if exists "profiles admin write" on public.profiles;
create policy "profiles admin write" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "vehicles read" on public.vehicles;
create policy "vehicles read" on public.vehicles for select to authenticated using (public.is_active_user());
drop policy if exists "vehicles admin insert" on public.vehicles;
create policy "vehicles admin insert" on public.vehicles for insert to authenticated with check (public.is_admin());
drop policy if exists "vehicles admin update" on public.vehicles;
create policy "vehicles admin update" on public.vehicles for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "vehicles admin delete" on public.vehicles;
create policy "vehicles admin delete" on public.vehicles for delete to authenticated using (public.is_admin());

drop policy if exists "inspections read" on public.inspections;
create policy "inspections read" on public.inspections for select to authenticated using (public.is_active_user());
drop policy if exists "inspections insert" on public.inspections;
create policy "inspections insert" on public.inspections for insert to authenticated with check (public.is_active_user());
drop policy if exists "inspections admin delete" on public.inspections;
create policy "inspections admin delete" on public.inspections for delete to authenticated using (public.is_admin());

drop policy if exists "settings read" on public.settings;
create policy "settings read" on public.settings for select to authenticated using (public.is_active_user());
drop policy if exists "settings admin update" on public.settings;
create policy "settings admin update" on public.settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Photo storage ----------
insert into storage.buckets (id, name, public) values ('damage-photos', 'damage-photos', false)
  on conflict (id) do nothing;

drop policy if exists "photos read" on storage.objects;
create policy "photos read" on storage.objects for select to authenticated
  using (bucket_id = 'damage-photos' and public.is_active_user());
drop policy if exists "photos upload" on storage.objects;
create policy "photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'damage-photos' and public.is_active_user());
drop policy if exists "photos admin delete" on storage.objects;
create policy "photos admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'damage-photos' and public.is_admin());
