# LED Scoreboard Preview Library

Browser-based preview generator that replicates the Python LED matrix renderer for instant configuration feedback in the web admin interface.

## Purpose

This library generates pixel-perfect PNG previews of how the LED scoreboard will display game information. It runs entirely in the browser using Canvas API, providing instant visual feedback (<50ms) without requiring server-side rendering or hardware access.

## Architecture

```
PreviewGenerator
├── FontManager       - Font loading and caching
├── LogoLoader       - Team logo loading and variants
└── Scenes           - Scene rendering implementations
    ├── Idle         - No active games
    ├── Pregame      - Before game starts
    ├── Live         - During game (stacked layout)
    ├── LiveBig      - During game (big-logos layout)
    └── Final        - After game ends
```

## Usage

### Basic Example

```typescript
import { PreviewGenerator } from '@/lib/preview'
import type { DeviceConfiguration } from '@/lib/canvas/types'

const config: DeviceConfiguration = {
  matrix_config: {
    width: 64,
    height: 32,
    brightness: 75,
  },
  render_config: {
    logo_variant: 'mini',
    live_layout: 'stacked',
  },
}

const generator = new PreviewGenerator(config)

const idleBuffer = generator.generateIdleScene()
const pregameBuffer = generator.generatePregameScene()
const liveBuffer = await generator.generateLiveScene()
const finalBuffer = generator.generateFinalScene()

const allScenes = await generator.generateAllScenes()
```

### With Custom Game Data

```typescript
import { createDemoPregameSnapshot } from '@/lib/canvas/demo-data'

const customSnapshot: GameSnapshot = {
  sport: { id: 'wnba', name: 'WNBA' },
  away: { id: '1611661329', name: 'Liberty', abbr: 'NY', score: 78 },
  home: { id: '1611661330', name: 'Aces', abbr: 'LV', score: 82 },
  state: 'live',
  period_name: 'Q4',
  display_clock: '2:34',
  status_detail: 'In Progress',
}

const buffer = await generator.generateLiveScene(customSnapshot)
```

### In React Components

```typescript
'use client'

import { useEffect, useState } from 'react'
import { PreviewGenerator } from '@/lib/preview'
import Image from 'next/image'

export function ScoreboardPreview({ config }: { config: DeviceConfiguration }) {
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    const generator = new PreviewGenerator(config)
    const buffer = generator.generateIdleScene()
    const base64 = buffer.toString('base64')
    setPreview(`data:image/png;base64,${base64}`)
  }, [config])

  if (!preview) return <div>Generating preview...</div>

  return <Image src={preview} alt="Scoreboard preview" width={64} height={32} />
}
```

## Components

### PreviewGenerator

Main entry point for generating scene previews.

**Constructor:**
```typescript
constructor(config: DeviceConfiguration, options?: PreviewGeneratorConfig)
```

**Methods:**
- `generateIdleScene(): Buffer` - No games scene
- `generatePregameScene(snapshot?: GameSnapshot): Buffer` - Pregame scene
- `generateLiveScene(snapshot?: GameSnapshot, bigLogos?: boolean): Promise<Buffer>` - Live game scene
- `generateFinalScene(snapshot?: GameSnapshot): Buffer` - Final score scene
- `generateAllScenes(): Promise<{ idle, pregame, live, liveBig, final }>` - All scenes at once

### FontManager

Manages pixel fonts for text rendering.

**Usage:**
```typescript
import { getFontManager } from '@/lib/preview'

const fontManager = getFontManager()
const scoreFont = fontManager.getScoreFont()      // Large score numbers
const clockFont = fontManager.getClockFont()       // Game clock
const defaultFont = fontManager.getDefaultFont()   // General text
```

**Configuration:**
Fonts are configured in `config/fonts.json`:
```json
{
  "default": { "font": "04B_24__.TTF", "size": 8 },
  "score": { "font": "score_large.otf", "size": 16 },
  "clock": { "font": "04B_24__.TTF", "size": 8 }
}
```

### Logo Loading

Team logos with multiple size variants.

**Usage:**
```typescript
import { loadTeamLogo, getLogoVariantDimensions } from '@/lib/preview'

const logo = await loadTeamLogo({
  teamId: '1611661329',
  abbr: 'NY',
  sport: 'wnba',
  variant: 'mini'  // 'mini' | 'small' | 'banner'
})

const dimensions = getLogoVariantDimensions('mini')
// { height: 10, maxWidth: 18 }
```

**Logo Variants:**
- `mini` - 10px high, max 18px wide (stacked live view)
- `small` - 15px high, max 30px wide (pregame/final)
- `banner` - 20px high, max 60px wide (big-logos live view)

**Cache Management:**
```typescript
import { clearLogoCache } from '@/lib/preview'

clearLogoCache()
```

## Scene Specifications

### Idle Scene

Display when no games are active.

**Layout:**
```
┌──────────────────────────────┐
│ Mon 04/06 - No games         │
│                              │
└──────────────────────────────┘
```

**Elements:**
- Date/time string (gray text)
- "No games" message
- Updates with current date

### Pregame Scene

Display before game starts.

**Layout:**
```
┌──────────────────────────────┐
│ [NY ] NY                     │
│                              │
│ [LV ] LV                     │
│                              │
│       7:00 PM ET             │
└──────────────────────────────┘
```

**Elements:**
- Team logos (placeholder if not loaded)
- Team abbreviations (4 chars max)
- Game start time (centered, yellow)

### Live Scene (Stacked)

Display during game, stacked layout.

**Layout:**
```
┌──────────────────────────────┐
│ [NY ] NY                  78 │
│                              │
│ [LV ] LV                  82 │
│                              │
│           Q4 2:34            │
└──────────────────────────────┘
```

**Elements:**
- Team logos (mini variant, 10x10)
- Team abbreviations
- Live scores (right-aligned)
- Period and clock (centered, green)

### Live Scene (Big Logos)

Display during game, big-logos layout.

**Layout:**
```
┌──────────────────────────────┐
│                              │
│      [NY  ]  [LV  ]          │
│       NY      LV             │
│                              │
│         78 - 82              │
│        Q4 2:34               │
└──────────────────────────────┘
```

**Elements:**
- Large team logos (banner variant, 20x20)
- Team abbreviations (3 chars, centered)
- Combined score (centered)
- Period and clock (centered, green)

### Final Scene

Display after game ends.

**Layout:**
```
┌──────────────────────────────┐
│ [NY ] NY                  78 │
│                              │
│ [LV ] LV                  82 │
│                              │
│          Final               │
└──────────────────────────────┘
```

**Elements:**
- Team logos (placeholder)
- Team abbreviations
- Final scores
- "Final" status (centered, red)

## Synchronization with Python Renderer

**CRITICAL:** This TypeScript library is a pixel-perfect reimplementation of the Python renderer (`src/render/`). Any changes to rendering logic, layouts, colors, or fonts must be synchronized between both implementations.

See `docs/preview-maintenance.md` for the complete synchronization workflow.

### Quick Sync Checklist

When modifying either implementation:

1. Identify affected modules (fonts, logos, scenes)
2. Make equivalent changes in both Python and TypeScript
3. Update tests in both implementations
4. Run visual regression tests
5. Verify pixel-perfect match

### Common Sync Points

- **Font sizes/families** (`src/render/fonts.py` ↔ `fonts.ts`)
- **Logo variants** (`src/render/logos.py` ↔ `logos.ts`)
- **Layout coordinates** (`src/render/scenes/*.py` ↔ `scenes/*.ts`)
- **Color values** (RGB tuples in both)
- **Text truncation** (character limits)

## Testing

```bash
cd web-admin

npm test                          # Run all tests
npm test -- preview              # Preview-specific tests
npm test -- --coverage           # With coverage
npm test -- --watch              # Watch mode
```

### Test Structure

```
preview/
├── fonts.test.ts       - Font loading and caching
├── scenes/
│   ├── idle.test.ts   - Idle scene rendering
│   └── pregame.test.ts - Pregame scene rendering
└── generator.test.ts   - Integration tests
```

### Visual Regression Testing

Compare output between Python and TypeScript:

```bash
python app.py --sim --once        # Generate Python reference
npm test -- --updateSnapshot      # Update TS snapshots
npm test -- scenes                # Verify match
```

## Performance

Typical rendering times (M1 Mac):
- Idle scene: ~15ms
- Pregame scene: ~20ms
- Live scene (no logos): ~20ms
- Live scene (with logos): ~45ms
- Final scene: ~20ms

Logo loading is async and cached. First load: ~30ms, subsequent: <1ms.

## Troubleshooting

### Fonts Not Loading

**Symptom:** Text appears in fallback font

**Solution:** Verify font files exist in `assets/fonts/pixel/`:
```bash
ls -la assets/fonts/pixel/
```

Check font configuration in `config/fonts.json`.

### Logos Not Appearing

**Symptom:** Gray placeholder boxes instead of logos

**Solution:** Verify team logo files exist:
```bash
ls -la assets/logos/
ls -la assets/logos/variants/
```

Run logo fetch script:
```bash
python scripts/fetch_wnba_assets.py
python scripts/fetch_nhl_assets.py
```

### Preview Doesn't Match Hardware

**Symptom:** TypeScript preview differs from actual LED display

**Solution:** Run visual regression tests to identify pixel differences:
```bash
python app.py --sim --once
npm test -- --updateSnapshot
```

Compare output PNGs in `out/` directory. Check `docs/preview-maintenance.md` for sync procedures.

### Slow Preview Generation

**Symptom:** Preview takes >100ms to generate

**Solution:**
- Check logo cache: `clearLogoCache()` may force reloads
- Verify font files are local (not loading from network)
- Profile with Chrome DevTools to identify bottleneck
- Consider disabling logos for draft previews

## File Structure

```
web-admin/src/lib/preview/
├── index.ts              - Public API exports
├── generator.ts          - PreviewGenerator class
├── fonts.ts             - FontManager
├── logos.ts             - Logo loading utilities
└── scenes/
    ├── idle.ts          - Idle scene
    ├── pregame.ts       - Pregame scene
    ├── live.ts          - Live scene (stacked)
    ├── liveBig.ts       - Live scene (big logos)
    └── final.ts         - Final scene
```

## Related Documentation

- **ADR**: `docs/adr/typescript-preview-generator.md` - Why duplication is intentional
- **Maintenance**: `docs/preview-maintenance.md` - How to keep TS/Python in sync
- **Python Renderer**: `src/render/` - Production implementation
- **Display System**: `src/display/` - Hardware abstraction layer

## Contributing

When adding new features or modifying existing rendering:

1. Read `docs/preview-maintenance.md` first
2. Make changes to both Python and TypeScript
3. Add tests to both implementations
4. Run visual regression tests
5. Document any new configuration options
6. Update this README if API changes

Remember: This is intentional duplication, not technical debt. The duplicate code enables instant browser-based previews while maintaining pixel-perfect accuracy with hardware output.
