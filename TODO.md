Multi-Sport Favorites: Remove Legacy JSON Favorites

Context
- Today, team favorites exist in two places:
  - Legacy JSON pushed to devices via on-config-write → `config/favorites.json`
  - Multi-sport DB tables (`public.device_sport_config`) managed by the web-admin Sport Favorites tab.
- The device agent only consumes JSON it receives (APPLY_CONFIG). It does not query DB directly.

Goal
- Treat DB (`device_sport_config`) as the single source of truth for sport favorites.
- Remove favorites from the legacy JSON path and UI to avoid drift/duplication.

Tasks
1) Server synthesis from DB → JSON (required for devices)
   - Add a server function/endpoint that builds a merged JSON config from `device_sport_config` for a device.
     - Option A: New Edge Function `on-config-build` that:
       - Authenticates user.
       - Reads latest `public.configs` row for base (or defaults).
       - Reads `public.device_sport_config` rows for device and synthesizes the multi-sport `sports` section.
       - Returns/optionally calls `on-config-write` to persist + broadcast APPLY_CONFIG to device.
     - Option B: Expand `on-config-write` to optionally pull/override favorites from DB when a flag is set (e.g., `{ use_db_favorites: true }`).
   - Include priority ordering and `favorite_teams` arrays per sport in the synthesized JSON.

2) JSON schema and loader
   - Update `web-admin/src/lib/schema.ts` and `supabase/functions/on-config-write/index.ts` JSON schema to:
     - Make `favorites` optional in legacy format.
     - Support multi-sport `sports` section but allow missing/empty `favorites` when DB is authoritative.
   - Update `src/config/multi_sport_loader.py` to:
     - Handle configs where favorites are absent (no errors; empty list).
     - Avoid migrating/serializing favorites back into legacy JSON.

3) Web-admin UI
   - Legacy Config tab: fully remove the favorites editor (done) and any buttons that sync favorites into JSON.
   - Keep JSON text editor for non-favorite settings (matrix/refresh/render/timezone).
   - Add a “Build + Apply From DB Favorites” action that calls Task #1 (server synthesis) to produce and push JSON to device.

4) Device agent/docs
   - No code change required on the agent; it continues to apply whatever JSON it receives.
   - Update README and `supabase/README.md` to state: favorites are stored in DB; JSON favorites are deprecated and ignored.

5) Data migration (optional)
   - For existing configs that still have `favorites` in JSON, provide a one-time helper to write those into `device_sport_config` (id/abbr/name resolution), then strip from JSON.

Validation
- Save favorites in Sport Favorites tab → run “Build + Apply From DB Favorites” → device receives JSON with `sports[].favorites` derived from DB and reflects changes.
- Verify on-config-write accepts JSON without legacy `favorites` and that loader in Python tolerates missing favorites.

Risks/Notes
- Until Task #1 is implemented, devices won’t see DB-only favorites without manually building/sending JSON.
- Keep RLS intact; server-side synthesis must authenticate and verify device ownership.

Details / Decisions
- Final JSON target + precedence
  - Device consumes a single JSON payload with: `sports[]` (each: `sport`, `enabled`, `priority`, `favorites`), plus `timezone`, `matrix`, `refresh`, `render`.
  - Precedence rules:
    - Favorites: come only from DB (`device_sport_config`). Ignore any `favorites` present in legacy JSON.
    - Non-favorite settings (timezone/matrix/refresh/render): take from latest `public.configs` row; fall back to defaults if missing.
    - Manual overrides: remain in DB (`game_overrides`); not serialized into JSON unless explicitly required later.
- Triggering synthesis
  - Provide a dedicated “Build + Apply From DB Favorites” action in web-admin.
  - Optionally add “Apply after Save Favorites” toggle to auto-trigger synthesis on save.
  - Make it explicit in UI if DB saved changes are pending application to device.
- Web-admin UX
  - Place the “Build + Apply From DB Favorites” button on the device page (near Legacy Config section header) and/or within Sport Favorites header.
  - Show a read-only “Effective Config Preview” (rendered JSON) before applying.
  - Display last applied timestamp and online status (from `events` and `devices.last_seen_ts`).
- Schema and validation
  - Update JSON schema (client + function) to make `favorites` optional.
  - Validate per-sport object: `sport` enum, `enabled` bool, `priority` integer >= 1, `favorites` array allowed to be empty/omitted.
  - Identifier resolution on synthesis: prefer team `id`; fallback to `abbreviation`; lastly `name`. Log/warn when falling back.
- Synthesis function spec
  - Input: `device_id`; optional flags `{ apply?: boolean, override_non_favorites?: boolean }`.
  - Reads: latest `public.configs` (base), `public.device_sport_config` (favorites/buttons), optionally `game_overrides` for display status only.
  - Output: merged JSON; if `apply=true`, call `on-config-write` with merged content and return result incl. broadcast status.
  - Auth: verify ownership via user JWT; service role only for server-to-DB steps (never exposed to client).
- Migration & rollout
  - Helper tool to migrate existing legacy JSON `favorites` → DB rows (resolve identifiers to `id` when possible), then strip `favorites` from JSON.
  - Clear UI copy: “Favorites are managed in Sport Favorites. Legacy favorites are deprecated and ignored.”
  - Rollback: on synthesis/apply failure, do not overwrite last good config; surface error in UI and insert an `events` row.
- Testing & observability
  - Unit tests for: identifier resolution, empty DB, unknown teams, synthesis precedence, default fallback.
  - Integration: end-to-end “Save Favorites → Build + Apply → Agent receives APPLY_CONFIG and writes file”.
  - Logging: function logs + `events` inserts for APPLY_CONFIG attempts and outcomes.
- Data readiness & seeding
  - Ensure `sport_teams` is populated in each environment (seed script/admin page). Required fields: `id`, `name`, `abbreviation`; optional: `conference`, `division`.
- Security / RLS
  - Confirm only device owners can synthesize/apply for that device. Devices only read their `configs` and insert `events` via device-scoped JWT.
  - Service role usage is limited to server-side routes/functions.
- Cleanup tasks
  - Remove `web-admin/src/pages/api/teams.ts` and any direct legacy fallbacks once `/api/sports` is reliable.
  - Remove JSON favorites handling in Python loader (or keep tolerant but no-op) after synthesis flow is live.
- Documentation
  - Diagram the flow: DB favorites → synthesis → on-config-write → Realtime → agent → `config/favorites.json`.
  - Document required env vars for web-admin and functions (`SUPABASE_URL`, anon/service role keys, etc.).

Acceptance Criteria
- Web-admin can build and apply a JSON config for a device entirely from DB favorites.
- Applied JSON contains per-sport `favorites` from DB and non-favorite settings from latest saved JSON or defaults.
- Devices reflect new favorites after “Build + Apply” (agent writes `config/favorites.json`).
- Legacy JSON `favorites` are ignored without breaking existing non-favorite settings.
- `/api/sports` is the single source for team lists (DB first, asset fallback); no code reads `assets/teams.json` directly.
- RLS rules enforced: owners only; device-scoped JWT works for agent event updates.
- Documentation updated: users know to manage favorites in the Sport Favorites tab.

Next Implementation Steps (with Verification)

1) Relax JSON Schema (favorites optional)
- Work:
  - Update web-admin schema at `web-admin/src/lib/schema.ts` to remove `required: ['favorites']`.
  - Update `supabase/functions/on-config-write/index.ts` schema similarly (do not require `favorites`).
- Verify:
  - In web-admin, open “Configuration JSON”, remove the `favorites` array, and click Apply Config.
  - Expect 200 from on-config-write and APPLY_CONFIG received by the agent.

2) Effective Config Preview (DB → JSON, no apply)
- Work:
  - Add a “Preview Effective Config” button next to “Load Latest Config”.
  - Call `on-config-build` with `{ apply: false }` and render returned JSON in the editor.
- Verify:
  - Click Preview; JSON shows merged DB favorites + base settings without pushing to device.
  - Then click “Build + Apply From DB Favorites” and confirm the diff matches the preview.

3) Auto-Apply After Save (optional)
- Work:
  - Add a toggle in Sport Favorites: “Auto-apply after Save Favorites”.
  - After successful PUT to `/api/device/[id]/sports`, call `on-config-build { apply: true }`.
- Verify:
  - Save Favorites with toggle on → device receives APPLY_CONFIG; editor shows updated JSON.

4) Admin-only UI controls
- Work:
  - Hide “Seed Teams” button for non-admins by checking `ADMIN_EMAILS` against `user.email` client-side.
- Verify:
  - Non-admin: button hidden; Admin: button visible and works.

5) Remove legacy teams endpoint
- Work:
  - Remove `web-admin/src/pages/api/teams.ts` and any invocations; rely solely on `/api/sports`.
- Verify:
  - Sport Favorites loads teams via `/api/sports`; suggestions work; no 404 for `/api/teams`.

6) Migration helper (legacy JSON → DB favorites)
- Work:
  - Add an admin action that reads latest `public.configs.content.favorites`, resolves identifiers, and upserts into `device_sport_config`.
  - Optionally strip favorites from JSON on the next apply.
- Verify:
  - Run the helper for a device with legacy favorites; rows appear in `device_sport_config` and Build + Apply uses them.

7) Code hygiene: ESLint hook deps
- Work:
  - Fix missing dependency warnings in Favorites editor and SportManagement (`useEffect` deps / `useCallback`).
- Verify:
  - `npm run lint` shows no hook dependency warnings in those files.

8) Observability
- Work:
  - Insert `events` rows from `on-config-build` for attempts/success/failure.
  - Show last `CONFIG_APPLIED` time in the device page header.
- Verify:
  - Click Build + Apply → new event is visible; last applied time updates.

9) Docs update
- Work:
  - README and supabase/README.md: document DB-sourced favorites, Build/Preview/Apply flow, env vars for web-admin and functions.
- Verify:
  - A new dev can seed teams, configure favorites, preview, and apply to a device following the docs.
6) Deprecate legacy `assets/teams.json` (use per-sport files)
- Replace all consumers of `assets/teams.json` with sport-specific files:
  - WNBA: `assets/wnba_teams.json`
  - NHL: `assets/nhl_teams.json`
- Web-admin:
  - Remove or refactor `web-admin/src/pages/api/teams.ts` (legacy endpoint reading `assets/teams.json`).
  - Ensure `/api/sports` is the single source for team lists (already supports DB + asset fallback).
  - Update `useMultiSportTeams` to rely on `/api/sports` only; drop any direct/legacy fallback to `teams.json`.
- Python/scripts:
  - Ensure fetch scripts populate per-sport files; remove references to `assets/teams.json` in scripts and README.
- Cleanup:
  - Remove `assets/teams.json` from the repo once no code references remain.
  - Update documentation (README and supabase/README.md) to reference per-sport files and `/api/sports`.
