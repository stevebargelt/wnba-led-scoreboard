#!/usr/bin/env bash
set -euo pipefail

# Installs/builds the rpi-rgb-led-matrix Python bindings (rgbmatrix) and verifies import.
# Defaults:
#   - Repo dir: $HOME/rpi-rgb-led-matrix (override: REPO_DIR or --repo)
#   - Python:   result of `which python3` (override: PYTHON_BIN or --python)
#   - APT step: executed if apt-get is available (skip with --no-apt)

REPO_DIR="${REPO_DIR:-$HOME/rpi-rgb-led-matrix}"
PYTHON_BIN="${PYTHON_BIN:-$(command -v python3)}"
DO_APT=1

usage() {
  cat <<USAGE
Usage: $0 [--repo <path>] [--python <python-bin>] [--no-apt]

Examples:
  $0                               # use defaults
  REPO_DIR=~/src/rpi-rgb-led-matrix $0
  $0 --repo /opt/rpi-rgb-led-matrix --python $(command -v python3)
  $0 --no-apt                      # skip apt install step
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_DIR="$2"; shift 2;;
    --python)
      PYTHON_BIN="$2"; shift 2;;
    --no-apt)
      DO_APT=0; shift;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "Unknown arg: $1" >&2; usage; exit 1;;
  esac
done

log() { echo -e "\033[1;34m[install]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }
err() { echo -e "\033[1;31m[error]\033[0m $*"; }

if [[ -z "${PYTHON_BIN}" ]]; then
  err "Could not find python3. Set PYTHON_BIN or install python3."; exit 1
fi

log "Python: $(${PYTHON_BIN} -c 'import sys; print(sys.executable, "-", sys.version.split()[0])')"

# 1) Install build prerequisites (if apt-get is available)
if [[ $DO_APT -eq 1 ]] && command -v apt-get >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1; then SUDO=sudo; else SUDO=""; fi
  log "Installing build prerequisites via apt-get (may prompt for password)"
  $SUDO apt-get update
  $SUDO apt-get install -y build-essential python3-dev swig git libjpeg-dev zlib1g-dev || {
    warn "apt-get install failed. You can re-run with --no-apt and ensure deps are present."
  }
else
  warn "Skipping apt-get step (either --no-apt given or apt-get not present)."
fi

# 2) Clone rpi-rgb-led-matrix if needed
if [[ ! -d "$REPO_DIR" ]]; then
  log "Cloning rpi-rgb-led-matrix into $REPO_DIR"
  git clone https://github.com/hzeller/rpi-rgb-led-matrix.git "$REPO_DIR"
else
  log "Using existing repo at $REPO_DIR"
fi

# 3) Build core library
log "Building core library"
make -C "$REPO_DIR" -j"$(nproc 2>/dev/null || echo 2)"

# 4) Generate Python wrapper via SWIG and build
pushd "$REPO_DIR/bindings/python" >/dev/null
log "Generating Python wrapper (SWIG)"
make clean || true
make build-python PYTHON="$PYTHON_BIN"

if [[ ! -f rgbmatrix/core.cpp ]]; then
  err "Failed to generate rgbmatrix/core.cpp. Check SWIG is installed and try again."; exit 1
fi

# 5) Install into the provided Python environment
log "Installing rgbmatrix into: $PYTHON_BIN"
"$PYTHON_BIN" -m pip install -U pip wheel setuptools
"$PYTHON_BIN" -m pip install .

# 6) Verify import
log "Verifying rgbmatrix import"
"$PYTHON_BIN" - <<'PY'
import sys
try:
    import rgbmatrix
    print("rgbmatrix OK ->", rgbmatrix.__file__)
except Exception as e:
    print("rgbmatrix import FAILED:", e)
    sys.exit(1)
PY

popd >/dev/null

cat <<'NEXT'

Next steps:
- Hardware test (examples):
    cd "$HOME"/rpi-rgb-led-matrix/examples-api-use
    sudo -E $(which python3) demo.py --led-rows=32 --led-cols=64 --led-gpio-mapping=adafruit-hat --led-brightness=80

- Run this app on the matrix (from project root):
    source .venv/bin/activate
    sudo -E $(pwd)/.venv/bin/python app.py

Tip: The -E flag preserves the venv so the rgbmatrix module is found under sudo.
NEXT

log "Done."

