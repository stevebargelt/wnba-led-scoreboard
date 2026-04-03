# Supabase Setup Scripts

This directory contains scripts to help set up and verify your Supabase database.

## Prerequisites

1. Supabase project created
2. `.env` file configured with credentials
3. Python virtual environment activated: `source .venv/bin/activate`

## Setup Workflow

### Step 1: Verify Environment

Ensure your `.env` file contains:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DEVICE_ID=your-device-uuid
```

### Step 2: Run Migrations

**Option A: SQL Editor (Recommended)**

1. Run `python scripts/print_migrations.py > migrations.sql`
2. Open the Supabase SQL Editor (URL printed in output)
3. Copy and paste each migration from the output
4. Run them in order

**Option B: Manual Copy-Paste**

1. Open Supabase SQL Editor
2. Copy contents of `supabase/migrations/001_complete_schema.sql`
3. Paste and run
4. Repeat for `002_rls_policies.sql` and `003_seed_data.sql`

### Step 3: Verify Migrations

```bash
python scripts/run_migrations.py
```

This checks:
- All required tables exist
- Sports and leagues data is seeded
- Database schema is correct

Expected output:
```
✅ Table 'devices' exists
✅ Table 'device_config' exists
✅ Table 'device_leagues' exists
✅ Table 'sports' exists
✅ Table 'leagues' exists

Found 5 sports:
  - Basketball (basketball)
  - Hockey (hockey)
  ...

Found 5 leagues:
  - WNBA (wnba) - basketball
  - NHL (nhl) - hockey
  ...
```

### Step 4: Setup Device

```bash
python scripts/setup_device.py
```

This will:
- Check if device exists
- Create device if missing
- Verify device configuration

### Step 5: Test Connection

```bash
python scripts/test_connection.py
```

This runs a complete integration test:
1. Checks environment variables
2. Tests Supabase client connection
3. Initializes configuration loader
4. Loads and displays device configuration

Expected output:
```
Testing Supabase connection...

1. Checking environment variables...
   ✅ SUPABASE_URL: https://...
   ✅ SUPABASE_ANON_KEY: eyJhbGci...
   ✅ DEVICE_ID: e9004446-dbb9-...

2. Testing Supabase client connection...
   ✅ Supabase client created successfully

3. Testing configuration loader...
   ✅ Configuration loader initialized

4. Loading device configuration...
   ✅ Configuration loaded successfully!
      Device ID: e9004446-dbb9-44dc-be01-410048f26cd3
      Timezone: America/Los_Angeles
      Enabled: True
      Enabled leagues: ['wnba', 'nhl']
      Favorite teams: 2 leagues with favorites

✅ All tests passed!
```

## Troubleshooting

### "Tables missing" error

- Run migrations first (Step 2)
- Verify migrations with `python scripts/run_migrations.py`

### "Device not found" error

- Run `python scripts/setup_device.py`
- Check DEVICE_ID in `.env` matches database

### "Failed to load configuration" error

- Verify device exists and has owner_id set
- Check RLS policies allow device access
- Ensure migrations were run successfully

### psycopg2 import errors

The `apply_migrations.py` script requires psycopg2 but programmatic migration execution
is not possible with just Supabase API keys. Use the SQL Editor instead.

## Script Reference

| Script | Purpose |
|--------|---------|
| `print_migrations.py` | Print all migrations for easy copy-paste |
| `run_migrations.py` | Verify migrations were applied correctly |
| `setup_device.py` | Create or verify device exists |
| `test_connection.py` | Complete integration test |
| `apply_migrations.py` | Attempts automated migration (requires DB password) |

## Why Manual Migration?

Supabase's REST API does not support arbitrary SQL execution for security reasons. The
standard approach is to use the SQL Editor in the Supabase Dashboard. This is the same
approach documented in the official Supabase migration README.

Direct PostgreSQL connections require the database password (shown once at project
creation), which is different from the API keys (anon_key and service_role_key).
