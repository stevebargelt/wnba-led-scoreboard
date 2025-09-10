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

Reliability & Performance Features
The system includes comprehensive reliability improvements to ensure consistent operation even when network conditions are poor:

Network Resilience
- **Circuit Breaker**: Automatically stops hitting failing ESPN API endpoints and recovers gracefully
- **Exponential Backoff**: Smart retry strategy that backs off when services are struggling
- **Cached Fallbacks**: Uses recently cached game data when fresh API calls fail
- **Stale Cache Recovery**: Falls back to expired cache data during extended outages (up to 1 hour old)
- **Emergency Fallback**: Maintains last successful game data for up to 30 minutes when all else fails

Adaptive Performance
- **Smart Refresh Rates**: Automatically adjusts polling frequency based on:
  - Game state (faster near tip-off, slower during breaks and completed games)
  - Network conditions (slower refresh during network issues)
  - Game activity (faster when scores are changing)
- **Break Detection**: Recognizes timeouts, halftime, and other game breaks to reduce unnecessary polling
- **Intelligent Caching**: Caches completed games longer, live games shorter, with automatic cleanup

Configuration
All reliability features can be tuned via environment variables:
```
# Network resilience settings
ESPN_CACHE_TTL=300                    # Cache duration in seconds (default: 5 minutes)
ESPN_STALE_CACHE_MAX_AGE=3600        # Max age for stale cache fallback (default: 1 hour)  
ESPN_CIRCUIT_FAILURE_THRESHOLD=3     # Failures before circuit opens (default: 3)
ESPN_MAX_FALLBACK_AGE_MINUTES=30     # Max age for emergency fallback (default: 30 min)
HTTP_TIMEOUT=10                      # HTTP request timeout (default: 10 seconds)
```

The system gracefully degrades during network issues, ensuring your scoreboard keeps running with the most recent data available.

Notes
- ESPN endpoints used are unofficial and may change. The enhanced client handles failures gracefully.
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
 Getting a DEVICE_TOKEN
 - Deploy the mint function (see `supabase/README.md` → Mint device tokens) and ensure you’re signed in as the device owner.
 - Request a token:
   - `curl -sS -X POST https://<project-ref>.functions.supabase.co/mint-device-token \
      -H 'Content-Type: application/json' -H 'apikey: <ANON_KEY>' -H 'Authorization: Bearer <USER_JWT>' \
      -d '{"device_id":"<DEVICE_ID>","ttl_days":30}'`
 - Put the `token` into `/etc/wnba-led-agent.env` as `DEVICE_TOKEN` and restart the agent.

## Deployment Guide

### Production Deployment on Raspberry Pi

#### Prerequisites
- Raspberry Pi 3B+ or newer with Raspbian OS
- RGB LED Matrix HAT (e.g., Adafruit RGB Matrix HAT)
- 64x32 RGB LED panel (or your preferred size)
- Stable internet connection
- SSH access to the Pi

#### Step 1: System Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required system packages
sudo apt install -y python3-dev python3-pip python3-venv git

# Clone the repository
cd /home/pi
git clone https://github.com/stevebargelt/wnba-led-scoreboard.git
cd wnba-led-scoreboard
```

#### Step 2: Python Environment Setup
```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Install RGB matrix bindings (hardware-specific)
bash scripts/install_rgbmatrix.sh
```

#### Step 3: Hardware Testing
```bash
# Test your LED matrix hardware
bash scripts/hardware_self_test.sh

# If default settings don't work, try different options:
bash scripts/hardware_self_test.sh --rows 32 --cols 64 --brightness 60
```

#### Step 4: Configuration
```bash
# Copy and customize configuration
cp config/favorites.json config/favorites.json.backup
nano config/favorites.json

# Set up environment overrides (optional)
cp .env.example .env
nano .env

# Fetch team assets (logos and colors)
source .venv/bin/activate
python scripts/fetch_wnba_assets.py
```

#### Step 5: Initial Testing
```bash
# Test in simulation mode first
python app.py --sim --once

# Check the generated image
ls -la out/frame.png

# Test with demo data
python app.py --sim --demo

# Test on hardware (requires sudo for GPIO access)
sudo -E $(pwd)/.venv/bin/python app.py --once
```

#### Step 6: Systemd Service Setup
```bash
# Copy systemd service file
sudo cp scripts/systemd/wnba-led.service /etc/systemd/system/

# Edit service file to match your paths
sudo nano /etc/systemd/system/wnba-led.service

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable wnba-led.service
sudo systemctl start wnba-led.service

# Check status
sudo systemctl status wnba-led.service
```

#### Step 7: Agent Setup (Optional - for remote management)
```bash
# Copy agent configuration
sudo cp etc/wnba-led-agent.env.example /etc/wnba-led-agent.env

# Edit with your Supabase credentials
sudo nano /etc/wnba-led-agent.env

# Install and start agent service
sudo cp scripts/systemd/wnba-led-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable wnba-led-agent.service
sudo systemctl start wnba-led-agent.service
```

### Web Admin Deployment

#### Local Development
```bash
cd web-admin
cp .env.local.example .env.local
nano .env.local  # Add your Supabase credentials

npm ci
npm run dev
```

#### Production Deployment (Vercel)
```bash
cd web-admin

# Build and test locally first
npm run build
npm run start

# Deploy to Vercel
npm install -g vercel
vercel --prod
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### Production Deployment (Self-hosted)
```bash
cd web-admin
npm ci
npm run build

# Copy build output to your web server
# Example for nginx:
sudo cp -r .next/static/* /var/www/html/
sudo cp -r .next/server/* /var/www/html/
```

## Troubleshooting Guide

### Network Connectivity Issues

#### Symptoms
- Scoreboard shows "No games" when games should be available
- Console shows `[warn] fetch_scoreboard failed` messages
- Display shows stale/outdated game information

#### Diagnosis Steps
```bash
# Test basic internet connectivity
ping -c 4 8.8.8.8

# Test ESPN API accessibility
curl -I "http://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard"

# Check DNS resolution
nslookup site.api.espn.com

# Test with specific date (format: YYYYMMDD)
curl "http://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard?dates=20240915"
```

#### Common Solutions

**No Internet Connection**
```bash
# Check network interface status
ip addr show

# Restart network service
sudo systemctl restart networking

# Check WiFi connection (if using WiFi)
iwconfig
sudo wpa_cli reconfigure
```

**DNS Issues**
```bash
# Add backup DNS servers to /etc/resolv.conf
echo "nameserver 8.8.8.8" | sudo tee -a /etc/resolv.conf
echo "nameserver 1.1.1.1" | sudo tee -a /etc/resolv.conf

# Or configure in /etc/dhcpcd.conf for permanent fix
echo "static domain_name_servers=8.8.8.8 1.1.1.1" | sudo tee -a /etc/dhcpcd.conf
```

**Firewall Blocking**
```bash
# Check if firewall is running
sudo ufw status

# Allow outbound HTTP traffic (if needed)
sudo ufw allow out 80/tcp
sudo ufw allow out 443/tcp
```

**Proxy/Corporate Network**
```bash
# Set proxy environment variables if needed
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080

# Add to .env file for persistence
echo "HTTP_PROXY=http://proxy.company.com:8080" >> .env
echo "HTTPS_PROXY=http://proxy.company.com:8080" >> .env
```

### ESPN API Failure Scenarios

#### Understanding the Resilience System
The scoreboard uses a multi-layer fallback system when ESPN API fails:
1. **Circuit Breaker**: Stops hitting failing endpoints temporarily
2. **Fresh Cache**: Uses recently cached data (default: 5 minutes)
3. **Stale Cache**: Falls back to expired cache (up to 1 hour old)
4. **Emergency Fallback**: Uses last successful data (up to 30 minutes)

#### Symptoms
- Console shows repeated `[warn] fetch_scoreboard failed` messages
- Display shows older game information but still functions
- Console shows `[info] Using stale cached data` or `[info] Using emergency fallback data`

#### Monitoring API Health
```bash
# Check circuit breaker status (requires API status endpoint)
curl "http://localhost:8000/api/status" 2>/dev/null | grep -i circuit

# Monitor cache directory
ls -la cache/espn/
find cache/espn/ -name "*.json" -exec stat -c "%n: %y" {} \;

# Check service logs
sudo journalctl -u wnba-led.service -f --lines=50

# Test ESPN API directly
curl -v "http://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard?dates=$(date +%Y%m%d)"
```

#### Configuration Tuning
```bash
# Edit .env to adjust resilience settings
nano .env

# Key settings:
ESPN_CACHE_TTL=300                    # Fresh cache duration (seconds)
ESPN_STALE_CACHE_MAX_AGE=3600        # Max stale cache age (seconds)
ESPN_CIRCUIT_FAILURE_THRESHOLD=3     # Failures before circuit opens
ESPN_MAX_FALLBACK_AGE_MINUTES=30     # Emergency fallback age limit
HTTP_TIMEOUT=10                      # Request timeout
```

#### Troubleshooting Steps

**Circuit Breaker Stuck Open**
```bash
# Wait for automatic recovery (default: 1 minute) or restart service
sudo systemctl restart wnba-led.service

# Lower failure threshold if network is unreliable
echo "ESPN_CIRCUIT_FAILURE_THRESHOLD=5" >> .env
```

**Cache Directory Issues**
```bash
# Check cache permissions
ls -la cache/
sudo chown -R pi:pi cache/

# Clear corrupted cache
rm -rf cache/espn/*

# Verify disk space
df -h
```

**Persistent API Failures**
```bash
# Check if ESPN changed their API
curl -I "http://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard"

# Enable debug logging
echo "DEBUG=true" >> .env
sudo systemctl restart wnba-led.service

# Monitor for API changes
sudo journalctl -u wnba-led.service -f | grep -i "error\|fail\|exception"
```

### Hardware/LED Matrix Problems

#### Common Symptoms
- Display is blank/dark but service is running
- Colors are wrong or washed out
- Display is flickering or has artifacts
- Only partial display working (half dark, single color)
- Service crashes with hardware errors

#### Initial Diagnosis
```bash
# Check if service is running
sudo systemctl status wnba-led.service

# Test in simulation mode first
sudo -E $(pwd)/.venv/bin/python app.py --sim --once
ls -la out/frame.png  # Should create an image file

# Check hardware connections
dmesg | grep -i spi
ls -la /dev/spi*
```

#### Power Supply Issues
**Symptoms**: Dim display, flickering, random crashes, partial functionality

```bash
# Check system voltage (should be ~5V)
vcgencmd measure_volts

# Monitor power with stress test
vcgencmd measure_volts & stress --cpu 4 --timeout 30s

# Check for undervoltage warnings
dmesg | grep -i "voltage"
vcgencmd get_throttled
```

**Solutions**:
- Use official Raspberry Pi power supply (5V/3A minimum)
- Check USB-C cable quality and connection
- Consider external power supply for large LED panels

#### GPIO/Hardware Connection Issues
**Symptoms**: Completely blank display, wrong colors, partial segments

```bash
# Test GPIO permissions
ls -la /dev/mem /dev/gpiomem

# Check if other processes are using GPIO
sudo lsof /dev/mem /dev/gpiomem

# Test with hardware demo
cd /home/pi/rpi-rgb-led-matrix/examples-api-use
sudo ./demo -D0 --led-rows=32 --led-cols=64
```

**Solutions**:
```bash
# Ensure GPIO access
sudo usermod -a -G gpio pi

# Check hardware connections:
# - Ribbon cable properly seated
# - HAT firmly connected to GPIO pins
# - Power connector secure

# Disable SPI if causing conflicts
sudo raspi-config
# Advanced Options → SPI → Disable
```

#### Display Configuration Issues
**Symptoms**: Wrong size, incorrect layout, performance problems

```bash
# Test different hardware settings
sudo -E $(pwd)/.venv/bin/python app.py --once

# Common hardware mapping options to try:
# adafruit-hat (default)
# regular
# adafruit-hat-pwm
# compute-module
```

**Configuration in .env**:
```bash
# Matrix hardware settings
MATRIX_WIDTH=64
MATRIX_HEIGHT=32
MATRIX_CHAIN_LENGTH=1
MATRIX_PARALLEL=1
MATRIX_GPIO_SLOWDOWN=2
MATRIX_BRIGHTNESS=80
MATRIX_HARDWARE_MAPPING=adafruit-hat
MATRIX_PWM_BITS=11
```

#### Performance Issues
**Symptoms**: Slow updates, flickering, poor refresh rate

```bash
# Increase GPIO slowdown for stability
echo "MATRIX_GPIO_SLOWDOWN=4" >> .env

# Reduce PWM bits for better performance
echo "MATRIX_PWM_BITS=9" >> .env

# Lower brightness to reduce power draw
echo "MATRIX_BRIGHTNESS=60" >> .env

# Disable WiFi if using Ethernet (reduces interference)
sudo systemctl disable wpa_supplicant
```

#### HAT-Specific Issues

**Adafruit RGB Matrix HAT**:
```bash
# Verify HAT detection
sudo i2cdetect -y 1

# Check HAT EEPROM
sudo dtparam i2c_arm=on
sudo modprobe i2c-dev
```

**Generic/DIY Connections**:
```bash
# Try different hardware mappings
echo "MATRIX_HARDWARE_MAPPING=regular" >> .env

# Adjust timing parameters
echo "MATRIX_GPIO_SLOWDOWN=1" >> .env  # Try values 1-4
```

#### Emergency Recovery
```bash
# Force simulation mode if hardware is broken
echo "SIM_MODE=true" >> .env
sudo systemctl restart wnba-led.service

# Check if display works at all
sudo -E $(pwd)/.venv/bin/python -c "
import time
from PIL import Image, ImageDraw
try:
    from rgbmatrix import RGBMatrix, RGBMatrixOptions
    opts = RGBMatrixOptions()
    opts.rows, opts.cols = 32, 64
    matrix = RGBMatrix(options=opts)
    image = Image.new('RGB', (64, 32))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 64, 32), fill=(255, 0, 0))
    matrix.SetImage(image)
    time.sleep(5)
except ImportError:
    print('RGB Matrix not available - hardware issue')
except Exception as e:
    print(f'Hardware error: {e}')
"
```

### Web Admin Authentication Issues

#### Common Symptoms
- Cannot access web admin interface
- Login page appears but authentication fails
- "User not authorized" or similar errors
- Blank/white screen after authentication

#### Supabase Connection Issues
```bash
# Test Supabase connectivity
curl -I "https://YOUR_PROJECT.supabase.co/rest/v1/"

# Check environment variables
cd web-admin
cat .env.local | grep SUPABASE

# Verify Supabase configuration
npm run dev  # Check console for connection errors
```

#### Authentication Setup Issues
```bash
# Verify Supabase Auth settings in dashboard:
# - Authentication → Settings → Site URL
# - Authentication → URL Configuration → Redirect URLs

# Check if user exists in Supabase
# Dashboard → Authentication → Users

# Test API key permissions
curl -H "apikey: YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     "https://YOUR_PROJECT.supabase.co/rest/v1/devices"
```

#### Common Configuration Problems

**Missing Environment Variables**:
```bash
cd web-admin

# Ensure .env.local exists and has correct values
cp .env.local.example .env.local
nano .env.local

# Required variables:
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

**Row Level Security Issues**:
```sql
-- Check RLS policies in Supabase dashboard → Database → Policies
-- Ensure these policies exist on the 'devices' table:

-- Allow users to see their own devices
CREATE POLICY "Users can select own devices" ON devices 
FOR SELECT USING (owner_user_id = auth.uid());

-- Allow users to insert devices
CREATE POLICY "Users can insert devices" ON devices 
FOR INSERT WITH CHECK (owner_user_id = auth.uid());
```

**CORS/Domain Issues**:
- Supabase Dashboard → Authentication → Settings
- Ensure your domain is in "Site URL" and "Redirect URLs"
- For local development: `http://localhost:3000`
- For production: `https://your-domain.com`

#### Debugging Steps
```bash
# Enable debug mode
cd web-admin
echo "NEXT_PUBLIC_DEBUG=true" >> .env.local

# Check browser console for errors
# Open Developer Tools → Console tab

# Test authentication flow manually
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('YOUR_URL', 'YOUR_ANON_KEY');
supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'password'
}).then(console.log).catch(console.error);
"
```

### Configuration Troubleshooting

#### Invalid JSON Configuration
```bash
# Validate JSON syntax
python -m json.tool config/favorites.json

# Check for common issues:
# - Missing commas
# - Trailing commas
# - Unquoted strings
# - Invalid escape sequences

# Test configuration loading
python -c "
from src.config.loader import load_config
try:
    cfg = load_config('config/favorites.json')
    print('Configuration loaded successfully')
    print(f'Found {len(cfg.favorites)} favorite teams')
except Exception as e:
    print(f'Configuration error: {e}')
"
```

#### Environment Variable Issues
```bash
# Check current environment
env | grep -E "(MATRIX|ESPN|DEMO|SIM)"

# Test environment loading
python -c "
import os
from dotenv import load_dotenv
load_dotenv()
print(f'Matrix size: {os.getenv(\"MATRIX_WIDTH\")}x{os.getenv(\"MATRIX_HEIGHT\")}')
print(f'Timezone: {os.getenv(\"TIMEZONE\")}')
print(f'Demo mode: {os.getenv(\"DEMO_MODE\")}')
"

# Verify .env file syntax (no spaces around =)
grep -n "=" .env | grep " "  # Should show no results
```

#### Team Configuration Problems
```bash
# Verify team assets exist
ls -la assets/teams.json
ls -la assets/logos/

# Check team data
python -c "
import json
with open('assets/teams.json') as f:
    teams = json.load(f)
    print(f'Found {len(teams)} teams')
    for team in teams[:3]:
        print(f'  {team[\"id\"]}: {team[\"displayName\"]} ({team[\"abbreviation\"]})')
"

# Re-fetch team assets if needed
source .venv/bin/activate
python scripts/fetch_wnba_assets.py
```

#### Service Configuration Issues
```bash
# Check systemd service files
sudo systemctl cat wnba-led.service
sudo systemctl cat wnba-led-agent.service

# Verify file paths in service files match your installation
sudo nano /etc/systemd/system/wnba-led.service

# Check service status and logs
sudo systemctl status wnba-led.service --no-pager -l
sudo journalctl -u wnba-led.service --lines=50

# Reload and restart if configuration changed
sudo systemctl daemon-reload
sudo systemctl restart wnba-led.service
```

#### Permission Issues
```bash
# Check file permissions
ls -la config/favorites.json
ls -la .env
ls -la cache/

# Fix common permission issues
sudo chown -R pi:pi /home/pi/wnba-led-scoreboard
chmod 644 config/favorites.json .env
chmod 755 cache/

# Check service user permissions
sudo -u pi python app.py --sim --once
```
