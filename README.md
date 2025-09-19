# 🏀🏒 Multi-League LED Scoreboard

<div align="center">

![Multi-Sport LED Scoreboard](https://img.shields.io/badge/Multi--Sport-LED%20Scoreboard-orange?style=for-the-badge)
![WNBA](https://img.shields.io/badge/WNBA-Supported-orange?style=for-the-badge&logo=basketball)
![NHL](https://img.shields.io/badge/NHL-Supported-blue?style=for-the-badge&logo=hockey-puck)
![Python](https://img.shields.io/badge/Python-3.8+-blue?style=for-the-badge&logo=python)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-Compatible-red?style=for-the-badge&logo=raspberry-pi)

*Real-time sports scores on RGB LED matrices with direct Supabase integration*

</div>

## 📋 Overview

Display **live sports scores** on RGB LED matrices for multiple professional leagues. The system uses **direct Supabase integration** where the Python app polls configuration from the database - no agents or WebSockets required.

### 🎯 Core Features
- 🏀 **Multi-League Support** - WNBA, NHL, NBA, MLB, NFL
- 🧠 **Smart Game Selection** - Intelligent priority resolution across sports
- 🛡️ **Network Resilience** - Multi-layer fallback with caching
- 🎛️ **Web Admin Interface** - Remote configuration management
- ⚡ **Direct Database Polling** - Simple, reliable architecture
- 🎨 **Multiple Display Layouts** - Stacked scores or big-logos mode

### 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Python App │────▶│   Supabase   │◀────│  Web Admin   │
│  (Polling)  │     │   Database   │     │   (Next.js)  │
└─────────────┘     └──────────────┘     └──────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.8+ environment
- Node.js 18+ and npm
- Supabase account (free tier works)
- Raspberry Pi with LED matrix (optional - can run in simulation)

### Step 1: Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. In SQL Editor, run these 3 migrations in order:
   ```sql
   -- 1. Copy contents of supabase/migrations/001_complete_schema.sql
   -- 2. Copy contents of supabase/migrations/002_rls_policies.sql
   -- 3. Copy contents of supabase/migrations/003_seed_data.sql
   ```

3. Create your device:
   ```sql
   -- Get your user ID
   SELECT id, email FROM auth.users;

   -- Create device
   INSERT INTO devices (name, user_id)
   VALUES ('Living Room Display', 'your-user-id')
   RETURNING id;  -- Save this device ID
   ```

### Step 2: Python App Setup

```bash
# Clone and setup
git clone https://github.com/yourusername/wnba-led-scoreboard.git
cd wnba-led-scoreboard

# Create .env file
cat > .env << EOF
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
DEVICE_ID=your-device-id-from-step-1
EOF

# Install Python dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Fetch team assets
python scripts/fetch_wnba_assets.py
python scripts/fetch_nhl_assets.py

# Test in simulation mode
python app.py --sim --once
# Check out/frame.png for output
```

### Step 3: Web Admin Setup

```bash
cd web-admin

# Create .env file
cat > .env << EOF
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
EOF

# Install and run
npm ci
npm run dev

# Open http://localhost:3000
# Sign up/login, configure your device
```

---

## 🔧 Hardware Setup (Raspberry Pi)

### Required Hardware
- Raspberry Pi 3B+ or newer
- RGB LED Matrix (64x32 or 128x64)
- RGB Matrix HAT (Adafruit or compatible)
- 5V Power Supply (3A+ for larger displays)

### Installation

```bash
# Install RGB matrix library
bash scripts/install_rgbmatrix.sh

# Test hardware
sudo bash scripts/hardware_self_test.sh

# Run scoreboard
sudo -E $(pwd)/.venv/bin/python app.py
```

### Systemd Service (Auto-start)

```bash
# Create service file
sudo tee /etc/systemd/system/scoreboard.service << EOF
[Unit]
Description=LED Scoreboard
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/wnba-led-scoreboard
Environment="PATH=/home/pi/wnba-led-scoreboard/.venv/bin"
ExecStart=/home/pi/wnba-led-scoreboard/.venv/bin/python app.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable scoreboard
sudo systemctl start scoreboard
```

---

## 🎮 Configuration

### Web Admin Interface

1. **Sports Tab** - Enable/disable leagues, set priorities
2. **Favorite Teams Tab** - Select favorite teams per sport
3. **Config Tab** - Display settings (brightness, dimensions, refresh rates)

### Environment Variables

```bash
# Required for Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
DEVICE_ID=your-device-id

# Optional overrides
SIMULATION_MODE=true       # Force simulation (no hardware)
DEMO_MODE=true            # Run with fake games
TIMEZONE=America/New_York # Override timezone
BRIGHTNESS=75             # LED brightness (1-100)
```

### Local Configuration (Fallback)

If Supabase is unavailable, create `config/favorites.json`:

```json
{
  "favorites": {
    "WNBA": ["SEA", "MIN"],
    "NHL": ["SEA", "VAN"]
  },
  "timezone": "America/Los_Angeles",
  "matrix": {
    "width": 128,
    "height": 64,
    "brightness": 100
  }
}
```

---

## 🏀🏒 Supported Sports

| League | Status | Season | API |
|--------|--------|--------|-----|
| WNBA | ✅ Live | May-Oct | ESPN |
| NHL | ✅ Live | Oct-Jun | NHL |
| NBA | ✅ Ready | Oct-Jun | ESPN |
| MLB | ✅ Ready | Mar-Nov | ESPN |
| NFL | ✅ Ready | Sep-Feb | ESPN |

---

## 🚀 Deployment Options

### Development
```bash
python app.py --sim        # Simulation mode
python app.py --demo       # Demo with fake games
```

### Production (Raspberry Pi)
```bash
sudo -E python app.py      # Run with hardware
```

### Web Admin Deployment

**Vercel:**
```bash
cd web-admin
vercel --prod
```

**Self-hosted:**
```bash
cd web-admin
npm run build
pm2 start npm --name scoreboard-admin -- start
```

---

## 🔍 Testing

```bash
# Test Supabase connection
python test_supabase_integration.py

# Run in demo mode
python app.py --demo

# Run web admin tests
cd web-admin && npm test
```

---

## 🐛 Troubleshooting

### Python App Issues

```bash
# Check environment variables
python -c "import os; print(os.getenv('DEVICE_ID'))"

# Test Supabase connection
python test_supabase_integration.py

# Enable debug logging
PYTHONPATH=. python app.py --sim 2>&1 | tee debug.log
```

### Web Admin Issues

```bash
# Check browser console for errors
# Verify .env file exists
# Ensure SUPABASE_SERVICE_ROLE_KEY is set
```

### Database Issues

```sql
-- Check device ownership
SELECT * FROM devices WHERE id = 'your-device-id';

-- Verify leagues exist
SELECT code, name FROM leagues;

-- Check RLS policies
SELECT tablename, policyname FROM pg_policies;
```

---

## 📁 Project Structure

```
.
├── app.py                    # Main scoreboard application
├── src/
│   ├── config/              # Configuration management
│   ├── sports/              # Sports/leagues architecture
│   │   ├── leagues/         # League-specific clients
│   │   └── league_aggregator.py # Multi-league orchestration
│   └── render/              # LED display rendering
├── web-admin/               # Next.js admin interface
│   ├── src/
│   │   ├── components/      # React components
│   │   └── pages/          # Next.js pages
│   └── package.json
├── supabase/
│   └── migrations/         # Database setup (3 files)
├── assets/                 # Team logos and colors
└── config/                 # Local configuration
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `python -m pytest` and `cd web-admin && npm test`
5. Submit a pull request

---

## 📝 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

- ESPN API for WNBA/NBA/NFL/MLB data
- NHL API for hockey data
- [rpi-rgb-led-matrix](https://github.com/hzeller/rpi-rgb-led-matrix) library
- Supabase for database and auth

---

## 📚 Additional Resources

- [CLAUDE.md](CLAUDE.md) - AI assistant guidelines for development
- [Hardware Setup Guide](https://github.com/hzeller/rpi-rgb-led-matrix)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)