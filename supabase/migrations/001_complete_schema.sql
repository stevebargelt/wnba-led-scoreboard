-- Complete Schema for WNBA LED Scoreboard
-- Direct Supabase Integration (no agents/websockets)
-- This single migration replaces all previous schema migrations

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    last_seen_ts TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Device configuration (hybrid approach: columns + JSONB for flexibility)
CREATE TABLE IF NOT EXISTS device_config (
    device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,

    -- Core settings as columns for easy querying
    timezone VARCHAR(100) DEFAULT 'America/Los_Angeles',
    brightness INTEGER DEFAULT 100 CHECK (brightness BETWEEN 1 AND 100),
    matrix_width INTEGER DEFAULT 128,
    matrix_height INTEGER DEFAULT 64,

    -- Refresh intervals
    refresh_pregame_sec INTEGER DEFAULT 600,
    refresh_ingame_sec INTEGER DEFAULT 120,
    refresh_final_sec INTEGER DEFAULT 900,

    -- Display settings
    live_display_layout VARCHAR(50) DEFAULT 'stacked',

    -- Flexible JSONB fields for extensibility
    display_config JSONB DEFAULT '{}',
    priority_config JSONB DEFAULT '{}',
    feature_flags JSONB DEFAULT '{}',
    custom_settings JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- SPORTS/LEAGUES HIERARCHY
-- ============================================================================

-- Sports table - defines base sport configurations
CREATE TABLE IF NOT EXISTS sports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,

    -- Sport configuration
    timing JSONB NOT NULL DEFAULT '{}',
    scoring JSONB NOT NULL DEFAULT '{}',
    terminology JSONB NOT NULL DEFAULT '{}',
    extensions JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leagues table - specific league implementations
CREATE TABLE IF NOT EXISTS leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    sport_id UUID REFERENCES sports(id) ON DELETE CASCADE,

    -- API configuration
    api_config JSONB NOT NULL DEFAULT '{}',

    -- Current season info
    current_season JSONB DEFAULT NULL,

    -- League-specific overrides
    timing_overrides JSONB DEFAULT '{}',
    scoring_overrides JSONB DEFAULT '{}',
    terminology_overrides JSONB DEFAULT '{}',

    -- League metadata
    team_count INTEGER DEFAULT 0,
    conference_structure JSONB DEFAULT NULL,
    team_assets_url TEXT,
    logo_url_template TEXT,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- League teams table
CREATE TABLE IF NOT EXISTS league_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    team_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(10) NOT NULL,
    logo_url TEXT,
    colors JSONB DEFAULT '{}',
    conference VARCHAR(50),
    division VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(league_id, team_id),
    UNIQUE(league_id, abbreviation)
);

-- Device league preferences
CREATE TABLE IF NOT EXISTS device_leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 999,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT device_leagues_unique UNIQUE (device_id, league_id)
);

-- Device favorite teams
CREATE TABLE IF NOT EXISTS device_favorite_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    team_id VARCHAR(50) NOT NULL,
    priority INTEGER DEFAULT 999,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(device_id, league_id, team_id)
);

-- Game overrides (for forcing specific games to display)
CREATE TABLE IF NOT EXISTS game_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    sport VARCHAR(50) NOT NULL,
    game_event_id VARCHAR(100) NOT NULL,
    reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    overridden_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    overridden_by_user_id UUID REFERENCES auth.users(id),

    UNIQUE(device_id, game_event_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_leagues_sport_id ON leagues(sport_id);
CREATE INDEX IF NOT EXISTS idx_leagues_code ON leagues(code);
CREATE INDEX IF NOT EXISTS idx_league_teams_league_id ON league_teams(league_id);
CREATE INDEX IF NOT EXISTS idx_device_leagues_device_id ON device_leagues(device_id);
CREATE INDEX IF NOT EXISTS idx_device_favorite_teams_device_id ON device_favorite_teams(device_id);
CREATE INDEX IF NOT EXISTS idx_game_overrides_device_id ON game_overrides(device_id);
CREATE INDEX IF NOT EXISTS idx_game_overrides_expires_at ON game_overrides(expires_at);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Initialize device configuration
CREATE OR REPLACE FUNCTION initialize_device_config()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO device_config (device_id)
    VALUES (NEW.id)
    ON CONFLICT (device_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Initialize device leagues
CREATE OR REPLACE FUNCTION initialize_device_leagues(p_device_id UUID)
RETURNS void AS $$
BEGIN
    -- Insert default league entries for all leagues
    INSERT INTO device_leagues (device_id, league_id, enabled, priority)
    SELECT
        p_device_id,
        l.id,
        false,
        CASE l.code
            WHEN 'wnba' THEN 1
            WHEN 'nhl' THEN 2
            WHEN 'nba' THEN 3
            WHEN 'mlb' THEN 4
            WHEN 'nfl' THEN 5
            ELSE 999
        END
    FROM leagues l
    ON CONFLICT (device_id, league_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Auto-initialize leagues for new devices
CREATE OR REPLACE FUNCTION auto_initialize_device_leagues()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM initialize_device_leagues(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp triggers
CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_config_updated_at
    BEFORE UPDATE ON device_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sports_updated_at
    BEFORE UPDATE ON sports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leagues_updated_at
    BEFORE UPDATE ON leagues
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_league_teams_updated_at
    BEFORE UPDATE ON league_teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_leagues_updated_at
    BEFORE UPDATE ON device_leagues
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-initialization triggers
CREATE TRIGGER initialize_device_config_on_device_create
    AFTER INSERT ON devices
    FOR EACH ROW
    EXECUTE FUNCTION initialize_device_config();

CREATE TRIGGER initialize_leagues_on_device_create
    AFTER INSERT ON devices
    FOR EACH ROW
    EXECUTE FUNCTION auto_initialize_device_leagues();