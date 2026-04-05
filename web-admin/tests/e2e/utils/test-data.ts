export const TEST_DEVICE = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Test Device',
  description: 'Device for E2E testing',
}

export const TEST_LEAGUES = [
  {
    sport_key: 'basketball_wnba',
    league_key: 'wnba',
    enabled: true,
  },
  {
    sport_key: 'hockey_nhl',
    league_key: 'nhl',
    enabled: false,
  },
]

export const TEST_FAVORITE_TEAMS = [
  {
    team_id: 'las-vegas-aces',
    team_name: 'Las Vegas Aces',
    league_key: 'wnba',
  },
  {
    team_id: 'seattle-storm',
    team_name: 'Seattle Storm',
    league_key: 'wnba',
  },
]

export const TEST_CONFIG = {
  brightness: 75,
  timezone: 'America/New_York',
  layout_mode: 'stacked',
  show_final_games: true,
  rotation_seconds: 10,
  pregame_offset_hours: 2,
  postgame_display_hours: 4,
}
