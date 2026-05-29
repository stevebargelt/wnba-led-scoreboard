# Pencil Design Session — Multi-League LED Scoreboard Web Admin Redesign

## Goal

Redesign the web admin for a multi-tenant LED scoreboard product (Next.js 14 + TypeScript + Tailwind). The **governing principle** is radical honesty: only expose controls that actually change the physical panel. The redesign eliminates inert controls and collapses two separate, out-of-sync UIs (league enable + team favorites) into one unified surface.

---

## PRECONDITIONS

Before starting:

1. Open the **Pencil app** (stand-alone — not the VS Code extension).
2. Open (or create) the file: `/Users/stevebargelt/code/wnba-led-scoreboard/designs/wnba-led-scoreboard.pen`
   - If the file doesn't exist: File → New Pencil File, save to that path.
3. Ensure the output directory exists: `/Users/stevebargelt/code/wnba-led-scoreboard/designs/`
4. Ensure the code export directory exists (create if needed): `/Users/stevebargelt/code/wnba-led-scoreboard/designs/code/`
5. The corpus is **empty** — no existing screens. All 6 screens below are NEW.

---

## Style

**Friendly Control Room** — a clean, approachable consumer aesthetic for people who own an LED scoreboard, not a dense developer tool. Rounded cards, generous spacing, clear sans-serif typography (reserve monospace only for copy-able machine values like `DEVICE_ID` and env vars), one calm accent colour plus clear success/danger states.

**Light and dark are both first-class and follow the user's OS setting (`prefers-color-scheme`) by default**; the ThemeToggle lets a user override. Design every frame in BOTH themes so parity is explicit — dark should feel intentional and comfortable, not a mechanical inversion.

Secondary: responsive at desktop (1280px) and mobile (375px) widths. WCAG 2.1 AA contrast throughout, in both themes.

Component vocabulary (use these consistently across all frames):
- `Button` — primary (filled), secondary (outlined), ghost, destructive
- `Input` — with label, helper text, and error state variants
- `Card` / `CardHeader` / `CardTitle` — white/dark-800, soft shadow
- `Badge` — neutral, success (online), danger (offline)
- `StatusBadge` — green dot + "Online" | grey dot + "Offline"
- `Toggle` — binary on/off, used for league enable/disable
- `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` — horizontal tab bar
- `ThemeToggle` — top-right in the Header

Sidebar navigation (present on all full-layout screens): two items only for a normal user — **Dashboard** (home icon) and the user's account / sign-out. For admin users a third item appears: **Admin** (trophy icon), gated by role. The current nav has Analytics and Settings stubs — those are **removed entirely** in the redesign.

---

## Screens

Design the following 6 screens as new top-level frames. Use numeric prefixes starting at 01. Canvas layout: arrange frames left-to-right in rows of 3, 2400px horizontal spacing.

---

### 01-dashboard

**Frame size:** 1280 × 900 px (desktop)

**What to show:**
- Sidebar nav (left, 256px wide): logo block ("LED Admin"), nav item "Dashboard" (active), sign-out button at bottom. No Analytics, no Settings items.
- Header bar: product name "LED Scoreboard Admin", ThemeToggle button (top right).
- Main content area:
  - Page heading: "Dashboard" / subhead "Manage your LED scoreboards"
  - Top-right CTA: "Add Device" (primary Button, PlusIcon)
  - Device grid (2 columns on desktop): show 3 device cards
    - Card 1 "Living Room Panel": StatusBadge **Online** (green), last seen "just now", "Configure" secondary button → links to device detail
    - Card 2 "Garage Display": StatusBadge **Offline** (grey), last seen "2 hours ago", "Configure" secondary button
    - Card 3 "Workshop": StatusBadge **Offline** (grey), last seen "5 days ago", "Configure" secondary button
  - Each card shows: device name (semibold), StatusBadge, last-seen timestamp, Configure button

**Design notes:** Cards are clickable; the device name is a link. StatusBadge uses ≤90s freshness — green means device phoned home within 90 seconds.

---

### 02-dashboard-empty

**Frame size:** 1280 × 900 px (desktop)

**What to show:**
- Same sidebar + header as 01.
- Main content: page heading "Dashboard"
- Empty state centred in the main area:
  - Large icon (e.g. CpuChipIcon or a display/TV icon, ~64px)
  - Heading: "No devices yet"
  - Body: "Add your first LED panel to get started. You'll need a Raspberry Pi with the scoreboard app installed."
  - Primary CTA Button: "Add Device" (links to onboarding)

**Design notes:** Empty state should feel welcoming, not broken.

---

### 03-device-onboarding

**Frame size:** 1280 × 900 px (desktop)

**What to show:**

Two states side by side within the same frame (label them "Step 1 – Name" and "Step 2 – Done"):

**Step 1 – Name (left):**
- Centered card (max-w-md):
  - Heading: "Add a Device"
  - Input: "Device name" (placeholder "e.g. Living Room Panel")
  - Primary Button: "Create Device" (full width)
  - Back link ← Dashboard

**Step 2 – Done (right), success state after creation:**
- Centered card (wider, ~max-w-lg):
  - Heading: "Device Created" with a checkmark icon
  - Subhead: "Copy these values into your Pi's `.env` file."
  - **Three copy-able rows** (each: label + monospace value + copy-to-clipboard icon button):
    - `SUPABASE_URL` = `https://xxxxx.supabase.co`
    - `SUPABASE_ANON_KEY` = `eyJhbGci…` (truncated)
    - `DEVICE_ID` = `d8f2c1a0-…` (UUID)
  - Info callout (blue): "No device token is needed. The device authenticates using the anon key and its DEVICE_ID."
  - Secondary Button: "← Back to Dashboard"
  - Primary Button: "Configure Device" (opens device detail)

**Design notes:** NO DEVICE_TOKEN field anywhere. The entire token-minting flow is cut. The DEVICE_ID is the identifier.

---

### 04-device-teams

**Frame size:** 1280 × 960 px (desktop)

**What to show:**
- Full Layout (sidebar + header).
- Sub-header: "← Back" ghost button | device name "Living Room Panel" (h1) | StatusBadge Online
- Two-tab bar: **Teams** (active) | Settings
- Teams tab content:
  - Page-level dirty indicator (top of content, subtle amber banner): "Unsaved changes — save to update your panel."
  - **WNBA section** (Card):
    - Header row: league badge "WNBA" (orange), toggle ON (enabled), "Women's National Basketball Association"
    - Favorite teams sub-section (visible because toggle is ON):
      - 2 existing rows, each: team name text input (with datalist autocomplete, showing "Seattle Storm"), abbreviation badge "SEA", remove × button
      - "Add team" ghost link/button at bottom of section
  - **NHL section** (Card):
    - Header row: league badge "NHL" (blue), toggle OFF (disabled)
    - Collapsed content (no favorites visible because league is disabled)
    - Light call-to-action: "Enable NHL to pick favorite teams"
  - **Save bar** (sticky bottom or below cards): primary Button "Save Teams" (enabled, amber/primary because dirty), secondary Button "Discard changes"

**Design notes:** This replaces the current fragmented Sports tab + Favorites tab. One surface, one save. Dirty state is explicit (banner + button state changes). Toggling a league off does NOT delete its saved favorites — they're preserved but greyed/hidden. The datalist autocomplete enriches abbreviation + ID from the team directory automatically.

---

### 05-device-settings

**Frame size:** 1280 × 900 px (desktop)

**What to show:**
- Full Layout.
- Sub-header: "← Back" | "Living Room Panel" | StatusBadge Online
- Two-tab bar: Teams | **Settings** (active)
- Settings tab content (clean state, no unsaved changes):
  - **Card: Display**
    - `Brightness` — labelled slider (range 1–100) + numeric input side by side, current value 80. Helper: "Controls LED panel brightness. Changes take effect on next poll."
    - `Timezone` — select/combobox, current value "America/Los_Angeles". Helper: "Sets how game start times are displayed on the panel."
  - **Disclosure/accordion: "Advanced — Refresh Cadence"** (collapsed by default, chevron icon):
    - When expanded: three number inputs side by side:
      - Pre-game (sec): 30
      - In-game (sec): 5
      - Final (sec): 60
    - Helper text: "The device automatically backs off polling. Adjust only if needed."
  - **Save bar**: primary Button "Save Settings" (disabled/greyed because no changes). Secondary Button "Discard" (also disabled). Dirty state would enable both.

**Design notes:** Matrix width/height, logo variant, live layout select, priority/boost toggles, and conflict-resolution are ALL removed from this view. Only brightness + timezone + cadence (advanced, collapsed). Every visible control is real.

---

### 06-admin-sports-leagues

**Frame size:** 1280 × 960 px (desktop)

**What to show:**
- Full Layout — but sidebar shows the admin variant: Dashboard + **Admin** (active, trophy icon). The "Admin" item is only visible to role=admin users; normal users never see it.
- Role indicator banner (subtle, top of content): "Admin view — changes affect all users' devices."
- Page heading: "Sports & Leagues" / subhead "Global catalog — manage which sports and leagues are available to all users."
- Content: a two-column layout:
  - Left: sports list (WNBA, NHL) as Cards with sport name, league count badge, expand arrow
  - Right panel (when a sport is selected, e.g. WNBA): league list table
    - Columns: League name, Code, Enabled toggle, Action
    - Example row: WNBA (enabled)
    - "Add League" button
- No "Analytics" nav item, no "Settings" nav item anywhere.

**Design notes:** This is the admin-gated catalog. A normal user (not admin) navigating to `/admin/sports-leagues` sees a 403/Forbidden state — design that too as a small inset state within the right panel: "You don't have permission to access this area."

---

## Export instructions

After completing all frames:

1. **PNG export** — for each frame, export at 1x (or 2x if the extension supports it):
   - Frame 01-dashboard → `/Users/stevebargelt/code/wnba-led-scoreboard/designs/01-dashboard.png`
   - Frame 02-dashboard-empty → `/Users/stevebargelt/code/wnba-led-scoreboard/designs/02-dashboard-empty.png`
   - Frame 03-device-onboarding → `/Users/stevebargelt/code/wnba-led-scoreboard/designs/03-device-onboarding.png`
   - Frame 04-device-teams → `/Users/stevebargelt/code/wnba-led-scoreboard/designs/04-device-teams.png`
   - Frame 05-device-settings → `/Users/stevebargelt/code/wnba-led-scoreboard/designs/05-device-settings.png`
   - Frame 06-admin-sports-leagues → `/Users/stevebargelt/code/wnba-led-scoreboard/designs/06-admin-sports-leagues.png`

2. **HTML code export** (optional, skip if Pencil tooling doesn't support it):
   - Export all frames to `/Users/stevebargelt/code/wnba-led-scoreboard/designs/code/`
   - File naming: `01-dashboard.html`, `02-dashboard-empty.html`, etc.

3. Save the `.pen` file: `/Users/stevebargelt/code/wnba-led-scoreboard/designs/wnba-led-scoreboard.pen`

---

## Key design constraints (non-negotiable)

- **One Save per tab.** Save button is disabled (greyed) when no changes are pending. Enabled when dirty.
- **No always-on save.** Dirty state must be visually obvious before Save is enabled.
- **Honest success.** A success toast means the DB was written and the device will pick it up on its next poll cycle. Never show success for a no-op.
- **Nothing inert visible.** Matrix width/height, logo variant, priority/boost toggles, conflict resolution, manual game overrides, device token — all absent from every screen.
- **No DEVICE_TOKEN anywhere.** Onboarding shows DEVICE_ID + Supabase env vars only.
- **WCAG 2.1 AA contrast** on all text, icons, and interactive elements in both light and dark mode.
- **Responsive.** Core layouts work at 375px (mobile) — the sidebar collapses to a hamburger/bottom-nav on mobile. (You may annotate the desktop frames with a note: "mobile: sidebar collapses to bottom nav" rather than designing separate mobile frames unless you have extra time.)
