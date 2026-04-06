-- Fix: Change get_device_configuration parameter from UUID to TEXT
-- This handles RPC calls from Python/JavaScript that pass device_id as string

DROP FUNCTION IF EXISTS get_device_configuration(UUID);

CREATE OR REPLACE FUNCTION get_device_configuration(p_device_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_config JSON;
    v_device_uuid UUID;
BEGIN
    -- Cast TEXT to UUID (validates format and raises error if invalid)
    v_device_uuid := p_device_id::UUID;
    
    -- Build complete configuration JSON for the device
    WITH device_data AS (
        SELECT
            d.id,
            d.name,
            d.last_seen_ts,
            dc.timezone,
            dc.brightness,
            dc.matrix_width,
            dc.matrix_height,
            dc.refresh_pregame_sec,
            dc.refresh_ingame_sec,
            dc.refresh_final_sec,
            dc.live_display_layout,
            dc.display_config,
            dc.priority_config
        FROM devices d
        LEFT JOIN device_config dc ON dc.device_id = d.id
        WHERE d.id = v_device_uuid
    ),
    enabled_leagues AS (
        SELECT
            json_agg(
                json_build_object(
                    'code', l.code,
                    'name', l.name,
                    'priority', dl.priority
                ) ORDER BY dl.priority
            ) AS leagues
        FROM device_leagues dl
        JOIN leagues l ON l.id = dl.league_id
        WHERE dl.device_id = v_device_uuid
        AND dl.enabled = true
    ),
    favorite_teams AS (
        SELECT
            l.code AS league_code,
            json_agg(
                json_build_object(
                    'team_id', dft.team_id,
                    'name', COALESCE(lt.name, dft.team_id),
                    'abbreviation', COALESCE(lt.abbreviation, UPPER(LEFT(dft.team_id, 3))),
                    'logo_url', lt.logo_url
                ) ORDER BY dft.priority
            ) AS teams
        FROM device_favorite_teams dft
        JOIN leagues l ON l.id = dft.league_id
        LEFT JOIN league_teams lt ON lt.league_id = dft.league_id AND lt.team_id = dft.team_id
        WHERE dft.device_id = v_device_uuid
        GROUP BY l.code
    )
    SELECT json_build_object(
        'device_id', device_data.id,
        'device_name', device_data.name,
        'timezone', COALESCE(device_data.timezone, 'America/Los_Angeles'),
        'matrix_config', json_build_object(
            'width', COALESCE(device_data.matrix_width, 128),
            'height', COALESCE(device_data.matrix_height, 64),
            'brightness', COALESCE(device_data.brightness, 100)
        ),
        'refresh_config', json_build_object(
            'pregame_sec', COALESCE(device_data.refresh_pregame_sec, 600),
            'ingame_sec', COALESCE(device_data.refresh_ingame_sec, 120),
            'final_sec', COALESCE(device_data.refresh_final_sec, 900)
        ),
        'render_config', json_build_object(
            'live_layout', COALESCE(device_data.live_display_layout, 'stacked'),
            'logo_variant', COALESCE(device_data.display_config->>'logo_variant', 'mini')
        ),
        'enabled_leagues', COALESCE(enabled_leagues.leagues, '[]'::json),
        'favorite_teams', COALESCE(
            (SELECT json_object_agg(league_code, teams) FROM favorite_teams),
            '{}'::json
        ),
        'priority_config', COALESCE(device_data.priority_config::json, '{}'::json),
        'last_updated', NOW()
    ) INTO v_config
    FROM device_data
    LEFT JOIN enabled_leagues ON true;

    IF v_config IS NULL THEN
        RAISE EXCEPTION 'Device % not found', p_device_id;
    END IF;

    UPDATE devices
    SET last_seen_ts = NOW()
    WHERE id = v_device_uuid;

    RETURN v_config;
END;
$$;

-- Update grants for new TEXT signature
GRANT EXECUTE ON FUNCTION get_device_configuration(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_device_configuration(TEXT) TO service_role;

COMMENT ON FUNCTION get_device_configuration IS 'Retrieves complete configuration for a device. Accepts TEXT device_id and casts to UUID internally for compatibility with RPC calls.';
