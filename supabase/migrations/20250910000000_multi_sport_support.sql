-- Multi-sport support extensions for WNBA LED Scoreboard

-- Sport types enum
create type sport_type as enum ('wnba', 'nhl', 'nba', 'mlb', 'nfl');

-- Sport teams table for managing team data across all sports
create table if not exists public.sport_teams (
  id uuid primary key default gen_random_uuid(),
  sport sport_type not null,
  external_id text not null,        -- Team ID from sport's API
  name text not null,
  display_name text not null,
  abbreviation text not null,
  conference text,
  division text,
  colors jsonb default '{}',        -- {"primary": "#hex", "secondary": "#hex"}
  logo_urls jsonb default '{}',     -- {"original": "url", "mini": "url", "banner": "url"}
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  unique(sport, external_id)
);

create index if not exists sport_teams_sport_idx on public.sport_teams(sport);
create index if not exists sport_teams_active_idx on public.sport_teams(sport, is_active) where is_active = true;

-- updated_at trigger for sport_teams
drop trigger if exists trg_sport_teams_updated_at on public.sport_teams;
create trigger trg_sport_teams_updated_at
before update on public.sport_teams
for each row execute procedure public.set_updated_at();

alter table public.sport_teams enable row level security;

-- RLS policies for sport_teams (read-only for authenticated users)
drop policy if exists "Users can read sport teams" on public.sport_teams;
create policy "Users can read sport teams"
on public.sport_teams for select
to authenticated
using (true);

-- Device sport preferences (which sports are enabled per device)
create table if not exists public.device_sport_config (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  sport sport_type not null,
  enabled boolean not null default false,
  priority integer not null default 1,     -- Lower number = higher priority
  favorite_teams text[] default '{}',      -- Array of team external_ids
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  unique(device_id, sport)
);

create index if not exists device_sport_config_device_idx on public.device_sport_config(device_id);

-- updated_at trigger for device_sport_config
drop trigger if exists trg_device_sport_config_updated_at on public.device_sport_config;
create trigger trg_device_sport_config_updated_at
before update on public.device_sport_config
for each row execute procedure public.set_updated_at();

alter table public.device_sport_config enable row level security;

-- RLS policies for device_sport_config
drop policy if exists "Users manage sport config for own devices" on public.device_sport_config;
create policy "Users manage sport config for own devices"
on public.device_sport_config for all
using (
  exists (
    select 1 from public.devices d
    where d.id = public.device_sport_config.device_id
      and d.owner_user_id = auth.uid()
  )
);

drop policy if exists "Device reads own sport config" on public.device_sport_config;
create policy "Device reads own sport config"
on public.device_sport_config for select
using (device_id = public.jwt_device_id());

-- Game override logs (track manual game selections)
create table if not exists public.game_overrides (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  sport sport_type not null,
  game_event_id text not null,
  overridden_at timestamptz not null default now(),
  overridden_by_user_id uuid references auth.users(id),
  expires_at timestamptz,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists game_overrides_device_idx on public.game_overrides(device_id, overridden_at desc);
create index if not exists game_overrides_active_idx on public.game_overrides(device_id, expires_at) where expires_at > now();

alter table public.game_overrides enable row level security;

-- RLS policies for game_overrides  
drop policy if exists "Users manage overrides for own devices" on public.game_overrides;
create policy "Users manage overrides for own devices"
on public.game_overrides for all
using (
  exists (
    select 1 from public.devices d
    where d.id = public.game_overrides.device_id
      and d.owner_user_id = auth.uid()
  )
);

drop policy if exists "Device reads own overrides" on public.game_overrides;
create policy "Device reads own overrides"
on public.game_overrides for select
using (device_id = public.jwt_device_id());

-- Helper function: get current sport priorities for a device
create or replace function public.get_device_sport_priorities(target_device_id uuid)
returns table(sport sport_type, enabled boolean, priority integer, favorite_teams text[])
language sql
stable
as $$
  select 
    dsc.sport,
    dsc.enabled,
    dsc.priority,
    dsc.favorite_teams
  from public.device_sport_config dsc
  where dsc.device_id = target_device_id
  order by dsc.priority asc, dsc.sport;
$$;

-- Helper function: get active game override for a device
create or replace function public.get_active_game_override(target_device_id uuid)
returns table(sport sport_type, game_event_id text, reason text, expires_at timestamptz)
language sql
stable  
as $$
  select 
    go.sport,
    go.game_event_id,
    go.reason,
    go.expires_at
  from public.game_overrides go
  where go.device_id = target_device_id
    and go.expires_at > now()
  order by go.overridden_at desc
  limit 1;
$$;

-- Insert default sport teams data (will be populated by asset fetching scripts)
-- This is handled by the fetching scripts rather than migration

-- Grant usage on custom types
grant usage on type sport_type to authenticated;
grant usage on type sport_type to anon;