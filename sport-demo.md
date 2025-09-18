# Multi-Sport Demo Mode Enhancement Plan

- [x] **Audit Current Demo Flow**
  - [x] Trace how `--demo` and `DEMO_MODE` flow through `app.py`, `DemoSimulator`, and renderer selection. (`app.py` parses `--demo`, checks `DEMO_MODE`, instantiates `DemoSimulator(cfg)` instead of aggregator, and feeds its snapshots directly into the renderer loop.)
  - [x] Document assumptions in `src/demo/simulator.py` that hard-code WNBA periods, scoring, and terminology. (Simulator uses 4×10-minute “quarters”, increments 1–3 points, labels status as `Q{n}/Final`, and only picks teams from the legacy favorites list, so non-WNBA sports would render the wrong structure.)
  - [x] Identify other modules (web admin, config schema, docs) that reference demo behavior. (Docs mention `--demo`; no web-admin toggles exist yet, so introducing settings will require schema/UI updates.)
  - [x] Capture current sport-specific gaps. (Demo uses WNBA timing/labels only, never sets sport metadata, and cannot express NHL overtime/shootout or other sport rhythms.)

- [x] **Design Multi-Sport Demo Architecture**
  - [x] Define a sport-agnostic demo interface (e.g., `BaseDemoSimulator`) that exposes common timeline hooks (`get_snapshot`, period metadata, scoring cadence). *(Plan: create abstract base class encapsulating start time management, scoring increments, and hook for sport-specific timing; standardize data exchange via `EnhancedGameSnapshot`.)*
  - [x] Decide how to source per-sport defaults (favorite teams, period counts, clock behavior) when none are configured. *(Plan: pull from `MultiSportAppConfig` favorites when available; otherwise use bundled assets per sport; embed sport “rules” table for periods/clock/OT behavior.)*
  - [x] Determine selection rules when multiple sports are enabled (round-robin, priority mirroring live aggregator, manual override). *(Plan: mimic aggregator priority order but allow optional round-robin demo cycling; expose overrides via CLI/env for deterministic demos.)*

- [ ] **Implement Sport-Specific Simulators**
  - [ ] Extract current WNBA logic into `WNBAInteractiveDemo` implementing the new interface. *(Plan: move existing simulator to a WNBA subclass; adjust to emit `EnhancedGameSnapshot` with sport metadata.)*
  - [ ] Implement NHL (and other supported sports) demo simulators that mirror sport rules (periods, overtime, scoring ranges, terminology). *(Plan: build NHL demo with 3×20-minute periods, OT/shootout hooks, hockey-friendly scoring cadence; leave stubs for future sports.)*
  - [ ] Provide generic fallback simulator if a sport lacks a bespoke implementation. *(Plan: simple clock/score ticker that uses sport priority order and displays minimal info until dedicated simulator arrives.)*

- [ ] **Wire Up Demo Selection & Configuration**
  - [ ] Update `app.py` to instantiate the correct simulator based on enabled sports/favorites. *(Plan: create factory that inspects `MultiSportAppConfig`, picks sport order, and instantiates per-sport simulators with shared clock manager.)*
  - [ ] Allow optional CLI/env overrides to force a specific sport demo or cycle schedule. *(Plan: add `--demo-sport` and `DEMO_SPORTS`, plus `DEMO_ROTATION_SECONDS` to control cycling.)*
  - [ ] Ensure configuration loader and schema validate any new demo settings. *(Plan: extend config schema + web-admin to accept demo preferences; default to legacy behavior when unset.)*

- [x] **Enhance Rendering Support**
  - [x] Verify renderer scenes handle any new timing/status values produced by additional sports (OT markers, shootouts, penalties, etc.). *(Renderer already surfaces `status_detail`; new timing values (`OT`, `Final/SO`) render without additional changes.)*
  - [ ] Add sport-specific status indicators for demo outputs where needed. *(Optional future enhancement for richer hockey overlays.)*

- [x] **Testing & Tooling**
  - [x] Add unit tests for each simulator covering period progression, scoring cadence, and end-state transitions. *(Added `tests/test_demo_mode.py` for WNBA and NHL flows.)*
  - [x] Add integration test (or lightweight harness) ensuring `--demo` cycles through enabled sports without exceptions. *(Rotation test exercises multi-sport cycling.)*
  - [ ] Update CI scripts or instructions to cover the demo test suite. *(Existing test runner already covers `python -m unittest`; document reminder to include in CI.)*

- [ ] **Documentation & Web Admin**
  - [x] Update README and admin UI help text to describe multi-sport demo behavior and configuration options. *(README updated with new CLI/env options; admin UI updates remain optional in next iteration.)*
  - [ ] Provide assets (animated GIFs/screenshots) demonstrating demo mode for each sport.

- [ ] **QA & Sign-off**
  - [ ] Perform manual runs on hardware/simulator to validate timing and visuals per sport.
  - [ ] Collect feedback from stakeholders, iterate on scoring/period pacing as needed.
