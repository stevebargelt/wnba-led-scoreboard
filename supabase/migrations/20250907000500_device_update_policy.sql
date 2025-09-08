-- Allow device (via device-scoped JWT) to update its own row (e.g., last_seen_ts)
alter table public.devices enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='devices' and policyname='Device can update own row'
  ) then
    execute 'create policy "Device can update own row" '
         || 'on public.devices for update '
         || 'using (id = public.jwt_device_id()) '
         || 'with check (id = public.jwt_device_id())';
  end if;
end $$;
