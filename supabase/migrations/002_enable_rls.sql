-- Migration 002: Enable Row Level Security
-- This should be run AFTER 001_setup_tables.sql

-- Enable RLS on tables
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can view their own devices" ON devices;
DROP POLICY IF EXISTS "Users can insert their own devices" ON devices;
DROP POLICY IF EXISTS "Users can update their own devices" ON devices;
DROP POLICY IF EXISTS "Users can delete their own devices" ON devices;

DROP POLICY IF EXISTS "Users can view configs for their devices" ON configs;
DROP POLICY IF EXISTS "Users can insert configs for their devices" ON configs;
DROP POLICY IF EXISTS "Users can update configs for their devices" ON configs;
DROP POLICY IF EXISTS "Users can delete configs for their devices" ON configs;

-- Create policies for devices table
CREATE POLICY "Users can view their own devices" ON devices
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own devices" ON devices
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own devices" ON devices
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own devices" ON devices
    FOR DELETE USING (user_id = auth.uid());

-- Create policies for configs table
CREATE POLICY "Users can view configs for their devices" ON configs
    FOR SELECT USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert configs for their devices" ON configs
    FOR INSERT WITH CHECK (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update configs for their devices" ON configs
    FOR UPDATE USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete configs for their devices" ON configs
    FOR DELETE USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );