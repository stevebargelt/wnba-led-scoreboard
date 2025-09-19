-- Sports table - defines base sport configurations
CREATE TABLE sports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,

    -- Timing configuration
    timing JSONB NOT NULL DEFAULT '{}',
    -- Example: {
    --   "periodType": "period",
    --   "regulationPeriods": 3,
    --   "periodDurationMinutes": 20,
    --   "clockDirection": "down",
    --   "hasOvertime": true,
    --   "overtimeDurationMinutes": 5,
    --   "hasShootout": true,
    --   "hasSuddenDeath": true,
    --   "intermissionDurationMinutes": 18,
    --   "periodNameFormat": "P{number}",
    --   "overtimeName": "OT"
    -- }

    -- Scoring configuration
    scoring JSONB NOT NULL DEFAULT '{}',
    -- Example: {
    --   "scoringTypes": {"goal": 1, "empty_net": 1},
    --   "defaultScoreValue": 1
    -- }

    -- Terminology configuration
    terminology JSONB NOT NULL DEFAULT '{}',
    -- Example: {
    --   "gameStartTerm": "Puck Drop",
    --   "periodEndTerm": "End of Period",
    --   "gameEndTerm": "Final",
    --   "overtimeTerm": "Overtime"
    -- }

    -- Sport-specific extensions
    extensions JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leagues table - specific league implementations
CREATE TABLE leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    sport_id UUID REFERENCES sports(id) ON DELETE CASCADE,

    -- API configuration
    api_config JSONB NOT NULL DEFAULT '{}',
    -- Example: {
    --   "baseUrl": "https://api-web.nhle.com/v1",
    --   "endpoints": {"scoreboard": "/score/{date}", "teams": "/teams"},
    --   "rateLimitPerMinute": 60,
    --   "cacheTTLSeconds": 300
    -- }

    -- Current season info
    current_season JSONB DEFAULT NULL,
    -- Example: {
    --   "startDate": "2024-10-04",
    --   "endDate": "2025-06-30",
    --   "playoffStart": "2025-04-15",
    --   "isActive": true
    -- }

    -- League-specific overrides of sport settings
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
CREATE TABLE league_teams (
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

-- Device league preferences (which leagues are enabled per device)
CREATE TABLE device_leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 999,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(device_id, league_id)
);

-- Device favorite teams (per league)
CREATE TABLE device_favorite_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    team_id VARCHAR(50) NOT NULL,
    priority INTEGER DEFAULT 999,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(device_id, league_id, team_id)
);

-- Indexes for performance
CREATE INDEX idx_leagues_sport_id ON leagues(sport_id);
CREATE INDEX idx_leagues_code ON leagues(code);
CREATE INDEX idx_league_teams_league_id ON league_teams(league_id);
CREATE INDEX idx_device_leagues_device_id ON device_leagues(device_id);
CREATE INDEX idx_device_favorite_teams_device_id ON device_favorite_teams(device_id);

-- Row Level Security
ALTER TABLE sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_favorite_teams ENABLE ROW LEVEL SECURITY;

-- Policies: Everyone can read sports/leagues/teams
CREATE POLICY "Sports are viewable by everyone" ON sports
    FOR SELECT USING (true);

CREATE POLICY "Leagues are viewable by everyone" ON leagues
    FOR SELECT USING (true);

CREATE POLICY "League teams are viewable by everyone" ON league_teams
    FOR SELECT USING (true);

-- Only authenticated users can modify sports/leagues (admin functions)
CREATE POLICY "Only authenticated users can modify sports" ON sports
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Only authenticated users can modify leagues" ON leagues
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Only authenticated users can modify teams" ON league_teams
    FOR ALL USING (auth.role() = 'authenticated');

-- Device owners can manage their own device preferences
CREATE POLICY "Device owners can view their league preferences" ON device_leagues
    FOR SELECT USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Device owners can update their league preferences" ON device_leagues
    FOR ALL USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Device owners can view their favorite teams" ON device_favorite_teams
    FOR SELECT USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Device owners can update their favorite teams" ON device_favorite_teams
    FOR ALL USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_sports_updated_at BEFORE UPDATE ON sports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leagues_updated_at BEFORE UPDATE ON leagues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_league_teams_updated_at BEFORE UPDATE ON league_teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();