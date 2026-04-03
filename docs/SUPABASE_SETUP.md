# Supabase Setup Guide

## Overview

This guide covers setting up a new Supabase instance for the WNBA LED Scoreboard.

## Prerequisites

- Supabase account with project created
- Project credentials (URL, anon key, service role key)
- Access to Supabase SQL Editor

## Step 1: Update Environment Variables

Update `.env` with your Supabase credentials:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DEVICE_ID=your-device-uuid
```

## Step 2: Run Database Migrations

### Why Manual Migration?

Supabase does not support raw SQL execution via the REST API for security reasons. The standard approach is to use the SQL Editor in the Supabase Dashboard.

### Running Migrations

1. Open Supabase SQL Editor:
   ```
   https://supabase.com/dashboard/project/YOUR_PROJECT_REF/sql
   ```

2. Run each migration file in order:
   - `supabase/migrations/001_complete_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_seed_data.sql`

3. For each file:
   - Open the file in your editor
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click "Run" or press Cmd+Enter

### Verification

After running migrations, verify the setup:

```bash
python scripts/run_migrations.py
```

This will check:
- All required tables exist
- Sports and leagues data is seeded
- RLS policies are active

## Step 3: Create/Verify Device

The device should be created automatically when you first access the web admin. Alternatively, create it manually:

```sql
INSERT INTO devices (id, name, owner_id)
VALUES (
    'e9004446-dbb9-44dc-be01-410048f26cd3',
    'Default Device',
    (SELECT id FROM auth.users LIMIT 1)
)
ON CONFLICT (id) DO NOTHING;
```

## Step 4: Test Connection

Test the Python app can connect and load configuration:

```bash
python -c "from src.config.supabase_config_loader import *; from supabase import create_client; import os; client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_ANON_KEY')); loader = SupabaseConfigLoader(os.getenv('DEVICE_ID'), client); config = loader.load_full_config(); print('✅ Config loaded:', config.device_id, 'Leagues:', config.enabled_leagues)"
```

## Troubleshooting

### Connection Errors

- Verify SUPABASE_URL and keys are correct
- Check project is not paused (inactive projects pause after 7 days)
- Ensure RLS policies allow device access

### Missing Tables

- Run migrations in order - each depends on the previous
- Check SQL Editor for error messages
- Verify you're running against the correct project

### Device Not Found

- Check DEVICE_ID matches a device in the database
- Verify the device has an owner_id set
- Check RLS policies allow device access

## Alternative: Supabase CLI (Advanced)

If you have the Supabase CLI installed and configured:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Note: This requires proper authentication and configuration.
