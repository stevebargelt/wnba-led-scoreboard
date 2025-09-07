Supabase Setup

Overview
- This repo includes SQL migrations under `supabase/migrations` designed for Supabase CLI.
- Filenames must start with a 14‑digit timestamp (`YYYYMMDDHHMMSS_*.sql`) to be picked up by `supabase db push`.

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
- Ensure your project is linked (see Prereqs), then deploy the action publisher function:
  - `supabase functions deploy on-action`
  - Set function env variables in the Supabase Dashboard → Edge Functions → on-action → Settings:
    - `SUPABASE_REALTIME_URL` = `wss://<project-ref>.supabase.co/realtime/v1/websocket`
    - `SUPABASE_ANON_KEY` = your anon public key

Invoke on-action via cURL
- Replace `<project-ref>` and keys/placeholders accordingly.
- RESTART example:
  - `curl -sS -X POST \
    https://<project-ref>.functions.supabase.co/on-action \
    -H 'Content-Type: application/json' \
    -H 'apikey: <ANON_KEY>' \
    -H 'Authorization: Bearer <ANON_KEY>' \
    -d '{"device_id":"<DEVICE_ID>","type":"RESTART","payload":{"service":"wnba-led.service"}}'`
- APPLY_CONFIG example (send an entire favorites/config JSON):
  - `curl -sS -X POST \
    https://<project-ref>.functions.supabase.co/on-action \
    -H 'Content-Type: application/json' \
    -H 'apikey: <ANON_KEY>' \
    -H 'Authorization: Bearer <ANON_KEY>' \
    -d @<(echo '{"device_id":"<DEVICE_ID>","type":"APPLY_CONFIG","payload":'; cat config/favorites.json; echo '}')`
