# Database Migrations

## Clean Migration Structure

We use just **3 migrations** to set up the entire database:

1. **`001_complete_schema.sql`** - All tables, indexes, functions, and triggers
2. **`002_rls_policies.sql`** - Complete Row Level Security setup
3. **`003_seed_data.sql`** - Initial sports and leagues data

## Installation

Run these migrations in order in your Supabase SQL Editor:

```sql
-- 1. Copy and run 001_complete_schema.sql
-- 2. Copy and run 002_rls_policies.sql
-- 3. Copy and run 003_seed_data.sql
```

## What Gets Created

### Tables (8 total)
- `devices` - User devices with ownership
- `device_config` - Device display settings
- `sports` - Sport definitions (Basketball, Hockey, etc.)
- `leagues` - League implementations (WNBA, NHL, etc.)
- `league_teams` - Teams within leagues
- `device_leagues` - Enabled leagues per device
- `device_favorite_teams` - Favorite teams per device
- `game_overrides` - Force specific games to display

### Automatic Features
- RLS policies for secure access
- Auto-initialization of device config
- Auto-initialization of league entries
- Update timestamp triggers
- Sports/leagues data (WNBA, NHL, NBA, MLB, NFL)

## Archived Migrations

The `archive/` folder contains old migrations from the previous architecture. These are kept for reference but should NOT be run.