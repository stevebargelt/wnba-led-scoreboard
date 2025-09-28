-- Populate NHL teams in league_teams table
-- This fixes the issue where team abbreviations were showing as IDs in demo mode

-- Get the NHL league ID
DO $$
DECLARE
    v_nhl_league_id UUID;
BEGIN
    SELECT id INTO v_nhl_league_id FROM leagues WHERE code = 'nhl';

    IF v_nhl_league_id IS NOT NULL THEN
        -- Delete existing NHL teams if any
        DELETE FROM league_teams WHERE league_id = v_nhl_league_id;

        -- Insert all 32 NHL teams
        INSERT INTO league_teams (league_id, team_id, name, abbreviation, logo_url, conference, division)
        VALUES
            (v_nhl_league_id, '1', 'New Jersey Devils', 'NJD', 'https://assets.nhle.com/logos/nhl/svg/NJD_light.svg', 'Eastern', 'Metropolitan'),
            (v_nhl_league_id, '2', 'New York Islanders', 'NYI', 'https://assets.nhle.com/logos/nhl/svg/NYI_light.svg', 'Eastern', 'Metropolitan'),
            (v_nhl_league_id, '3', 'New York Rangers', 'NYR', 'https://assets.nhle.com/logos/nhl/svg/NYR_light.svg', 'Eastern', 'Metropolitan'),
            (v_nhl_league_id, '4', 'Philadelphia Flyers', 'PHI', 'https://assets.nhle.com/logos/nhl/svg/PHI_light.svg', 'Eastern', 'Metropolitan'),
            (v_nhl_league_id, '5', 'Pittsburgh Penguins', 'PIT', 'https://assets.nhle.com/logos/nhl/svg/PIT_light.svg', 'Eastern', 'Metropolitan'),
            (v_nhl_league_id, '6', 'Boston Bruins', 'BOS', 'https://assets.nhle.com/logos/nhl/svg/BOS_light.svg', 'Eastern', 'Atlantic'),
            (v_nhl_league_id, '7', 'Buffalo Sabres', 'BUF', 'https://assets.nhle.com/logos/nhl/svg/BUF_light.svg', 'Eastern', 'Atlantic'),
            (v_nhl_league_id, '8', 'Montreal Canadiens', 'MTL', 'https://assets.nhle.com/logos/nhl/svg/MTL_light.svg', 'Eastern', 'Atlantic'),
            (v_nhl_league_id, '9', 'Ottawa Senators', 'OTT', 'https://assets.nhle.com/logos/nhl/svg/OTT_light.svg', 'Eastern', 'Atlantic'),
            (v_nhl_league_id, '10', 'Toronto Maple Leafs', 'TOR', 'https://assets.nhle.com/logos/nhl/svg/TOR_light.svg', 'Eastern', 'Atlantic'),
            (v_nhl_league_id, '12', 'Carolina Hurricanes', 'CAR', 'https://assets.nhle.com/logos/nhl/svg/CAR_light.svg', 'Eastern', 'Metropolitan'),
            (v_nhl_league_id, '13', 'Florida Panthers', 'FLA', 'https://assets.nhle.com/logos/nhl/svg/FLA_light.svg', 'Eastern', 'Atlantic'),
            (v_nhl_league_id, '14', 'Tampa Bay Lightning', 'TBL', 'https://assets.nhle.com/logos/nhl/svg/TBL_light.svg', 'Eastern', 'Atlantic'),
            (v_nhl_league_id, '15', 'Washington Capitals', 'WSH', 'https://assets.nhle.com/logos/nhl/svg/WSH_light.svg', 'Eastern', 'Metropolitan'),
            (v_nhl_league_id, '16', 'Chicago Blackhawks', 'CHI', 'https://assets.nhle.com/logos/nhl/svg/CHI_light.svg', 'Western', 'Central'),
            (v_nhl_league_id, '17', 'Detroit Red Wings', 'DET', 'https://assets.nhle.com/logos/nhl/svg/DET_light.svg', 'Eastern', 'Atlantic'),
            (v_nhl_league_id, '18', 'Nashville Predators', 'NSH', 'https://assets.nhle.com/logos/nhl/svg/NSH_light.svg', 'Western', 'Central'),
            (v_nhl_league_id, '19', 'St. Louis Blues', 'STL', 'https://assets.nhle.com/logos/nhl/svg/STL_light.svg', 'Western', 'Central'),
            (v_nhl_league_id, '20', 'Calgary Flames', 'CGY', 'https://assets.nhle.com/logos/nhl/svg/CGY_light.svg', 'Western', 'Pacific'),
            (v_nhl_league_id, '21', 'Colorado Avalanche', 'COL', 'https://assets.nhle.com/logos/nhl/svg/COL_light.svg', 'Western', 'Central'),
            (v_nhl_league_id, '22', 'Edmonton Oilers', 'EDM', 'https://assets.nhle.com/logos/nhl/svg/EDM_light.svg', 'Western', 'Pacific'),
            (v_nhl_league_id, '23', 'Vancouver Canucks', 'VAN', 'https://assets.nhle.com/logos/nhl/svg/VAN_light.svg', 'Western', 'Pacific'),
            (v_nhl_league_id, '24', 'Anaheim Ducks', 'ANA', 'https://assets.nhle.com/logos/nhl/svg/ANA_light.svg', 'Western', 'Pacific'),
            (v_nhl_league_id, '25', 'Dallas Stars', 'DAL', 'https://assets.nhle.com/logos/nhl/svg/DAL_light.svg', 'Western', 'Central'),
            (v_nhl_league_id, '26', 'Los Angeles Kings', 'LAK', 'https://assets.nhle.com/logos/nhl/svg/LAK_light.svg', 'Western', 'Pacific'),
            (v_nhl_league_id, '28', 'San Jose Sharks', 'SJS', 'https://assets.nhle.com/logos/nhl/svg/SJS_light.svg', 'Western', 'Pacific'),
            (v_nhl_league_id, '29', 'Columbus Blue Jackets', 'CBJ', 'https://assets.nhle.com/logos/nhl/svg/CBJ_light.svg', 'Eastern', 'Metropolitan'),
            (v_nhl_league_id, '30', 'Minnesota Wild', 'MIN', 'https://assets.nhle.com/logos/nhl/svg/MIN_light.svg', 'Western', 'Central'),
            (v_nhl_league_id, '52', 'Winnipeg Jets', 'WPG', 'https://assets.nhle.com/logos/nhl/svg/WPG_light.svg', 'Western', 'Central'),
            (v_nhl_league_id, '53', 'Arizona Coyotes', 'ARI', 'https://assets.nhle.com/logos/nhl/svg/ARI_light.svg', 'Western', 'Central'),
            (v_nhl_league_id, '54', 'Vegas Golden Knights', 'VGK', 'https://assets.nhle.com/logos/nhl/svg/VGK_light.svg', 'Western', 'Pacific'),
            (v_nhl_league_id, '55', 'Seattle Kraken', 'SEA', 'https://assets.nhle.com/logos/nhl/svg/SEA_light.svg', 'Western', 'Pacific'),
            (v_nhl_league_id, '59', 'Utah Hockey Club', 'UTA', 'https://assets.nhle.com/logos/nhl/svg/UTA_light.svg', 'Western', 'Central');

        RAISE NOTICE 'Inserted % NHL teams', 33;
    ELSE
        RAISE WARNING 'NHL league not found in leagues table';
    END IF;
END $$;