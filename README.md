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

Display **live sports scores** on RGB LED matrices for multiple professional leagues. The system uses **direct Supabase integration** with secure database functions - no agents or WebSockets required.

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

#### Python Application Architecture

The Python application uses a modern, testable architecture with dependency injection:

- **Orchestrator Pattern**: Clean separation of concerns with `ApplicationOrchestrator` managing the main loop
- **Dependency Injection**: `ServiceContainer` for managing service lifecycle and dependencies
- **Adapter Pattern**: Adapters bridge existing components to standardized interfaces
- **Configuration Management**: Unified configuration with 4-level precedence system
- **Structured Logging**: Centralized logging with color support and configurable levels

---

## 🚀 Quick Start

### Prerequisites
- Python 3.8+ environment
- Node.js 18+ and npm
- Supabase account (free tier works)
- Raspberry Pi with LED matrix (optional - can run in simulation)

### Step 1: Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. In SQL Editor, run these migrations in order:
   ```sql
   -- 1. Copy contents of supabase/migrations/001_complete_schema.sql
   -- 2. Copy contents of supabase/migrations/002_rls_policies.sql
   -- 3. Copy contents of supabase/migrations/003_seed_data.sql
   -- 4. Copy contents of supabase/migrations/004_device_config_functions_fixed.sql
   ```

3. Create your device via the web admin (see Step 3 below) or manually:
   ```sql
   -- Get your user ID (requires authentication)
   SELECT id, email FROM auth.users;

   -- Create device
   INSERT INTO devices (name, user_id)
   VALUES ('Living Room Display', 'your-user-id')
   RETURNING id;  -- Save this device ID

   -- Enable leagues for your device
   INSERT INTO device_leagues (device_id, league_id, enabled, priority)
   SELECT 'your-device-id', id, true, ROW_NUMBER() OVER (ORDER BY code)
   FROM leagues WHERE code IN ('wnba', 'nhl');
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
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DEVICE_ID=your-device-id-from-step-1
EOF

# Install Python dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Fetch team assets and populate database
python scripts/fetch_wnba_assets.py
python scripts/fetch_nhl_assets.py
# These scripts now also populate the league_teams table in Supabase

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
ADMIN_EMAILS=your-email@example.com
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

### Configuration System

The application uses a unified configuration system with multiple sources and automatic precedence:

#### Configuration Precedence (highest to lowest)
1. **Runtime Arguments** - Command-line flags (e.g., `--sim`, `--demo`)
2. **Environment Variables** - `SCOREBOARD_*` prefixed variables
3. **Supabase Database** - Remote configuration from database
4. **Default Values** - Built-in sensible defaults

#### Environment Variables
```bash
# Override any configuration via environment
export SCOREBOARD_MATRIX_WIDTH=128
export SCOREBOARD_MATRIX_HEIGHT=64
export SCOREBOARD_BRIGHTNESS=75
export SCOREBOARD_SIMULATION_MODE=true
export SCOREBOARD_TIMEZONE="America/New_York"
```

#### Configuration Validation
All configuration values are validated at startup:
- Matrix dimensions must be multiples of 8
- Brightness must be between 1-100
- Refresh intervals have min/max constraints
- Leagues must be from supported list

#### Local Configuration (Fallback)

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

#### Development Prerequisites

Additional tools required for development and deployment verification:

- **Vercel CLI**: For deployment verification
  ```bash
  npm install -g vercel
  ```
- **GitHub CLI (`gh`)**: For deployment status checking
  ```bash
  # macOS
  brew install gh
  # Ubuntu/Debian
  sudo apt install gh
  ```
- **jq**: For JSON parsing in scripts
  ```bash
  # macOS
  brew install jq
  # Ubuntu/Debian
  sudo apt-get install jq
  ```

#### Running the Application

```bash
python app.py --sim        # Simulation mode
python app.py --demo       # Demo with fake games
```

### Production (Raspberry Pi)

#### Automated CI/CD Deployment

The project includes automated deployment to a Raspberry Pi test device using **Tailscale SSH** and **GitHub Actions**.

**Features:**
- ✅ Auto-deploy on push to `develop` branch
- ✅ Manual deployment via workflow dispatch
- ✅ Automatic health checks and rollback on failure
- ✅ Secure deployment over Tailscale mesh network

**Quick Start:**
1. Set up Tailscale on your Raspberry Pi
2. Configure GitHub Secrets (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md))
3. Push to `develop` branch to trigger deployment

**Manual Deployment:**
```bash
# Deploy develop branch
gh workflow run deploy-pi.yml

# Deploy specific branch
gh workflow run deploy-pi.yml -f branch=main
```

**📚 Full Documentation:** See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for:
- Initial setup instructions
- GitHub Secrets configuration
- Troubleshooting guide
- Manual deployment procedures
- Rollback procedures

#### Direct Execution
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

The codebase includes comprehensive test coverage with 180+ unit tests:

```bash
# Run all Python tests
python -m unittest discover tests

# Run specific test modules
python -m unittest tests.test_core_container  # Test DI container
python -m unittest tests.test_core_orchestrator  # Test orchestrator
python -m unittest tests.test_config_provider  # Test configuration

# Run with coverage report
python -m coverage run -m unittest discover tests
python -m coverage report

# Test database connection and configuration
python -c "from src.config.supabase_config_loader import *; from supabase import create_client; import os; client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_ANON_KEY')); loader = SupabaseConfigLoader(os.getenv('DEVICE_ID'), client); print('Config loaded:', loader.load_full_config().device_id)"

# Run in demo mode
python app.py --demo --sim

# Web admin tests
cd web-admin && npm test

# Web admin E2E tests
cd web-admin && npm run test:e2e           # Run all E2E tests
cd web-admin && npm run test:e2e:headed    # Run with visible browser
cd web-admin && npm run test:e2e:ui        # Run with Playwright UI mode
cd web-admin && npm run test:e2e:debug     # Debug mode
```

### Continuous Integration

E2E tests run automatically on every pull request via GitHub Actions:

```yaml
# .github/workflows/e2e-tests.yml
- Runs on: pull_request, push to main
- Tests: All Playwright E2E tests
- Browser: Chromium only (optimized for speed)
- Artifacts: Screenshots and videos on failure
- Target: < 5 min total runtime
```

To set up E2E tests in CI, configure the following GitHub Secrets (Settings → Secrets and variables → Actions):

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `TEST_USER_EMAIL` | Test user email for auth tests | `test@example.com` |
| `TEST_USER_PASSWORD` | Test user password | `SecurePassword123!` |

**Branch Protection**: To require E2E tests to pass before merging:
1. Go to repository Settings → Branches
2. Add branch protection rule for `main`
3. Enable "Require status checks to pass before merging"
4. Select "Playwright E2E Tests" workflow

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#e2e-tests-ci-setup) for detailed setup instructions.

---

## 🐛 Troubleshooting

### Python App Issues

```bash
# Check environment variables
python -c "import os; print('DEVICE_ID:', os.getenv('DEVICE_ID')); print('SUPABASE_URL:', os.getenv('SUPABASE_URL')[:30] if os.getenv('SUPABASE_URL') else None)"

# Test database function access
python -c "from src.config.supabase_config_loader import *; from supabase import create_client; import os; client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_ANON_KEY')); loader = SupabaseConfigLoader(os.getenv('DEVICE_ID'), client); config = loader.load_full_config(); print('✅ Config loaded:', config.device_id, 'Leagues:', config.enabled_leagues)"

# Enable debug logging
python app.py --sim --demo --once 2>&1 | tee debug.log
```

### Web Admin Issues

```bash
# Check browser console for errors
# Verify .env file exists in web-admin/
# Ensure SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAILS are set
cd web-admin && npm run type-check
```

### Missing Team Names in Demo Mode

```bash
# Populate team data in database
python scripts/fetch_wnba_assets.py
python scripts/fetch_nhl_assets.py

# Verify teams were populated
python -c "from supabase import create_client; import os; client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_ANON_KEY')); result = client.table('league_teams').select('team_id,name,abbreviation').limit(5).execute(); print('Sample teams:', result.data)"
```

### Database Issues

```sql
-- Test the database function (most important)
SELECT get_device_configuration('your-device-id');

-- Check if device exists and is owned by current user
SELECT * FROM devices WHERE id = 'your-device-id';

-- Verify leagues and teams are populated
SELECT code, name FROM leagues;
SELECT COUNT(*) as team_count, l.code as league
FROM league_teams lt
JOIN leagues l ON l.id = lt.league_id
GROUP BY l.code;

-- Check device league configuration
SELECT dl.enabled, l.code, l.name, dl.priority
FROM device_leagues dl
JOIN leagues l ON l.id = dl.league_id
WHERE dl.device_id = 'your-device-id'
ORDER BY dl.priority;
```

---

## 📁 Project Structure

```
.
├── app.py                    # Main scoreboard application
├── src/
│   ├── config/              # Configuration management
│   │   └── supabase_config_loader.py # Database function calls
│   ├── sports/              # Sports/leagues architecture
│   │   ├── leagues/         # League-specific clients
│   │   └── league_aggregator.py # Multi-league orchestration
│   └── render/              # LED display rendering
├── web-admin/               # Next.js admin interface
│   ├── src/
│   │   ├── components/      # React components
│   │   └── pages/          # Next.js pages and API routes
│   └── package.json
├── supabase/
│   └── migrations/         # Database setup (4 files)
├── scripts/                 # Asset fetching + DB population
│   ├── fetch_wnba_assets.py # Downloads logos + populates teams
│   └── fetch_nhl_assets.py  # Downloads logos + populates teams
├── assets/                 # Team logos and colors
└── tests/                  # Python unit tests
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test` (runs both Python and web-admin tests with coverage)
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

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Raspberry Pi CI/CD deployment guide
- [CLAUDE.md](CLAUDE.md) - AI assistant guidelines for development
- [Hardware Setup Guide](https://github.com/hzeller/rpi-rgb-led-matrix)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)