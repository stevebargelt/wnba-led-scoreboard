import { GameSnapshot, GameState, Sport, League, TeamInfo } from './types'

const BASKETBALL_SPORT: Sport = {
  id: 'basketball',
  name: 'Basketball',
  periods: 4,
}

const WNBA_LEAGUE: League = {
  id: 'wnba',
  name: 'WNBA',
  abbreviation: 'WNBA',
  sport_id: 'basketball',
}

function getPeriodName(sport: Sport, period: number): string {
  if (sport.id === 'basketball') {
    if (period <= 4) return `Q${period}`
    return `OT${period - 4}`
  }
  return `P${period}`
}

export function createDemoPregameSnapshot(): GameSnapshot {
  const startTime = new Date()
  startTime.setHours(startTime.getHours() + 2)

  return {
    sport: BASKETBALL_SPORT,
    league: WNBA_LEAGUE,
    event_id: 'demo-pregame',
    state: GameState.PRE,
    start_time_local: startTime,
    home: {
      id: '11',
      name: 'Mercury',
      abbr: 'PHX',
      score: 0,
    },
    away: {
      id: '6',
      name: 'Sparks',
      abbr: 'LA',
      score: 0,
    },
    current_period: 1,
    period_name: 'Q1',
    display_clock: '',
    seconds_to_start: 7200,
    status_detail: '7:00 PM ET',
  }
}

export function createDemoLiveSnapshot(): GameSnapshot {
  const period = 3

  return {
    sport: BASKETBALL_SPORT,
    league: WNBA_LEAGUE,
    event_id: 'demo-live',
    state: GameState.LIVE,
    start_time_local: new Date(),
    home: {
      id: '11',
      name: 'Mercury',
      abbr: 'PHX',
      score: 72,
    },
    away: {
      id: '6',
      name: 'Sparks',
      abbr: 'LA',
      score: 68,
    },
    current_period: period,
    period_name: getPeriodName(BASKETBALL_SPORT, period),
    display_clock: '5:42',
    seconds_to_start: -1,
    status_detail: 'Q3 5:42',
  }
}

export function createDemoFinalSnapshot(): GameSnapshot {
  const period = 4

  return {
    sport: BASKETBALL_SPORT,
    league: WNBA_LEAGUE,
    event_id: 'demo-final',
    state: GameState.FINAL,
    start_time_local: new Date(),
    home: {
      id: '11',
      name: 'Mercury',
      abbr: 'PHX',
      score: 89,
    },
    away: {
      id: '6',
      name: 'Sparks',
      abbr: 'LA',
      score: 82,
    },
    current_period: period,
    period_name: getPeriodName(BASKETBALL_SPORT, period),
    display_clock: '',
    seconds_to_start: -1,
    status_detail: 'Final',
  }
}
