#!/bin/bash

set -e

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    exit 1
fi

PROJECT_REF=$(echo "$SUPABASE_URL" | sed 's|https://||' | sed 's|.supabase.co||')
echo "Project Reference: $PROJECT_REF"

MIGRATIONS_DIR="$(dirname "$0")/../supabase/migrations"

echo "Linking to Supabase project..."
supabase link --project-ref "$PROJECT_REF" || {
    echo "Error: Failed to link to Supabase project"
    echo "You may need to login first: supabase login"
    exit 1
}

echo ""
echo "Applying migrations..."

for migration in "001_complete_schema.sql" "002_rls_policies.sql" "003_seed_data.sql"; do
    echo "Running migration: $migration"

    supabase db execute --db-url "postgresql://postgres:${SUPABASE_SERVICE_ROLE_KEY}@db.${PROJECT_REF}.supabase.co:5432/postgres" \
        --file "${MIGRATIONS_DIR}/${migration}" || {
        echo "Error: Failed to run migration $migration"
        echo "Trying alternative method with psql..."

        PGPASSWORD="${SUPABASE_SERVICE_ROLE_KEY}" psql \
            -h "db.${PROJECT_REF}.supabase.co" \
            -p 5432 \
            -U postgres \
            -d postgres \
            -f "${MIGRATIONS_DIR}/${migration}" || {
            echo "Error: Both methods failed for $migration"
            echo "Please run migrations manually through SQL Editor:"
            echo "  https://supabase.com/dashboard/project/${PROJECT_REF}/sql"
            exit 1
        }
    }

    echo "✅ $migration completed successfully"
    echo ""
done

echo "✅ All migrations completed successfully!"
