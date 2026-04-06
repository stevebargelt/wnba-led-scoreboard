#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../web-admin"

echo "🎨 Updating preview baseline screenshots..."
echo

export UPDATE_BASELINES=true

npm test -- tests/preview/visual-regression.test.ts --verbose

echo
echo "✅ Baseline screenshots updated successfully!"
echo "📍 Location: web-admin/tests/preview/__baselines__/"
echo
echo "Baselines created:"
ls -lh tests/preview/__baselines__/*.png 2>/dev/null | awk '{print "  - " $9 " (" $5 ")"}'
echo
echo "⚠️  Remember to commit the updated baseline images!"
