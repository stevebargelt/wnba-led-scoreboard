-- Create devices table if it doesn't exist
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    user_id UUID REFERENCES auth.users(id),
    last_seen_ts TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add user_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'devices' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE devices ADD COLUMN user_id UUID REFERENCES auth.users(id);
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

-- Enable Row Level Security (only if not already enabled)
DO $$
BEGIN
    ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
    ALTER TABLE configs ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own devices" ON devices;
DROP POLICY IF EXISTS "Users can insert their own devices" ON devices;
DROP POLICY IF EXISTS "Users can update their own devices" ON devices;
DROP POLICY IF EXISTS "Users can delete their own devices" ON devices;

DROP POLICY IF EXISTS "Users can view configs for their devices" ON configs;
DROP POLICY IF EXISTS "Users can insert configs for their devices" ON configs;
DROP POLICY IF EXISTS "Users can update configs for their devices" ON configs;
DROP POLICY IF EXISTS "Users can delete configs for their devices" ON configs;

-- Create policies for devices
CREATE POLICY "Users can view their own devices" ON devices
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own devices" ON devices
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own devices" ON devices
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own devices" ON devices
    FOR DELETE USING (user_id = auth.uid());

-- Create policies for configs
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