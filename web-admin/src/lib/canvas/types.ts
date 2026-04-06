export enum GameState {
  PRE = 'PRE',
  LIVE = 'LIVE',
  FINAL = 'FINAL',
}

export interface TeamInfo {
  id: string
  name: string
  abbr: string
  score: number
}

export interface Sport {
  id: string
  name: string
  periods: number
}

export interface League {
  id: string
  name: string
  abbreviation: string
  sport_id: string
}

export interface GameSnapshot {
  sport: Sport
  league: League
  event_id: string
  state: GameState
  start_time_local: Date
  home: TeamInfo
  away: TeamInfo
  current_period: number
  period_name: string
  display_clock: string
  seconds_to_start: number
  status_detail: string
}

export interface DisplayConfig {
  width: number
  height: number
  brightness: number
  logo_variant: string
  live_layout: string
}

export interface DeviceConfiguration {
  device_id: string
  matrix_config: {
    width: number
    height: number
    brightness: number
    pwm_bits: number
    hardware_mapping: string
    chain_length: number
    parallel: number
    gpio_slowdown: number
  }
  render_config: {
    logo_variant: string
    live_layout: string
  }
}
