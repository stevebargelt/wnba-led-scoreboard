#!/usr/bin/env python3

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

MIGRATIONS_DIR = Path(__file__).parent.parent / "supabase" / "migrations"

MIGRATIONS = [
    "001_complete_schema.sql",
    "002_rls_policies.sql",
    "003_seed_data.sql",
]

def print_migrations():
    url = os.getenv("SUPABASE_URL", "")
    if url:
        project_ref = url.split("//")[1].split(".")[0]
        print(f"\n=== Supabase SQL Editor ===")
        print(f"https://supabase.com/dashboard/project/{project_ref}/sql\n")

    print("=== MIGRATION INSTRUCTIONS ===")
    print("Copy and paste each migration into the Supabase SQL Editor in order:\n")

    for i, migration_file in enumerate(MIGRATIONS, 1):
        migration_path = MIGRATIONS_DIR / migration_file

        if not migration_path.exists():
            print(f"\n❌ Migration file not found: {migration_path}")
            continue

        print(f"\n{'='*60}")
        print(f"Migration {i}/3: {migration_file}")
        print(f"{'='*60}\n")

        with open(migration_path, 'r') as f:
            content = f.read()

        print(content)

        if i < len(MIGRATIONS):
            print(f"\n\n{'='*60}")
            print(f"✓ After running {migration_file}, proceed to the next migration")
            print(f"{'='*60}\n")

    print(f"\n{'='*60}")
    print("✓ All migrations printed!")
    print("\nAfter running all migrations, verify with:")
    print("  python scripts/run_migrations.py")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    print_migrations()
