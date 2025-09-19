-- Row Level Security Policies
-- Comprehensive RLS setup for all tables

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_favorite_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_overrides ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DEVICES TABLE POLICIES
-- ============================================================================

-- Users can view their own devices
CREATE POLICY "Users can view own devices" ON devices
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create devices
CREATE POLICY "Users can create devices" ON devices
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own devices
CREATE POLICY "Users can update own devices" ON devices
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own devices
CREATE POLICY "Users can delete own devices" ON devices
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- DEVICE_CONFIG TABLE POLICIES
-- ============================================================================

-- Users can view config for their devices
CREATE POLICY "Users can view device config" ON device_config
    FOR SELECT
    USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- Users can insert config for their devices
CREATE POLICY "Users can insert device config" ON device_config
    FOR INSERT
    WITH CHECK (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- Users can update config for their devices
CREATE POLICY "Users can update device config" ON device_config
    FOR UPDATE
    USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- Users can delete config for their devices
CREATE POLICY "Users can delete device config" ON device_config
    FOR DELETE
    USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- SPORTS & LEAGUES - PUBLIC READ, AUTHENTICATED WRITE
-- ============================================================================

-- Everyone can read sports
CREATE POLICY "Sports are viewable by everyone" ON sports
    FOR SELECT
    USING (true);

-- Only authenticated users can modify sports (admin function)
CREATE POLICY "Authenticated users can modify sports" ON sports
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Everyone can read leagues
CREATE POLICY "Leagues are viewable by everyone" ON leagues
    FOR SELECT
    USING (true);

-- Only authenticated users can modify leagues (admin function)
CREATE POLICY "Authenticated users can modify leagues" ON leagues
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Everyone can read teams
CREATE POLICY "Teams are viewable by everyone" ON league_teams
    FOR SELECT
    USING (true);

-- Only authenticated users can modify teams (admin function)
CREATE POLICY "Authenticated users can modify teams" ON league_teams
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- DEVICE_LEAGUES TABLE POLICIES
-- ============================================================================

-- Users can view league configs for their devices
CREATE POLICY "Users can view device leagues" ON device_leagues
    FOR SELECT
    USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- Users can add league configs for their devices
CREATE POLICY "Users can insert device leagues" ON device_leagues
    FOR INSERT
    WITH CHECK (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- Users can update league configs for their devices
CREATE POLICY "Users can update device leagues" ON device_leagues
    FOR UPDATE
    USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- Users can delete league configs for their devices
CREATE POLICY "Users can delete device leagues" ON device_leagues
    FOR DELETE
    USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- DEVICE_FAVORITE_TEAMS TABLE POLICIES
-- ============================================================================

-- Users can view favorite teams for their devices
CREATE POLICY "Users can view device favorite teams" ON device_favorite_teams
    FOR SELECT
    USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- Users can add favorite teams for their devices
CREATE POLICY "Users can insert device favorite teams" ON device_favorite_teams
    FOR INSERT
    WITH CHECK (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- Users can update favorite teams for their devices
CREATE POLICY "Users can update device favorite teams" ON device_favorite_teams
    FOR UPDATE
    USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- Users can delete favorite teams for their devices
CREATE POLICY "Users can delete device favorite teams" ON device_favorite_teams
    FOR DELETE
    USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- GAME_OVERRIDES TABLE POLICIES
-- ============================================================================

-- Users can view overrides for their devices
CREATE POLICY "Users can view game overrides" ON game_overrides
    FOR SELECT
    USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- Users can create overrides for their devices
CREATE POLICY "Users can insert game overrides" ON game_overrides
    FOR INSERT
    WITH CHECK (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
        AND auth.uid() = overridden_by_user_id
    );

-- Users can update overrides for their devices
CREATE POLICY "Users can update game overrides" ON game_overrides
    FOR UPDATE
    USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- Users can delete overrides for their devices
CREATE POLICY "Users can delete game overrides" ON game_overrides
    FOR DELETE
    USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );