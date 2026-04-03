#!/usr/bin/env python3

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

MIGRATIONS_DIR = Path(__file__).parent.parent / "supabase" / "migrations"

MIGRATIONS = [
    "001_complete_schema.sql",
    "002_rls_policies.sql",
    "003_seed_data.sql",
]

REQUIRED_TABLES = [
    "devices",
    "device_config",
    "device_leagues",
    "sports",
    "leagues",
]

def verify_migrations():
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        sys.exit(1)

    client = create_client(supabase_url, service_role_key)

    print("Verifying database setup...\n")

    all_verified = True

    for table in REQUIRED_TABLES:
        try:
            result = client.table(table).select("*", count="exact").limit(0).execute()
            print(f"✅ Table '{table}' exists")
        except Exception as e:
            print(f"❌ Table '{table}' missing or error: {e}")
            all_verified = False

    if not all_verified:
        print("\n⚠️  Some tables are missing!")
        print("\nTo run migrations:")
        print("1. Go to Supabase Dashboard > SQL Editor")
        print("2. Run each migration file in order:")
        for migration in MIGRATIONS:
            print(f"   - {migration}")
        sys.exit(1)

    print("\n✅ All required tables verified!")

    try:
        sports = client.table("sports").select("code,name").execute()
        if sports.data:
            print(f"\nFound {len(sports.data)} sports:")
            for sport in sports.data:
                print(f"  - {sport['name']} ({sport['code']})")
        else:
            print("\n⚠️  No sports data found - run 003_seed_data.sql")

        leagues = client.table("leagues").select("code,name,sport_code").execute()
        if leagues.data:
            print(f"\nFound {len(leagues.data)} leagues:")
            for league in leagues.data:
                print(f"  - {league['name']} ({league['code']}) - {league['sport_code']}")
        else:
            print("\n⚠️  No leagues data found - run 003_seed_data.sql")

    except Exception as e:
        print(f"\n⚠️  Error checking seed data: {e}")

    print("\n✅ Database verification complete!")

if __name__ == "__main__":
    verify_migrations()
