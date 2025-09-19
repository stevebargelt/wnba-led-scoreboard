#!/usr/bin/env python3
"""
Setup script to run Supabase migrations and seed data.
"""

import os
import sys
from pathlib import Path
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def run_migration(client, migration_file):
    """Run a single migration file."""
    print(f"Running migration: {migration_file.name}")

    with open(migration_file, 'r') as f:
        sql = f.read()

    try:
        # Execute the SQL
        result = client.rpc("exec", {"query": sql}).execute()
        print(f"  ✓ {migration_file.name} completed")
        return True
    except Exception as e:
        print(f"  ✗ {migration_file.name} failed: {e}")
        return False

def main():
    # Get Supabase credentials
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY")

    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set")
        print("Set them in .env file or as environment variables")
        sys.exit(1)

    # Initialize client
    try:
        client = create_client(supabase_url, supabase_key)
        print(f"Connected to Supabase: {supabase_url}")
    except Exception as e:
        print(f"Failed to connect to Supabase: {e}")
        sys.exit(1)

    # Get migration files
    migrations_dir = Path(__file__).parent / "migrations"

    print("\n" + "="*50)
    print("IMPORTANT: Migrations must be run through Supabase Dashboard")
    print("="*50)
    print("\nThe Supabase Python client cannot run arbitrary SQL.")
    print("Please follow these steps:\n")
    print("1. Go to your Supabase Dashboard")
    print(f"2. Navigate to SQL Editor at: {supabase_url}/sql")
    print("3. Run this migration file:")
    print(f"   - {migrations_dir}/000_complete_setup.sql")
    print("\nOr run these files in order:")
    print(f"   1. {migrations_dir}/001_setup_tables.sql")
    print(f"   2. {migrations_dir}/002_enable_rls.sql")
    print(f"   3. {migrations_dir}/003_sports_leagues.sql")
    print("\n4. After migrations, optionally run seed data:")
    print(f"   - {migrations_dir.parent}/seed/sports_leagues_seed.sql")
    print("\n" + "="*50)

    # Test connection by trying to query sports table
    print("\nTesting database connection...")
    try:
        result = client.table("sports").select("count").execute()
        print("✓ Database is properly configured!")
        print(f"  Found {len(result.data)} sports in database")
    except Exception as e:
        error_msg = str(e)
        if "not found" in error_msg.lower():
            print("✗ Sports table not found - please run migrations")
        else:
            print(f"✗ Database test failed: {e}")

if __name__ == "__main__":
    main()