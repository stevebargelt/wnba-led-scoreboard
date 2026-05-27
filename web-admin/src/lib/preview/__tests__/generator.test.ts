import { PreviewGenerator } from '../generator'
import { DisplayConfig, GameSnapshot, GameState } from '../types'
import { renderIdleScene, renderPregameScene, renderLiveStacked, renderFinalScene, renderLiveBigLogos } from '../scenes'

jest.mock('../scenes', () => ({
  renderIdleScene: jest.fn(),
  renderPregameScene: jest.fn().mockResolvedValue(undefined),
  renderLiveStacked: jest.fn().mockResolvedValue(undefined),
  renderFinalScene: jest.fn().mockResolvedValue(undefined),
  renderLiveBigLogos: jest.fn().mockResolvedValue(undefined),
}))

const mockRenderIdleScene = renderIdleScene as jest.Mock
const mockRenderPregameScene = renderPregameScene as jest.Mock
const mockRenderLiveStacked = renderLiveStacked as jest.Mock
const mockRenderFinalScene = renderFinalScene as jest.Mock
const mockRenderLiveBigLogos = renderLiveBigLogos as jest.Mock

const makeConfig = (overrides: Partial<DisplayConfig> = {}): DisplayConfig => ({
  width: 64,
  height: 32,
  brightness: 100,
  logo_variant: 'mini',
  live_layout: 'stacked',
  ...overrides,
})

const makeSnapshot = (state: GameState, overrides: Partial<GameSnapshot> = {}): GameSnapshot => ({
  sport: { id: 'basketball', name: 'Basketball', code: 'wnba' },
  league: { id: 'wnba', name: 'WNBA', abbreviation: 'WNBA', sport_id: 'basketball' },
  event_id: 'test-event',
  state,
  start_time_local: new Date(),
  home: { id: '1', name: 'Home', abbr: 'HOM', score: 0 },
  away: { id: '2', name: 'Away', abbr: 'AWY', score: 0 },
  current_period: 1,
  period_name: 'Q1',
  display_clock: '10:00',
  seconds_to_start: 0,
  status_detail: '',
  ...overrides,
})

describe('PreviewGenerator', () => {
  let generator: PreviewGenerator

  beforeEach(() => {
    generator = new PreviewGenerator()
    jest.clearAllMocks()
    mockRenderPregameScene.mockResolvedValue(undefined)
    mockRenderLiveStacked.mockResolvedValue(undefined)
    mockRenderFinalScene.mockResolvedValue(undefined)
    mockRenderLiveBigLogos.mockResolvedValue(undefined)
  })

  describe('null snapshot → idle scene', () => {
    it('calls renderIdleScene when snapshot is null', async () => {
      await generator.generatePreview(makeConfig(), null)
      expect(mockRenderIdleScene).toHaveBeenCalledTimes(1)
    })

    it('does not call any other scene function when snapshot is null', async () => {
      await generator.generatePreview(makeConfig(), null)
      expect(mockRenderPregameScene).not.toHaveBeenCalled()
      expect(mockRenderLiveStacked).not.toHaveBeenCalled()
      expect(mockRenderFinalScene).not.toHaveBeenCalled()
      expect(mockRenderLiveBigLogos).not.toHaveBeenCalled()
    })

    it('returns a data URL string when snapshot is null', async () => {
      const result = await generator.generatePreview(makeConfig(), null)
      expect(typeof result).toBe('string')
      expect(result.startsWith('data:')).toBe(true)
    })
  })

  describe('PRE state', () => {
    it('calls renderPregameScene for PRE state', async () => {
      await generator.generatePreview(makeConfig(), makeSnapshot(GameState.PRE))
      expect(mockRenderPregameScene).toHaveBeenCalledTimes(1)
    })

    it('does not call idle scene for PRE state', async () => {
      await generator.generatePreview(makeConfig(), makeSnapshot(GameState.PRE))
      expect(mockRenderIdleScene).not.toHaveBeenCalled()
    })

    it('returns a data URL string for PRE state', async () => {
      const result = await generator.generatePreview(makeConfig(), makeSnapshot(GameState.PRE))
      expect(result.startsWith('data:')).toBe(true)
    })
  })

  describe('LIVE state', () => {
    it('calls renderLiveStacked for LIVE state with stacked layout', async () => {
      await generator.generatePreview(makeConfig({ live_layout: 'stacked' }), makeSnapshot(GameState.LIVE))
      expect(mockRenderLiveStacked).toHaveBeenCalledTimes(1)
      expect(mockRenderLiveBigLogos).not.toHaveBeenCalled()
    })

    it('calls renderLiveBigLogos for LIVE state with big-logos layout', async () => {
      await generator.generatePreview(makeConfig({ live_layout: 'big-logos' }), makeSnapshot(GameState.LIVE))
      expect(mockRenderLiveBigLogos).toHaveBeenCalledTimes(1)
      expect(mockRenderLiveStacked).not.toHaveBeenCalled()
    })

    it('returns a data URL string for LIVE stacked', async () => {
      const result = await generator.generatePreview(makeConfig(), makeSnapshot(GameState.LIVE))
      expect(result.startsWith('data:')).toBe(true)
    })

    it('returns a data URL string for LIVE big-logos', async () => {
      const result = await generator.generatePreview(
        makeConfig({ live_layout: 'big-logos' }),
        makeSnapshot(GameState.LIVE)
      )
      expect(result.startsWith('data:')).toBe(true)
    })
  })

  describe('FINAL state', () => {
    it('calls renderFinalScene for FINAL state', async () => {
      await generator.generatePreview(makeConfig(), makeSnapshot(GameState.FINAL))
      expect(mockRenderFinalScene).toHaveBeenCalledTimes(1)
    })

    it('does not call idle or live scenes for FINAL state', async () => {
      await generator.generatePreview(makeConfig(), makeSnapshot(GameState.FINAL))
      expect(mockRenderIdleScene).not.toHaveBeenCalled()
      expect(mockRenderLiveStacked).not.toHaveBeenCalled()
    })

    it('returns a data URL string for FINAL state', async () => {
      const result = await generator.generatePreview(makeConfig(), makeSnapshot(GameState.FINAL))
      expect(result.startsWith('data:')).toBe(true)
    })
  })

  describe('unknown state defaults to idle', () => {
    it('calls renderIdleScene for an unrecognized state', async () => {
      const snapshot = makeSnapshot('UNKNOWN' as GameState)
      await generator.generatePreview(makeConfig(), snapshot)
      expect(mockRenderIdleScene).toHaveBeenCalledTimes(1)
    })

    it('does not call other scene functions for unknown state', async () => {
      const snapshot = makeSnapshot('UNKNOWN' as GameState)
      await generator.generatePreview(makeConfig(), snapshot)
      expect(mockRenderPregameScene).not.toHaveBeenCalled()
      expect(mockRenderLiveStacked).not.toHaveBeenCalled()
      expect(mockRenderFinalScene).not.toHaveBeenCalled()
      expect(mockRenderLiveBigLogos).not.toHaveBeenCalled()
    })
  })

  describe('canvas parameter', () => {
    it('accepts an existing canvas element and returns a data URL', async () => {
      const canvas = document.createElement('canvas')
      const result = await generator.generatePreview(makeConfig(), null, canvas)
      expect(typeof result).toBe('string')
      expect(result.startsWith('data:')).toBe(true)
    })

    it('uses the provided canvas element (not a newly created one)', async () => {
      const canvas = document.createElement('canvas')
      const toDataURLSpy = jest.spyOn(canvas, 'toDataURL')
      await generator.generatePreview(makeConfig(), null, canvas)
      expect(toDataURLSpy).toHaveBeenCalled()
    })
  })
})
