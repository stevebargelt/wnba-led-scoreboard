#!/usr/bin/env python3

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

try:
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
except ImportError:
    print("Error: psycopg2 not installed. Install with: pip install psycopg2-binary")
    sys.exit(1)

load_dotenv()

MIGRATIONS_DIR = Path(__file__).parent.parent / "supabase" / "migrations"

MIGRATIONS = [
    "001_complete_schema.sql",
    "002_rls_policies.sql",
    "003_seed_data.sql",
]

def get_db_connection():
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        sys.exit(1)

    project_ref = supabase_url.split("//")[1].split(".")[0]

    db_config = {
        "host": f"db.{project_ref}.supabase.co",
        "port": 5432,
        "database": "postgres",
        "user": "postgres",
        "password": service_role_key,
    }

    try:
        conn = psycopg2.connect(**db_config)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        return conn
    except psycopg2.OperationalError as e:
        print(f"Error: Could not connect to database: {e}")
        print("\nNote: Direct PostgreSQL connections may not be enabled.")
        print("You may need to run migrations through the Supabase SQL Editor:")
        print(f"  https://supabase.com/dashboard/project/{project_ref}/sql")
        sys.exit(1)

def run_migrations():
    conn = get_db_connection()
    cursor = conn.cursor()

    print("Connected to Supabase PostgreSQL database\n")

    for migration_file in MIGRATIONS:
        migration_path = MIGRATIONS_DIR / migration_file

        if not migration_path.exists():
            print(f"Error: Migration file not found: {migration_path}")
            cursor.close()
            conn.close()
            sys.exit(1)

        print(f"Running migration: {migration_file}")

        with open(migration_path, 'r') as f:
            sql = f.read()

        try:
            cursor.execute(sql)
            print(f"✅ {migration_file} completed successfully\n")
        except Exception as e:
            print(f"❌ Error running {migration_file}: {e}")
            cursor.close()
            conn.close()
            sys.exit(1)

    cursor.close()
    conn.close()

    print("✅ All migrations completed successfully!")

if __name__ == "__main__":
    run_migrations()
