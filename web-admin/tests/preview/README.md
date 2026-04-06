# Preview Comparison Tests (ANTI-DRIFT)

## Purpose

These tests prevent code drift between the TypeScript (web admin) and Python (LED display) preview rendering implementations.

## How It Works

1. **Python Preview Generation**: Calls `scripts/compare_previews.py` to generate preview images using the Python rendering system
2. **TypeScript Preview Generation**: Uses `PreviewGenerator` to generate the same scenes
3. **Pixel-by-Pixel Comparison**: Compares images pixel-by-pixel
4. **Threshold Check**: Fails if >5% of pixels differ

## Test Scenes

- `idle` - No active games
- `pregame` - Before game starts
- `live` - During game (stacked layout)
- `live_big` - During game (big-logos layout)
- `final` - After game ends

## Current Status

⚠️ **Tests are currently FAILING** - This is expected and indicates that the TypeScript and Python implementations have already drifted significantly (13-40% pixel differences).

This is exactly what these tests were designed to catch! The failures are a feature, not a bug.

## What To Do When Tests Fail

### If you modified Python rendering:
1. Check if the change was intentional
2. Update the TypeScript implementation to match
3. Re-run tests to verify they pass

### If you modified TypeScript rendering:
1. Check if the change was intentional
2. Update the Python implementation to match
3. Re-run tests to verify they pass

### If both implementations are correct but different:
This indicates legitimate code drift. You must:
1. Analyze the differences (debug images saved to `tmp/preview-comparison/debug/`)
2. Decide which implementation is correct
3. Update the other to match
4. Document the decision

## Running Tests

```bash
cd web-admin
npm test -- tests/preview/comparison.test.ts
```

## Debugging Failures

When tests fail, debug images are saved to `tmp/preview-comparison/debug/`:
- `{scene}-python.png` - Python-generated preview
- `{scene}-typescript.png` - TypeScript-generated preview

Compare these images visually to understand the differences.

## CI Integration

These tests run automatically on every PR via `npm run test:ci`.

## Adjusting the Threshold

The 5% threshold is defined in `comparison.test.ts` as `PIXEL_DIFF_THRESHOLD`.

**⚠️ WARNING**: Increasing this threshold defeats the purpose of these tests. Only adjust if you have a very good reason and team consensus.
