# Plan: Client-Side LED Scoreboard Preview

## Dependency Graph

```
                    types.ts
                   /   |    \
                  /    |     \
            fonts.ts  logos.ts  demo-data.ts
                \      |      /
                 \     |     /
                  display.ts
                      |
                  scenes.ts
                      |
                  generator.ts
                      |
               DisplayPreview.tsx
```

**Key dependencies:**
- `types.ts` has no dependencies — everything else imports from it
- `display.ts` depends on types only (Canvas abstraction)
- `fonts.ts` is standalone (web font loading, no TS imports)
- `logos.ts` depends on types only (image loading + cache)
- `scenes.ts` depends on display, logos, types (the core rendering)
- `generator.ts` depends on scenes, display, types (orchestration)
- `demo-data.ts` depends on types only
- `DisplayPreview.tsx` depends on generator, demo-data, types
- Font files need to exist in `web-admin/public/` before fonts.ts can load them

**External dependencies on main:**
- Logo assets: `assets/logos/variants/` and `assets/nhl_logos/` must be symlinked or copied into `web-admin/public/`
- Font assets: `assets/fonts/pixel/` TTF/OTF files must be copied into `web-admin/public/`
- `supabaseClient.ts` already exists in `web-admin/src/lib/`
- UI components (Card, Button, Tabs) already exist in `web-admin/src/components/ui/`
- Device page at `web-admin/src/pages/device/[id].tsx` already imports DisplayPreview

## Vertical Slices

Each task delivers a working, testable increment. No task depends on an unfinished task — each builds on the completed output of the previous one.

---

### Task 1: Foundation — Types, Display, and Font Assets

**What:** Create `types.ts` and `display.ts` (the Canvas abstraction), copy font files to `web-admin/public/assets/fonts/pixel/`, create `fonts.ts` web font loader. This is the foundation everything else builds on.

**Files created:**
- `web-admin/src/lib/preview/types.ts`
- `web-admin/src/lib/preview/display.ts`
- `web-admin/src/lib/preview/fonts.ts`
- `web-admin/public/assets/fonts/pixel/04B_24__.TTF` (copy)
- `web-admin/public/assets/fonts/pixel/score_large.otf` (copy)

**Acceptance criteria:**
- `GameState`, `TeamInfo`, `GameSnapshot`, `DisplayConfig` types defined, matching Python `src/model/game.py` fields
- `ClientDisplay` class wraps `HTMLCanvasElement` with: `clear()`, `drawText()`, `drawImage()`, `drawRectangle()`, `getTextWidth()`, `toDataURL()`
- `loadPreviewFonts()` loads both pixel fonts via FontFace API, returns success/failure
- Font files exist in public directory and are servable by Next.js
- Unit tests: ClientDisplay creates canvas with correct dimensions, clear fills with color, toDataURL returns PNG data URL
- Unit tests: font loader handles success and failure cases

**Verification:**
```bash
cd web-admin && npm test -- --testPathPattern='preview/(display|fonts|types)'
```

---

### Task 2: Logo Loading and Asset Setup

**What:** Create `logos.ts` (logo loader with cache), ensure logo assets are accessible from the web admin. The logo loader needs to resolve sport-specific paths and cache loaded images.

**Files created:**
- `web-admin/src/lib/preview/logos.ts`
- Symlink or copy logo assets into `web-admin/public/assets/` (logos/, nhl_logos/ directories)

**Acceptance criteria:**
- `loadTeamLogo(teamId, abbr, sport, variant)` returns `HTMLImageElement | null`
- Tries variant path first: `/assets/logos/variants/{id}_{variant}.png`
- Falls back to sport-specific paths (WNBA: `/assets/logos/{id}.png`, NHL: `/assets/nhl_logos/{ABBR}.png`)
- In-memory cache: same args return cached image, no re-fetch
- `clearLogoCache()` exported for testing
- Graceful failure: returns null on load error (no throw)
- Unit tests: cache hit returns same reference, cache miss loads, error returns null

**Verification:**
```bash
cd web-admin && npm test -- --testPathPattern='preview/logos'
```

---

### Task 3: Demo Data — Multi-Sport Snapshots

**What:** Create `demo-data.ts` with hardcoded game snapshots for WNBA and NHL. These are used by the preview component to render each scene type.

**Files created:**
- `web-admin/src/lib/preview/demo-data.ts`

**Acceptance criteria:**
- `createDemoPregameSnapshot(sport?)` — defaults to WNBA (PHX vs LA, team IDs 11 and 6)
- `createDemoLiveSnapshot(sport?)` — WNBA live Q3 5:42, scores 72-68
- `createDemoFinalSnapshot(sport?)` — WNBA final, scores 89-82
- NHL variants use real team abbreviations with IDs from `nhl_teams.json` (e.g., BOS vs MTL)
- All snapshots conform to `GameSnapshot` type
- Unit tests: each factory returns valid snapshot with correct state, non-empty fields

**Verification:**
```bash
cd web-admin && npm test -- --testPathPattern='preview/demo-data'
```

---

### CHECKPOINT 1: Foundation Complete

At this point, types + display + fonts + logos + demo-data are all built and tested independently. Nothing renders a scene yet, but all the building blocks are proven.

**Gate:** All tests pass, fonts load in a browser (manual check via dev server).

---

### Task 4: Scene Rendering — Idle + Live Stacked

**What:** Create `scenes.ts` with `renderIdleScene` and `renderLiveStacked`. These are the two simplest scenes and validate that the rendering pipeline (display + fonts + logos + scenes) works end-to-end.

**Files created:**
- `web-admin/src/lib/preview/scenes.ts` (partial — idle + live stacked)

**Acceptance criteria:**
- `renderIdleScene(display)`: black background, date + "No games" at (1,1), gray, font_small
- `renderLiveStacked(display, snapshot)`: matches Python `draw_live` exactly — row_h=12, top_y=1, bot_y=13, logo_x=1, abbr_x=13, scores right-aligned, status centered at bottom in green
- Logo loading integrated (async functions, placeholder rectangles on failure)
- Unit tests: both scenes render without throwing, canvas operations called with correct coordinates/colors

**Verification:**
```bash
cd web-admin && npm test -- --testPathPattern='preview/scenes'
```

---

### Task 5: Scene Rendering — Pregame, Final, Live Big

**What:** Add remaining three scene renderers to `scenes.ts`.

**Files modified:**
- `web-admin/src/lib/preview/scenes.ts` (add pregame, final, live big)

**Acceptance criteria:**
- `renderPregameScene(display, snapshot)`: matches Python `draw_pregame` — logos left/right, "VS" center, countdown timer centered, start time bottom
- `renderFinalScene(display, snapshot)`: matches Python `draw_final` — "FINAL" at (1,1) in red, stacked layout, no bottom status
- `renderLiveBigLogos(display, snapshot)`: matches Python `draw_live_big` — status top, logos left/right, scores between with adaptive sizing, abbreviations under logos
- Unit tests for each scene: correct coordinates, colors, font assignments

**Verification:**
```bash
cd web-admin && npm test -- --testPathPattern='preview/scenes'
```

---

### Task 6: Generator + Index + Integration

**What:** Create `generator.ts` (PreviewGenerator orchestrator), `index.ts` (public exports), and wire everything together. Write integration tests that generate all scene types end-to-end.

**Files created:**
- `web-admin/src/lib/preview/generator.ts`
- `web-admin/src/lib/preview/index.ts`

**Acceptance criteria:**
- `PreviewGenerator.generatePreview(config, snapshot, canvas?)` routes to correct scene based on `snapshot.state`
- Null snapshot → idle scene
- `live_layout: 'big-logos'` → live big logos scene
- `index.ts` exports: `PreviewGenerator`, `ClientDisplay`, `loadPreviewFonts`, all scene functions, demo data factories, types
- Integration test: generate all 5 scene types, verify PNG data URLs returned, verify no throws

**Verification:**
```bash
cd web-admin && npm test -- --testPathPattern='preview/(generator|integration)'
```

---

### CHECKPOINT 2: Preview Library Complete

The entire `src/lib/preview/` module is built, tested, and exported. No React component yet — this is a pure library checkpoint.

**Gate:** All preview tests pass. Manual verification: write a quick script or test that generates an idle scene and logs the data URL.

---

### Task 7: DisplayPreview Component Rewrite

**What:** Rewrite `DisplayPreview.tsx` from server-API-based to client-side Canvas rendering. The component already exists and is imported by `pages/device/[id].tsx`.

**Files modified:**
- `web-admin/src/components/preview/DisplayPreview.tsx` (full rewrite)

**Acceptance criteria:**
- Renders canvas at native matrix resolution (from device config, default 64x32)
- Canvas displayed at 8x scale via CSS: `width: 512px, height: 256px, imageRendering: pixelated`
- Scene selector buttons: Idle, Pregame, Live, Big Logos, Final
- Refresh button re-renders current scene
- Loads pixel fonts on mount via `loadPreviewFonts()`
- Auto-refresh: re-renders when `selectedScene` changes
- No server API calls — all rendering is client-side
- Error state shown if canvas context fails
- Loading state while fonts load on first render
- Props: `deviceId` (unchanged), plus optional `renderConfig` for live_layout/logo_variant reactivity
- Component test: renders without crash, scene buttons present, canvas element present

**Verification:**
```bash
cd web-admin && npm test -- --testPathPattern='preview/DisplayPreview'
cd web-admin && npm run type-check
```

---

### Task 8: Device Page Integration + Auto-Refresh Wiring

**What:** Wire the DisplayPreview component to react to config changes from the device page. The device page already has `renderCfg` state (live_layout, logo_variant) — pass it to DisplayPreview so the preview auto-refreshes when the user changes settings in the Config tab.

**Files modified:**
- `web-admin/src/pages/device/[id].tsx` (pass renderCfg to DisplayPreview)
- `web-admin/src/components/preview/DisplayPreview.tsx` (accept and use renderCfg prop)

**Acceptance criteria:**
- DisplayPreview accepts optional `renderConfig: { live_layout: string, logo_variant: string }` prop
- When renderConfig changes, preview re-renders automatically
- Changing live_layout from "stacked" to "big-logos" in Config tab immediately updates the Live preview
- Changing logo_variant updates logo sizes in preview
- No prop change → no re-render (stable references)

**Verification:**
```bash
cd web-admin && npm test
cd web-admin && npm run type-check
cd web-admin && npm run build
```

---

### CHECKPOINT 3: Feature Complete

The preview is fully working in the web admin. All tests pass, build succeeds, the preview tab shows accurate scenes.

**Gate:** `npm test`, `npm run type-check`, `npm run build` all pass. Visual verification in browser: start dev server, navigate to device page, click Preview tab, verify all 5 scenes render with pixel fonts and team logos at 8x scale.

---

## Risk Notes

1. **Font rendering differences**: Canvas text rendering varies between browsers. Pixel fonts may render slightly differently than PIL. Accept "close enough" — exact pixel matching is a non-goal for v1.

2. **Logo asset paths**: The web-admin has no `public/` directory yet. Need to create it and either copy or symlink logo assets. Symlinks are simpler for dev but won't work in production builds — copies are safer.

3. **jsdom Canvas mocking**: jsdom doesn't implement Canvas natively. Tests will need `jest-canvas-mock` or manual mocks of `HTMLCanvasElement` and `CanvasRenderingContext2D`. The existing test infrastructure doesn't include this — Task 1 must set it up.

4. **NHL logo format**: NHL logos are SVG files in `assets/nhl_logos/`. Browser `Image` elements can load SVGs, but they may render differently than PIL's cairosvg conversion. The variant PNGs (pre-rendered) are the safer path.
