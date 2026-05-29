# Web Admin Redesign — Implementation Handoff

**Status:** Design complete (Pencil). Ready for implementation.
**Design source:** `designs/wnba-led-scoreboard.pen`
**Renders:** `designs/0X-*.png` (light) + `designs/0X-*-dark.png` (dark) — 7 screens × 2 themes = 14 PNGs @ 2x.
**Target:** `web-admin/` — Next.js 14 + TypeScript + Tailwind + Supabase. No new backend; reads/writes existing `device_*` tables via the existing API routes.

---

## 1. Governing principle — radical honesty

> Only expose controls that actually change the physical panel.

The redesign exists to kill inert controls and to collapse the two separate, out-of-sync UIs (league enable + team favorites) into **one unified surface with one Save**. Anything that doesn't change the device must not appear. Brightness/Timezone are intended, real controls — the device-side wiring is already tracked in the backlog (not a design concern); see §9.

---

## 2. Frame inventory (what's in the .pen)

| # | Frame name | Route (suggested) | Purpose |
|---|-----------|-------------------|---------|
| 01 | `01-dashboard` | `/` | Device list (cards) |
| 02 | `02-dashboard-empty` | `/` (empty state) | First-run, no devices |
| 03 | `03-device-onboarding` | `/devices/new` | Create device → env handoff (2 steps in one frame) |
| 04 | `04-device-teams` | `/devices/[id]/teams` | Unified league-enable + favorites, one Save |
| 05 | `05-device-settings` | `/devices/[id]/settings` | Brightness + Timezone + Advanced cadence |
| 06 | `06-admin-sports-leagues` | `/admin/sports-leagues` | Global catalog (admin-gated) + 403 inset |
| 07 | `07-add-team-picker` | (state of 04) | Open team-picker / autocomplete state |

Every frame is duplicated with a `(dark)` variant for explicit theme parity.

---

## 3. Hard architectural constraints (unchanged from CLAUDE.md)

- **Polling only** — no WebSockets, no realtime subscriptions, no edge functions.
- **No device tokens** — RLS enforces ownership; the device authenticates with the anon key + `DEVICE_ID`. The token-minting flow is **cut entirely** (see §6.3).
- **Honest success** — a success toast means the row was written and the device will pick it up on its next poll. Never toast success for a no-op.
- **One Save per tab** — Save is disabled (greyed) when clean, enabled when dirty. Dirty must be visually obvious before Save enables.
- Remove the current nav stubs **Analytics** and **Settings** entirely. Normal-user nav = **Dashboard** + account/sign-out only; admins also get **Admin**.

---

## 4. Design tokens

Implement as CSS custom properties on `:root` (light) + `[data-theme="dark"]` / `@media (prefers-color-scheme: dark)`, surfaced through the Tailwind theme. Default to OS setting; `ThemeToggle` overrides (persist choice to `localStorage`, e.g. `theme = system | light | dark`).

**Type:** `font-sans = Inter`, `font-mono = JetBrains Mono` (mono only for copy-able machine values — env vars, `DEVICE_ID`, team abbreviations).
**Radii:** `card = 16`, `md = 10`, `sm = 8`, `pill = 999`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F5F7FA` | `#0E1217` | app background |
| `surface` | `#FFFFFF` | `#161B22` | cards, header, sidebar |
| `surface-2` | `#EEF1F5` | `#1C222B` | subtle fills, disabled btn |
| `surface-3` | `#F8FAFC` | `#222A34` | input backgrounds |
| `border` | `#E2E6EC` | `#2A313C` | hairlines, card borders |
| `border-strong` | `#CBD2DC` | `#3A4350` | secondary button outline |
| `text-primary` | `#101826` | `#EDF1F6` | headings, values |
| `text-secondary` | `#586172` | `#A7B1C0` | labels, body |
| `text-muted` | `#828C9C` | `#6E7888` | helper text, placeholders |
| `accent` | `#2563EB` | `#4C84F5` | primary action, active nav |
| `accent-hover` | `#1D4ED8` | `#6A9AF8` | hover |
| `accent-fg` | `#FFFFFF` | `#08111F` | text/icon on accent |
| `accent-soft` | `#E8F0FE` | `#16243E` | active nav bg, info callout, hover row |
| `accent-soft-fg` | `#1E40AF` | `#B8CEFB` | text on accent-soft |
| `success` | `#16A34A` | `#2FB866` | success icon |
| `success-soft` | `#E6F6EC` | `#11281B` | online badge bg |
| `success-fg` | `#0B7A33` | `#7BE3A6` | online badge text |
| `success-dot` | `#22C55E` | `#34D27B` | online dot |
| `danger` | `#DC2626` | `#EF5350` | destructive, 403 |
| `danger-hover` | `#B91C1C` | `#F2706E` | hover |
| `danger-soft` | `#FCEBEB` | `#2E1718` | 403 icon bg |
| `danger-fg` | `#FFFFFF` | `#1A0809` | text on danger |
| `amber` | `#C2780A` | `#E7A33A` | dirty-state icon |
| `amber-soft` | `#FBF0DA` | `#2C2310` | dirty banner bg |
| `amber-fg` | `#825104` | `#F4D9A6` | dirty banner text |
| `offline-dot` | `#94A3B8` | `#5A6678` | offline dot |
| `league-wnba` | `#E8650E` | `#F2802F` | WNBA badge |
| `league-wnba-soft` | `#FCEADD` | `#2E1C10` | WNBA tint |
| `league-wnba-fg` | `#FFFFFF` | `#1A0E04` | text on WNBA badge |
| `league-nhl` | `#1D4ED8` | `#5B8DEF` | NHL badge |
| `league-nhl-soft` | `#E7EEFC` | `#14233E` | NHL tint |
| `league-nhl-fg` | `#FFFFFF` | `#06101F` | text on NHL badge |
| `shadow-color` | `#1018281F` | `#00000066` | card/menu shadow |

All foreground/background pairs were chosen to meet **WCAG 2.1 AA** in both themes (disabled controls are intentionally low-contrast and exempt).

---

## 5. Component library

Build these as the shared vocabulary (`web-admin/components/ui/`). Anatomy + states below.

- **Button** — radius `md`, padding `10×16`, gap `8`, label `14/600`, optional leading icon `16`.
  Variants: **primary** (`accent` bg / `accent-fg`), **secondary** (`surface` bg, `border-strong` outline, `text-primary`), **ghost** (transparent, `text-secondary`), **destructive** (`danger` bg / `danger-fg`). **Disabled** = `surface-2` bg, `text-muted` label. Supports `fullWidth`.
- **Input** — vertical: label `13/500 text-secondary` → box (`h-42`, radius `sm`, `surface-3`, `border`, pad `12`, value `14`) → helper `12 text-muted`. **Focus** = 2px `accent` ring (see picker). **Error** = `danger` ring + `danger` helper. Placeholder uses `text-muted`.
- **Card** / **CardHeader** / **CardTitle** — radius `card`, `surface`, 1px `border`, soft shadow (`y1 blur3 shadow-color`), pad `20–24`.
- **Badge** — pill, pad `3×10`, `12/600`. Neutral = `surface-2/text-secondary`. Variants by fill: league badges, abbreviation chip (mono `11`, `accent-soft`), count badge.
- **StatusBadge** — pill, 8px dot + `12/600` label. **Online** = `success-soft`/`success-dot`/`success-fg`; **Offline** = `surface-2`/`offline-dot`/`text-secondary`. **Freshness rule: online iff the device phoned home ≤ 90s ago** (`last_seen_at`).
- **Toggle** — track `44×26` pill, knob `20` white + shadow. **On** = `accent`, knob right; **Off** = `border-strong`, knob left.
- **Tabs** — horizontal, `h-48`, bottom `border`. Active = `accent` label `600` + 2px `accent` bottom border; inactive = `text-secondary 500`.
- **ThemeToggle** — `40×40` radius `md`, `surface`+`border`, moon/sun icon `18`. Top-right of header.
- **Sidebar** — `w-256`, `surface`, right `border`. Brand (accent logo mark `34` + wordmark `16/700`); nav items (pad `10×12`, radius `md`, icon `18` + label `14`; **active** = `accent-soft` bg / `accent` icon / `accent-soft-fg 600`); bottom = user chip (avatar + email) + sign-out. **Admin item is role-gated** (render only when `role === 'admin'`). Collapses to a bottom-nav/hamburger at mobile (375px).
- **DeviceCard** — card with name `17/600` + StatusBadge, device icon, last-seen line (`13 text-muted`), full-width **secondary** Configure button. Whole card / name links to device detail.
- **CopyRow** — mono key (`11/600 text-muted`) + value box (mono `13`, `surface-3`) + copy-to-clipboard icon button.

Icons: Lucide. (Note: `clock` is absent from the available set — `timer` was used; verify icon names against your Lucide version.)

---

## 6. Screen specs

### 6.1 Dashboard (`01`, empty `02`)
- Sidebar + header (`LED Scoreboard Admin` + ThemeToggle). Heading `Dashboard` / "Manage your LED scoreboards". Top-right **Add Device** (primary, + icon).
- Device grid, 2-col desktop → 1-col mobile. Each `DeviceCard`: name, StatusBadge, last-seen, Configure.
- **States to build:** loading (skeleton cards), **empty** (`02` — centered icon + "No devices yet" + body + Add Device), error.
- Data: list devices owned by user; compute online/offline from `last_seen_at` (≤90s).
- **AC:** offline device renders grey badge + real relative last-seen; clicking name/Configure → `/devices/[id]/teams`.

### 6.2 Device onboarding (`03`)
Two sub-states (one frame shows both):
- **Step 1 — Name:** centered card, single `Device name` input, full-width **Create Device**, back link.
- **Step 2 — Done:** success card with check; subhead "Copy these values into your Pi's `.env`"; **three CopyRows** — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DEVICE_ID`; blue info callout: *"No device token is needed. The device authenticates using the anon key and its DEVICE_ID."*; secondary "Back to Dashboard" + primary "Configure Device".
- **No `DEVICE_TOKEN` field anywhere.** The entire token-mint flow is removed; `DEVICE_ID` is the identifier.
- **AC:** Create inserts a `devices` row, returns its UUID; Step 2 shows the live project URL/anon key + new `DEVICE_ID`; clipboard copy works.

### 6.3 Device → Teams (`04`) + Add-team picker (`07`)
The headline screen. Replaces the fragmented Sports tab + Favorites tab with **one surface, one Save**.
- Sub-header: back, device name (`h1`), StatusBadge, ThemeToggle. Tabs: **Teams** (active) | Settings.
- **Dirty banner** (amber) appears when there are unsaved changes.
- **Per-league Card** (WNBA, NHL): league badge + full name + **Toggle**. When enabled → **Favorite teams** subsection: rows of `team-name input (datalist autocomplete) + abbreviation badge + remove ×`, then **+ Add team**.
- When **disabled**: favorites hidden but **preserved** (do not delete saved favorites on toggle-off); show light CTA "Enable {league} to pick favorite teams."
- **Save bar:** primary **Save Teams** (enabled only when dirty) + secondary **Discard changes**.
- **Add-team picker (`07`):** clicking **+ Add team** turns the row into a **focused search input** (2px accent ring, search icon, `Search {league} teams…` placeholder, cancel ×) with an **autocomplete dropdown** of the league's team directory. Each row = abbreviation chip + full name. Typing filters. Top match is highlighted (Enter / + to add). **Teams already favorited show a dimmed "✓ Added" and are not selectable** (no double-add). On select, the datalist enrichment auto-fills abbreviation + team ID from the directory, appends a favorite row, and **marks the surface dirty**. Cancel × dismisses.
- Data: `device_leagues` (enable/disable) + `device_favorite_teams` (name/abbr/id). Save writes both transactionally per the one-Save model.
- **AC:** toggling a league off then Save preserves its favorites in the DB (re-enable restores them); Save disabled until dirty; success toast only after a real write.

### 6.4 Device → Settings (`05`)
- Same shell; tab **Settings** active. **Clean state** shown (Save + Discard greyed).
- **Display card:** `Brightness` (1–100 slider + numeric, value 80) + `Timezone` (combobox, `America/Los_Angeles`).
- **Advanced — Refresh Cadence** (accordion, collapsed by default; shown expanded in the frame to document it): three numeric inputs `Pre-game / In-game / Final` (30 / 5 / 60) + helper "The device automatically backs off polling."
- **Everything else is removed:** matrix width/height, logo variant, live-layout select, priority/boost toggles, conflict resolution, manual game overrides.
- Build all three (Brightness, Timezone, cadence) as real controls. Device-side wiring for brightness/timezone is tracked in the backlog — not a design concern (see §9).

### 6.5 Admin → Sports & Leagues (`06`)
- Sidebar = **admin variant** (Dashboard + **Admin** active, trophy icon). Admin item only renders for `role === 'admin'`.
- Subtle role banner: "Admin view — changes affect all users' devices." Heading "Sports & Leagues" / "Global catalog…".
- Two columns: left **sports list** (cards w/ name + league-count badge + chevron; selected = accent); right **league table** (League name / Code / Enabled toggle / Action) + **Add League**.
- **403 state:** a non-admin hitting `/admin/sports-leagues` sees a "You don't have permission to access this area." inset (designed in `06` as a labeled "Non-admin view" panel). Enforce server-side (route guard / RLS), not just UI.
- Data: global `sports` + `leagues` catalog (not per-device).
- **AC:** non-admin is blocked server-side; admin can toggle a league's global availability.

---

## 7. Interaction model — the dirty/Save contract (applies to 04 & 05)

1. Page loads clean → Save + Discard disabled (greyed).
2. Any change (toggle, add/remove team, slider, field) → set dirty → dirty banner (04) + Save/Discard enable.
3. Discard → revert to last-saved state → clean.
4. Save → write to Supabase → success toast ("Saved — your panel will update on its next poll") → clean. On error: error toast, stay dirty.
5. Never toast success for a no-op; never auto-save.

---

## 8. Accessibility & responsive

- WCAG 2.1 AA contrast in both themes (tokens pre-checked). Visible focus rings (2px accent). Toggles/tabs/combobox keyboard-operable; the team picker is a combobox (`role=combobox` + `listbox`, arrow/enter/escape).
- Icons never replace essential text labels.
- Desktop 1280 (multi-zone) → mobile 375: sidebar collapses to bottom-nav/hamburger; device grid + league cards go single-column; sub-header wraps.

---

## 9. Device-side wiring (already tracked — not a design concern)

The web UI builds **all** Settings controls (Brightness, Timezone, Refresh cadence) as real controls. The device-side honoring of `matrix_config.brightness` and `timezone` in the Go app (`go-scoreboard/`) is **already tracked in the backlog** — it follows the same poll/config path the app already uses for `refresh_config`, and is sequenced separately from this web-admin work.

| Control | Screen | Supabase field | Web-admin | Device wiring |
|---|---|---|---|---|
| League enable/disable | 04 | `enabled_leagues` | Build | live |
| Favorite teams | 04 / 07 | `favorite_teams` | Build | live |
| Refresh cadence | 05 | `refresh_config` | Build | live |
| Brightness | 05 | `matrix_config.brightness` | Build | backlog ticket |
| Timezone | 05 | `timezone` | Build | backlog ticket |

No gating needed on the web side — the config rows are written either way; the device picks them up once its ticket lands.

---

## 10. Suggested implementation slices (for task breakdown)

1. **Tokens + theming** — CSS vars (light/dark) + Tailwind theme + ThemeToggle (system/light/dark, persisted). *No behavior change.*
2. **UI component library** — the §5 set with stories/visual checks.
3. **Shell** — Sidebar (role-gated Admin), Header, Layout; remove Analytics/Settings stubs.
4. **Dashboard + empty + DeviceCard** — list, freshness badge, routing.
5. **Onboarding** — create device, env handoff, remove token flow.
6. **Teams (unified) + Add-team picker** — leagues + favorites + dirty/Save + combobox; preserve-on-disable.
7. **Settings** — Display card (Brightness + Timezone) + Advanced cadence accordion.
8. **Admin catalog + 403** — server-side guard + table.
9. **Responsive pass** (375) + a11y audit + AA contrast verification.

Each slice is independently testable; 6 and 8 carry the most logic (transactional save; authz).

---

## 11. Open questions for the team

1. Team directory source for the picker autocomplete (abbr + id enrichment) — static seed vs. an endpoint? WNBA list is known; NHL TBD.
2. Routes — confirm against existing `web-admin` router (paths in §2 are suggested).
3. Admin role source — where does `role === 'admin'` come from (Supabase user metadata / a table)?
4. Mobile bottom-nav vs. hamburger — pick one (frames annotate "sidebar collapses").
