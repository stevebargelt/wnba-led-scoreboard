# Backlog

## Active

### BL-006: Add libcairo2-dev to Pi setup dependencies
The `fetch_nhl_assets.py` script requires `cairosvg` which needs the `libcairo2-dev` system package. Add it to:
- `install_rgbmatrix.sh` apt install step
- README / setup documentation

## Done (recent)

### BL-001: Clean up dead NHL team_assets_url endpoint — CLOSED 2026-05-27
### BL-002: Update WNBA/NHL season dates for 2026 — CLOSED 2026-05-27
### BL-003: WNBA parser reads broadcasts from wrong path — CLOSED 2026-05-27
### BL-004: NBA teams parser reads 'logo' but ESPN returns 'logos' array — CLOSED 2026-05-27
### BL-005: WNBA teams parser reads venue but ESPN doesn't include it — CLOSED 2026-05-27

## Notes for next session
**Picked up next:** Web admin redesign (web-admin/, Next.js). User says it's "not super usable"; wants requirements/use-cases nailed down first via a PRD (/prd skill). Open with two framing questions: (1) Who's the user — just Steve with his own device(s), or multi-tenant signups? (schema has ownership+RLS but reality may be simpler). (2) What's the #1 pain — device setup, picking favorites, or not seeing what the display looks like? (client-side preview is in-flight on this branch). Critical constraint: the Go device IGNORES matrix_config, render_config, and timezone — only enabled_leagues, favorite_teams, refresh_config drive behavior. Don't design a UI exposing dead settings.

**Just shipped (2026-05-28):** Python->Go rewrite COMPLETE and hardware-verified on the Pi (led-scoreboard-3). All 7 phases on branch feat/client-side-preview-v2 (commits cf15b9e..3e74d13), NOT merged, no PR yet. Go app in go-scoreboard/ replaces the Python live-render path; Python (src/, app.py) is FROZEN. Live WNBA game renders on the LED panel with color logos, scores/clock, and "Halftime" status.

**How to work on the Go scoreboard:** READ the "Go Scoreboard (ACTIVE rewrite)" section at the top of CLAUDE.md. Work go-scoreboard/ DIRECTLY (edit source, build on Pi) — do NOT route through the Forge pipeline (containers can't reach Pi GPIO). Dev loop: edit on Mac -> go build ./... + --sim --once (read out/frame.png) -> commit/push -> ssh led-scoreboard-3, git pull, go build -tags matrix -o scoreboard-matrix ./cmd/scoreboard, sudo ./scoreboard-matrix. View renders without hardware: --sim --once on Pi, scp out/frame.png back. NEVER run go get / go mod tidy on the Pi (desyncs go.mod). Pi: ssh alias led-scoreboard-3 (IP ~192.168.68.62, mDNS flaky), Go at ~/go-sdk (use bash -lc), snd_bcm2835 blacklisted (needed for hw PWM), librgbmatrix.a at /home/pi/rpi-rgb-led-matrix/lib linked via direct CGO wrapper.

**Open follow-ups:** NHL logos don't render (different team IDs + separate nhl_logos/ dir; fetch-logos is WNBA-only). No systemd unit to auto-start on boot. Branch unmerged. Device-config matrix/render/timezone fields ignored by Go app.

**Note:** gt handoff does NOT work in this VS Code environment (needs tmux / Forge agent identity). Use `forge backlog notes` for handoffs. Cross-session context also lives in CLAUDE.md + memory (project_session_state.md, project_go_rewrite.md).

## Active

### #1 — Route Go scoreboard work through Forge engineer (after Go lands in container)

### #5 — Automate Pi deploy via Tailscale + GitHub Actions (replaces manual SSH workflow)

### #6 — Remove frozen Python scoreboard codebase (src/, app.py, tests/, Python scripts)

### #7 — Polling: back off API calls when no game is imminent (time-to-start-aware cadence)

### #8 — Live snapshot from device — replaces removed Canvas preview

## Done (recent)

### #4 — Bring TS preview layouts back in sync with Go renderer (post-pregame-rework drift)
**Closed:** 2026-05-28.


### #3 — Fix TS preview to use Go's small font (04B_03B_.TTF), eliminating cross-scene font mismatch
**Closed:** 2026-05-28. Commit `a278a10`.


### #2 — Compile Go renderer to WASM for in-browser preview (eliminates TS/Go drift)
**Closed:** 2026-05-28.

**Status: deferred** — Steve approved the direction 2026-05-28 but explicitly deferred the work. Don't start without re-confirming priority.
