WNBA LED Scoreboard (64x32 default)

Overview
This project displays a WNBA scoreboard on an RGB LED matrix (defaults to 64x32). It discovers today's favorite-team games, shows a countdown before tip, and renders live scores with clock/period.

Quick Start
- Copy `config/favorites.json` and edit favorites in priority order.
- Optionally copy `.env.example` to `.env` to override matrix size and settings.
- Create venv and install deps:
  - `python3 -m venv .venv && source .venv/bin/activate`
  - `pip install -r requirements.txt`
- Run in sim mode (renders to `out/frame.png`):
  - `python app.py --sim --once`
- Run on Pi with matrix:
  - `python app.py`
 - Demo mode (simulated game, changes occasionally):
   - `python app.py --sim --demo` (local/offscreen)
   - `sudo -E $(pwd)/.venv/bin/python app.py --demo` (on Pi)

Hardware & Bindings
- Install rgbmatrix (Python bindings) on the Pi:
  - `bash scripts/install_rgbmatrix.sh`
- Self-test your panel/HAT with upstream demo:
  - `bash scripts/hardware_self_test.sh`
  - Defaults read from `.env` (64x32, adafruit-hat, brightness 80). Override with flags like `--rows 32 --cols 64`.
  - The demo runs with `sudo -E` (required for GPIO access).

Logos & Team Colors
- Auto-fetch WNBA teams, logos, and colors from ESPN, and generate pre-sized variants:
  - `source .venv/bin/activate && python scripts/fetch_wnba_assets.py`
  - Outputs:
    - `assets/teams.json` (id, abbr, name, primary/secondary colors, logo path)
    - `assets/logos/{id}.png` original logos
    - `assets/logos/variants/{id}_mini.png` (~10px tall), `{id}_banner.png` (~20px tall)
- Rendering uses mini logos in live/final and mini logos in pregame flanking “VS”. Missing logos fall back to outlined boxes.

Troubleshooting logos
- Ensure assets ended up in the project’s `assets/` folder (the fetcher now writes relative to the repo).
- Run the check task:
  - `source .venv/bin/activate && python scripts/check_assets.py`
  - Confirms `assets/teams.json` presence and per-favorite logo/variant files.
- If you previously ran the fetcher from a different directory, re-run it from the repo or with the updated script so files land under this project.

Config
- JSON: `config/favorites.json` controls favorites, timezone, matrix, refresh.
- .env overrides: MATRIX_WIDTH, MATRIX_HEIGHT, TIMEZONE, REFRESH_* and more (see `.env.example`).

Structure
- `app.py` entrypoint and loop
- `src/config/*` load config and env overrides
- `src/data/espn.py` ESPN WNBA scoreboard client
- `src/select/choose.py` favorite-based game selection
- `src/render/*` renderer and scenes (pregame/live/final)
- `assets/*` logos and fonts

Notes
- ESPN endpoints used are unofficial and may change. Poll cadences are conservative and configurable.
- Renderer falls back to simulation automatically if `rgbmatrix` is missing.

VS Code Tasks
- Terminal → Run Task…
  - "Create venv" → "Install requirements"
  - "Install rgbmatrix (bindings)"
  - "Hardware Self-Test (demo.py)"
  - "Fetch WNBA assets (logos/colors)"
  - "Run (sim once)", "Run (demo sim)", or "Run (matrix loop)"
