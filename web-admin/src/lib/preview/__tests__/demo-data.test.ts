import { GameState } from '../types'
import {
  createDemoPregameSnapshot,
  createDemoLiveSnapshot,
  createDemoFinalSnapshot,
  createNhlDemoPregameSnapshot,
  createNhlDemoLiveSnapshot,
  createNhlDemoFinalSnapshot,
  getPeriodName,
} from '../demo-data'

describe('getPeriodName', () => {
  it('returns Q1-Q4 for basketball periods 1-4', () => {
    expect(getPeriodName('basketball', 1)).toBe('Q1')
    expect(getPeriodName('basketball', 4)).toBe('Q4')
    expect(getPeriodName('wnba', 2)).toBe('Q2')
  })

  it('returns OT1, OT2 for basketball overtime', () => {
    expect(getPeriodName('basketball', 5)).toBe('OT1')
    expect(getPeriodName('wnba', 6)).toBe('OT2')
  })

  it('returns P1-P3 for hockey periods 1-3', () => {
    expect(getPeriodName('hockey', 1)).toBe('P1')
    expect(getPeriodName('nhl', 3)).toBe('P3')
  })

  it('returns OT for hockey period 4', () => {
    expect(getPeriodName('hockey', 4)).toBe('OT')
    expect(getPeriodName('nhl', 4)).toBe('OT')
  })

  it('returns SO for hockey period 5+', () => {
    expect(getPeriodName('hockey', 5)).toBe('SO')
    expect(getPeriodName('nhl', 6)).toBe('SO')
  })
})

describe('WNBA demo snapshots', () => {
  describe('createDemoPregameSnapshot', () => {
    it('returns PRE state', () => {
      expect(createDemoPregameSnapshot().state).toBe(GameState.PRE)
    })

    it('has non-empty team IDs and abbreviations', () => {
      const snap = createDemoPregameSnapshot()
      expect(snap.home.id).toBeTruthy()
      expect(snap.home.abbr).toBeTruthy()
      expect(snap.away.id).toBeTruthy()
      expect(snap.away.abbr).toBeTruthy()
    })

    it('has seconds_to_start > 0', () => {
      expect(createDemoPregameSnapshot().seconds_to_start).toBeGreaterThan(0)
    })

    it('has correct team values', () => {
      const snap = createDemoPregameSnapshot()
      expect(snap.home.id).toBe('11')
      expect(snap.home.abbr).toBe('PHX')
      expect(snap.away.id).toBe('6')
      expect(snap.away.abbr).toBe('LA')
    })

    it('has correct sport and league', () => {
      const snap = createDemoPregameSnapshot()
      expect(snap.sport.code).toBe('wnba')
      expect(snap.league.id).toBe('wnba')
    })

    it('has start_time_local approximately 2 hours from now', () => {
      const snap = createDemoPregameSnapshot()
      const diff = snap.start_time_local.getTime() - Date.now()
      expect(diff).toBeGreaterThan(7000 * 1000)
      expect(diff).toBeLessThan(7400 * 1000)
    })
  })

  describe('createDemoLiveSnapshot', () => {
    it('returns LIVE state', () => {
      expect(createDemoLiveSnapshot().state).toBe(GameState.LIVE)
    })

    it('has scores > 0', () => {
      const snap = createDemoLiveSnapshot()
      expect(snap.home.score).toBeGreaterThan(0)
      expect(snap.away.score).toBeGreaterThan(0)
    })

    it('has non-empty display_clock', () => {
      expect(createDemoLiveSnapshot().display_clock).toBeTruthy()
    })

    it('has correct period info', () => {
      const snap = createDemoLiveSnapshot()
      expect(snap.current_period).toBe(3)
      expect(snap.period_name).toBe('Q3')
    })

    it('has non-empty team IDs and abbreviations', () => {
      const snap = createDemoLiveSnapshot()
      expect(snap.home.id).toBeTruthy()
      expect(snap.away.id).toBeTruthy()
    })
  })

  describe('createDemoFinalSnapshot', () => {
    it('returns FINAL state', () => {
      expect(createDemoFinalSnapshot().state).toBe(GameState.FINAL)
    })

    it('has correct scores', () => {
      const snap = createDemoFinalSnapshot()
      expect(snap.home.score).toBe(89)
      expect(snap.away.score).toBe(82)
    })

    it('has non-empty team IDs and abbreviations', () => {
      const snap = createDemoFinalSnapshot()
      expect(snap.home.id).toBeTruthy()
      expect(snap.away.id).toBeTruthy()
    })
  })
})

describe('NHL demo snapshots', () => {
  describe('createNhlDemoPregameSnapshot', () => {
    it('returns PRE state', () => {
      expect(createNhlDemoPregameSnapshot().state).toBe(GameState.PRE)
    })

    it('has hockey-specific period name', () => {
      expect(createNhlDemoPregameSnapshot().period_name).toBe('P1')
    })

    it('has seconds_to_start > 0', () => {
      expect(createNhlDemoPregameSnapshot().seconds_to_start).toBeGreaterThan(0)
    })

    it('has correct NHL sport/league', () => {
      const snap = createNhlDemoPregameSnapshot()
      expect(snap.sport.code).toBe('nhl')
      expect(snap.league.id).toBe('nhl')
    })

    it('has correct team abbreviations', () => {
      const snap = createNhlDemoPregameSnapshot()
      expect(snap.home.abbr).toBe('BOS')
      expect(snap.away.abbr).toBe('MTL')
    })

    it('has non-empty team IDs', () => {
      const snap = createNhlDemoPregameSnapshot()
      expect(snap.home.id).toBeTruthy()
      expect(snap.away.id).toBeTruthy()
    })
  })

  describe('createNhlDemoLiveSnapshot', () => {
    it('returns LIVE state', () => {
      expect(createNhlDemoLiveSnapshot().state).toBe(GameState.LIVE)
    })

    it('has scores > 0', () => {
      const snap = createNhlDemoLiveSnapshot()
      expect(snap.home.score).toBeGreaterThan(0)
      expect(snap.away.score).toBeGreaterThan(0)
    })

    it('has non-empty display_clock', () => {
      expect(createNhlDemoLiveSnapshot().display_clock).toBeTruthy()
    })

    it('has hockey-specific period name', () => {
      expect(createNhlDemoLiveSnapshot().period_name).toBe('P2')
    })
  })

  describe('createNhlDemoFinalSnapshot', () => {
    it('returns FINAL state', () => {
      expect(createNhlDemoFinalSnapshot().state).toBe(GameState.FINAL)
    })

    it('has correct scores', () => {
      const snap = createNhlDemoFinalSnapshot()
      expect(snap.home.score).toBe(4)
      expect(snap.away.score).toBe(3)
    })

    it('has hockey-specific period name', () => {
      expect(createNhlDemoFinalSnapshot().period_name).toBe('P3')
    })

    it('has non-empty team IDs and abbreviations', () => {
      const snap = createNhlDemoFinalSnapshot()
      expect(snap.home.id).toBeTruthy()
      expect(snap.away.id).toBeTruthy()
      expect(snap.home.abbr).toBeTruthy()
      expect(snap.away.abbr).toBeTruthy()
    })
  })
})
