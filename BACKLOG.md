# Backlog

## Active

### BL-006: Add libcairo2-dev to Pi setup dependencies
The `fetch_nhl_assets.py` script requires `cairosvg` which needs the `libcairo2-dev` system package. Add it to:
- `install_rgbmatrix.sh` apt install step
- README / setup documentation

## Done (recent)

### BL-001: Clean up dead NHL team_assets_url endpoint — CLOSED 2026-05-27
### BL-002: Update WNBA/NHL season dates for 2026 — CLOSED 2026-05-27
### BL-003: WNBA parser reads broadcasts from wrong path — CLOSED 2026-05-27
### BL-004: NBA teams parser reads 'logo' but ESPN returns 'logos' array — CLOSED 2026-05-27
### BL-005: WNBA teams parser reads venue but ESPN doesn't include it — CLOSED 2026-05-27

## Notes-for-next-session

### DECISION: Rewriting Python scoreboard in Go
User hates the Python dependency hell (venv, pip, Pillow headers, rgbmatrix build). Decision made to rewrite the scoreboard app in Go. A full plan was created and approved (see below). The Go project will live at `go-scoreboard/` in the repo root.

### Go Rewrite Plan (approved by user)
**7 phases**, ~2,250 lines estimated:
1. **Phase 1: Proof of Life** — Go module, display interface, rgbmatrix via build tags, test pattern on LED matrix. THIS IS THE NEXT TASK.
2. **Phase 2: Fonts + Basic Rendering** — Load pixel fonts via `golang.org/x/image/font/opentype`, port idle scene
3. **Phase 3: ESPN Client** — WNBA scoreboard HTTP+JSON, GameSnapshot model
4. **Phase 4: Live Scene** — Port live scene, logo loading/compositing
5. **Phase 5: Config + Supabase** — .env + PostgREST client for `get_device_configuration` RPC
6. **Phase 6: Remaining Scenes + NHL** — pregame, final, live_big scenes + NHLE client
7. **Phase 7: Main Loop + Polish** — polling, SIGHUP reload, graceful shutdown, caching

**Key architecture decisions:**
- Build tags: `//go:build matrix` for Pi hardware, `//go:build !matrix` stub for Mac dev
- Dependencies: `image` stdlib for rendering, `golang.org/x/image/font/opentype` for fonts, `github.com/mcuadros/go-rpi-rgb-led-matrix` for LED, `github.com/joho/godotenv` for .env, direct PostgREST HTTP for Supabase (no SDK)
- Project structure: `go-scoreboard/cmd/scoreboard/main.go` + `go-scoreboard/internal/{config,display,espn,nhl,model,render,teams}/`
- Skip Python's over-abstractions: no DI container, no 4-layer config precedence, no scene registry — just simple Go

**Development workflow:** VS Code Remote SSH to Pi for Phase 1 (hardware testing). Then shift to Mac simulator mode for bulk coding.

### LED Panel Hardware Config (CONFIRMED WORKING)
Panel: S-P4-2020-A3 (P4 outdoor, SMD2020)
Working rgbmatrix settings:
- `rows=32, cols=32, chain_length=2` (NOT cols=64 chain=1)
- `multiplexing=0`
- `pixel_mapper_config="Rotate:180"`
- `gpio_slowdown=4` (Pi 4 needs higher than default 2)
- `hardware_mapping="adafruit-hat"`
**Status:** Quadrants display in correct positions. Some pixel bleeding observed but gpio_slowdown=4 was not yet tested with the correct config (was only tested with slowdown=2). Try slowdown 3/4/5 to clean up bleeding.

### Pi State (led-scoreboard-3, fresh reformat)
- **OS:** Raspberry Pi OS (fresh install, 2026-05-27)
- **Hostname:** led-scoreboard-3 (new Pi, old one was led-scoreboard-2 which bricked)
- **SSH:** Working (`ssh pi@led-scoreboard-3.local`)
- **Home dir:** `chmod 755 /home/pi` DONE (required for rgbmatrix privilege drop)
- **Apt packages installed:** git, python3-venv, python3-dev, build-essential, swig, libjpeg-dev, zlib1g-dev, libcairo2-dev
- **Go:** NOT yet installed on Pi — needed for Phase 1
- **Python venv:** EXISTS at `~/wnba-led-scoreboard/.venv` (created with `--system-site-packages`)
- **rgbmatrix Python:** Installed via Adafruit script + manual `pip install .` from `~/rpi-rgb-led-matrix/rpi-rgb-led-matrix-7a503494378a67f3baa4ac680cecbae2703cc58f/bindings/python/`
- **rgbmatrix C library:** Built at `~/rpi-rgb-led-matrix/rpi-rgb-led-matrix-7a503494378a67f3baa4ac680cecbae2703cc58f/`
- **Adafruit RGB Matrix Bonnet installer:** Was run (`curl https://raw.githubusercontent.com/adafruit/Raspberry-Pi-Installer-Scripts/main/rgb-matrix.sh`)
- **Repo cloned:** `~/wnba-led-scoreboard` via HTTPS (not SSH — SSH key not set up)
- **Branch:** `feat/client-side-preview-v2`
- **Team assets:** WNBA fetched, NHL fetched (required libcairo2-dev for cairosvg)
- **.env:** Created manually with Supabase creds, device ID, matrix config

### Uncommitted Changes on Mac
The engineer made changes to fix 128x64→64x32 defaults but they are NOT yet committed:
- `src/config/supabase_config_loader.py` line 233: `MatrixConfig(width=64, height=32)` (was 128x64)
- `web-admin/src/components/preview/__tests__/DisplayPreview.test.tsx`: test assertions updated to 64x32
- `web-admin/src/lib/preview/__tests__/scenes.test.ts`: height=32, font size assertions updated

### Active Backlog
- BL-006: Add libcairo2-dev to Pi setup dependencies (install_rgbmatrix.sh + docs)

### Workflow Decision: NO FORGE for Go rewrite
The forge engineer containers cannot access Pi GPIO hardware, so the forge pipeline adds no value here. Instead:
- Open VS Code Remote SSH to `pi@led-scoreboard-3.local`
- Run Claude Code directly on the Pi
- Claude writes code, builds, runs — user validates LED output visually
- No forge invoke, no containers, no pipeline
- This is a direct Claude Code session, not an orchestrated one

### Go needs to be installed on the Pi
Go is NOT yet installed. First thing next session:
```bash
sudo apt install -y golang
```
Or for latest version:
```bash
wget https://go.dev/dl/go1.24.4.linux-arm64.tar.gz
sudo tar -C /usr/local -xzf go1.24.4.linux-arm64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc
```

### Picked up next: Go rewrite Phase 1 — open VS Code Remote SSH to Pi, install Go, create `go-scoreboard/` project, get test pattern on LED matrix.
