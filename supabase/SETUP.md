# Supabase Database Setup

## Migration Order

### Option A: Single Migration (Recommended for new installations)
Run **000_complete_setup.sql** - This sets up everything in one go

### Option B: Separate Migrations (If you need granular control)
Run these migrations in order:

1. **001_setup_tables.sql** - Creates devices and configs tables (without RLS)
2. **002_enable_rls.sql** - Enables Row Level Security and creates policies
3. **003_sports_leagues.sql** - Creates sports, leagues, and related tables

## Running Migrations

### Option 1: Through Supabase Dashboard

1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy and paste each migration file in order
4. Run each migration

### Option 2: Using Supabase CLI

```bash
# Install Supabase CLI if not already installed
brew install supabase/tap/supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## Seed Data

After running migrations, you can optionally load seed data:

```sql
-- Run contents of seed/sports_leagues_seed.sql
```

This will populate:
- Hockey and Basketball sports
- NHL, WNBA, and NBA leagues

## Environment Variables

### For Python App (.env)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
DEVICE_ID=unique-device-id  # Optional, for device-specific configs
```

### For Web Admin (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Tables Overview

### Core Tables
- **sports** - Sport definitions (hockey, basketball, etc.)
- **leagues** - League implementations (NHL, WNBA, NBA, etc.)
- **league_teams** - Teams for each league

### Device Configuration
- **devices** - Registered devices
- **configs** - Device configurations (legacy)
- **device_leagues** - Which leagues are enabled per device
- **device_favorite_teams** - Favorite teams per device/league

## Row Level Security

All tables have RLS enabled:
- Sports/leagues/teams are readable by everyone
- Device configurations are only accessible by device owners
- Authenticated users can modify sports/leagues (admin functions)