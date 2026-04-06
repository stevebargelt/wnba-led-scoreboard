#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BASELINE_DIR="$PROJECT_ROOT/tests/visual/baselines"

mkdir -p "$BASELINE_DIR"

TEST_CONFIG='{
  "device_id": "baseline-device",
  "display": {
    "width": 64,
    "height": 32,
    "brightness": 75
  },
  "preferences": {
    "timezone": "America/New_York",
    "big_logos": false
  },
  "leagues": ["wnba", "nhl"],
  "favorite_teams": []
}'

echo "Generating baseline screenshots..."
echo "Output directory: $BASELINE_DIR"

for scene in idle pregame live live_big final; do
  echo "Generating baseline for scene: $scene"

  python3 "$PROJECT_ROOT/scripts/generate_preview.py" \
    --device-id "baseline-device" \
    --scene "$scene" \
    --output "$BASELINE_DIR/temp" \
    --config-json "$TEST_CONFIG"

  if [ -f "$BASELINE_DIR/temp/frame.png" ]; then
    mv "$BASELINE_DIR/temp/frame.png" "$BASELINE_DIR/${scene}_baseline.png"
    echo "✓ Created: ${scene}_baseline.png"
  else
    echo "✗ Failed to generate: ${scene}_baseline.png"
    exit 1
  fi
done

rm -rf "$BASELINE_DIR/temp"

echo ""
echo "Baseline generation complete!"
echo "Generated files:"
ls -lh "$BASELINE_DIR"/*.png
