# SPEC: Client-Side LED Scoreboard Preview

## Objective

Add a live preview to the web admin that shows users exactly what their LED matrix will display. The preview renders in the browser using the Canvas API at native matrix resolution (default 64x32), scaled up 8x via CSS `imageRendering: pixelated` so individual pixels are crisp and visible.

The preview appears on the device configuration page, uses demo game data to show each scene type, and re-renders automatically when the user changes display settings (layout, brightness, logo variant).

### Target Users

People configuring their LED scoreboard through the web admin interface. They want immediate visual feedback before changes reach the hardware.

## Core Feature: Scene Preview

### Scene Types

Five scenes, matching the Python renderer in `src/render/scenes/`:

| Scene | Python Source | Trigger |
|-------|-------------|---------|
| Idle | `builtin.py:IdleScene` + `renderer.py:render_idle` | No games scheduled |
| Pregame | `scenes/pregame.py:draw_pregame` | Before game starts |
| Live (stacked) | `scenes/live.py:draw_live` | During game, `live_layout=stacked` |
| Live (big logos) | `scenes/live_big.py:draw_live_big` | During game, `live_layout=big-logos` |
| Final | `scenes/final.py:draw_final` | After game ends |

### Scene Layouts (from Python source of truth)

**Idle:**
- Black background
- `(1, 1)`: Date string + " - No games", truncated to 20 chars, gray `(180, 180, 180)`, font_small

**Pregame:**
- Away logo at `(2, top_y)`, home logo at `(w - lw - 2, top_y)` where `top_y = 2`
- "VS" centered at `(w//2 - 6, top_y + 1)`, gray `(200, 200, 200)`, font_small
- Countdown timer centered vertically+horizontally, yellow `(255, 200, 0)`, font_large
- Start time at `(1, h - 9)`, dim gray `(150, 150, 150)`, font_small

**Live (stacked):**
- `row_h=12`, `top_y=1`, `bot_y=13`, `logo_x=1`, `abbr_x=13`, `score_right_x=w-1`
- Away row: logo `(1, 1)` 10x10, abbr at `(13, 2)` gray, score right-aligned white, font_large
- Home row: logo `(1, 13)` 10x10, abbr at `(13, 14)` gray, score right-aligned white, font_large
- Status centered at bottom: period + clock, green `(0, 255, 0)`, font_small

**Live (big logos):**
- Status line at very top, centered, gray `(200, 200, 200)`, font_small
- Home logo left side at `(1, y_logo_top)`, away logo right side at `(w - logo_w - 2, y_logo_top)`
- Logos sized up to 20px tall (16px if h<=32), aspect-preserved
- Abbreviations centered under their respective logos at bottom, gray `(220, 220, 220)`, font_small
- Scores between logos: home score left of center, away score right of center, white, adaptive font sizing
- Vertical centering within logo band

**Final:**
- "FINAL" at `(1, 1)`, red `(255, 80, 80)`, font_small
- Then stacked layout (same as live stacked): logos, abbreviations, scores
- No bottom status line

### Fonts

Load the actual pixel fonts from `assets/fonts/pixel/` as web fonts:

| Role | File | Size | Usage |
|------|------|------|-------|
| font_small | `04B_24__.TTF` | 8px | Abbreviations, status, labels |
| font_large | `score_large.otf` | 12px | Scores, countdown timer |

These TTF/OTF files work with `@font-face`. Load them in the preview component and set them on the Canvas context. Fallback to `monospace` if font loading fails.

Note: The Python `Renderer` currently uses DejaVuSans as a placeholder, but `FontManager` + `config/fonts.json` define the pixel fonts as the intended target. The TS preview should use the pixel fonts.

### Logos

Logos are served from the `public/` directory of the web admin:

- **Variant logos** (preferred): `/assets/logos/variants/{teamId}_{variant}.png` where variant is `mini` (10px tall) or `banner` (20px tall)
- **WNBA fallback**: `/assets/logos/{teamId}.png`
- **NHL fallback**: `/assets/nhl_logos/{ABBR}.png` or `.svg`

Logo loading should be cached in memory and fail gracefully (draw a gray outline rectangle as placeholder).

### Display Scaling

- Render to canvas at native resolution (e.g., 64x32)
- Display the canvas element at 8x scale: 512x256 CSS pixels
- Use `imageRendering: pixelated` on the canvas for crisp upscaling
- The canvas draws at real pixel coordinates; CSS handles magnification

### Demo Data

Use hardcoded demo game snapshots for preview scenes. Include games from multiple sports:

- WNBA: PHX Mercury vs LA Sparks (matches existing team IDs with logo assets)
- NHL: Include at least one demo matchup

Each snapshot provides: team IDs, abbreviations, scores, period, clock, status, sport/league info.

### Auto-Refresh

The preview re-renders when:
- User selects a different scene type
- User changes `live_layout` (stacked vs big-logos)
- User changes `logo_variant`
- User clicks the manual refresh button

No debounce needed — Canvas rendering is <50ms.

## Project Structure

All new files under `web-admin/`:

```
web-admin/
├── public/
│   └── assets/fonts/pixel/        # Copy of TTF/OTF fonts for web loading
│       ├── 04B_24__.TTF
│       └── score_large.otf
├── src/
│   ├── lib/
│   │   └── preview/               # Single preview library (replaces 3 dirs on old branch)
│   │       ├── index.ts            # Public exports
│   │       ├── types.ts            # GameSnapshot, DisplayConfig, etc.
│   │       ├── display.ts          # Canvas abstraction (ClientDisplay)
│   │       ├── fonts.ts            # Web font loader
│   │       ├── logos.ts            # Logo loader with cache
│   │       ├── scenes.ts           # All scene render functions
│   │       ├── demo-data.ts        # Demo game snapshots
│   │       └── generator.ts        # PreviewGenerator orchestrator
│   └── components/
│       └── preview/
│           └── DisplayPreview.tsx  # React component (replace existing)
```

### Files Modified

- `web-admin/src/components/preview/DisplayPreview.tsx` — rewrite to use client-side rendering instead of server API

### Files NOT Created

- No server-side API endpoints
- No Playwright/E2E test infrastructure
- No visual regression tooling
- No deployment scripts
- No ADR or maintenance docs (the code is the documentation)

## Tech Stack

- **Rendering**: Browser Canvas 2D API (`HTMLCanvasElement`, `CanvasRenderingContext2D`)
- **Fonts**: `@font-face` declarations loading TTF/OTF from `/assets/fonts/pixel/`
- **Component**: React functional component with hooks
- **Styling**: Tailwind CSS (matches existing web admin)
- **Types**: TypeScript strict mode
- **Testing**: Jest + jsdom (matches existing web admin test setup)

## Acceptance Criteria

### AC1: Scene Rendering Accuracy
Each scene renders with the same layout constants, colors, and positions as the Python source.
- Idle: date + "No games" at (1,1) in gray
- Pregame: logos left/right with "VS" center, countdown middle, start time bottom
- Live stacked: two rows with logo/abbr/score, status bottom in green
- Live big: status top, logos left/right, scores between, abbrs under logos
- Final: "FINAL" top-left in red, stacked layout, no bottom status

### AC2: Pixel Fonts Load
The Canvas context uses `04B_24__.TTF` and `score_large.otf` when available. Text rendering uses these fonts, not system defaults. Graceful fallback to monospace if fonts fail to load.

### AC3: Logo Loading
Team logos load from `/assets/logos/variants/` with fallback paths. Failed loads show a gray outline rectangle. Logos are cached after first load.

### AC4: Display Scaling
Canvas renders at native matrix resolution. Displayed at 8x scale with `imageRendering: pixelated`. Pixels are crisp blocks, not blurred.

### AC5: Auto-Refresh
Preview re-renders when scene selection, layout, or logo variant changes. No page reload required.

### AC6: Multi-Sport Demo Data
Demo snapshots include at least WNBA and NHL games with correct team IDs that match available logo assets.

### AC7: Tests Pass
Unit tests cover each scene render function, the generator, font loading, and logo loading. All existing web-admin tests continue to pass.

## Testing Strategy

- **Unit tests** for each scene render function (verify no throws, verify canvas operations)
- **Unit tests** for PreviewGenerator (all scene types, null snapshot → idle)
- **Unit tests** for font loader (loaded state, fallback state)
- **Unit tests** for logo loader (cache hit, cache miss, load failure)
- **Integration test** for DisplayPreview component (renders, scene switching works)
- Mock `HTMLCanvasElement` and `CanvasRenderingContext2D` in jsdom (standard approach)
- Mock logo loading in scene tests (return null to test placeholder path)

## Boundaries

### Always Do
- Match Python scene layout constants exactly (coordinates, colors, font sizes)
- Use pixel fonts from `assets/fonts/pixel/`
- Support all sports that have logo assets
- Cache logos after first load
- Fail gracefully when fonts or logos don't load

### Never Do
- Add server-side preview rendering (no API endpoints, no node-canvas)
- Modify Python source code
- Add Playwright, E2E tests, or visual regression infrastructure
- Add deployment scripts or CI workflows for this feature
- Create separate directories for server-side vs client-side rendering

### Ask First
- Changing the scale factor from 8x
- Adding new scene types beyond the existing 5
- Modifying the demo data team matchups
- Adding real-time game data (vs demo data) to the preview
