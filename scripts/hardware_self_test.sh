#!/usr/bin/env bash
set -euo pipefail

# Runs the upstream demo.py to validate your panel & HAT.
# Reads defaults from .env if present or allows overrides via flags.

ROWS=""
COLS=""
MAPPING=""
BRIGHTNESS=""
REPO_DIR="${REPO_DIR:-$HOME/rpi-rgb-led-matrix}"
PYTHON_BIN="${PYTHON_BIN:-$(command -v python3)}"

usage() {
  cat <<USAGE
Usage: $0 [--rows 32] [--cols 64] [--mapping adafruit-hat] [--brightness 80] [--repo <path>] [--python <bin>]

Notes:
- Defaults read from .env if present: MATRIX_HEIGHT -> rows, MATRIX_WIDTH -> cols, MATRIX_HARDWARE_MAPPING -> mapping, MATRIX_BRIGHTNESS -> brightness
- Falls back to rows=32, cols=64, mapping=adafruit-hat, brightness=80
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rows) ROWS="$2"; shift 2;;
    --cols) COLS="$2"; shift 2;;
    --mapping) MAPPING="$2"; shift 2;;
    --brightness) BRIGHTNESS="$2"; shift 2;;
    --repo) REPO_DIR="$2"; shift 2;;
    --python) PYTHON_BIN="$2"; shift 2;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1;;
  esac
done

# Load .env if present
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

ROWS="${ROWS:-${MATRIX_HEIGHT:-32}}"
COLS="${COLS:-${MATRIX_WIDTH:-64}}"
MAPPING="${MAPPING:-${MATRIX_HARDWARE_MAPPING:-adafruit-hat}}"
BRIGHTNESS="${BRIGHTNESS:-${MATRIX_BRIGHTNESS:-80}}"

echo "[self-test] Using repo: $REPO_DIR"
echo "[self-test] Demo settings: rows=$ROWS cols=$COLS mapping=$MAPPING brightness=$BRIGHTNESS"

DEMO_DIR="$REPO_DIR/examples-api-use"
DEMO_PY="$DEMO_DIR/demo.py"

if [[ ! -f "$DEMO_PY" ]]; then
  echo "[error] demo.py not found at $DEMO_PY. Ensure rpi-rgb-led-matrix is cloned and built." >&2
  exit 1
fi

if [[ -z "$PYTHON_BIN" ]]; then
  echo "[error] python3 not found. Set PYTHON_BIN or install python3." >&2
  exit 1
fi

cmd=("sudo" "-E" "$PYTHON_BIN" "$DEMO_PY" "--led-rows=$ROWS" "--led-cols=$COLS" "--led-gpio-mapping=$MAPPING" "--led-brightness=$BRIGHTNESS")
echo "[self-test] Running: ${cmd[*]}"
"${cmd[@]}"

