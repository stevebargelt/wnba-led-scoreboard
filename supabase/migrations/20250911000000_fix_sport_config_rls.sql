-- Fix RLS policies for device_sport_config table

-- Drop existing policy and recreate with explicit WITH CHECK clause
drop policy if exists "Users manage sport config for own devices" on public.device_sport_config;

-- Policy for SELECT operations
create policy "Users can read sport config for own devices"
on public.device_sport_config for select
using (
  exists (
    select 1 from public.devices d
    where d.id = public.device_sport_config.device_id
      and d.owner_user_id = auth.uid()
  )
);

-- Policy for INSERT operations
create policy "Users can insert sport config for own devices"
on public.device_sport_config for insert
with check (
  exists (
    select 1 from public.devices d
    where d.id = public.device_sport_config.device_id
      and d.owner_user_id = auth.uid()
  )
);

-- Policy for UPDATE operations  
create policy "Users can update sport config for own devices"
on public.device_sport_config for update
using (
  exists (
    select 1 from public.devices d
    where d.id = public.device_sport_config.device_id
      and d.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.devices d
    where d.id = public.device_sport_config.device_id
      and d.owner_user_id = auth.uid()
  )
);

-- Policy for DELETE operations
create policy "Users can delete sport config for own devices"
on public.device_sport_config for delete
using (
  exists (
    select 1 from public.devices d
    where d.id = public.device_sport_config.device_id
      and d.owner_user_id = auth.uid()
  )
);

-- Also fix the same issue for game_overrides table
drop policy if exists "Users manage overrides for own devices" on public.game_overrides;

-- Separate policies for game_overrides
create policy "Users can read overrides for own devices"
on public.game_overrides for select
using (
  exists (
    select 1 from public.devices d
    where d.id = public.game_overrides.device_id
      and d.owner_user_id = auth.uid()
  )
);

create policy "Users can insert overrides for own devices"
on public.game_overrides for insert
with check (
  exists (
    select 1 from public.devices d
    where d.id = public.game_overrides.device_id
      and d.owner_user_id = auth.uid()
  )
);

create policy "Users can update overrides for own devices"
on public.game_overrides for update
using (
  exists (
    select 1 from public.devices d
    where d.id = public.game_overrides.device_id
      and d.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.devices d
    where d.id = public.game_overrides.device_id
      and d.owner_user_id = auth.uid()
  )
);

create policy "Users can delete overrides for own devices"
on public.game_overrides for delete
using (
  exists (
    select 1 from public.devices d
    where d.id = public.game_overrides.device_id
      and d.owner_user_id = auth.uid()
  )
);