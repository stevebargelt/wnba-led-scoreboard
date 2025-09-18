import type { NextApiRequest, NextApiResponse } from 'next'
import { PeriodType, ClockDirection, type SportConfig, type LeagueConfig } from '@/types/sports'

// Mock data for now - in production, this would come from Python backend
const SPORTS_DATA: SportConfig[] = [
  {
    name: 'Hockey',
    code: 'hockey',
    timing: {
      periodType: PeriodType.PERIOD,
      regulationPeriods: 3,
      periodDurationMinutes: 20,
      clockDirection: ClockDirection.COUNT_DOWN,
      hasOvertime: true,
      overtimeDurationMinutes: 5,
      hasShootout: true,
      hasSuddenDeath: true,
      intermissionDurationMinutes: 18,
      periodNameFormat: 'P{number}',
      overtimeName: 'OT',
    },
    scoring: {
      scoringTypes: {
        goal: 1,
        empty_net: 1,
        penalty_shot: 1,
        shootout_goal: 1,
      },
      defaultScoreValue: 1,
    },
    terminology: {
      gameStartTerm: 'Puck Drop',
      periodEndTerm: 'End of Period',
      gameEndTerm: 'Final',
      overtimeTerm: 'Overtime',
    },
    extensions: {
      has_penalty_box: true,
      has_power_play: true,
      max_players_on_ice: 6,
      goalie_pulled_situations: true,
    },
  },
  {
    name: 'Basketball',
    code: 'basketball',
    timing: {
      periodType: PeriodType.QUARTER,
      regulationPeriods: 4,
      periodDurationMinutes: 12,
      clockDirection: ClockDirection.COUNT_DOWN,
      hasOvertime: true,
      overtimeDurationMinutes: 5,
      hasShootout: false,
      hasSuddenDeath: false,
      intermissionDurationMinutes: 15,
      periodNameFormat: 'Q{number}',
      overtimeName: 'OT',
    },
    scoring: {
      scoringTypes: {
        free_throw: 1,
        field_goal: 2,
        three_pointer: 3,
      },
      defaultScoreValue: 2,
    },
    terminology: {
      gameStartTerm: 'Tip Off',
      periodEndTerm: 'End of Quarter',
      gameEndTerm: 'Final',
      overtimeTerm: 'Overtime',
    },
    extensions: {
      has_shot_clock: true,
      shot_clock_seconds: 24,
      has_three_point_line: true,
    },
  },
]

const LEAGUES_DATA: LeagueConfig[] = [
  {
    name: 'National Hockey League',
    code: 'nhl',
    sportCode: 'hockey',
    api: {
      baseUrl: 'https://api-web.nhle.com/v1',
      endpoints: {
        scoreboard: '/score/{date}',
        teams: '/teams',
        standings: '/standings',
      },
      rateLimitPerMinute: 60,
      cacheTTLSeconds: 300,
    },
    teamCount: 32,
    conferenceStructure: {
      Eastern: ['Metropolitan', 'Atlantic'],
      Western: ['Central', 'Pacific'],
    },
    timingOverrides: {
      overtimeDurationMinutes: 5,
      hasShootout: true,
    },
    currentSeason: {
      startDate: '2024-10-04',
      endDate: '2025-06-30',
      playoffStart: '2025-04-15',
      isActive: true,
    },
  },
  {
    name: "Women's National Basketball Association",
    code: 'wnba',
    sportCode: 'basketball',
    api: {
      baseUrl: 'http://site.api.espn.com/apis/site/v2/sports/basketball/wnba',
      endpoints: {
        scoreboard: '/scoreboard',
        teams: '/teams',
        standings: '/standings',
      },
      rateLimitPerMinute: 60,
      cacheTTLSeconds: 300,
    },
    teamCount: 12,
    timingOverrides: {
      periodDurationMinutes: 10,
    },
    currentSeason: {
      startDate: '2025-05-16',
      endDate: '2025-10-20',
      playoffStart: '2025-09-15',
      isActive: false,
    },
  },
]

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Return all sports and leagues
    res.status(200).json({
      sports: SPORTS_DATA,
      leagues: LEAGUES_DATA,
    })
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
