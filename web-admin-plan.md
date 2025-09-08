Cloud‑First Admin Plan — WNBA LED Scoreboard

Premise
- Internet is required for scores, so prioritize a cloud admin. Keep on‑device work minimal: a small agent to apply cloud commands and a simple config reload path for the scoreboard.

Goals
- Manage favorites, layout, refresh, timezone, and device actions from a hosted web UI.
- Support multiple devices and remote access with authentication.
- Ensure the scoreboard keeps rendering even if cloud is briefly unavailable (uses last applied config).

Architecture (Cloud‑First)
- Frontend: Next.js or SvelteKit hosted on Vercel/Netlify.
- Backend: Supabase (Auth, Postgres, Realtime, Edge Functions).
- Device Agent (Pi): small Python process subscribing to a per‑device Realtime channel; applies config to local files and signals the scoreboard to reload; reports status heartbeats.
- Scoreboard: unchanged rendering loop; add “config reload on change” and/or a SIGHUP handler.

Data Model (Supabase)
- devices: id (uuid), name, last_seen_ts, sw_version, notes.
- configs: id, device_id (fk), content jsonb (mirrors favorites.json/env), version_ts, author_user_id, source ('cloud').
- events: id, device_id, type ('APPLY_CONFIG'|'RESTART'|'FETCH_ASSETS'|'SELF_TEST'|'PING'), payload jsonb, created_ts, actor.
- Optional: telemetry: lightweight status snapshots { mode, layout, clock, scores, errors }.
- RLS: users only see their devices; device role only reads its own commands/config and writes its own status.

Device Agent (Pi)
- Inputs: SUPABASE_URL, SUPABASE_ANON_KEY (public), DEVICE_ID, DEVICE_TOKEN (one‑time issued, exchanged for scoped JWT stored securely, 0600).
- Realtime channel: `device:<DEVICE_ID>`.
- Commands handled:
  - APPLY_CONFIG: write config/favorites.json + .env overrides; signal scoreboard to reload (SIGHUP or touch a watched file).
  - RESTART: restart scoreboard service via systemd.
  - FETCH_ASSETS: run scripts/fetch_wnba_assets.py; regenerate variants.
  - SELF_TEST: run scripts/hardware_self_test.sh and report result.
  - PING: reply with status snapshot.
- Heartbeat: every 30s update devices.last_seen_ts + minimal status event.
- Offline: queue last intended config locally and apply when back online.

Scoreboard Changes (minimal)
- Add config reload capability: on file mtime change or on SIGHUP, call load_config() and swap cfg thread‑safely between frames.
- Optional: expose a simple /health or /status HTTP JSON on localhost for diagnostics; no UI needed.

Frontend (Admin UI)
- Auth via Supabase (email magic link or OAuth).
- Pages:
  - Devices: list + register device (generate DEVICE_ID + one‑time token); copy‑paste agent env snippet.
  - Device detail: edit config (favorites with drag‑drop; layout; refresh; brightness; timezone); actions (apply, restart, fetch assets, self test); live status.
  - Optional: global presets/templates for configs.
- Apply: writes to configs table; Edge Function publishes APPLY_CONFIG to the device channel.

Edge Functions / Server Actions
- onConfigWrite: validate content, insert into configs, publish APPLY_CONFIG to `device:<id>` channel.
- onAction: publish command event with payload (restart, fetch_assets, self_test).
- Security: requires user auth; only owners can target their devices.

Security
- Supabase RLS on all tables. Separate service role key stays in Edge Functions; device only uses scoped JWT post exchange.
- No public on‑device admin UI; optional local /status on 127.0.0.1 for troubleshooting.

Phased TODOs (Cloud‑First)
1) Scoreboard readiness
   - [x] Add config reload on mtime/SIGHUP. (Implemented: file watcher + SIGHUP/USR1 in `app.py`)
   - [ ] Normalize config schema so it maps 1:1 to cloud `configs.content`. (Doc JSON schema + validation)

2) Supabase setup
   - [x] Prepare migrations in repo for tables (devices, configs, events) + RLS. (Added `supabase/migrations/20250907000000_cloud_admin.sql`)
   - [x] Apply migrations to your Supabase project. (Run `supabase db push`)
   - [x] Edge Functions: onConfigWrite (validate, insert, publish APPLY_CONFIG) (Added `supabase/functions/on-config-write`)
   - [x] Edge Functions: onAction (publish commands). (`supabase/functions/on-action`)
   - [x] Minimal publisher for testing. (CLI `scripts/publish_command.py` + Edge Function `publish-command` scaffold)
   - [x] Seed initial device (manual insert) for first bootstrap. (Follow README step‑by‑step)
   - [ ] Security: Require caller ownership in onAction (verify user owns device before broadcast)
   - [ ] CORS: Lock Edge Functions to ALLOWED_ORIGINS whitelist (local + prod domains)

3) Device Agent (Python)
   - [x] Subscribe to `device:<DEVICE_ID>`; receive commands. (Realtime scaffold + handlers)
   - [x] Implement APPLY_CONFIG, RESTART, FETCH_ASSETS, SELF_TEST, PING. (`src/agent/agent.py`)
   - [x] Heartbeat to devices.last_seen_ts; minimal status event. (Added periodic REST update + STATUS event when token present)
   - [x] Systemd unit: wnba-led-agent.service (After=network-online.target; Restart=always). (Templates added)

4) Frontend (Next.js/SvelteKit)
   - [x] Auth scaffold; devices list and detail.
   - [x] Device registration flow (create id + token; show env snippet). (Page `/register`)
   - [ ] Config editor (favorites drag‑drop, layout, refresh, brightness, TZ).
   - [x] Apply/Actions buttons; realtime status stream. (Actions + Recent Events + online badge)

5) Nice‑to‑haves
   - [ ] Preview renders (server‑side render PNG using PIL for given config).
   - [ ] Alerts when device misses heartbeats.
   - [ ] Presets for different matrix sizes/layouts.

Hosting
- Frontend on Vercel/Netlify; Supabase provides DB/Auth/Realtime.
- Device: systemd services for scoreboard and agent.

Notes
- Since internet is required for game data, a cloud admin is consistent with the dependency. The device keeps the last good config to render even if commands can’t reach it for a short time.

Next Up (concrete actions)
- Security: Require caller ownership in onAction; add ALLOWED_ORIGINS whitelist CORS to all Edge Functions.
- Config editor: favorites drag‑and‑drop, add/remove with team lookup; client‑side validate against schema before apply.
- Events UI: show last action payload/details; copy-to-clipboard on device page (done for token/env; add for DEVICE_ID too).
- Production: add scoreboard unit doc (HUP reload), restrict CORS to admin domain, prepare PR to merge feat/web-admin-cloud → main.
