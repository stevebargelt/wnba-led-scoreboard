# Multi-League LED Scoreboard

Display live sports scores on RGB LED matrix panels — WNBA, NHL, NBA, MLB, NFL.

This is a multi-tenant product: users sign up, register their own scoreboard devices, and configure each one independently. One panel can show only NHL, another only WNBA, a third a mix of both. Configuration lives in Supabase; each device polls for its own settings and pulls live game data from ESPN / NHL APIs.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Go Device  │────▶│   Supabase   │◀────│  Web Admin   │
│   (on Pi)   │     │  (Postgres   │     │   (Next.js)  │
│             │     │   + RLS)     │     │              │
└─────────────┘     └──────────────┘     └──────────────┘
       │                                          
       └──▶ ESPN / NHL APIs (live game data)      
```

- **Go device** (`go-scoreboard/`): single static Go binary running on a Raspberry Pi with an Adafruit RGB Matrix HAT. Polls Supabase for config, ESPN/NHL for live games, renders to a 64×32 chained-2 LED panel.
- **Web admin** (`web-admin/`): Next.js 14 + TypeScript + Tailwind. Users sign up via Supabase Auth, register devices they own, configure leagues and favorite teams per device.
- **Supabase**: Postgres with RLS policies enforcing per-user device ownership. Three migration files set up the entire schema.

No WebSockets, no edge functions, no realtime subscriptions. The device polls. Simple by design.

## Repository Layout

| Path | What it is |
|------|-----------|
| `go-scoreboard/` | The Go scoreboard binary that runs on the Pi. See **CLAUDE.md** for the dev process and hardware setup. |
| `web-admin/` | Next.js admin interface. See `web-admin/README.md` for setup. |
| `supabase/migrations/` | Database schema (3 migration files). Run in order in the Supabase SQL editor. |
| `assets/` | Team logos and pixel fonts (logos are gitignored; fetched on the Pi). |
| `scripts/` | Hardware setup helpers (mostly shell). |
| `CLAUDE.md` | Detailed dev process: Go scoreboard, Pi hardware, dev loop, gotchas. **Read this first if you're working on the device.** |

## Quick Start

### 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run each migration in order:
   - `supabase/migrations/001_complete_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_seed_data.sql`
3. Note your project URL, anon key, and service-role key.

Detailed steps in `docs/SUPABASE_SETUP.md`.

### 2. Web admin

```bash
cd web-admin
npm ci
cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
EOF
npm run dev   # → http://localhost:3000
```

Sign up, then register your first device. The admin gives you a `DEVICE_ID` to put into the device's environment.

### 3. Device (Go scoreboard on the Pi)

See **CLAUDE.md → Go Scoreboard** for the full Pi setup (hardware prerequisites, `librgbmatrix` install, blacklisted modules, exact dev loop). Short version:

```bash
# On the Pi (after Go and librgbmatrix are installed — see CLAUDE.md):
cd go-scoreboard
go build -tags matrix -o scoreboard-matrix ./cmd/scoreboard

# Env: SUPABASE_URL, SUPABASE_ANON_KEY, DEVICE_ID
sudo ./scoreboard-matrix
```

For simulator development (no hardware), build without `-tags matrix` and run `./scoreboard --sim --once` — writes `out/frame.png`.

## Hardware

- Raspberry Pi 3B+ or newer (developed on Pi 4)
- Adafruit RGB Matrix HAT (`adafruit-hat` GPIO mapping)
- RGB LED matrix panel(s): currently tested with 2× 32×32 panels chained, rotated 180°
- 5V/3A+ power supply

`snd_bcm2835` must be blacklisted on the Pi for hardware PWM; without it the panel renders with artifacts. CLAUDE.md has the exact procedure and panel config.

## Supported Leagues

| League | Status | Season | API |
|--------|--------|--------|-----|
| WNBA | Live | May–Oct | ESPN |
| NHL  | Live | Oct–Jun | NHL  |
| NBA  | Ready | Oct–Jun | ESPN |
| MLB  | Ready | Mar–Nov | ESPN |
| NFL  | Ready | Sep–Feb | ESPN |

## Status

- **Go device:** Active. The original Python implementation is frozen and slated for removal.
- **Web admin:** Active. A redesign is underway — IA, dead-control cleanup, persistent preview surface.
- **Preview:** In flight. A client-side Canvas preview exists in the admin but drifts from the device renderer; longer-term direction is to compile the Go renderer to WASM so the browser preview is bit-identical with the device.

## Contributing

1. Branch off `main` with a conventional-commit name (`feat/...`, `fix/...`, `chore/...`).
2. For Go device changes, see CLAUDE.md's "Go Scoreboard" section.
3. For web admin: `cd web-admin && npm run dev && npm run test && npm run lint`.
4. Open a PR — do not commit directly to `main`.

## License

MIT.

## Acknowledgments

- [rpi-rgb-led-matrix](https://github.com/hzeller/rpi-rgb-led-matrix) — the C library that drives the panel
- ESPN and NHL public APIs for live game data
- Supabase for database and auth
