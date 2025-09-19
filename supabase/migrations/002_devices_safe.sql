-- This migration handles both new installations and existing databases

-- First, check if devices table exists and has user_id column
DO $$
DECLARE
    table_exists boolean;
    user_id_exists boolean;
BEGIN
    -- Check if devices table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'devices'
    ) INTO table_exists;

    IF table_exists THEN
        -- Check if user_id column exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'devices' AND column_name = 'user_id'
        ) INTO user_id_exists;

        IF NOT user_id_exists THEN
            -- Add user_id column
            ALTER TABLE devices ADD COLUMN user_id UUID REFERENCES auth.users(id);
        END IF;
    ELSE
        -- Create devices table
        CREATE TABLE devices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT,
            user_id UUID REFERENCES auth.users(id),
            last_seen_ts TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- Create configs table if it doesn't exist
CREATE TABLE IF NOT EXISTS configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
DO $$
BEGIN
    -- Enable RLS on devices if not already enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'devices'
        AND rowsecurity = true
    ) THEN
        ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
    END IF;

    -- Enable RLS on configs if not already enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'configs'
        AND rowsecurity = true
    ) THEN
        ALTER TABLE configs ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Only create policies if user_id column exists
DO $$
DECLARE
    has_user_id boolean;
BEGIN
    -- Check if user_id column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'devices' AND column_name = 'user_id'
    ) INTO has_user_id;

    IF has_user_id THEN
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Users can view their own devices" ON devices;
        DROP POLICY IF EXISTS "Users can insert their own devices" ON devices;
        DROP POLICY IF EXISTS "Users can update their own devices" ON devices;
        DROP POLICY IF EXISTS "Users can delete their own devices" ON devices;

        -- Create policies for devices
        CREATE POLICY "Users can view their own devices" ON devices
            FOR SELECT USING (user_id = auth.uid());

        CREATE POLICY "Users can insert their own devices" ON devices
            FOR INSERT WITH CHECK (user_id = auth.uid());

        CREATE POLICY "Users can update their own devices" ON devices
            FOR UPDATE USING (user_id = auth.uid());

        CREATE POLICY "Users can delete their own devices" ON devices
            FOR DELETE USING (user_id = auth.uid());
    ELSE
        -- If no user_id column, create permissive policies for now
        DROP POLICY IF EXISTS "Allow all for devices" ON devices;
        CREATE POLICY "Allow all for devices" ON devices
            FOR ALL USING (true);
    END IF;
END $$;

-- Create policies for configs table
DO $$
DECLARE
    has_user_id boolean;
BEGIN
    -- Check if devices table has user_id column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'devices' AND column_name = 'user_id'
    ) INTO has_user_id;

    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view configs for their devices" ON configs;
    DROP POLICY IF EXISTS "Users can insert configs for their devices" ON configs;
    DROP POLICY IF EXISTS "Users can update configs for their devices" ON configs;
    DROP POLICY IF EXISTS "Users can delete configs for their devices" ON configs;
    DROP POLICY IF EXISTS "Allow all for configs" ON configs;

    IF has_user_id THEN
        -- Create user-specific policies
        CREATE POLICY "Users can view configs for their devices" ON configs
            FOR SELECT USING (
                device_id IN (
                    SELECT id FROM devices WHERE devices.user_id = auth.uid()
                )
            );

        CREATE POLICY "Users can insert configs for their devices" ON configs
            FOR INSERT WITH CHECK (
                device_id IN (
                    SELECT id FROM devices WHERE devices.user_id = auth.uid()
                )
            );

        CREATE POLICY "Users can update configs for their devices" ON configs
            FOR UPDATE USING (
                device_id IN (
                    SELECT id FROM devices WHERE devices.user_id = auth.uid()
                )
            );

        CREATE POLICY "Users can delete configs for their devices" ON configs
            FOR DELETE USING (
                device_id IN (
                    SELECT id FROM devices WHERE devices.user_id = auth.uid()
                )
            );
    ELSE
        -- If no user_id column, create permissive policy
        CREATE POLICY "Allow all for configs" ON configs
            FOR ALL USING (true);
    END IF;
END $$;