import { createCanvas } from 'canvas'
import { PregameScene } from './pregame'
import { GameSnapshot, GameState } from '../../canvas/types'
import * as logosModule from '../logos'

jest.mock('../logos', () => ({
  loadTeamLogo: jest.fn(),
}))

describe('PregameScene', () => {
  let scene: PregameScene
  let canvas: ReturnType<typeof createCanvas>
  let ctx: ReturnType<typeof canvas.getContext>
  let mockSnapshot: GameSnapshot

  beforeEach(() => {
    scene = new PregameScene()
    canvas = createCanvas(64, 32)
    ctx = canvas.getContext('2d')

    mockSnapshot = {
      sport: { id: 'basketball', name: 'Basketball', periods: 4 },
      league: { id: 'wnba', name: 'WNBA', abbreviation: 'WNBA', sport_id: 'basketball' },
      event_id: 'test-event',
      state: GameState.PRE,
      start_time_local: new Date('2024-04-06T19:30:00'),
      home: { id: 'home-id', name: 'Home Team', abbr: 'HOM', score: 0 },
      away: { id: 'away-id', name: 'Away Team', abbr: 'AWY', score: 0 },
      current_period: 0,
      period_name: '',
      display_clock: '',
      seconds_to_start: 3600,
      status_detail: '',
    }
    ;(logosModule.loadTeamLogo as jest.Mock).mockResolvedValue(null)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should return correct scene name', () => {
    expect(scene.getName()).toBe('pregame')
  })

  it('should draw VS text in center', async () => {
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'
    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    await scene.draw(canvas, ctx, mockSnapshot, new Date(), fontSmall, fontLarge)

    const vsCalls = fillTextSpy.mock.calls.filter(call => call[0] === 'VS')
    expect(vsCalls.length).toBe(1)
  })

  it('should format countdown with hours when more than 1 hour', async () => {
    mockSnapshot.seconds_to_start = 7265
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'
    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    await scene.draw(canvas, ctx, mockSnapshot, new Date(), fontSmall, fontLarge)

    const countdownCalls = fillTextSpy.mock.calls.filter(call => String(call[0]).includes(':'))
    const countdownText = countdownCalls.find(call => String(call[0]).match(/^\d+:\d{2}:\d{2}$/))
    expect(countdownText).toBeDefined()
    expect(countdownText![0]).toBe('2:01:05')
  })

  it('should format countdown without hours when less than 1 hour', async () => {
    mockSnapshot.seconds_to_start = 125
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'
    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    await scene.draw(canvas, ctx, mockSnapshot, new Date(), fontSmall, fontLarge)

    const countdownCalls = fillTextSpy.mock.calls.filter(call =>
      String(call[0]).match(/^\d{2}:\d{2}$/)
    )
    expect(countdownCalls.length).toBeGreaterThan(0)
    expect(countdownCalls[0][0]).toBe('02:05')
  })

  it('should display start time with sport terminology', async () => {
    mockSnapshot.start_time_local = new Date('2024-04-06T19:30:00')
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'
    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    await scene.draw(canvas, ctx, mockSnapshot, new Date(), fontSmall, fontLarge)

    const startTimeCalls = fillTextSpy.mock.calls.filter(call =>
      String(call[0]).includes('Tip-Off')
    )
    expect(startTimeCalls.length).toBe(1)
    expect(String(startTimeCalls[0][0])).toMatch(/Tip-Off \d{1,2}:\d{2} (AM|PM)/)
  })

  it('should load team logos with correct parameters', async () => {
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'

    await scene.draw(canvas, ctx, mockSnapshot, new Date(), fontSmall, fontLarge)

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

  it('should handle hockey sport with correct terminology', async () => {
    mockSnapshot.sport = { id: 'hockey', name: 'Hockey', periods: 3 }
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'
    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    await scene.draw(canvas, ctx, mockSnapshot, new Date(), fontSmall, fontLarge)

    const startTimeCalls = fillTextSpy.mock.calls.filter(call =>
      String(call[0]).includes('Puck Drop')
    )
    expect(startTimeCalls.length).toBe(1)
  })

  it('should not crash when snapshot is null', async () => {
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'

    await expect(
      scene.draw(canvas, ctx, null, new Date(), fontSmall, fontLarge)
    ).resolves.not.toThrow()
  })

  it('should use countdown color rgb(255, 200, 0)', async () => {
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'

    let countdownColor: string | undefined
    const originalFillText = ctx.fillText.bind(ctx)
    ctx.fillText = jest.fn((text: string, x: number, y: number) => {
      if (String(text).match(/^\d+:\d{2}(:\d{2})?$/)) {
        countdownColor = ctx.fillStyle as string
      }
      return originalFillText(text, x, y)
    })

    await scene.draw(canvas, ctx, mockSnapshot, new Date(), fontSmall, fontLarge)

    expect(countdownColor).toBe('#ffc800')
  })
})
