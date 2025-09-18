/**
 * Type definitions for sports and leagues
 */

export enum PeriodType {
  QUARTER = 'quarter',
  PERIOD = 'period',
  HALF = 'half',
  INNING = 'inning',
  SET = 'set',
}

export enum ClockDirection {
  COUNT_DOWN = 'down',
  COUNT_UP = 'up',
  NONE = 'none',
}

export interface TimingConfig {
  periodType: PeriodType
  regulationPeriods: number
  periodDurationMinutes: number
  clockDirection: ClockDirection
  hasOvertime: boolean
  overtimeDurationMinutes?: number
  hasShootout?: boolean
  hasSuddenDeath?: boolean
  intermissionDurationMinutes: number
  periodNameFormat: string
  overtimeName: string
}

export interface ScoringConfig {
  scoringTypes: Record<string, number>
  defaultScoreValue: number
}

export interface TerminologyConfig {
  gameStartTerm: string
  periodEndTerm: string
  gameEndTerm: string
  overtimeTerm: string
}

export interface SportConfig {
  name: string
  code: string
  timing: TimingConfig
  scoring: ScoringConfig
  terminology: TerminologyConfig
  extensions?: Record<string, any>
}

export interface LeagueAPIConfig {
  baseUrl: string
  endpoints: Record<string, string>
  rateLimitPerMinute: number
  cacheTTLSeconds: number
}

export interface LeagueSeason {
  startDate: string
  endDate: string
  playoffStart?: string
  isActive: boolean
}

export interface LeagueConfig {
  name: string
  code: string
  sportCode: string
  api: LeagueAPIConfig
  currentSeason?: LeagueSeason
  timingOverrides?: Partial<TimingConfig>
  scoringOverrides?: Partial<ScoringConfig>
  terminologyOverrides?: Partial<TerminologyConfig>
  teamCount: number
  conferenceStructure?: Record<string, string[]>
  teamAssetsUrl?: string
  logoUrlTemplate?: string
}

export interface LeagueWithSport extends LeagueConfig {
  sport: SportConfig
  effectiveTiming: TimingConfig
  effectiveScoring: ScoringConfig
  effectiveTerminology: TerminologyConfig
}

export interface SportHierarchy {
  sport: SportConfig
  leagues: LeagueConfig[]
}
