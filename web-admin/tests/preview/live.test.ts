import { createCanvas } from 'canvas'
import { drawLive } from '@/lib/preview/scenes/live'
import { GameSnapshot, GameState } from '@/lib/canvas/types'
import * as logosModule from '@/lib/preview/logos'

jest.mock('@/lib/preview/logos', () => ({
  loadTeamLogo: jest.fn(),
}))

describe('drawLive', () => {
  let canvas: ReturnType<typeof createCanvas>
  let ctx: ReturnType<typeof canvas.getContext>
  let mockSnapshot: GameSnapshot

  beforeEach(() => {
    canvas = createCanvas(64, 32)
    ctx = canvas.getContext('2d')

    mockSnapshot = {
      sport: { id: 'basketball', name: 'Basketball', periods: 4 },
      league: { id: 'wnba', name: 'WNBA', abbreviation: 'WNBA', sport_id: 'basketball' },
      event_id: 'test-event',
      state: GameState.LIVE,
      start_time_local: new Date('2024-04-06T19:30:00'),
      home: { id: 'home-id', name: 'Home Team', abbr: 'HOM', score: 85 },
      away: { id: 'away-id', name: 'Away Team', abbr: 'AWY', score: 78 },
      current_period: 3,
      period_name: 'Q3',
      display_clock: '5:23',
      seconds_to_start: 0,
      status_detail: '',
    }
    ;(logosModule.loadTeamLogo as jest.Mock).mockResolvedValue(null)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should validate canvas dimensions', async () => {
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'

    await drawLive({
      canvas,
      ctx,
      snapshot: mockSnapshot,
      nowLocal: new Date(),
      fontSmall,
      fontLarge,
    })

    expect(canvas.width).toBe(64)
    expect(canvas.height).toBe(32)
  })

  it('should draw team abbreviations', async () => {
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'
    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    await drawLive({
      canvas,
      ctx,
      snapshot: mockSnapshot,
      nowLocal: new Date(),
      fontSmall,
      fontLarge,
    })

    const abbrCalls = fillTextSpy.mock.calls.filter(call => call[0] === 'HOM' || call[0] === 'AWY')
    expect(abbrCalls.length).toBe(2)
  })

  it('should truncate team abbreviations to 4 characters', async () => {
    mockSnapshot.home.abbr = 'LONGNAME'
    mockSnapshot.away.abbr = 'VERYLONGNAME'
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'
    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    await drawLive({
      canvas,
      ctx,
      snapshot: mockSnapshot,
      nowLocal: new Date(),
      fontSmall,
      fontLarge,
    })

    const abbrCalls = fillTextSpy.mock.calls.filter(call => {
      const text = String(call[0])
      return text === 'LONG' || text === 'VERY'
    })
    expect(abbrCalls.length).toBe(2)
  })

  it('should draw scores with correct font', async () => {
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'
    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    await drawLive({
      canvas,
      ctx,
      snapshot: mockSnapshot,
      nowLocal: new Date(),
      fontSmall,
      fontLarge,
    })

    const scoreCalls = fillTextSpy.mock.calls.filter(call => call[0] === '85' || call[0] === '78')
    expect(scoreCalls.length).toBe(2)
  })

  it('should draw game status with period and clock', async () => {
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'
    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    await drawLive({
      canvas,
      ctx,
      snapshot: mockSnapshot,
      nowLocal: new Date(),
      fontSmall,
      fontLarge,
    })

    const statusCalls = fillTextSpy.mock.calls.filter(call => String(call[0]).includes('Q3'))
    expect(statusCalls.length).toBeGreaterThan(0)
    expect(String(statusCalls[0][0])).toContain('5:23')
  })

  it('should load team logos with correct parameters', async () => {
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'

    await drawLive({
      canvas,
      ctx,
      snapshot: mockSnapshot,
      nowLocal: new Date(),
      fontSmall,
      fontLarge,
    })

    expect(logosModule.loadTeamLogo).toHaveBeenCalledWith({
      teamId: 'away-id',
      abbr: 'AWY',
      sport: 'basketball',
      variant: 'mini',
    })

    expect(logosModule.loadTeamLogo).toHaveBeenCalledWith({
      teamId: 'home-id',
      abbr: 'HOM',
      sport: 'basketball',
      variant: 'mini',
    })
  })

  it('should use custom logo variant when specified', async () => {
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'

    await drawLive({
      canvas,
      ctx,
      snapshot: mockSnapshot,
      nowLocal: new Date(),
      fontSmall,
      fontLarge,
      logoVariant: 'small',
    })

    expect(logosModule.loadTeamLogo).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'small',
      })
    )
  })

  it('should draw placeholder rectangles when logos not available', async () => {
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'
    const strokeRectSpy = jest.spyOn(ctx, 'strokeRect')

    await drawLive({
      canvas,
      ctx,
      snapshot: mockSnapshot,
      nowLocal: new Date(),
      fontSmall,
      fontLarge,
    })

    expect(strokeRectSpy).toHaveBeenCalledTimes(2)
    expect(strokeRectSpy).toHaveBeenCalledWith(1, 1, 10, 10)
    expect(strokeRectSpy).toHaveBeenCalledWith(1, 13, 10, 10)
  })

  it('should use green color for live game status', async () => {
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'

    let statusColor: string | undefined
    const originalFillText = ctx.fillText.bind(ctx)
    ctx.fillText = jest.fn((text: string, x: number, y: number) => {
      if (String(text).includes('Q3')) {
        statusColor = ctx.fillStyle as string
      }
      return originalFillText(text, x, y)
    })

    await drawLive({
      canvas,
      ctx,
      snapshot: mockSnapshot,
      nowLocal: new Date(),
      fontSmall,
      fontLarge,
    })

    expect(statusColor).toBe('#00ff00')
  })

  it('should handle empty display clock', async () => {
    mockSnapshot.display_clock = ''
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'
    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    await drawLive({
      canvas,
      ctx,
      snapshot: mockSnapshot,
      nowLocal: new Date(),
      fontSmall,
      fontLarge,
    })

    const statusCalls = fillTextSpy.mock.calls.filter(call => String(call[0]).includes('Q3'))
    expect(statusCalls.length).toBeGreaterThan(0)
    expect(String(statusCalls[0][0]).trim()).toBe('Q3')
  })

  it('should align scores to right edge', async () => {
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'
    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    await drawLive({
      canvas,
      ctx,
      snapshot: mockSnapshot,
      nowLocal: new Date(),
      fontSmall,
      fontLarge,
    })

    const scoreCalls = fillTextSpy.mock.calls.filter(call => call[0] === '85' || call[0] === '78')

    scoreCalls.forEach(call => {
      const x = call[1] as number
      expect(x).toBeLessThan(canvas.width)
      expect(x).toBeGreaterThan(canvas.width / 2)
    })
  })
})
