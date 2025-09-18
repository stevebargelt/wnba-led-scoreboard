Supabase Setup

Overview
- This repo includes SQL migrations under `supabase/migrations` designed for Supabase CLI.
- Filenames must start with a 14‑digit timestamp (`YYYYMMDDHHMMSS_*.sql`) to be picked up by `supabase db push`.
- Sport favorites are stored in `public.device_sport_config`. Use the web admin (or direct API calls) to edit favorites, then invoke `on-config-build` to generate the device JSON.

Prereqs
- Install the Supabase CLI: https://supabase.com/docs/guides/cli
- Log in and link your project:
  - `supabase login`
  - `supabase link --project-ref <your-project-ref>`

Apply Migrations
- Run: `supabase db push`
  - This applies all migrations in `supabase/migrations` to your linked project.
- Alternatively, copy the contents of a migration file into the Supabase SQL Editor and execute.

Verify Schema
- In the SQL editor, run:
  - `select table_name from information_schema.tables where table_schema = 'public' and table_name in ('devices','configs','events');`
  - You should see `devices`, `configs`, and `events` listed.
- Check RLS policies under Table Editor → Row Level Security.

Notes
- These migrations reference `auth.users`, which exists in Supabase projects (Auth enabled). If you’re running locally, ensure `supabase start` has initialized Auth.
- The migration also adds `public.events` to the `supabase_realtime` publication so you can stream DB events if desired.

Deploy Edge Functions
- Ensure your project is linked (see Prereqs), then deploy:
  - `supabase functions deploy on-action`
    - Uses built-in envs `SUPABASE_URL` and `SUPABASE_ANON_KEY`; derives Realtime URL automatically.
- `supabase functions deploy on-config-write`
  - Set env variables in on-config-write Settings:
    - `SERVICE_ROLE_KEY` = your service role key (keep secret)
    - (Optional) `ANON_KEY` = your anon public key; falls back to built-in `SUPABASE_ANON_KEY`
    - No need to set a Realtime URL; it is derived from `SUPABASE_URL`.
- `supabase functions deploy on-config-build`
  - Set env variables in on-config-build Settings:
    - `SERVICE_ROLE_KEY`
    - `ANON_KEY` / `SUPABASE_ANON_KEY`
  - This function merges DB favorites with the latest config row and (optionally) calls `on-config-write`.

Invoke on-action via cURL
- Replace `<project-ref>` and keys/placeholders accordingly.
- RESTART example:
  - `curl -sS -X POST \
    https://<project-ref>.functions.supabase.co/on-action \
    -H 'Content-Type: application/json' \
    -H 'apikey: <ANON_KEY>' \
    -H 'Authorization: Bearer <ANON_KEY>' \
    -d '{"device_id":"<DEVICE_ID>","type":"RESTART","payload":{"service":"wnba-led.service"}}'`
- Build + Apply from DB favorites (`on-config-build` → `on-config-write`):
  - `curl -sS -X POST \
    https://<project-ref>.functions.supabase.co/on-config-build \
    -H 'Content-Type: application/json' \
    -H 'apikey: <ANON_KEY>' \
    -H 'Authorization: Bearer <USER_JWT>' \
    -d '{"device_id":"<DEVICE_ID>","apply":true}'`
  - Returns the merged JSON (`content`) and, when `apply=true`, persists it to `public.configs` and broadcasts `APPLY_CONFIG`.
- Preview without applying:
  - Same request with `"apply": false` to fetch the synthesized config for inspection.
- Direct apply (custom payload):
  - `curl -sS -X POST \
    https://<project-ref>.functions.supabase.co/on-config-write \
    -H 'Content-Type: application/json' \
    -H 'apikey: <ANON_KEY>' \
    -H 'Authorization: Bearer <USER_JWT>' \
    -d '{"device_id":"<DEVICE_ID>","content":{"sports":[{"sport":"wnba","enabled":true,"priority":1,"favorites":["SEA","MIN"]}]}}'`
- Mint device tokens
- Deploy the mint function:
  - `supabase functions deploy mint-device-token`
  - Env: set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `JWT_SECRET` (your project JWT secret) in the function settings
    - Note: Supabase forbids secrets starting with `SUPABASE_`, so use `JWT_SECRET`.
- Invoke to get a token (caller must be signed in and own the device):
  - `curl -sS -X POST \
    https://<project-ref>.functions.supabase.co/mint-device-token \
    -H 'Content-Type: application/json' \
    -H 'apikey: <ANON_KEY>' \
    -H 'Authorization: Bearer <USER_JWT>' \
    -d '{"device_id":"<DEVICE_ID>","ttl_days":30}'`
  - Copy the returned `token` into `/etc/wnba-led-agent.env` as `DEVICE_TOKEN` and restart the agent.
