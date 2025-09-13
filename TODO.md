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

