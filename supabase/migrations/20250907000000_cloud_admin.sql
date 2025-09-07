-- Supabase schema for cloud-first admin (devices/configs/events) with RLS

-- Extensions
create extension if not exists pgcrypto with schema public;

-- Helper: extract `device_id` from JWT claims (if present)
create or replace function public.jwt_device_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'device_id', '')::uuid;
$$;

-- Helper: auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- devices
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  sw_version text,
  last_seen_ts timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists devices_owner_idx on public.devices(owner_user_id);

-- updated_at trigger
drop trigger if exists trg_devices_updated_at on public.devices;
create trigger trg_devices_updated_at
before update on public.devices
for each row execute procedure public.set_updated_at();

alter table public.devices enable row level security;

-- RLS policies for devices
drop policy if exists "Users can select own devices" on public.devices;
create policy "Users can select own devices"
on public.devices for select
using (owner_user_id = auth.uid());

drop policy if exists "Device can select self" on public.devices;
create policy "Device can select self"
on public.devices for select
using (id = public.jwt_device_id());

drop policy if exists "Users can insert devices" on public.devices;
create policy "Users can insert devices"
on public.devices for insert
with check (owner_user_id = auth.uid());

drop policy if exists "Users can update own devices" on public.devices;
create policy "Users can update own devices"
on public.devices for update
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "Users can delete own devices" on public.devices;
create policy "Users can delete own devices"
on public.devices for delete
using (owner_user_id = auth.uid());

-- configs (append-only)
create table if not exists public.configs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  content jsonb not null,
  version_ts timestamptz not null default now(),
  source text not null default 'cloud' check (source in ('cloud','device')),
  author_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists configs_device_idx on public.configs(device_id, version_ts desc);

alter table public.configs enable row level security;

-- RLS policies for configs
drop policy if exists "Users read configs for own devices" on public.configs;
create policy "Users read configs for own devices"
on public.configs for select
using (
  exists (
    select 1 from public.devices d
    where d.id = public.configs.device_id
      and d.owner_user_id = auth.uid()
  )
);

drop policy if exists "Device reads own configs" on public.configs;
create policy "Device reads own configs"
on public.configs for select
using (device_id = public.jwt_device_id());

drop policy if exists "Users insert configs for own devices" on public.configs;
create policy "Users insert configs for own devices"
on public.configs for insert
with check (
  exists (
    select 1 from public.devices d
    where d.id = public.configs.device_id
      and d.owner_user_id = auth.uid()
  )
);

drop policy if exists "Device inserts own configs (device source)" on public.configs;
create policy "Device inserts own configs (device source)"
on public.configs for insert
with check (device_id = public.jwt_device_id() and source = 'device');

-- events (commands + telemetry)
create table if not exists public.events (
  id bigserial primary key,
  device_id uuid not null references public.devices(id) on delete cascade,
  type text not null check (type in ('APPLY_CONFIG','RESTART','FETCH_ASSETS','SELF_TEST','PING','STATUS')),
  payload jsonb,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists events_device_idx on public.events(device_id, created_at desc);

alter table public.events enable row level security;

-- RLS policies for events
drop policy if exists "Users read events for own devices" on public.events;
create policy "Users read events for own devices"
on public.events for select
using (
  exists (
    select 1 from public.devices d
    where d.id = public.events.device_id
      and d.owner_user_id = auth.uid()
  )
);

drop policy if exists "Device reads own events" on public.events;
create policy "Device reads own events"
on public.events for select
using (device_id = public.jwt_device_id());

drop policy if exists "Users insert events for own devices" on public.events;
create policy "Users insert events for own devices"
on public.events for insert
with check (
  exists (
    select 1 from public.devices d
    where d.id = public.events.device_id
      and d.owner_user_id = auth.uid()
  )
);

drop policy if exists "Device inserts own events" on public.events;
create policy "Device inserts own events"
on public.events for insert
with check (device_id = public.jwt_device_id());

-- Optional: expose events to Supabase Realtime (if using DB-triggered streams)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events'
  ) then
    execute 'alter publication supabase_realtime add table public.events';
  end if;
end $$;

