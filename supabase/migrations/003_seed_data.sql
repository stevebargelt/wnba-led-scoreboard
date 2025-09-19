-- Seed Data for Sports and Leagues
-- Initial data setup for all supported sports and leagues

-- ============================================================================
-- SPORTS DATA
-- ============================================================================

INSERT INTO sports (code, name, timing, scoring, terminology) VALUES
-- Basketball
('basketball', 'Basketball',
  '{
    "periodType": "quarter",
    "regulationPeriods": 4,
    "periodDurationMinutes": 12,
    "clockDirection": "down",
    "hasOvertime": true,
    "overtimeDurationMinutes": 5,
    "intermissionDurationMinutes": 15,
    "periodNameFormat": "Q{number}",
    "overtimeName": "OT"
  }'::JSONB,
  '{
    "scoringTypes": {
      "field_goal": 2,
      "three_pointer": 3,
      "free_throw": 1
    },
    "defaultScoreValue": 2
  }'::JSONB,
  '{
    "gameStartTerm": "Tip-Off",
    "periodEndTerm": "End of Quarter",
    "gameEndTerm": "Final",
    "overtimeTerm": "OT",
    "halfTimeTerm": "Halftime"
  }'::JSONB
),

-- Hockey
('hockey', 'Hockey',
  '{
    "periodType": "period",
    "regulationPeriods": 3,
    "periodDurationMinutes": 20,
    "clockDirection": "down",
    "hasOvertime": true,
    "overtimeDurationMinutes": 5,
    "hasShootout": true,
    "hasSuddenDeath": true,
    "intermissionDurationMinutes": 18,
    "periodNameFormat": "P{number}",
    "overtimeName": "OT"
  }'::JSONB,
  '{
    "scoringTypes": {
      "goal": 1,
      "empty_net": 1,
      "power_play": 1,
      "short_handed": 1,
      "penalty_shot": 1
    },
    "defaultScoreValue": 1
  }'::JSONB,
  '{
    "gameStartTerm": "Puck Drop",
    "periodEndTerm": "End of Period",
    "gameEndTerm": "Final",
    "overtimeTerm": "OT",
    "shootoutTerm": "SO"
  }'::JSONB
),

-- Baseball
('baseball', 'Baseball',
  '{
    "periodType": "inning",
    "regulationPeriods": 9,
    "clockDirection": "none",
    "hasOvertime": true,
    "overtimeName": "Extra Innings"
  }'::JSONB,
  '{
    "scoringTypes": {
      "run": 1,
      "home_run": 1,
      "rbi": 1
    },
    "defaultScoreValue": 1
  }'::JSONB,
  '{
    "gameStartTerm": "First Pitch",
    "periodEndTerm": "End of Inning",
    "gameEndTerm": "Final",
    "overtimeTerm": "Extra Innings",
    "topTerm": "Top",
    "bottomTerm": "Bottom"
  }'::JSONB
),

-- Football
('football', 'Football',
  '{
    "periodType": "quarter",
    "regulationPeriods": 4,
    "periodDurationMinutes": 15,
    "clockDirection": "down",
    "hasOvertime": true,
    "overtimeDurationMinutes": 10,
    "intermissionDurationMinutes": 12,
    "periodNameFormat": "Q{number}",
    "overtimeName": "OT"
  }'::JSONB,
  '{
    "scoringTypes": {
      "touchdown": 6,
      "field_goal": 3,
      "safety": 2,
      "two_point": 2,
      "extra_point": 1
    },
    "defaultScoreValue": 6
  }'::JSONB,
  '{
    "gameStartTerm": "Kickoff",
    "periodEndTerm": "End of Quarter",
    "gameEndTerm": "Final",
    "overtimeTerm": "OT",
    "halfTimeTerm": "Halftime"
  }'::JSONB
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  timing = EXCLUDED.timing,
  scoring = EXCLUDED.scoring,
  terminology = EXCLUDED.terminology;

-- ============================================================================
-- LEAGUES DATA
-- ============================================================================

WITH sport_ids AS (
  SELECT code, id FROM sports
)
INSERT INTO leagues (code, name, sport_id, api_config, current_season, team_count, is_active) VALUES
-- Basketball Leagues
('wnba', 'WNBA',
  (SELECT id FROM sport_ids WHERE code = 'basketball'),
  '{
    "baseUrl": "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba",
    "endpoints": {
      "scoreboard": "/scoreboard",
      "teams": "/teams",
      "standings": "/standings"
    },
    "rateLimitPerMinute": 60,
    "cacheTTLSeconds": 300
  }'::JSONB,
  '{
    "year": 2025,
    "startDate": "2025-05-16",
    "endDate": "2025-10-31",
    "playoffStart": "2025-09-15",
    "isActive": false,
    "description": "Regular season starts May 16"
  }'::JSONB,
  12,
  false
),

('nba', 'NBA',
  (SELECT id FROM sport_ids WHERE code = 'basketball'),
  '{
    "baseUrl": "https://site.api.espn.com/apis/site/v2/sports/basketball/nba",
    "endpoints": {
      "scoreboard": "/scoreboard",
      "teams": "/teams",
      "standings": "/standings"
    },
    "rateLimitPerMinute": 60,
    "cacheTTLSeconds": 300
  }'::JSONB,
  '{
    "year": 2024,
    "startDate": "2024-10-22",
    "endDate": "2025-06-30",
    "playoffStart": "2025-04-15",
    "isActive": true,
    "description": "2024-25 Season"
  }'::JSONB,
  30,
  true
),

-- Hockey League
('nhl', 'NHL',
  (SELECT id FROM sport_ids WHERE code = 'hockey'),
  '{
    "baseUrl": "https://api-web.nhle.com/v1",
    "endpoints": {
      "scoreboard": "/score/{date}",
      "schedule": "/schedule/{date}",
      "standings": "/standings/now"
    },
    "rateLimitPerMinute": 60,
    "cacheTTLSeconds": 300
  }'::JSONB,
  '{
    "year": 2024,
    "startDate": "2024-10-04",
    "endDate": "2025-06-30",
    "playoffStart": "2025-04-15",
    "isActive": true,
    "description": "2024-25 Season"
  }'::JSONB,
  32,
  true
),

-- Baseball League
('mlb', 'MLB',
  (SELECT id FROM sport_ids WHERE code = 'baseball'),
  '{
    "baseUrl": "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb",
    "endpoints": {
      "scoreboard": "/scoreboard",
      "teams": "/teams",
      "standings": "/standings"
    },
    "rateLimitPerMinute": 60,
    "cacheTTLSeconds": 300
  }'::JSONB,
  '{
    "year": 2025,
    "startDate": "2025-03-27",
    "endDate": "2025-11-05",
    "playoffStart": "2025-10-01",
    "isActive": false,
    "description": "Season starts March 27"
  }'::JSONB,
  30,
  false
),

-- Football League
('nfl', 'NFL',
  (SELECT id FROM sport_ids WHERE code = 'football'),
  '{
    "baseUrl": "https://site.api.espn.com/apis/site/v2/sports/football/nfl",
    "endpoints": {
      "scoreboard": "/scoreboard",
      "teams": "/teams",
      "standings": "/standings"
    },
    "rateLimitPerMinute": 60,
    "cacheTTLSeconds": 300
  }'::JSONB,
  '{
    "year": 2024,
    "startDate": "2024-09-05",
    "endDate": "2025-02-09",
    "playoffStart": "2025-01-11",
    "isActive": true,
    "description": "2024-25 Season including playoffs"
  }'::JSONB,
  32,
  true
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  sport_id = EXCLUDED.sport_id,
  api_config = EXCLUDED.api_config,
  current_season = EXCLUDED.current_season,
  team_count = EXCLUDED.team_count,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- INITIALIZE EXISTING DEVICES
-- ============================================================================

-- Initialize config for any existing devices
INSERT INTO device_config (device_id)
SELECT id FROM devices
ON CONFLICT (device_id) DO NOTHING;

-- Initialize league entries for any existing devices
DO $$
DECLARE
    device_record RECORD;
BEGIN
    FOR device_record IN SELECT id FROM devices
    LOOP
        PERFORM initialize_device_leagues(device_record.id);
    END LOOP;
END $$;

-- ============================================================================
-- HELPFUL DEV/TEST DATA (Optional - comment out for production)
-- ============================================================================

-- Create a test device if none exist (for development)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM devices LIMIT 1) THEN
        -- Create a test device for the first auth user (if any)
        INSERT INTO devices (name, user_id)
        SELECT
            'Test LED Display',
            id
        FROM auth.users
        LIMIT 1;

        RAISE NOTICE 'Created test device for development';
    END IF;
END $$;