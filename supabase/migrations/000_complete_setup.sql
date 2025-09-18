-- Complete Setup Migration
-- This single file sets up all tables if you prefer running everything at once
-- Alternative to running 001, 002, 003 separately

-- ============================================
-- PART 1: Create base tables
-- ============================================

-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    user_id UUID REFERENCES auth.users(id),
    last_seen_ts TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create configs table
CREATE TABLE IF NOT EXISTS configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PART 2: Enable RLS and create policies
-- ============================================

-- Enable RLS
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

-- Create device policies
CREATE POLICY "Users can view their own devices" ON devices
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own devices" ON devices
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own devices" ON devices
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own devices" ON devices
    FOR DELETE USING (user_id = auth.uid());

-- Create config policies
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

-- ============================================
-- PART 3: Sports and Leagues tables
-- ============================================

-- Create sports table
CREATE TABLE IF NOT EXISTS sports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    timing JSONB NOT NULL,
    scoring JSONB NOT NULL,
    terminology JSONB NOT NULL,
    extensions JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create leagues table
CREATE TABLE IF NOT EXISTS leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sport_id UUID REFERENCES sports(id),
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    api_config JSONB,
    current_season TEXT,
    timing_overrides JSONB,
    scoring_overrides JSONB,
    terminology_overrides JSONB,
    team_count INTEGER,
    conference_structure JSONB,
    team_assets_url TEXT,
    logo_url_template TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create league_teams table
CREATE TABLE IF NOT EXISTS league_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    team_id TEXT NOT NULL,
    name TEXT NOT NULL,
    abbreviation TEXT,
    logo_url TEXT,
    colors JSONB,
    conference TEXT,
    division TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(league_id, team_id)
);

-- Device-specific league configurations
CREATE TABLE IF NOT EXISTS device_leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(device_id, league_id)
);

-- Device favorite teams
CREATE TABLE IF NOT EXISTS device_favorite_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    team_id TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(device_id, league_id, team_id)
);

-- Enable RLS on sports/leagues tables
ALTER TABLE sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_favorite_teams ENABLE ROW LEVEL SECURITY;

-- Sports/leagues are publicly readable
CREATE POLICY "Sports are viewable by everyone" ON sports
    FOR SELECT USING (true);

CREATE POLICY "Leagues are viewable by everyone" ON leagues
    FOR SELECT USING (true);

CREATE POLICY "League teams are viewable by everyone" ON league_teams
    FOR SELECT USING (true);

-- Authenticated users can modify sports/leagues (admin functions)
CREATE POLICY "Authenticated users can manage sports" ON sports
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage leagues" ON leagues
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage league teams" ON league_teams
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Device-specific configurations require ownership
CREATE POLICY "Users can view their device leagues" ON device_leagues
    FOR SELECT USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their device leagues" ON device_leagues
    FOR ALL USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view their favorite teams" ON device_favorite_teams
    FOR SELECT USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their favorite teams" ON device_favorite_teams
    FOR ALL USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );