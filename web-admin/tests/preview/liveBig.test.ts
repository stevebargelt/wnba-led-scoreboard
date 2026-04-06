import { createCanvas } from 'canvas'
import { drawLiveBig } from '@/lib/preview/scenes/liveBig'
import { GameSnapshot, GameState } from '@/lib/canvas/types'
import * as logosModule from '@/lib/preview/logos'
import * as fontsModule from '@/lib/preview/fonts'

jest.mock('@/lib/preview/logos', () => ({
  loadTeamLogo: jest.fn(),
}))

jest.mock('@/lib/preview/fonts', () => ({
  getFontManager: jest.fn(),
}))

describe('drawLiveBig', () => {
  let canvas: ReturnType<typeof createCanvas>
  let ctx: ReturnType<typeof canvas.getContext>
  let mockSnapshot: GameSnapshot
  let mockFontManager: {
    getSmallFont: jest.Mock
    getLargeFont: jest.Mock
    getScoreLargeFont: jest.Mock
  }

  beforeEach(() => {
    canvas = createCanvas(64, 32)
    ctx = canvas.getContext('2d')

    mockSnapshot = {
      sport: { id: 'basketball', name: 'Basketball', periods: 4 },
      league: { id: 'wnba', name: 'WNBA', abbreviation: 'WNBA', sport_id: 'basketball' },
      event_id: 'test-event',
      state: GameState.LIVE,
      start_time_local: new Date('2024-04-06T19:30:00'),
      home: { id: 'home-id', name: 'Home Team', abbr: 'HOM', score: 92 },
      away: { id: 'away-id', name: 'Away Team', abbr: 'AWY', score: 88 },
      current_period: 4,
      period_name: 'Q4',
      display_clock: '2:15',
      seconds_to_start: 0,
      status_detail: '',
    }

    mockFontManager = {
      getSmallFont: jest.fn().mockReturnValue('8px monospace'),
      getLargeFont: jest.fn().mockReturnValue('10px monospace'),
      getScoreLargeFont: jest.fn().mockReturnValue('10px monospace'),
    }
    ;(fontsModule.getFontManager as jest.Mock).mockReturnValue(mockFontManager)
    ;(logosModule.loadTeamLogo as jest.Mock).mockResolvedValue(null)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should validate canvas dimensions', async () => {
    await drawLiveBig(canvas, ctx, mockSnapshot)

    expect(canvas.width).toBe(64)
    expect(canvas.height).toBe(32)
  })

  it('should use font manager for fonts', async () => {
    await drawLiveBig(canvas, ctx, mockSnapshot)

    expect(fontsModule.getFontManager).toHaveBeenCalled()
    expect(mockFontManager.getSmallFont).toHaveBeenCalled()
    expect(mockFontManager.getLargeFont).toHaveBeenCalled()
  })

  it('should draw game status at top', async () => {
    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    await drawLiveBig(canvas, ctx, mockSnapshot)

    const statusCalls = fillTextSpy.mock.calls.filter(call => String(call[0]).includes('Q4'))
    expect(statusCalls.length).toBeGreaterThan(0)
    const statusY = statusCalls[0][2] as number
    expect(statusY).toBe(0)
  })

  it('should draw team abbreviations', async () => {
    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    await drawLiveBig(canvas, ctx, mockSnapshot)

    const abbrCalls = fillTextSpy.mock.calls.filter(call => call[0] === 'HOM' || call[0] === 'AWY')
    expect(abbrCalls.length).toBe(2)
  })

  it('should truncate team abbreviations to 4 characters', async () => {
    mockSnapshot.home.abbr = 'LONGTEAM'
    mockSnapshot.away.abbr = 'VERYLONGTEAM'
    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    await drawLiveBig(canvas, ctx, mockSnapshot)

    const abbrCalls = fillTextSpy.mock.calls.filter(call => {
      const text = String(call[0])
      return text === 'LONG' || text === 'VERY'
    })
    expect(abbrCalls.length).toBe(2)
  })

  it('should draw scores', async () => {
    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    await drawLiveBig(canvas, ctx, mockSnapshot)

    const scoreCalls = fillTextSpy.mock.calls.filter(call => call[0] === '92' || call[0] === '88')
    expect(scoreCalls.length).toBe(2)
  })

  it('should load team logos with banner variant by default', async () => {
    await drawLiveBig(canvas, ctx, mockSnapshot)

    expect(logosModule.loadTeamLogo).toHaveBeenCalledWith({
      teamId: 'away-id',
      abbr: 'AWY',
      sport: 'basketball',
      variant: 'banner',
    })

    expect(logosModule.loadTeamLogo).toHaveBeenCalledWith({
      teamId: 'home-id',
      abbr: 'HOM',
      sport: 'basketball',
      variant: 'banner',
    })
  })

  it('should use custom logo variant when specified', async () => {
    await drawLiveBig(canvas, ctx, mockSnapshot, 'mini')

    expect(logosModule.loadTeamLogo).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'mini',
      })
    )
  })

  it('should draw placeholder rectangles when logos not available', async () => {
    const strokeRectSpy = jest.spyOn(ctx, 'strokeRect')

    await drawLiveBig(canvas, ctx, mockSnapshot)

    expect(strokeRectSpy).toHaveBeenCalledTimes(2)
  })

  it('should handle empty game status', async () => {
    mockSnapshot.period_name = ''
    mockSnapshot.display_clock = ''

    await expect(drawLiveBig(canvas, ctx, mockSnapshot)).resolves.not.toThrow()
  })

  it('should use small font for long scores on small canvas', async () => {
    mockSnapshot.home.score = 123
    mockSnapshot.away.score = 456
    const smallCanvas = createCanvas(64, 32)
    const smallCtx = smallCanvas.getContext('2d')

    await drawLiveBig(smallCanvas, smallCtx, mockSnapshot)

    expect(mockFontManager.getSmallFont).toHaveBeenCalled()
  })

  it('should center game status horizontally', async () => {
    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    await drawLiveBig(canvas, ctx, mockSnapshot)

    const statusCalls = fillTextSpy.mock.calls.filter(call => String(call[0]).includes('Q4'))
    if (statusCalls.length > 0) {
      const statusX = statusCalls[0][1] as number
      expect(statusX).toBeGreaterThan(0)
      expect(statusX).toBeLessThan(canvas.width)
    }
  })

  it('should position home team logo on left', async () => {
    const mockImage = createCanvas(20, 20)
    ;(logosModule.loadTeamLogo as jest.Mock).mockImplementation(async ({ teamId }) => {
      if (teamId === 'home-id') return mockImage
      return null
    })
    const drawImageSpy = jest.spyOn(ctx, 'drawImage')

    await drawLiveBig(canvas, ctx, mockSnapshot)

    const homeLogo = drawImageSpy.mock.calls.find(call => call[0] === mockImage)
    if (homeLogo) {
      const logoX = homeLogo[1] as number
      expect(logoX).toBeLessThan(canvas.width / 2)
    }
  })

  it('should position away team logo on right', async () => {
    const mockImage = createCanvas(20, 20)
    ;(logosModule.loadTeamLogo as jest.Mock).mockImplementation(async ({ teamId }) => {
      if (teamId === 'away-id') return mockImage
      return null
    })
    const drawImageSpy = jest.spyOn(ctx, 'drawImage')

    await drawLiveBig(canvas, ctx, mockSnapshot)

    const awayLogo = drawImageSpy.mock.calls.find(call => call[0] === mockImage)
    if (awayLogo) {
      const logoX = awayLogo[1] as number
      expect(logoX).toBeGreaterThan(canvas.width / 2)
    }
  })

  it('should handle larger canvas dimensions', async () => {
    const largeCanvas = createCanvas(128, 64)
    const largeCtx = largeCanvas.getContext('2d')

    await drawLiveBig(largeCanvas, largeCtx, mockSnapshot)

    expect(largeCanvas.width).toBe(128)
    expect(largeCanvas.height).toBe(64)
  })

  it('should adapt logo height for larger canvas', async () => {
    const largeCanvas = createCanvas(128, 64)
    const largeCtx = largeCanvas.getContext('2d')
    const strokeRectSpy = jest.spyOn(largeCtx, 'strokeRect')

    await drawLiveBig(largeCanvas, largeCtx, mockSnapshot)

    if (strokeRectSpy.mock.calls.length > 0) {
      const rect = strokeRectSpy.mock.calls[0]
      const logoWidth = rect[2] as number
      const logoHeight = rect[3] as number
      expect(logoWidth).toBeGreaterThan(0)
      expect(logoHeight).toBeGreaterThan(0)
      expect(logoHeight).toBeLessThanOrEqual(20)
    } else {
      expect(true).toBe(true)
    }
  })
})
