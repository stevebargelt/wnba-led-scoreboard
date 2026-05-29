# Web Admin Redesign — Brief (input to prompt-author)

Redesign the Multi-League LED Scoreboard web admin.
Stack: Next.js 14 + TypeScript + Tailwind; Supabase Auth + RLS; polling only (no realtime).
Product: multi-tenant — many users, each owning MULTIPLE devices, each device configured independently.

GOVERNING PRINCIPLE: the UI must only expose controls that actually change the
physical panel. Today ~15 controls exist but only 3 work; the rest write to the DB
and are silently ignored by the on-device Go app. Eliminating that lie is the point.

HONORED — keep, make first-class:
  - Enabled leagues (which leagues display)
  - Favorite teams per league (drives which game shows)
  - Refresh cadence (pregame/ingame/final sec) — device now auto-backs-off polling,
    so treat cadence as ADVANCED/optional, not primary.

NEWLY HONORED — design as real, working controls (a parallel Go change makes them live):
  - Brightness (1-100)
  - Timezone (game start-time display)

CUT ENTIRELY (inert, no value): matrix width/height (fixed per-device hardware),
  logo variant, priority/boost toggles + conflict-resolution, manual game overrides,
  and the entire DEVICE_TOKEN flow.

TARGET IA:
  - Auth -> Dashboard: the user's devices as cards (name, online/offline via ~90s
    last-seen freshness, link into each).
  - ONE device-creation path. Onboarding result shows DEVICE_ID + Supabase env vars
    to put on the Pi. NO device token.
  - Device detail = exactly TWO tabs:
      1. "Teams" — one unified surface to enable leagues AND pick favorites within each
         (leagues as sections; favorites inside). Replaces today's two separate, unsynced
         UIs. One save, one source of truth, clear dirty-state.
      2. "Settings" — brightness, timezone, and (collapsed/advanced) refresh cadence.
         Every control real; one save.
  - Role-gated Admin area (hidden from normal users) for the global Sports & Leagues
    catalog. Remove Analytics + Settings stub pages from nav entirely.

REUSE / PRESERVE:
  - components/ui/ library (Button, Input, Card, Badge, Toggle, Tabs) — consistent, tested.
  - Good UX from current MultiSportFavoritesEditor: per-league grouping, team name/abbr
    autocomplete (datalist), auto-enrich team IDs from the directory, dirty-state tracking,
    toasts. Fold into the unified Teams surface.

QUALITY:
  - One clearly-scoped Save per tab with explicit dirty-state (no always-enabled save).
  - Honest feedback — success must mean a real device change; never a no-op success toast.
  - WCAG 2.1 AA; responsive desktop + mobile; light/dark (ThemeToggle exists).
  - Empty states: no devices yet; device with no leagues/teams.

OUT OF SCOPE: the Go-side change to honor brightness/timezone (tracked separately);
  auth screens; live-snapshot-from-device (#8).
