# Backlog

## Active

### BL-006: Add libcairo2-dev to Pi setup dependencies
The `fetch_nhl_assets.py` script requires `cairosvg` which needs the `libcairo2-dev` system package. Add it to:
- `install_rgbmatrix.sh` apt install step
- README / setup documentation

**Likely moot after #6:** `fetch_nhl_assets.py` (the only consumer of `cairosvg`) is deleted by #6; NHL/WNBA logo fetching moves to Go (`go run ./cmd/fetch-logos`). Re-evaluate / close once #6 lands.

## Done (recent)

### BL-001: Clean up dead NHL team_assets_url endpoint — CLOSED 2026-05-27
### BL-002: Update WNBA/NHL season dates for 2026 — CLOSED 2026-05-27
### BL-003: WNBA parser reads broadcasts from wrong path — CLOSED 2026-05-27
### BL-004: NBA teams parser reads 'logo' but ESPN returns 'logos' array — CLOSED 2026-05-27
### BL-005: WNBA teams parser reads venue but ESPN doesn't include it — CLOSED 2026-05-27

## Notes for next session
**Last session ended 2026-05-28 (long session — full web-admin redesign + 4 device-side Go fixes).**

**Where we left off:** Shipped 11 commits (e62fc83 -> b21e689), all LOCAL (push hold). The web-admin redesign is COMPLETE and visually swept via browser-tools (authed, both themes). Device-side Go: #6 Python removal, #7 poll backoff, #9 brightness/timezone, #13 heartbeat, #19 final-state — all built + verified (locally where possible).

**Picked up next (open tickets, rough priority):**
1. #14 — reorder favorite teams. Full-stack: UI up/down or drag + RPC store priority-by-index (migration 005 currently writes priority=999 flat) + Go must honor favorite order in SelectGame (today favorites are an unordered set, so reordering is cosmetic until Go changes).
2. #16 — data-driven leagues / real "Add League". Go uses a STATIC fetcher registry (wnba/nhl only) in internal/sports/aggregator.go; leagues.api_config exists but is unused. ESPN API is uniform so a generic ESPN fetcher could support many leagues. Big: Go + RPC + schema.
3. #15 — dev/QA auth bypass for web-admin (mock session behind a prod-safe flag, documented in CLAUDE.md). Deferred but bit us repeatedly (can't verify authed screens in containers).
4. #11/#12 — forge workflow: build phase should route per-discipline specialists (not one generic engineer); request-changes should drive the rationale fix-list. #18 — pre-commit hook reformats repo-wide -> churn. BL-006 likely moot post-#6.

**External state to remember:**
- PUSH HOLD STILL ON (Steve, until ~2026-05-29). Branch feat/client-side-preview-v2 is far ahead of origin, never pushed. Do NOT push until Steve confirms. Reconfirm on next session.
- The Pi must `git pull` + rebuild (`go build -tags matrix`) to get the Go fixes (#7/#9/#13/#19). Until then the real device still shows offline / "4th 0 0" / old brightness — fixes are verified locally, not yet on hardware.
- #13 heartbeat verified END-TO-END locally (ran `/tmp/scoreboard-hb --sim --env ../.env` vs real Supabase; dashboard stayed Online past 90s; 60s config reloads fire). That binary was stopped, so steve-1 reads Offline again until the Pi runs the fix.
- is_active catalog data corrected LIVE via service-role PATCH: wnba/nhl=true, nba/mlb/nfl=false. Seed 003 fixed too (commit 3574d5e). Migration 005 (save_device_teams RPC) was applied to Supabase by Steve via SQL editor — saving teams works.
- Dev server running at localhost:3000 (web-admin, real creds from web-admin/.env). browser-tools Chrome on :9222 with Steve's profile, AUTHED — this authed session is the workaround for #15; use it to verify authed screens (browser-nav/eval/screenshot scripts in ~/.claude/skills/browser-tools/).
- DEVICE_ID steve-1 = 6e57af4b-6980-4e61-8ffe-417656114c96.

**Decisions worth not relitigating:**
- Redesign: 2-tab device page (Teams + Settings); one unified Teams surface; single device-creation path, NO DEVICE_TOKEN; admin role-gated via the EXISTING ADMIN_EMAILS allowlist (not a new role system); inert controls removed. "Add League" removed (inert until #16). is_active = "supported & offered" (only leagues with a Go fetcher).
- Forge specialist gotchas: generic-engineer (not frontend-specialist) drops frontend craft (#11); pre-commit hook reformats repo-wide -> revert churn with `git checkout HEAD -- <files>` (#18); specialists leak a placeholder web-admin/.env.local that breaks local login (delete it; real creds in web-admin/.env). Trivial confirmed fixes were done direct-edit + browser-tools-verified rather than via container.

**Shipped this session (11 commits):**
- e62fc83 #6 remove frozen Python; c82765d #7 poll backoff; b000898 #9 brightness+tz
- eef5b45 redesign device 2-tab; df9bdd4 foundation; fe90a3e dashboard+onboarding; 7459288 admin+polish; 96cd314 title-contrast fix; 3574d5e #17 hide disabled leagues; 7377c92 #13 heartbeat; b21e689 #19 final-state
- Tickets filed: #11-#19. Migration 005 applied to Supabase.

## Active

### #1 — Route Go scoreboard work through Forge engineer (after Go lands in container)
**Note from #6:** the matrix C-lib provisioning (`scripts/install_rgbmatrix.sh`, `librgbmatrix.a`) is Pi-only and stays OUT of the container. The container build must use the no-CGO `matrix_stub.go` path (`go build ./...`, no `-tags matrix`). Pi-only C-lib/hardware setup is tracked under #5, not here.

### #5 — Automate Pi deploy via Tailscale + GitHub Actions (replaces manual SSH workflow)
**Survivors from #6 (Python removal) this ticket must convert** — #6 deleted the Python app but deliberately LEFT these Pi-infra scripts as reusable templates. They still reference Python and will NOT work as-is:
- `scripts/systemd/wnba-led.service` — `ExecStart=.venv/bin/python app.py`; repoint at the Go binary (`scoreboard-matrix`, needs root for GPIO). No autostart on the Pi yet.
- `scripts/deploy/{deploy,health-check,rollback}.sh` — written for the venv/pip deploy; rewrite for the static Go binary (`git pull` → `go build -tags matrix` → restart unit).
- `scripts/install_rgbmatrix.sh` — builds the **Python** rgbmatrix bindings; the Go app only needs the C lib `librgbmatrix.a`. Reduce to building the C lib; drop the Python-binding + import-verify steps.
- `scripts/hardware_self_test.sh` — python3-based matrix test; convert to a Go `--sim`/hardware check or drop.

### #7 — Polling: back off API calls when no game is imminent (time-to-start-aware cadence)
**Implemented (commit `c82765d`), pending Pi live-loop verification.** `pollIntervalSec` in `cmd/scoreboard/main.go` now paces to the soonest tip-off (flat PregameSec 30m–2h out, ≤2m inside 30m, 30s inside 5m, 30m idle backoff when nothing is imminent; live still 15s, final FinalSec). Unit-tested (`poll_test.go`, 10 cases, green) + `--sim --once` render clean. NOT yet observed backing off over hours on hardware — verify after the push hold lifts and the Pi pulls. Close once confirmed live.

### #8 — Live snapshot from device — replaces removed Canvas preview

### #9 — Make Go honor brightness + timezone from device_config
**Implemented (commit `b000898`), pending Pi verification.** Timezone (pregame + idle scenes via `time.LoadLocation`, fallback system local) and brightness (runtime `led_matrix_set_brightness` after config load + SIGHUP) now honored; `SetBrightness` added to the Display interface + stub/sim. Mac build/vet/test green + `loadLocation` unit test. The `matrix.go` CGO path can't build off-Pi, so brightness-on-panel + tz display stay unverified until the Pi pulls (push hold). Update the CLAUDE.md "fields not yet honored" note once Pi-confirmed.

Decision (2026-05-28, paired with the web-admin redesign): turn two currently-inert device_config fields into real, honored controls so the redesigned Settings tab is not lying. See memory project_honored_config_fields.

Today DeviceConfig (go-scoreboard/internal/config/supabase.go) decodes matrix_config.brightness and timezone, but reloadConfig() (cmd/scoreboard/main.go) ignores both:
- Timezone (easier): app currently uses the Pi system TZ. Load time.LoadLocation(cfg.Timezone) and format game start-times (pregame countdown / start display) in that location. Fall back to system/UTC on empty or bad tz. Mind the ESPN start-time parsing gotcha (sports.parseEventTime).
- Brightness (more involved): matrix brightness is hardcoded --led-brightness=80 in internal/display/matrix.go and applied at Init via CGO. Honoring cfg.Matrix.Brightness (1-100) needs either passing it into matrix Init or a runtime SetBrightness on the rgbmatrix wrapper. Runtime is nicer since SIGHUP reload already re-reads config. Clamp/validate; ignore 0/unset.

go-scoreboard/ = direct-edit (not Forge). Should land before/with the redesign Settings-tab implementation so brightness+timezone ship as working controls. Update the CLAUDE.md "fields not yet honored" note once done.


### #10 — Add admin role + gate the global Sports & Leagues catalog
Multi-tenant gap (pre-existing): the global sports/leagues/league_teams catalog RLS guard is auth.role() = 'authenticated' (migration 002_rls_policies.sql) — ANY signed-in user can edit shared catalog data that affects ALL users' devices (delete a league, change season dates, edit the team directory).

Decision (2026-05-28): for the web-admin redesign, screen 06 (admin Sports & Leagues catalog) ships OPEN to authenticated users for now, to unblock testing. Lock it down later via this ticket.

Scope:
- Introduce an admin role — Supabase app_metadata/JWT claim, or a profiles/user_roles table.
- Gate the Admin nav item + the /admin/sports-leagues route SERVER-SIDE (route guard / RLS), not just UI hiding.
- Tighten the sports / leagues / league_teams RLS policies to require admin instead of merely authenticated.
- Implement the 403 / forbidden state already designed in frame 06.

Ref: designs/web-admin-redesign-handoff.md sections 6.5 and 11 (Q3). The 6 user-facing screens (dashboard, onboarding, teams, settings, picker) need no roles; this is catalog-curation gating only.


### #11 — Forge: feature build phase should dispatch per-discipline specialists, not one generic engineer
Observed 2026-05-28 on the web-admin redesign (run-web-admin-redesign-honest-2-tab-device-config-8ecb5c). The tech-lead plan tagged each step discipline (steps 1-4 backend, 5-6 frontend), but the feature-ui-design-provided build phase dispatched ONE generic engineer for the whole wave; the discipline tags were unused for routing. CLAUDE.md describes the intent as "engineer (specialist per step)" — mismatch. Result: the generalist twice dropped frontend craft (a11y semantics, invalid disabled-on-datalist-option duplicate-favorites bug, skipped/ignored browser-tools visual verification). Ask: make the build phase fan out per the plan discipline tags (frontend-specialist for frontend steps, backend-specialist for backend), or document that build is intentionally single-engineer. This is a Forge tooling issue, not a scoreboard-app issue.


### #12 — Forge: request-changes should drive the rationale fix-list, not a plan re-run
Observed 2026-05-28, same run. After a build gate request-changes with a detailed fix-list rationale, the follow-up build/engineer task re-anchored on the PLAN (reported "all steps already implemented"), did a visual pass, and SKIPPED the rationale fix-list entirely — the reds re-flagged the identical a11y/validation/logging issues. Ask: when a step is sent back via request-changes, the re-run task input should foreground the rationale fix-list as the work to do, not just re-run against the original plan. Forge tooling issue.


### #13 — Device shows offline in web admin — Go app has no periodic heartbeat / config poll
SYMPTOM: the web admin shows a running device as "offline". StatusBadge is online iff devices.last_seen_ts is within ~90s.

ROOT CAUSE (pre-existing, independent of #7/#9): the Go app has NO periodic heartbeat. last_seen_ts is only written as a side effect of the get_device_configuration RPC (supabase/migrations/004 lines 106-109: UPDATE devices SET last_seen_ts = NOW()). The Go app calls that RPC only inside reloadConfig() (cmd/scoreboard/main.go), which runs at STARTUP and SIGHUP only. The poll loop fetches GAMES (ESPN/NHL via refreshGames), not config. So last_seen_ts is written once at boot and never again -> the 90s freshness window reads stale ~90s after start -> online for ~1 min after a restart, then offline forever.

BIGGER IMPLICATION: the device is not polling its config after startup, contradicting the documented architecture ("60-second poll interval for configuration updates"). Config changes from the web admin (favorites, and brightness/timezone via #9) currently reach the device only on a manual SIGHUP or restart, not automatically. The offline badge is the visible symptom of that gap.

FIX (go-scoreboard, direct-edit): add a ~60s config-reload ticker to the main loop in cmd/scoreboard/main.go. Each tick calls reloadConfig() which (a) refreshes last_seen_ts via the get_device_configuration side effect -> device shows online, and (b) auto-applies config changes including d.SetBrightness (the hook added in #9). Independent of #7 game-poll backoff (this is a cheap Supabase call; #7 throttles ESPN/NHL). Use get_device_configuration (the proven anon-key path) for the heartbeat; do NOT rely on the device_heartbeat RPC — it is granted only to authenticated/service_role, not anon (migration 004 line 142), while the device authenticates with the anon key. OPTIONAL refinement: trigger refreshGames + pollC reset only when the enabled-league set actually changes, so league changes reflect promptly without re-hitting ESPN/NHL every 60s.

VERIFY: build + --sim on Mac; actual "online" can only be confirmed once the push hold lifts and the Pi pulls the new code (same pending-Pi caveat as #7/#9).


### #14 — Favorite teams: no reorder in new Teams tab (regression) + priority not persisted
SYMPTOM: the new DeviceTeamsTab has no way to reorder favorite teams (add/remove only). The old MultiSportFavoritesEditor had move up/down ordering, so this is a regression.

CROSS-STACK — reordering only becomes meaningful if all three layers carry order:
1. UI (web-admin/src/components/config/DeviceTeamsTab.tsx): add reorder controls (up/down or drag) per favorite chip/row.
2. API payload: send team_ids in the chosen order.
3. RPC (supabase/migrations/005_save_device_teams.sql): TODAY it inserts every favorite with priority=999 (flat, no order). Change to priority = array index so order is persisted in device_favorite_teams.priority (column already exists).
4. Go app: reloadConfig() (cmd/scoreboard/main.go) currently builds favorites as an UNORDERED set (map[league]map[teamID]bool), so favorite order has NO effect on SelectGame today. For reordering to actually change which favorite game is shown, Go must read favorite priority and honor it in selection.

So: a UI-only reorder would be cosmetic until the RPC persists priority AND Go honors it. Decide scope (full UI+RPC+Go, or defer). Natural to fold into the remaining web-admin redesign work + a small Go follow-up.


### #15 — Dev/QA auth bypass for web-admin (so authed flows are actually testable)
PROBLEM (root cause of the 2026-05-28 login breakage): the web-admin requires a real Supabase Auth session. Forge specialist containers have no session, so (a) their browser-tools visual verification only ever renders the login page — every authenticated screen (dashboard populated, device Teams/Settings, admin) goes visually UNVERIFIED; and (b) to make their container dev server boot, a specialist wrote web-admin/.env.local with NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co. Because /project is mounted rw, that file leaked onto the real machine and overrode web-admin/.env, breaking local login (browser posted to placeholder.supabase.co/auth/v1/token). Fixed for now by deleting the placeholder .env.local (web-admin/.env has the real creds).

PROPOSED FIX — a dev-only auth bypass:
- A mock-session path gated behind an env flag (e.g. NEXT_PUBLIC_DEV_AUTH_BYPASS=true) that injects a fake authenticated session (and optionally a couple of mock devices) so the app renders authed views WITHOUT a real Supabase session.
- HARD prod-safety: the bypass must be impossible to enable in production (guard on NODE_ENV !== production AND the explicit flag; never default-on).
- Document it in CLAUDE.md Stack section — the forge frontend-specialist seed explicitly checks there for "dev auth instructions (bypass env vars, test credentials, mock auth setup)." With it documented, specialists set the flag in-container, render authed screens, and do REAL visual verification — no need to touch Supabase config, no .env.local leak.

ALSO: instruct specialist passes to NEVER create/modify web-admin/.env.local (it is the real local config). Consider adding web-admin/.env.local.example with placeholders + a note, but never write a real/placeholder .env.local in automation.

This is what makes the rest of the redesign actually verifiable.


### #16 — Admin Add League is inert today — make leagues data-driven (api_config + generic ESPN fetcher) or remove the button
FINDING: the admin "Add League" control is currently a lying control. The Go app dispatches via a STATIC registry in go-scoreboard/internal/sports/aggregator.go (registry[code]) with only wnba -> FetchWNBA and nhl -> FetchNHL registered, each a hardcoded fetcher. An admin-added league row gets no Go fetcher -> errUnknownLeague -> the league is enabled/selectable but never displays a game on the panel.

The data model already anticipated data-driven leagues: leagues.api_config JSONB ("API configuration") exists for exactly this but is UNUSED. It is also not included in get_device_configuration, so it never reaches the device.

FEASIBILITY: ESPN APIs are uniform — WNBA = site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard; the pattern is sports/{sport}/{league}/scoreboard. A GENERIC ESPN fetcher parameterized by the sport/league slug (stored in leagues.api_config) could support NBA, MLB, NFL, NCAA, MLS, etc. with NO per-league Go code. NHL is the exception (uses the NHL stats API, not ESPN -> needs a bespoke client). Caveat: confirm ESPN scoreboard JSON is uniform enough across leagues for the existing WNBA parser (team/logo/period/status fields).

OPTIONS:
(A) SHORT TERM / honest-now: remove or disable the Add League button; admin manages only the existing supported leagues (enable/disable, season dates). Cheapest, keeps honest-controls.
(B) REAL multi-league: build the generic ESPN fetcher (api_config -> include in get_device_configuration RPC -> Go builds an ESPN fetcher from it at config-load, replacing/augmenting the static registry). Constrain Add League in the UI to ESPN-backed leagues + capture the slug into api_config. Investigate ESPN JSON uniformity first. Go + RPC + schema-wiring + web-admin work.

DECISION NEEDED (Steve, 2026-05-28): A now + B as the multi-league feature, or prioritize B. B2 (uncommitted) currently ships an Add League dialog — if A, remove/disable it before committing B2.


### #17 — Device Teams tab shows admin-disabled leagues (ignores leagues.is_active)
BUG (found 2026-05-28 in live review): a league disabled in the admin catalog (leagues.is_active = false, e.g. MLB) still appears as a toggleable card on the user-facing device Teams tab, and can be enabled for the device. The admin enable/disable flag is supposed to gate which leagues a user can configure; it is currently cosmetic on the device side.

ROOT CAUSE: GET /api/device/[id]/sports.ts builds sportConfigs from device_leagues rows (select enabled, priority, league:leagues(code)) with NO leagues.is_active filter. DeviceTeamsTab.tsx renders one card per returned sportConfig. A device with a stale device_leagues row for a now-disabled league (MLB) shows it.

FIX:
1. PRIMARY (web-admin): GET /api/device/[id]/sports must exclude leagues where leagues.is_active = false from sportConfigs — join leagues.is_active and filter to true (or filter post-query). Add a test that a disabled league is not returned. This removes MLB from the device config screen.
2. DEFENSE-IN-DEPTH (Go path): get_device_configuration RPC (supabase/migrations/004) should also exclude is_active=false leagues from enabled_leagues, so a disabled league never reaches the device even with a stale enabled device_leagues row. (New migration; orchestrator applies to Supabase. Go already errUnknownLeagues unknown codes, so this is hardening.)

RELATED: this overlaps #16 — for is_active to mean "available", the seed/admin must set is_active=true only for leagues the Go app can actually fetch (today: wnba, nhl). MLB/NBA/etc should stay is_active=false until #16 (data-driven leagues) lands. Also note: the Teams tab currently only shows leagues the device already has device_leagues rows for — it has no path to add a NOT-yet-configured active league; consider showing all is_active leagues merged with device state (separate UX gap).


### #18 — Pre-commit hook reformats repo-wide, churning already-committed files every commit
Observed repeatedly 2026-05-28: each web-admin commit runs a pre-commit format step (prettier) across the whole repo, not just staged files. It re-lowercases hex and re-wraps lines in files NOT part of the commit (e.g. globals.css, Navigation.tsx, Button.tsx, Card.tsx, seed-teams.ts), leaving them modified in the working tree after the commit. I have had to git checkout HEAD -- those files multiple times to keep commits scoped. Also a contributing factor to specialists "touching" committed files. FIX: make the pre-commit hook format ONLY staged files (lint-staged), or drop the repo-wide format step. See .husky/ + package.json scripts. Low priority but recurring friction.


### #19 — WNBA game stuck at "4th 0 0" at game end — never shows Final
BUG (seen live 2026-05-28): a WNBA game that went FINAL displayed as "4th 0 0" (4th quarter, 0:00 clock) and never showed "Final". Sibling to the Halftime bug fixed in 56fbf1a (special-cased StatusDetail=="halftime" -> "Halftime" in internal/scenes/live.go:85).

EXPECTED: when the final period ends / the game completes, the panel shows "Final" (the Final scene), not a live "4th 0:00".

ROOT CAUSE DIRECTION: state is parsed in internal/sports/wnba.go (~L124-129) from ESPN status.type.state: pre->StatePre, in->StateLive, post->StateFinal. The game was still StateLive ("in") with Period=4, DisplayClock="0:00", so the Live scene rendered "4th 0 0". Likely (a) ESPN reports state="in" at the buzzer (end-of-period / final-pending) before flipping to "post", and/or (b) the completed signal (status.type.completed==true or name=="STATUS_FINAL") is not consulted, so the transition to StateFinal is missed. "Never says final" points at the post/completed transition being missed.

FIX DIRECTION (Go, direct-edit): in the WNBA parser (and check NHL too) treat status.type.completed==true / name=="STATUS_FINAL" as StateFinal regardless of the state string; prefer fixing the STATE mapping so the Final scene shows. As a secondary guard, in scenes/live.go, a 0:00 clock at the end of the final period could render "Final"/"End 4th" instead of "4th 0 0". Repro: inspect the raw ESPN status.type (state/completed/name) for a just-completed WNBA game vs what the parser maps.


## Done (recent)

### #6 — Remove frozen Python scoreboard codebase (src/, app.py, tests/, Python scripts)
**Closed:** 2026-05-28. Commit `e62fc83`.


### #4 — Bring TS preview layouts back in sync with Go renderer (post-pregame-rework drift)
**Closed:** 2026-05-28.


### #3 — Fix TS preview to use Go's small font (04B_03B_.TTF), eliminating cross-scene font mismatch
**Closed:** 2026-05-28. Commit `a278a10`.


### #2 — Compile Go renderer to WASM for in-browser preview (eliminates TS/Go drift)
**Closed:** 2026-05-28.

**Status: deferred** — Steve approved the direction 2026-05-28 but explicitly deferred the work. Don't start without re-confirming priority.
