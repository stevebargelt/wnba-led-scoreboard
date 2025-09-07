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

Render Layouts
- Configure in `config/favorites.json` under a new `render` block, or via `.env` overrides.
- Options:
  - `render.live_layout`: `stacked` (default) or `big-logos`
  - `render.logo_variant`: `mini` or `banner` (default `mini`)
  - `.env` equivalents: `LIVE_LAYOUT`, `LOGO_VARIANT`
- Stacked (default): two rows with mini logos (≈10px), abbr, right‑aligned scores; clock bottom center.
- Big‑logos: 20×20 logos (home left, away right); center column shows period, two text rows (abbr+score), and clock.
  - Use with `.env`: `LIVE_LAYOUT=big-logos` (uses banner logo variant, scaled to fit 20×20).
 Agent & Cloud Admin (Preview)
- Device Agent (skeleton) subscribes to a Supabase Realtime channel and applies config/commands.
- Install extra dependency for Realtime: `pip install websocket-client` (already in requirements).
- Env vars (or `/etc/wnba-led-agent.env`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DEVICE_ID`, `DEVICE_TOKEN?`, `CONFIG_PATH`, `SCOREBOARD_SERVICE`.
- Systemd unit template: `scripts/systemd/wnba-led-agent.service` and env example `scripts/systemd/wnba-led-agent.env.example`.
 - Start locally:
   - `python -m src.agent.agent` (skeleton loop)
   - Apply a config file: `python -m src.agent.agent apply config/favorites.json --pid <scoreboard-pid>`

 Example Env File for the Agent
 - A ready-to-copy template is included at `etc/wnba-led-agent.env.example`.
 - Copy to the system location and edit values:
   - `sudo cp etc/wnba-led-agent.env.example /etc/wnba-led-agent.env`
   - `sudo nano /etc/wnba-led-agent.env` (set SUPABASE_URL, SUPABASE_ANON_KEY, and DEVICE_ID)
 - How to find DEVICE_ID:
   - Supabase Dashboard → Database → Table Editor → `public.devices`
   - Insert a device (name + your user’s owner_user_id), then copy the `id` from that row
   - Paste this UUID into `DEVICE_ID=` in `/etc/wnba-led-agent.env`
 - Restart the agent:
   - `sudo systemctl daemon-reload && sudo systemctl restart wnba-led-agent.service`

 Supabase Realtime (Test End-to-End)
 - Agent expects a Phoenix channel `device:<DEVICE_ID>` on your Supabase Realtime endpoint.
 - Option A (CLI publisher for quick tests):
   - `python scripts/publish_command.py --device-id <id> --type APPLY_CONFIG --file config/favorites.json \
      --realtime-url wss://<project>.supabase.co/realtime/v1/websocket --apikey <ANON_KEY>`
   - For a restart: `--type RESTART --payload '{"service":"wnba-led.service"}'`
 - Option B (Edge Function):
   - Deploy `supabase/functions/publish-command/index.ts` via Supabase CLI.
   - Set function env: `SUPABASE_REALTIME_URL`, `SUPABASE_ANON_KEY`.
   - Invoke with JSON body `{ "device_id": "<uuid>", "type": "APPLY_CONFIG", "payload": { ... } }`.

 Supabase Env Setup
 - Where to find values (Supabase Dashboard → Settings → API):
   - `SUPABASE_URL`: Project URL (looks like `https://<project-ref>.supabase.co`)
   - `SUPABASE_ANON_KEY`: “anon public” API key
   - `SUPABASE_REALTIME_URL` (optional): `wss://<project-ref>.supabase.co/realtime/v1/websocket`
 - Device identity:
   - `DEVICE_ID`: the `id` (UUID) from a row in `public.devices`
     - Create via Table editor (insert row with `name` and your `owner_user_id`) or SQL:
       - `insert into public.devices (name, owner_user_id) values ('Pi-LivingRoom', '<your-auth-user-uuid>') returning id;`
     - Find your `owner_user_id` under Dashboard → Authentication → Users → copy your UUID
   - `DEVICE_TOKEN` (optional, for tighter security): device-scoped JWT that carries `device_id` in its claims
     - For initial testing, you can omit this and rely on `SUPABASE_ANON_KEY` for Realtime access
     - For production, mint a device JWT from an Edge Function or server with claim `{ device_id: '<DEVICE_ID>' }`
 - Where to set values on the Pi:
   - Systemd env file (recommended): `/etc/wnba-led-agent.env`
     - Example:
       - `SUPABASE_URL=https://<project-ref>.supabase.co`
       - `SUPABASE_ANON_KEY=ey...`
       - `SUPABASE_REALTIME_URL=wss://<project-ref>.supabase.co/realtime/v1/websocket`
       - `DEVICE_ID=<uuid-from-devices-table>`
       - `DEVICE_TOKEN=ey...`  (optional)
       - `CONFIG_PATH=/home/pi/wnba-led-scoreboard/config/favorites.json`
       - `SCOREBOARD_SERVICE=wnba-led.service`
     - Then:
       - `sudo cp scripts/systemd/wnba-led-agent.service /etc/systemd/system/`
       - `sudo systemctl daemon-reload && sudo systemctl enable --now wnba-led-agent.service`
  - For local testing without systemd, export in shell before running the agent:
    - `export SUPABASE_URL=... SUPABASE_ANON_KEY=... DEVICE_ID=...`
    - `python -m src.agent.agent`

 Create a Supabase User and Device ID (Step‑by‑Step)
 1) Create (or identify) an Auth user
    - Dashboard → Authentication → Users → “Add user”
      - Enter your email (and password if you prefer “Add user with password”), or use “Invite” to send a magic link. Either way, the user will appear in the Users list.
    - After the user is created, click the user row and copy their “User ID” (UUID). This is the value stored in `auth.users.id` and will become `owner_user_id` for your device.
    - SQL alternative (in Dashboard → SQL editor):
      - `select id, email from auth.users order by created_at desc;`

 2) Create a device row owned by that user
    - Table Editor (Dashboard → Database → Tables → public.devices): “Insert row”
      - Set `name` (e.g., `Pi-LivingRoom`)
      - Set `owner_user_id` to the user UUID from step 1
      - Save → copy the generated `id` (UUID)
    - SQL alternative (Dashboard → SQL editor):
      - `insert into public.devices (name, owner_user_id) values ('Pi-LivingRoom', '<USER_UUID>') returning id, name;`
      - Copy the returned `id`

 3) Set the agent env on the Pi
    - Use the device UUID as `DEVICE_ID` in `/etc/wnba-led-agent.env` (or export in shell for manual runs):
      - `DEVICE_ID=<UUID from devices.id>`
    - Keep `SUPABASE_URL` and `SUPABASE_ANON_KEY` from Dashboard → Settings → API
    - Optional: `SUPABASE_REALTIME_URL=wss://<project-ref>.supabase.co/realtime/v1/websocket`
    - Optional (production): `DEVICE_TOKEN` = a device‑scoped JWT that includes a `device_id` claim

 4) Verify connectivity (quick test)
    - Start the agent on the Pi
    - From your dev machine, publish a command:
      - `python scripts/publish_command.py --device-id <UUID> --type PING --realtime-url wss://<project-ref>.supabase.co/realtime/v1/websocket --apikey <ANON_KEY>`
    - Check the agent logs for “PING received”
