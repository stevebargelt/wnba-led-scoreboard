# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Multi-League LED Scoreboard** - Displays live sports scores on RGB LED matrices using direct Supabase integration.

### Architecture
```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Python App │────▶│   Supabase   │◀────│  Web Admin   │
│  (Polling)  │     │   Database   │     │   (Next.js)  │
└─────────────┘     └──────────────┘     └──────────────┘
```

- **Python App**: Polls Supabase every 60 seconds for configuration
- **Supabase**: PostgreSQL database with RLS policies
- **Web Admin**: Next.js interface for configuration
- **No agents, WebSockets, or edge functions** - Simple, direct integration

## Development Tools

### Core Scoreboard Application (Python)
- **Runtime**: Python 3.8+ with virtual environment
- **Key Dependencies**: PIL, requests, supabase-py, python-dotenv
- **Hardware**: Optional RGB LED matrix via `rgbmatrix` library
- **Commands**:
  ```bash
  # Setup environment
  python3 -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt

  # Test Supabase connection
  python test_supabase_integration.py

  # Run scoreboard
  python app.py --sim --once           # Test run (simulation mode)
  python app.py --demo                 # Demo with simulated games
  python app.py                        # Production mode (requires hardware)

  # Fetch team assets
  python scripts/fetch_wnba_assets.py
  python scripts/fetch_nhl_assets.py
  ```

### Web Admin Interface (Next.js)
- **Runtime**: Node.js 18+ with npm
- **Framework**: Next.js 14 with TypeScript, Tailwind CSS
- **Testing**: Jest with React Testing Library
- **Commands**:
  ```bash
  cd web-admin
  npm ci                    # Install dependencies
  npm run dev               # Start development server
  npm run build             # Build for production
  npm run test              # Run tests
  npm run test:ci           # Run tests with coverage for CI
  npm run lint              # ESLint checking
  npm run lint:fix          # Auto-fix ESLint issues
  npm run type-check        # TypeScript type checking
  npm run format            # Format code with Prettier
  ```

## Database Setup

### Migrations (Just 3 Files!)
Located in `supabase/migrations/`:
1. `001_complete_schema.sql` - All tables, indexes, functions, triggers
2. `002_rls_policies.sql` - Complete RLS security setup
3. `003_seed_data.sql` - Sports and leagues data

Run in order in Supabase SQL Editor.

### Key Tables
- `devices` - User devices with ownership
- `device_config` - Display settings (hybrid columns + JSONB)
- `device_leagues` - Enabled sports per device
- `device_favorite_teams` - Favorite teams per device
- `sports` & `leagues` - Hierarchical sports architecture

## Core Components

### Scoreboard Application (`app.py`)
- **SupabaseConfigLoader** (`src/config/supabase_config_loader.py`): Direct DB polling
- **LeagueAggregator** (`src/sports/league_aggregator.py`): Multi-league game selection
- **League Clients** (`src/sports/leagues/`): API integrations for each sport
- **Renderer** (`src/render/`): LED matrix scenes (pregame/live/final)
- **Resilience** (`src/runtime/`): Circuit breaker, caching, adaptive refresh

### Web Admin (`web-admin/`)
- **Authentication**: Supabase Auth integration
- **Device Management**: Direct database configuration (no WebSockets)
- **UI Components**: Reusable component library (`src/components/ui/`)
- **API Routes** (`src/pages/api/`): Next.js API for database operations

## Project Structure
```
.
├── app.py                          # Main scoreboard application
├── src/                           # Python source code
│   ├── config/                    # Configuration management
│   │   └── supabase_config_loader.py # Direct DB polling
│   ├── sports/                    # Sports/leagues architecture
│   │   ├── leagues/               # League-specific API clients
│   │   └── league_aggregator.py   # Multi-league orchestration
│   ├── data/                      # ESPN API clients with resilience
│   ├── model/                     # Game data models
│   ├── render/                    # LED display rendering
│   └── runtime/                   # Adaptive refresh, hot-reload
├── web-admin/                     # Next.js admin interface
│   ├── src/components/            # React components
│   ├── src/lib/                   # Utilities and Supabase client
│   └── src/pages/                 # Next.js pages and API routes
├── supabase/                      # Database setup
│   └── migrations/                # 3 clean migration files
├── assets/                        # Team logos and fonts
├── config/                        # Local configuration fallback
└── scripts/                       # Maintenance and setup scripts
```

## Important Implementation Notes

### Direct Supabase Integration
- **No WebSockets/Realtime**: Python app polls every 60 seconds
- **No Edge Functions**: All logic in Python app and Next.js API
- **No Device Tokens**: Uses RLS policies for security
- **Simple Architecture**: Just 3 components instead of 7

### ESPN API Resilience
- **Circuit Breaker**: Stops hitting failing endpoints (`src/data/resilient_client.py`)
- **Multi-layer Fallback**: Fresh cache → Stale cache → Emergency fallback
- **Adaptive Refresh**: Dynamic polling based on game state

### Configuration Management
- **Primary**: Supabase database (device_config, device_leagues, device_favorite_teams)
- **Fallback**: Local `config/favorites.json` if Supabase unavailable
- **Environment Overrides**: `.env` file can override any setting
- **Hot Reload**: SIGHUP signal triggers configuration reload

### LED Display Rendering
- **Hardware Integration**: RGB matrix via `rgbmatrix` library (Pi only)
- **Simulation Mode**: Renders to `out/frame.png` for development
- **Multiple Layouts**: Stacked scores or big-logos mode
- **Asset Management**: Auto-fetched team logos with size variants


## Code Conventions

### Python Code
- **Type Hints**: Use `from __future__ import annotations` for forward references
- **Error Handling**: Explicit try/catch with meaningful logging
- **Configuration**: Environment variables for runtime, Supabase for structure
- **Imports**: Absolute imports from `src.` package
- **No Comments**: Unless specifically requested

### TypeScript/React Code
- **Strict TypeScript**: Enable `noUnusedLocals` and `noUnusedParameters`
- **Component Structure**: Separate UI components from business logic
- **Error Boundaries**: Handle runtime errors gracefully
- **Accessibility**: WCAG 2.1 AA compliance
- **No Comments**: Unless specifically requested

### Database/API
- **Row Level Security**: All tables use RLS policies
- **Direct Access**: No realtime subscriptions or WebSockets
- **Caching**: Aggressive caching with intelligent invalidation
- **Polling**: 60-second intervals for configuration updates

## Common Development Tasks

### Adding New Features
1. **Create feature branch**: `git checkout -b feat/feature-name`
2. **Python changes**: Update models, test with `--sim` mode
3. **Web admin changes**: Add components, update types, run tests
4. **Database changes**: Add to migrations if needed
5. **Documentation**: Update README.md for user-facing changes

### Testing
```bash
# Python app
python test_supabase_integration.py
python app.py --demo

# Web admin
cd web-admin && npm test

# Database connection
python -c "import os; print(os.getenv('DEVICE_ID'))"
```

### Deployment
- **Raspberry Pi**: Use systemd service (see README.md)
- **Web Admin**: Deploy to Vercel/Netlify or self-host
- **Database**: Supabase hosted PostgreSQL

## Do's and Don'ts

### DO:
- Use direct Supabase queries (no WebSockets)
- Follow existing code patterns and conventions
- Test in simulation mode before hardware
- Check environment variables are set
- Use the 3-migration setup for database

### DON'T:
- Add WebSocket/realtime subscriptions
- Create edge functions
- Use device tokens or agent authentication
- Add unnecessary comments to code
- Create new files unless absolutely necessary
- Sign commits with AI/LLM references

## Environment Variables

### Required
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
DEVICE_ID=your-device-uuid
```

### Optional
```bash
SIMULATION_MODE=true          # Force simulation (no hardware)
DEMO_MODE=true               # Run with fake games
TIMEZONE=America/New_York    # Override timezone
BRIGHTNESS=75                # LED brightness (1-100)
```

## Troubleshooting Guide

### Python App Not Loading Config
1. Check `DEVICE_ID` is set correctly
2. Verify device exists in database with ownership
3. Test with `python test_supabase_integration.py`

### Web Admin Save Errors
1. Check RLS policies are applied (migration 002)
2. Verify user owns the device
3. Check browser console for API errors

### No Games Displaying
1. Verify sports are enabled in device_leagues
2. Check current season dates in leagues table
3. Test with `--demo` mode to isolate API issues

## Important Reminders

- **This is a simplified architecture** - No agents, WebSockets, or complex auth
- **Python app polls every 60 seconds** - Not real-time but reliable
- **All configuration in database** - Web admin writes, Python reads
- **3 migrations replace 19** - Clean setup from scratch
- **Always test in simulation first** - `python app.py --sim`

## Do Not Section
- Do not commit directly to the `main` branch.
- Do not sign or mention Claude, Claude Code, Anthropic, LLM, AI, ML in any commit messages or PR text.
- Always prefer editing an existing file to creating a new one.

## Memories
- Demo mode is network connected and also calls ESPN/NHL / sport endpoints.