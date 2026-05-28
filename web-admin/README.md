# Web Admin

Next.js admin interface for the [Multi-League LED Scoreboard](../README.md) product. Lets users sign up, register their own LED scoreboard devices, and configure each device independently (enabled leagues, favorite teams, refresh intervals, etc.).

Writes device configuration to Supabase; each device polls Supabase for its own config every 60 seconds. **No WebSockets, no realtime subscriptions, no edge functions** — direct polling, RLS for security.

## Tech Stack

- **Next.js 14** (Pages router) + **TypeScript**
- **TailwindCSS** for styling
- **Supabase** for Postgres + Auth (RLS enforces per-user device ownership)
- **Jest** + React Testing Library for tests
- **ESLint** + **Prettier**

## Quick Start

```bash
cd web-admin
npm ci
```

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_EMAILS=your-email@example.com
```

Supabase migrations must be applied first — see the [top-level README](../README.md) and `supabase/migrations/`.

## Scripts

```bash
npm run dev          # → http://localhost:3000
npm run build        # production build
npm run test         # jest
npm run test:ci      # with coverage
npm run lint         # eslint
npm run lint:fix     # eslint --fix
npm run type-check   # tsc --noEmit
npm run format       # prettier
```

## Project Structure

```
web-admin/
├── src/
│   ├── components/   # UI components (Button, Input, Card, Tabs, ...)
│   ├── pages/        # Next.js pages + API routes
│   ├── lib/          # Supabase client, preview rendering, utilities
│   ├── contexts/     # React contexts (auth, theme)
│   └── styles/       # Tailwind global styles
└── public/           # Static assets (fonts, logos for preview)
```

## Architecture

### Data flow

```
User ──▶ Web Admin ──▶ Supabase ◀── Device (polls every 60s)
```

The web admin is purely a configuration UI. It never communicates with devices directly. All state lives in Supabase; devices read it on their own schedule.

### Tables (set up via `supabase/migrations/`)

- `devices` — registered devices with `user_id` ownership
- `device_config` — per-device display settings
- `device_leagues` — which leagues are enabled per device
- `device_favorite_teams` — favorite teams per device per league
- `sports` / `leagues` / `league_teams` — sport hierarchy + team directory

### Security

- Supabase Auth (JWT)
- RLS policies on every table — users can only read/write devices they own
- API routes use the user's JWT to create a user-scoped Supabase client → RLS enforces ownership server-side

## Status (2026-05-28)

The admin is **mid-redesign**. Known issues being addressed:

- Several config fields are silently ignored by the device (matrix size, brightness, timezone, layout, logo variant, priority weights). The Go device needs to honor them; until then the admin shouldn't expose dead controls.
- Sports and Favorites tabs are duplicate UIs for the same underlying data.
- Device-creation flow has stale references to a deprecated `DEVICE_TOKEN` minting edge function.
- Client-side Canvas preview drifts from the Go renderer (fonts wrong, pregame layout stale).

Active backlog tickets cover the redesign plan and individual bug fixes.

## Contributing

- Branch off `main` (do not commit directly).
- Run `npm run test`, `npm run lint`, `npm run type-check` before pushing.
- Conventional commits (`feat:`, `fix:`, `chore:`, etc.).
