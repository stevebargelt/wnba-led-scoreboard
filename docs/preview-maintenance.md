# Preview Maintenance Guide

Guide for keeping TypeScript preview generator and Python renderer in sync.

## Overview

The WNBA LED Scoreboard has two rendering implementations:
- **Python** (`src/render/`) - Production renderer for RGB LED matrix hardware
- **TypeScript** (`web-admin/src/lib/preview/`) - Browser-based preview generator

These implementations must stay pixel-perfect synchronized. This guide explains how to maintain that synchronization.

## Why Duplication Exists

See `docs/adr/typescript-preview-generator.md` for the full rationale. In short:
- TypeScript provides instant browser previews (<50ms)
- Python drives actual hardware on Raspberry Pi
- No shared runtime exists between them
- User experience requires instant feedback
- Visual accuracy requires identical rendering logic

**This is intentional duplication, not technical debt.**

## Synchronized Modules

### 1. Font Management

**Python:** `src/render/fonts.py`
**TypeScript:** `web-admin/src/lib/preview/fonts.ts`

Both load fonts from `config/fonts.json` and provide the same API:

```python
# Python
font_manager.get_font("score")
font_manager.get_period_font()
```

```typescript
// TypeScript
fontManager.getFont("score")
fontManager.getPeriodFont()
```

**Sync points:**
- Font file paths
- Font sizes
- Cache behavior
- Error handling

### 2. Logo Loading

**Python:** `src/render/logos.py` (if exists) or inline in scenes
**TypeScript:** `web-admin/src/lib/preview/logos.ts`

**Sync points:**
- Logo variant dimensions (mini: 10px, small: 15px, banner: 20px)
- File path resolution
- Cache behavior
- Fallback logic (when logo missing)
- NHL team ID mapping

### 3. Scene Rendering

**Python:** `src/render/scenes/*.py`
**TypeScript:** `web-admin/src/lib/preview/scenes/*.ts`

Five scenes must stay synchronized:
- Idle
- Pregame
- Live (stacked layout)
- LiveBig (big-logos layout)
- Final

**Sync points per scene:**
- Layout coordinates (x, y positions)
- Element sizes (logo dimensions, text heights)
- Colors (RGB values must match exactly)
- Font choices (which font for each element)
- Text truncation (character limits)
- Spacing and alignment

## Synchronization Workflow

### Step 1: Identify Change Scope

When making a change, determine which modules are affected:

```
Change Type                     Affected Modules
────────────────────────────────────────────────────
Add new font                    fonts.py ↔ fonts.ts
                                config/fonts.json

Change logo size                logos.ts
                                All scene files (layout coordinates)

Modify scene layout             Specific scene files (e.g., live.py ↔ live.ts)

Change color scheme             All scene files

Add new scene                   New scene file in both languages
                                Renderer class ↔ PreviewGenerator class
```

### Step 2: Make Equivalent Changes

Make functionally equivalent changes in both implementations.

**Example: Change score color from white to yellow**

Python (`src/render/scenes/live.py`):
```python
# Before
draw.text((x, y), score, fill=(255, 255, 255), font=font_large)

# After
draw.text((x, y), score, fill=(255, 255, 0), font=font_large)
```

TypeScript (`web-admin/src/lib/preview/scenes/live.ts`):
```typescript
// Before
display.drawText(score, x, y, 10, 'monospace', 'rgb(255, 255, 255)')

// After
display.drawText(score, x, y, 10, 'monospace', 'rgb(255, 255, 0)')
```

### Step 3: Update Tests

Add or update tests in both implementations.

Python:
```bash
python -m unittest tests.test_render
```

TypeScript:
```bash
cd web-admin && npm test -- preview
```

### Step 4: Visual Regression Testing

Generate reference images and compare outputs.

```bash
# Generate Python reference image
python app.py --sim --once

# Python output saved to: out/frame.png

# Generate TypeScript previews
cd web-admin
npm test -- --updateSnapshot

# Compare outputs manually or with pixel diff tool
```

### Step 5: Verify in Browser

Test the preview in the actual web admin interface:

```bash
cd web-admin
npm run dev
```

Navigate to device configuration page, verify previews match expectations.

### Step 6: Document Changes

If the change is significant:
- Update this guide
- Update `web-admin/src/lib/preview/README.md`
- Add comments explaining complex sync points
- Update scene specifications if layouts changed

## Common Synchronization Scenarios

### Scenario 1: Add New Font

**Files to update:**
1. `config/fonts.json` - Add font configuration
2. `assets/fonts/pixel/` - Add font file
3. `src/render/fonts.py` - Add helper method if needed
4. `web-admin/src/lib/preview/fonts.ts` - Add equivalent helper
5. Scene files - Use new font where applicable

**Example:**

`config/fonts.json`:
```json
{
  "team_name": { "font": "team_display.ttf", "size": 10 }
}
```

`src/render/fonts.py`:
```python
def get_team_name_font(self) -> ImageFont.FreeTypeFont:
    return self.get_font("team_name")
```

`web-admin/src/lib/preview/fonts.ts`:
```typescript
getTeamNameFont(): string {
  return this.getFont('team_name')
}
```

### Scenario 2: Change Logo Variant Size

**Impact:** High - affects all scenes using that variant

**Files to update:**
1. `web-admin/src/lib/preview/logos.ts` - Update `getLogoVariantDimensions()`
2. All scene files - Adjust layout coordinates to accommodate new size
3. Tests - Update expected dimensions

**Checklist:**
- [ ] Update variant dimensions function
- [ ] Adjust logo position in each scene
- [ ] Verify text doesn't overlap with resized logo
- [ ] Check alignment (centered, left, right)
- [ ] Update tests
- [ ] Visual regression test

### Scenario 3: Modify Scene Layout

**Example:** Move score position from top-right to bottom-right

**Files to update:**
- `src/render/scenes/live.py`
- `web-admin/src/lib/preview/scenes/live.ts`
- Tests for live scene

**Process:**
1. Calculate new coordinates in Python
2. Test with `python app.py --sim --once`
3. Apply same coordinates to TypeScript
4. Verify with visual regression test
5. Test in browser

**Coordinate System:**
- Origin (0, 0) is top-left
- x increases rightward
- y increases downward
- Both use same dimensions (typically 64x32)

### Scenario 4: Add New Scene

**Files to create:**
- `src/render/scenes/new_scene.py`
- `web-admin/src/lib/preview/scenes/newScene.ts`

**Files to update:**
- `src/render/renderer.py` - Add render method
- `web-admin/src/lib/preview/generator.ts` - Add generate method
- `web-admin/src/lib/preview/index.ts` - Export new scene
- Test files for new scene

**Template:**

Python:
```python
def draw_new_scene(buffer, draw, snap, now, font_small, font_large, logo_variant="mini"):
    # Implementation
    pass
```

TypeScript:
```typescript
export class NewScene implements Scene {
  draw(canvas, ctx, snapshot, currentTime, fontSmall, fontLarge, ...kwargs) {
    // Implementation
  }
  getName(): string {
    return 'new_scene'
  }
}
```

## Pixel-Perfect Verification

### Manual Comparison

```bash
# Generate outputs
python app.py --sim --once
cd web-admin && npm test

# Open both images
open out/frame.png
open web-admin/out/preview/idle.png

# Visual diff (if ImageMagick installed)
compare out/frame.png web-admin/out/preview/idle.png diff.png
```

### Automated Pixel Diff

```typescript
// In test file
import { createCanvas } from 'canvas'
import { execSync } from 'child_process'

test('matches Python output', () => {
  // Generate Python reference
  execSync('python app.py --sim --once')
  const pythonImage = readFileSync('out/frame.png')

  // Generate TypeScript output
  const generator = new PreviewGenerator(config)
  const tsBuffer = generator.generateIdleScene()

  // Compare pixels
  expect(tsBuffer).toMatchImageSnapshot({
    customDiffConfig: { threshold: 0 } // Exact match
  })
})
```

## Common Gotchas

### Color Format Differences

**Python:** RGB tuples `(255, 255, 0)`
**TypeScript:** CSS strings `'rgb(255, 255, 0)'`

Always verify RGB values match exactly.

### Font Rendering Differences

PIL and Canvas may render fonts slightly differently due to:
- Antialiasing differences
- Subpixel rendering
- Font hinting

**Mitigation:**
- Use bitmap fonts (no antialiasing)
- Test on target platform
- Accept minor (<2px) differences in text width

### Coordinate System Edge Cases

**Python PIL:**
- `draw.text((x, y), ...)` - (x,y) is baseline/left edge
- `draw.rectangle((x1, y1, x2, y2), ...)` - inclusive coordinates

**TypeScript Canvas:**
- `ctx.fillText(text, x, y)` - (x,y) depends on textBaseline setting
- `ctx.fillRect(x, y, width, height)` - width/height, not endpoint

**Always explicitly set:**
```typescript
ctx.textBaseline = 'top'  // or 'middle', 'bottom'
ctx.textAlign = 'left'     // or 'center', 'right'
```

### Logo Caching Inconsistencies

Both implementations cache logos but may load them differently:
- Python: Synchronous file I/O
- TypeScript: Async image loading

**Ensure:**
- Cache keys match format: `${sport}_${teamId}_${variant}`
- Missing logo handling is identical
- Fallback behavior matches

### Text Truncation

When truncating team abbreviations or messages:

```python
# Python
abbr = team.abbr[:4]  # "MYSTIC"[:4] = "MYST"
```

```typescript
// TypeScript
const abbr = team.abbr.slice(0, 4)  // "MYSTIC".slice(0,4) = "MYST"
```

Both should produce identical output.

## Testing Checklist

Before committing changes affecting both implementations:

- [ ] Python unit tests pass (`python -m unittest`)
- [ ] TypeScript unit tests pass (`npm test`)
- [ ] Visual regression test shows no diff
- [ ] Manual browser test confirms preview accuracy
- [ ] Hardware test (if available) confirms LED output
- [ ] Documentation updated
- [ ] Code comments explain complex sync points
- [ ] Commit message references both files

## Emergency Desync Recovery

If implementations get out of sync and you're not sure how:

### 1. Generate Reference Images

```bash
# Known good Python output
git checkout main
python app.py --sim --once
cp out/frame.png reference.png

# Current TypeScript output
cd web-admin
npm test -- --updateSnapshot
```

### 2. Visual Diff

```bash
compare reference.png web-admin/out/preview/idle.png diff.png
```

### 3. Identify Differences

Look for:
- Color mismatches (use color picker)
- Position offsets (measure pixel coordinates)
- Size differences (measure element dimensions)
- Missing elements

### 4. Trace Back to Code

Search for the affected elements:

```bash
# Find score rendering
grep -r "score" src/render/scenes/
grep -r "score" web-admin/src/lib/preview/scenes/
```

### 5. Restore Sync

Apply the Python implementation to TypeScript (Python is source of truth for hardware accuracy).

## FAQ

### Q: Which implementation is the source of truth?

**A:** Python. It drives actual hardware, so it defines correct output. TypeScript must match Python, not vice versa.

### Q: Can I make TypeScript-only changes?

**A:** Only for web-specific concerns (React integration, Next.js optimization, etc.). Never for rendering logic, colors, fonts, or layouts.

### Q: How do I test without hardware?

**A:** Use simulation mode:
```bash
python app.py --sim --once  # Generates out/frame.png
```

### Q: What if fonts render slightly differently?

**A:** If using TrueType fonts, minor differences (<2px) are acceptable due to rendering engine differences. Consider switching to bitmap fonts for exact pixel matching.

### Q: Should I duplicate helper functions?

**A:** Yes, if they're used in rendering logic. Keep helper functions in sync just like scene code.

### Q: How do I handle Python-specific or TypeScript-specific code?

**A:** Isolate platform-specific code outside the rendering logic:
- **Python-specific:** Hardware initialization, file I/O, signal handling
- **TypeScript-specific:** React hooks, Next.js optimizations, browser APIs

Core rendering logic must be platform-agnostic and duplicated.

### Q: What about performance differences?

**A:** Both should be fast (<100ms), but exact timing doesn't need to match. Focus on visual output accuracy, not performance parity.

## References

- **ADR**: `docs/adr/typescript-preview-generator.md`
- **Preview README**: `web-admin/src/lib/preview/README.md`
- **Python Renderer**: `src/render/renderer.py`
- **TypeScript Generator**: `web-admin/src/lib/preview/generator.ts`
- **Test Suite**: `web-admin/src/lib/preview/*.test.ts`

## Maintenance Ownership

**Current Status:** Active synchronization required
**Review Frequency:** Every rendering change
**Technical Debt:** Intentional (see ADR)
**Mitigation:** This guide + visual regression tests

When in doubt, ask: "Would this change how the LED matrix displays game information?" If yes, sync both implementations.
