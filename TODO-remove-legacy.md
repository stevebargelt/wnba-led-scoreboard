# Multi-Sport Hardening

## Code Cleanup
- [x] Remove `config/favorites.json` legacy structure + any loader paths that still auto‑migrate single-sport configs.
- [x] Delete legacy-only code paths (`--legacy` flag, legacy loader wrappers, single-sport choose logic) and collapse to the multi-sport pipeline.
- [x] Trim unused assets/functions (legacy `/api/teams`, old WNBA-only helpers, etc.).

## Config & Schema
- [x] Update config schemas (web-admin + Supabase functions) to require multi-sport `sports[]` and treat legacy `favorites` as deprecated.
- [x] Simplify Python config loader: accept only multi-sport format (with optional empty favorites per sport) and remove convert-to-legacy helpers.

## Documentation
- [x] Rewrite README + supabase/README to describe multi-sport flow only (DB favorites, Build+Apply, no mention of “legacy mode”).
- [x] Update setup instructions, command examples, and screenshots to show multi-sport usage.
- [x] Remove legacy troubleshooting sections (e.g., JSON favorites editor, single-sport flags).

## Scripts & Assets
- [x] Ensure fetch scripts (WNBA/NHL) output multi-sport assets only; drop duplicates referencing `assets/teams.json`.
- [x] Update any utility scripts/tests that still expect legacy JSON.

## UI & API
- [x] Make the web-admin “Legacy Config” tab purely a JSON viewer/editor for non-favorite settings; all favorite controls should be multi-sport.
- [x] Remove any conditional UI copy referencing WNBA-only support.

## Testing
- [ ] Add/update unit/integration tests to cover multi-sport defaults; remove legacy baselines.
- [ ] Write steps for a human user to: Run through end-to-end: seed teams → configure favorites → Build + Apply → verify device render.
