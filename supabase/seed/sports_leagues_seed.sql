-- Seed Sports
INSERT INTO sports (code, name, timing, scoring, terminology, extensions) VALUES
(
    'hockey',
    'Hockey',
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
    }'::jsonb,
    '{
        "scoringTypes": {
            "goal": 1,
            "empty_net": 1,
            "penalty_shot": 1,
            "shootout_goal": 1
        },
        "defaultScoreValue": 1
    }'::jsonb,
    '{
        "gameStartTerm": "Puck Drop",
        "periodEndTerm": "End of Period",
        "gameEndTerm": "Final",
        "overtimeTerm": "Overtime"
    }'::jsonb,
    '{
        "has_penalty_box": true,
        "has_power_play": true,
        "max_players_on_ice": 6,
        "goalie_pulled_situations": true
    }'::jsonb
),
(
    'basketball',
    'Basketball',
    '{
        "periodType": "quarter",
        "regulationPeriods": 4,
        "periodDurationMinutes": 12,
        "clockDirection": "down",
        "hasOvertime": true,
        "overtimeDurationMinutes": 5,
        "hasShootout": false,
        "hasSuddenDeath": false,
        "intermissionDurationMinutes": 15,
        "periodNameFormat": "Q{number}",
        "overtimeName": "OT"
    }'::jsonb,
    '{
        "scoringTypes": {
            "free_throw": 1,
            "field_goal": 2,
            "three_pointer": 3
        },
        "defaultScoreValue": 2
    }'::jsonb,
    '{
        "gameStartTerm": "Tip Off",
        "periodEndTerm": "End of Quarter",
        "gameEndTerm": "Final",
        "overtimeTerm": "Overtime"
    }'::jsonb,
    '{
        "has_shot_clock": true,
        "shot_clock_seconds": 24,
        "has_three_point_line": true,
        "has_free_throws": true,
        "max_fouls_before_ejection": 6
    }'::jsonb
);

-- Seed Leagues
INSERT INTO leagues (code, name, sport_id, api_config, current_season, timing_overrides, team_count)
SELECT
    'nhl',
    'National Hockey League',
    s.id,
    '{
        "baseUrl": "https://api-web.nhle.com/v1",
        "endpoints": {
            "scoreboard": "/score/{date}",
            "teams": "/teams",
            "standings": "/standings"
        },
        "rateLimitPerMinute": 60,
        "cacheTTLSeconds": 300
    }'::jsonb,
    '{
        "startDate": "2024-10-04",
        "endDate": "2025-06-30",
        "playoffStart": "2025-04-15",
        "isActive": true
    }'::jsonb,
    '{
        "overtimeDurationMinutes": 5,
        "hasShootout": true
    }'::jsonb,
    32
FROM sports s WHERE s.code = 'hockey';

INSERT INTO leagues (code, name, sport_id, api_config, current_season, timing_overrides, team_count)
SELECT
    'wnba',
    'Women''s National Basketball Association',
    s.id,
    '{
        "baseUrl": "http://site.api.espn.com/apis/site/v2/sports/basketball/wnba",
        "endpoints": {
            "scoreboard": "/scoreboard",
            "teams": "/teams",
            "standings": "/standings"
        },
        "rateLimitPerMinute": 60,
        "cacheTTLSeconds": 300
    }'::jsonb,
    '{
        "startDate": "2025-05-16",
        "endDate": "2025-10-20",
        "playoffStart": "2025-09-15",
        "isActive": false
    }'::jsonb,
    '{
        "periodDurationMinutes": 10
    }'::jsonb,
    12
FROM sports s WHERE s.code = 'basketball';

INSERT INTO leagues (code, name, sport_id, api_config, current_season, timing_overrides, team_count)
SELECT
    'nba',
    'National Basketball Association',
    s.id,
    '{
        "baseUrl": "http://site.api.espn.com/apis/site/v2/sports/basketball/nba",
        "endpoints": {
            "scoreboard": "/scoreboard",
            "teams": "/teams",
            "standings": "/standings"
        },
        "rateLimitPerMinute": 60,
        "cacheTTLSeconds": 300
    }'::jsonb,
    '{
        "startDate": "2024-10-22",
        "endDate": "2025-06-15",
        "playoffStart": "2025-04-15",
        "isActive": true
    }'::jsonb,
    '{}',  -- No overrides, uses default 12-minute quarters
    30
FROM sports s WHERE s.code = 'basketball';