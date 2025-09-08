Web Admin (Next.js) — Skeleton

Overview
- Minimal Next.js app with Supabase Auth and device pages to drive the agent via Edge Functions.
- This is a scaffold to get you started; fill in UI/validation as you go.

Prereqs
- Node 18+
- Set env from `.env.local.example` → `.env.local` (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, FUNCTION URLs)

Auth Setup
- In Supabase Dashboard → Authentication → Providers → Email:
  - Enable Email provider.
  - Enable “Email + Password”.
  - For development, you can disable email confirmations to simplify testing; otherwise new sign-ups will require email confirmation.
  - Optionally keep Magic Link enabled; the UI now uses email+password by default.

Install & Run
- `cd web-admin`
- `npm install` (or `pnpm i`/`yarn`)
- `npm run dev` → open http://localhost:3000

Pages
- `/` — Sign-in (email magic link) and list your devices.
- `/device/[id]` — Device detail: apply config (calls on-config-write) and run actions (calls on-action).

Config
- Update `.env.local` with your Supabase values and deployed function URLs.
- Functions: `on-config-write` and `on-action` must be deployed in your Supabase project.
