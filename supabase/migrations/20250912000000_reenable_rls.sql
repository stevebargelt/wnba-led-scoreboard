-- Re-enable RLS on multi-sport tables (in case it was disabled in development)

alter table if exists public.device_sport_config enable row level security;
alter table if exists public.game_overrides enable row level security;
alter table if exists public.sport_teams enable row level security;

-- Optional verification helpers (run manually in SQL editor):
-- select relname, relrowsecurity from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and relname in ('device_sport_config','game_overrides','sport_teams');

