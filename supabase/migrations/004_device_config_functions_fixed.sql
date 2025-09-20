-- First drop the existing function if it exists
DROP FUNCTION IF EXISTS get_device_configuration(UUID);
DROP FUNCTION IF EXISTS device_heartbeat(UUID);

-- Database functions for device configuration access
-- Uses SECURITY DEFINER to allow controlled access without exposing tables

-- ============================================================================
-- FUNCTION: Get complete device configuration
-- ============================================================================

CREATE OR REPLACE FUNCTION get_device_configuration(p_device_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_config JSON;
BEGIN
    -- Build complete configuration JSON for the device
    WITH device_data AS (
        SELECT
            d.id,
            d.name,
            d.last_seen_ts,
            dc.timezone,
            dc.matrix_config,
            dc.render_config,
            dc.refresh_config,
            dc.priority_config
        FROM devices d
        LEFT JOIN device_config dc ON dc.device_id = d.id
        WHERE d.id = p_device_id
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
        WHERE dl.device_id = p_device_id
        AND dl.enabled = true
    ),
    favorite_teams AS (
        SELECT
            l.code AS league_code,
            json_agg(
                json_build_object(
                    'team_id', dft.team_id,
                    'name', COALESCE(lt.name, dft.team_id),  -- Use team_id as fallback name
                    'abbreviation', COALESCE(lt.abbreviation, UPPER(LEFT(dft.team_id, 3))),  -- Generate 3-letter abbr
                    'logo_url', lt.logo_url
                ) ORDER BY dft.priority
            ) AS teams
        FROM device_favorite_teams dft
        JOIN leagues l ON l.id = dft.league_id
        LEFT JOIN league_teams lt ON lt.league_id = dft.league_id AND lt.team_id = dft.team_id  -- LEFT JOIN instead of JOIN
        WHERE dft.device_id = p_device_id
        GROUP BY l.code
    )
    SELECT json_build_object(
        'device_id', device_data.id,
        'device_name', device_data.name,
        'timezone', COALESCE(device_data.timezone, 'America/Los_Angeles'),
        'matrix_config', COALESCE(device_data.matrix_config::json, json_build_object(
            'width', 128,
            'height', 64,
            'brightness', 100
        )),
        'refresh_config', COALESCE(device_data.refresh_config::json, json_build_object(
            'pregame_sec', 600,
            'ingame_sec', 120,
            'final_sec', 900
        )),
        'render_config', COALESCE(device_data.render_config::json, json_build_object(
            'live_layout', 'stacked',
            'logo_variant', 'mini'
        )),
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

    -- Return NULL if device doesn't exist
    IF v_config IS NULL THEN
        RAISE EXCEPTION 'Device % not found', p_device_id;
    END IF;

    -- Update last_seen timestamp
    UPDATE devices
    SET last_seen_ts = NOW()
    WHERE id = p_device_id;

    RETURN v_config;
END;
$$;

-- ============================================================================
-- FUNCTION: Register device heartbeat
-- ============================================================================

CREATE OR REPLACE FUNCTION device_heartbeat(p_device_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE devices
    SET last_seen_ts = NOW()
    WHERE id = p_device_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device % not found', p_device_id;
    END IF;
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Allow anonymous users to execute these functions
GRANT EXECUTE ON FUNCTION get_device_configuration(UUID) TO anon;
GRANT EXECUTE ON FUNCTION device_heartbeat(UUID) TO anon;

-- Also grant to authenticated users
GRANT EXECUTE ON FUNCTION get_device_configuration(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION device_heartbeat(UUID) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_device_configuration IS 'Retrieves complete configuration for a device including leagues, teams, and settings';
COMMENT ON FUNCTION device_heartbeat IS 'Updates the last_seen timestamp for a device';