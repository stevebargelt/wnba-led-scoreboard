import { GameSnapshot, GameState, Sport, League, TeamInfo } from './types'

export function getPeriodName(sportCode: string, period: number): string {
  const code = sportCode.toLowerCase()
  if (code === 'basketball' || code === 'wnba') {
    if (period <= 4) return `Q${period}`
    return `OT${period - 4}`
  }
  if (code === 'hockey' || code === 'nhl') {
    if (period <= 3) return `P${period}`
    if (period === 4) return 'OT'
    return 'SO'
  }
  return `P${period}`
}

const WNBA_SPORT: Sport = { id: 'basketball', name: 'Basketball', code: 'wnba' }
const WNBA_LEAGUE: League = {
  id: 'wnba',
  name: 'WNBA',
  abbreviation: 'WNBA',
  sport_id: 'basketball',
}
const MERCURY: TeamInfo = { id: '11', name: 'Mercury', abbr: 'PHX', score: 0 }
const SPARKS: TeamInfo = { id: '6', name: 'Sparks', abbr: 'LA', score: 0 }

export function createDemoPregameSnapshot(): GameSnapshot {
  const start = new Date(Date.now() + 2 * 60 * 60 * 1000)
  return {
    sport: WNBA_SPORT,
    league: WNBA_LEAGUE,
    event_id: 'demo-wnba-pre',
    state: GameState.PRE,
    start_time_local: start,
    home: { ...MERCURY, score: 0 },
    away: { ...SPARKS, score: 0 },
    current_period: 1,
    period_name: 'Q1',
    display_clock: '',
    seconds_to_start: 7200,
    status_detail: '7:00 PM ET',
  }
}

export function createDemoLiveSnapshot(): GameSnapshot {
  return {
    sport: WNBA_SPORT,
    league: WNBA_LEAGUE,
    event_id: 'demo-wnba-live',
    state: GameState.LIVE,
    start_time_local: new Date(Date.now() - 45 * 60 * 1000),
    home: { ...MERCURY, score: 72 },
    away: { ...SPARKS, score: 68 },
    current_period: 3,
    period_name: 'Q3',
    display_clock: '5:42',
    seconds_to_start: 0,
    status_detail: 'Q3 5:42',
  }
}

export function createDemoFinalSnapshot(): GameSnapshot {
  return {
    sport: WNBA_SPORT,
    league: WNBA_LEAGUE,
    event_id: 'demo-wnba-final',
    state: GameState.FINAL,
    start_time_local: new Date(Date.now() - 3 * 60 * 60 * 1000),
    home: { ...MERCURY, score: 89 },
    away: { ...SPARKS, score: 82 },
    current_period: 4,
    period_name: 'Q4',
    display_clock: '',
    seconds_to_start: 0,
    status_detail: 'Final',
  }
}

const NHL_SPORT: Sport = { id: 'hockey', name: 'Hockey', code: 'nhl' }
const NHL_LEAGUE: League = { id: 'nhl', name: 'NHL', abbreviation: 'NHL', sport_id: 'hockey' }
const BRUINS: TeamInfo = { id: '6', name: 'Bruins', abbr: 'BOS', score: 0 }
const CANADIENS: TeamInfo = { id: '8', name: 'Canadiens', abbr: 'MTL', score: 0 }

export function createNhlDemoPregameSnapshot(): GameSnapshot {
  const start = new Date(Date.now() + 2 * 60 * 60 * 1000)
  return {
    sport: NHL_SPORT,
    league: NHL_LEAGUE,
    event_id: 'demo-nhl-pre',
    state: GameState.PRE,
    start_time_local: start,
    home: { ...BRUINS, score: 0 },
    away: { ...CANADIENS, score: 0 },
    current_period: 1,
    period_name: 'P1',
    display_clock: '',
    seconds_to_start: 7200,
    status_detail: '7:00 PM ET',
  }
}

export function createNhlDemoLiveSnapshot(): GameSnapshot {
  return {
    sport: NHL_SPORT,
    league: NHL_LEAGUE,
    event_id: 'demo-nhl-live',
    state: GameState.LIVE,
    start_time_local: new Date(Date.now() - 30 * 60 * 1000),
    home: { ...BRUINS, score: 3 },
    away: { ...CANADIENS, score: 2 },
    current_period: 2,
    period_name: 'P2',
    display_clock: '12:34',
    seconds_to_start: 0,
    status_detail: 'P2 12:34',
  }
}

export function createNhlDemoFinalSnapshot(): GameSnapshot {
  return {
    sport: NHL_SPORT,
    league: NHL_LEAGUE,
    event_id: 'demo-nhl-final',
    state: GameState.FINAL,
    start_time_local: new Date(Date.now() - 3 * 60 * 60 * 1000),
    home: { ...BRUINS, score: 4 },
    away: { ...CANADIENS, score: 3 },
    current_period: 3,
    period_name: 'P3',
    display_clock: '',
    seconds_to_start: 0,
    status_detail: 'Final',
  }
}
