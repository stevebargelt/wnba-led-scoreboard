DROP FUNCTION IF EXISTS save_device_teams(UUID, JSONB);

CREATE OR REPLACE FUNCTION save_device_teams(p_device_id UUID, p_leagues JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    entry JSONB;
BEGIN
    FOR entry IN SELECT * FROM jsonb_array_elements(p_leagues)
    LOOP
        INSERT INTO device_leagues (device_id, league_id, enabled, priority)
        VALUES (
            p_device_id,
            (entry->>'league_id')::UUID,
            (entry->>'enabled')::BOOLEAN,
            (entry->>'priority')::INTEGER
        )
        ON CONFLICT (device_id, league_id)
        DO UPDATE SET
            enabled = EXCLUDED.enabled,
            priority = EXCLUDED.priority;

        IF (entry->>'enabled')::BOOLEAN THEN
            DELETE FROM device_favorite_teams
            WHERE device_id = p_device_id
              AND league_id = (entry->>'league_id')::UUID;

            INSERT INTO device_favorite_teams (device_id, league_id, team_id, priority)
            SELECT
                p_device_id,
                (entry->>'league_id')::UUID,
                team_id_text,
                999
            FROM jsonb_array_elements_text(entry->'team_ids') AS team_id_text;
        END IF;
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION save_device_teams(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION save_device_teams(UUID, JSONB) TO service_role;
