# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Tools

### Core Scoreboard Application (Python)
- **Runtime**: Python 3.8+ with virtual environment
- **Key Dependencies**: PIL, requests, dotenv
- **Hardware**: Optional RGB LED matrix via `rgbmatrix` library
- **Commands**:
  ```bash
  # Setup environment
  python3 -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  
  # Run scoreboard
  python app.py --sim --once           # Test run (simulation mode)
  python app.py --demo                 # Demo with simulated games
  python app.py                        # Production mode (requires hardware)
  
  # Fetch team assets
  python scripts/fetch_wnba_assets.py
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

## Architecture Overview

### Monorepo Structure
- **Root**: Python scoreboard application with shared configuration
- **`web-admin/`**: Next.js web interface for device management
- **`supabase/`**: Database migrations and edge functions
- **Workspaces**: npm workspaces for coordinated development

### Core Components

#### Scoreboard Application (`app.py`)
- **Data Layer**: ESPN API client with resilience features (`src/data/`)
- **Game Selection**: Favorite team prioritization (`src/select/`)
- **Rendering**: LED matrix scenes (pregame/live/final) (`src/render/`)
- **Config Management**: JSON + environment variable overrides (`src/config/`)
- **Reliability**: Circuit breaker, caching, adaptive refresh (`src/runtime/`)

#### Web Admin (`web-admin/`)
- **Authentication**: Supabase Auth integration
- **Device Management**: Remote configuration and monitoring
- **UI Components**: Reusable component library (`src/components/ui/`)
- **Real-time**: WebSocket communication via Supabase Realtime

### Project Structure
```
.
├── app.py                          # Main scoreboard application
├── src/                           # Python source code
│   ├── config/                    # Configuration management
│   ├── data/                      # ESPN API clients (with resilience)
│   ├── model/                     # Game data models
│   ├── render/                    # LED display rendering
│   ├── runtime/                   # Adaptive refresh, hot-reload
│   └── select/                    # Game selection logic
├── web-admin/                     # Next.js admin interface
│   ├── src/components/            # React components
│   ├── src/lib/                   # Utilities and Supabase client
│   └── src/pages/                 # Next.js pages
├── config/favorites.json          # Team favorites configuration
├── assets/                        # Team logos and fonts
├── supabase/                      # Database schema and functions
└── scripts/                       # Maintenance and setup scripts
```

## Important Implementation Notes

### ESPN API Resilience
- **Enhanced Client**: `src/data/enhanced_espn.py` with comprehensive error handling
- **Circuit Breaker**: Automatically stops hitting failing endpoints (`src/data/resilient_client.py`)
- **Multi-layer Fallback**: Fresh cache → Stale cache → Emergency fallback
- **Adaptive Refresh**: Dynamic polling based on game state and network conditions

### Configuration Management
- **Primary**: `config/favorites.json` for teams, display, refresh settings
- **Environment Overrides**: `.env` file can override any JSON setting
- **Hot Reload**: SIGHUP signal triggers configuration reload without restart
- **Validation**: Type-safe configuration loading with defaults

### LED Display Rendering
- **Hardware Integration**: RGB matrix via `rgbmatrix` library (Pi only)
- **Simulation Mode**: Renders to `out/frame.png` for development
- **Multiple Layouts**: Stacked scores or big-logos mode
- **Asset Management**: Auto-fetched team logos with size variants

### Testing Strategy
- **Web Admin**: Jest + React Testing Library with 30% coverage minimums
- **Python**: Simulation mode allows testing without hardware
- **CI/CD**: GitHub Actions with automated testing and building

## Code Conventions

### Python Code
- **Type Hints**: Use `from __future__ import annotations` for forward references
- **Error Handling**: Prefer explicit try/catch with meaningful logging
- **Configuration**: Environment variables for runtime overrides, JSON for structure
- **Imports**: Absolute imports from `src.` package

### TypeScript/React Code
- **Strict TypeScript**: Enable `noUnusedLocals` and `noUnusedParameters`
- **Component Structure**: Separate UI components from business logic
- **Error Boundaries**: Handle runtime errors gracefully
- **Accessibility**: WCAG 2.1 AA compliance for forms and navigation

### Database/API
- **Row Level Security**: All Supabase tables use RLS policies
- **Real-time**: Phoenix channels for device communication
- **Caching**: Aggressive caching with intelligent invalidation

## Common Development Tasks

### Adding New Features
1. **Create feature branch**: `git checkout -b feat/feature-name`
2. **Python changes**: Update models, add tests, validate with simulation mode
3. **Web admin changes**: Add components, update types, run test suite
4. **Configuration**: Update `.env.example` for new environment variables
5. **Documentation**: Update README.md for user-facing changes

### Testing Reliability Features
- **Network simulation**: Disconnect network to test fallback behavior
- **Circuit breaker**: Force ESPN API failures to test recovery
- **Cache validation**: Check `cache/` directory for proper file management
- **Adaptive refresh**: Monitor refresh intervals during different game states

### Deployment
- **Raspberry Pi**: Use systemd services for production deployment
- **Web Admin**: Deploy to Vercel/Netlify (configured in CI/CD)
- **Database**: Supabase hosted PostgreSQL with edge functions

## Do Not Section
- Do not commit directly to the `main` branch.
- Do not sign or mention Claude, Claude Code, Anthropic, LLM, AI, ML in any commit messages or PR text.
- Do not create new files unless absolutely necessary for achieving your goal.
- Always prefer editing an existing file to creating a new one.