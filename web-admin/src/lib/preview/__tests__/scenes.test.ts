import {
  renderIdleScene,
  renderLiveStacked,
  renderPregameScene,
  renderFinalScene,
  renderLiveBigLogos,
} from '../scenes'
import { ClientDisplay } from '../display'
import { DisplayConfig } from '../types'
import {
  createDemoLiveSnapshot,
  createDemoPregameSnapshot,
  createDemoFinalSnapshot,
} from '../demo-data'
import { FONT_SMALL, FONT_LARGE } from '../fonts'
import { loadTeamLogo } from '../logos'

jest.mock('../logos', () => ({
  loadTeamLogo: jest.fn(),
  clearLogoCache: jest.fn(),
}))

const mockLoadTeamLogo = loadTeamLogo as jest.Mock

const makeConfig = (overrides: Partial<DisplayConfig> = {}): DisplayConfig => ({
  width: 64,
  height: 32,
  brightness: 100,
  logo_variant: 'mini',
  live_layout: 'stacked',
  ...overrides,
})

// ─── renderIdleScene ──────────────────────────────────────────────────────────

describe('renderIdleScene', () => {
  it('calls clear with black (0,0,0)', () => {
    const display = new ClientDisplay(makeConfig())
    const clearSpy = jest.spyOn(display, 'clear')
    renderIdleScene(display)
    expect(clearSpy).toHaveBeenCalledWith(0, 0, 0)
  })

  it('draws text at position (1, 1)', () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    renderIdleScene(display)
    expect(drawTextSpy).toHaveBeenCalledWith(
      expect.any(String),
      1,
      1,
      8,
      FONT_SMALL,
      'rgb(180, 180, 180)'
    )
  })

  it('truncates text to 20 characters', () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    renderIdleScene(display)
    const text = drawTextSpy.mock.calls[0][0] as string
    expect(text.length).toBeLessThanOrEqual(20)
  })

  it('includes weekday abbreviation and MM/DD format in text', () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    renderIdleScene(display)
    const text = drawTextSpy.mock.calls[0][0] as string
    // e.g. "Wed 05/27 — No games"
    expect(text).toMatch(/^\w{2,3} \d{2}\/\d{2}/)
  })

  it('includes "No games" in text', () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    renderIdleScene(display)
    const text = drawTextSpy.mock.calls[0][0] as string
    expect(text).toContain('No games')
  })

  it('uses FONT_SMALL and size 8', () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    renderIdleScene(display)
    const [, , , fontSize, fontFamily] = drawTextSpy.mock.calls[0]
    expect(fontSize).toBe(8)
    expect(fontFamily).toBe(FONT_SMALL)
  })
})

// ─── renderLiveStacked ────────────────────────────────────────────────────────

describe('renderLiveStacked', () => {
  beforeEach(() => {
    mockLoadTeamLogo.mockResolvedValue(null)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('calls clear with black (0,0,0)', async () => {
    const display = new ClientDisplay(makeConfig())
    const clearSpy = jest.spyOn(display, 'clear')
    await renderLiveStacked(display, createDemoLiveSnapshot())
    expect(clearSpy).toHaveBeenCalledWith(0, 0, 0)
  })

  it('draws away team placeholder rect at (1, 1, 10, 10) when logo is null', async () => {
    const display = new ClientDisplay(makeConfig())
    const rectSpy = jest.spyOn(display, 'drawRectangle')
    await renderLiveStacked(display, createDemoLiveSnapshot())
    expect(rectSpy).toHaveBeenCalledWith(1, 1, 10, 10, undefined, 'rgb(100, 100, 100)')
  })

  it('draws home team placeholder rect at (1, 13, 10, 10) when logo is null', async () => {
    const display = new ClientDisplay(makeConfig())
    const rectSpy = jest.spyOn(display, 'drawRectangle')
    await renderLiveStacked(display, createDemoLiveSnapshot())
    expect(rectSpy).toHaveBeenCalledWith(1, 13, 10, 10, undefined, 'rgb(100, 100, 100)')
  })

  it('draws away abbreviation at x=13, y=2 (topY+1)', async () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    const snap = createDemoLiveSnapshot()
    await renderLiveStacked(display, snap)
    const abbrCall = drawTextSpy.mock.calls.find(c => c[1] === 13 && c[2] === 2)
    expect(abbrCall).toBeDefined()
    expect(abbrCall![0]).toBe(snap.away.abbr.slice(0, 4))
    expect(abbrCall![3]).toBe(8)
    expect(abbrCall![4]).toBe(FONT_SMALL)
    expect(abbrCall![5]).toBe('rgb(200, 200, 200)')
  })

  it('draws home abbreviation at x=13, y=14 (botY+1)', async () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    const snap = createDemoLiveSnapshot()
    await renderLiveStacked(display, snap)
    const abbrCall = drawTextSpy.mock.calls.find(c => c[1] === 13 && c[2] === 14)
    expect(abbrCall).toBeDefined()
    expect(abbrCall![0]).toBe(snap.home.abbr.slice(0, 4))
  })

  it('draws scores with FONT_LARGE size 12 in white', async () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    const snap = createDemoLiveSnapshot()
    await renderLiveStacked(display, snap)
    const scoreCalls = drawTextSpy.mock.calls.filter(c => c[3] === 12)
    expect(scoreCalls).toHaveLength(2)
    for (const call of scoreCalls) {
      expect(call[4]).toBe(FONT_LARGE)
      expect(call[5]).toBe('rgb(255, 255, 255)')
    }
  })

  it('right-aligns scores using getTextWidth', async () => {
    const display = new ClientDisplay(makeConfig())
    const getTextWidthSpy = jest.spyOn(display, 'getTextWidth').mockReturnValue(8)
    const drawTextSpy = jest.spyOn(display, 'drawText')
    const snap = createDemoLiveSnapshot()
    await renderLiveStacked(display, snap)
    // scoreRightX = w - 1 = 63, getTextWidth returns 8, so x = 63 - 8 = 55
    const scoreCalls = drawTextSpy.mock.calls.filter(c => c[3] === 12)
    for (const call of scoreCalls) {
      expect(call[1]).toBe(55)
    }
    getTextWidthSpy.mockRestore()
  })

  it('places status text at y = h - 9', async () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    await renderLiveStacked(display, createDemoLiveSnapshot())
    // h=32, statusY = 32 - 9 = 23
    const statusCall = drawTextSpy.mock.calls.find(c => c[2] === 23)
    expect(statusCall).toBeDefined()
    expect(statusCall![5]).toBe('rgb(0, 255, 0)')
    expect(statusCall![4]).toBe(FONT_SMALL)
    expect(statusCall![3]).toBe(8)
  })

  it('status text is "{period_name} {display_clock}".trim()', async () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    const snap = createDemoLiveSnapshot()
    await renderLiveStacked(display, snap)
    const h = display.getCanvas().height
    const statusCall = drawTextSpy.mock.calls.find(c => c[2] === h - 9)
    expect(statusCall).toBeDefined()
    const expected = `${snap.period_name} ${snap.display_clock}`.trim()
    expect(statusCall![0]).toBe(expected)
  })

  it('centers status text horizontally', async () => {
    const display = new ClientDisplay(makeConfig())
    const getTextWidthSpy = jest.spyOn(display, 'getTextWidth').mockReturnValue(10)
    const drawTextSpy = jest.spyOn(display, 'drawText')
    await renderLiveStacked(display, createDemoLiveSnapshot())
    // w=64, textWidth=10, x = floor((64 - 10) / 2) = 27
    const h = display.getCanvas().height
    const statusCall = drawTextSpy.mock.calls.find(c => c[2] === h - 9)
    expect(statusCall).toBeDefined()
    expect(statusCall![1]).toBe(Math.floor((64 - 10) / 2))
    getTextWidthSpy.mockRestore()
  })

  it('draws logo image when loadTeamLogo returns an image element', async () => {
    const mockImg = new Image()
    mockLoadTeamLogo.mockResolvedValue(mockImg)
    const display = new ClientDisplay(makeConfig())
    const drawImageSpy = jest.spyOn(display, 'drawImage')
    const rectSpy = jest.spyOn(display, 'drawRectangle')
    await renderLiveStacked(display, createDemoLiveSnapshot())
    expect(drawImageSpy).toHaveBeenCalledWith(mockImg, 1, 1, 10, 10)
    expect(drawImageSpy).toHaveBeenCalledWith(mockImg, 1, 13, 10, 10)
    expect(rectSpy).not.toHaveBeenCalled()
  })

  it('calls loadTeamLogo with sport code and mini variant', async () => {
    const snap = createDemoLiveSnapshot()
    const display = new ClientDisplay(makeConfig())
    await renderLiveStacked(display, snap)
    expect(mockLoadTeamLogo).toHaveBeenCalledWith(
      snap.away.id,
      snap.away.abbr,
      snap.sport.code,
      'mini'
    )
    expect(mockLoadTeamLogo).toHaveBeenCalledWith(
      snap.home.id,
      snap.home.abbr,
      snap.sport.code,
      'mini'
    )
  })
})

// ─── renderPregameScene ───────────────────────────────────────────────────────

describe('renderPregameScene', () => {
  beforeEach(() => {
    mockLoadTeamLogo.mockResolvedValue(null)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('calls clear with black (0,0,0)', async () => {
    const display = new ClientDisplay(makeConfig())
    const clearSpy = jest.spyOn(display, 'clear')
    await renderPregameScene(display, createDemoPregameSnapshot())
    expect(clearSpy).toHaveBeenCalledWith(0, 0, 0)
  })

  it('draws away logo at (2, 2) when logo is available', async () => {
    const mockImg = new Image()
    mockLoadTeamLogo.mockResolvedValue(mockImg)
    const display = new ClientDisplay(makeConfig())
    const drawImageSpy = jest.spyOn(display, 'drawImage')
    await renderPregameScene(display, createDemoPregameSnapshot())
    expect(drawImageSpy).toHaveBeenCalledWith(mockImg, 2, 2, 10, 10)
  })

  it('draws home logo at (w-12, 2) when logo is available', async () => {
    const mockImg = new Image()
    mockLoadTeamLogo.mockResolvedValue(mockImg)
    const display = new ClientDisplay(makeConfig()) // w=64
    const drawImageSpy = jest.spyOn(display, 'drawImage')
    await renderPregameScene(display, createDemoPregameSnapshot())
    // w - logoSize - 2 = 64 - 10 - 2 = 52
    expect(drawImageSpy).toHaveBeenCalledWith(mockImg, 52, 2, 10, 10)
  })

  it('draws no placeholder rect when logo is null (pregame has no fallback rect)', async () => {
    const display = new ClientDisplay(makeConfig())
    const rectSpy = jest.spyOn(display, 'drawRectangle')
    await renderPregameScene(display, createDemoPregameSnapshot())
    expect(rectSpy).not.toHaveBeenCalled()
  })

  it('draws "VS" at ((w/2)-6, topY+1)', async () => {
    const display = new ClientDisplay(makeConfig()) // w=64
    const drawTextSpy = jest.spyOn(display, 'drawText')
    await renderPregameScene(display, createDemoPregameSnapshot())
    const vsCall = drawTextSpy.mock.calls.find(c => c[0] === 'VS')
    expect(vsCall).toBeDefined()
    expect(vsCall![1]).toBe(26) // floor(64/2) - 6 = 26
    expect(vsCall![2]).toBe(3) // topY + 1 = 2 + 1 = 3
    expect(vsCall![3]).toBe(8)
    expect(vsCall![4]).toBe(FONT_SMALL)
    expect(vsCall![5]).toBe('rgb(200, 200, 200)')
  })

  it('draws countdown with FONT_LARGE size 12 in yellow', async () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    await renderPregameScene(display, createDemoPregameSnapshot())
    const countdownCall = drawTextSpy.mock.calls.find(
      c => c[3] === 12 && c[5] === 'rgb(255, 200, 0)'
    )
    expect(countdownCall).toBeDefined()
    expect(countdownCall![4]).toBe(FONT_LARGE)
  })

  it('formats countdown as mm:ss when < 1 hour', async () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    const snap = createDemoPregameSnapshot()
    // seconds_to_start = 7200 = 2h exactly
    await renderPregameScene(display, snap)
    const countdownCall = drawTextSpy.mock.calls.find(
      c => c[3] === 12 && c[5] === 'rgb(255, 200, 0)'
    )
    expect(countdownCall).toBeDefined()
    // 7200s = 2h:00m:00s
    expect(countdownCall![0]).toBe('2:00:00')
  })

  it('centers countdown horizontally', async () => {
    const display = new ClientDisplay(makeConfig()) // w=64
    jest.spyOn(display, 'getTextWidth').mockReturnValue(20)
    const drawTextSpy = jest.spyOn(display, 'drawText')
    await renderPregameScene(display, createDemoPregameSnapshot())
    const countdownCall = drawTextSpy.mock.calls.find(
      c => c[3] === 12 && c[5] === 'rgb(255, 200, 0)'
    )
    expect(countdownCall).toBeDefined()
    // x = floor((64 - 20) / 2) = 22
    expect(countdownCall![1]).toBe(22)
  })

  it('draws start time at (1, h-9) in gray', async () => {
    const display = new ClientDisplay(makeConfig()) // h=32
    const drawTextSpy = jest.spyOn(display, 'drawText')
    await renderPregameScene(display, createDemoPregameSnapshot())
    const startTimeCall = drawTextSpy.mock.calls.find(
      c => c[2] === 23 && c[5] === 'rgb(150, 150, 150)'
    )
    expect(startTimeCall).toBeDefined()
    expect(startTimeCall![1]).toBe(1)
    expect(startTimeCall![3]).toBe(8)
    expect(startTimeCall![4]).toBe(FONT_SMALL)
  })

  it('calls loadTeamLogo with mini variant', async () => {
    const snap = createDemoPregameSnapshot()
    const display = new ClientDisplay(makeConfig())
    await renderPregameScene(display, snap)
    expect(mockLoadTeamLogo).toHaveBeenCalledWith(
      snap.away.id,
      snap.away.abbr,
      snap.sport.code,
      'mini'
    )
    expect(mockLoadTeamLogo).toHaveBeenCalledWith(
      snap.home.id,
      snap.home.abbr,
      snap.sport.code,
      'mini'
    )
  })
})

// ─── renderFinalScene ─────────────────────────────────────────────────────────

describe('renderFinalScene', () => {
  beforeEach(() => {
    mockLoadTeamLogo.mockResolvedValue(null)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('calls clear with black (0,0,0)', async () => {
    const display = new ClientDisplay(makeConfig())
    const clearSpy = jest.spyOn(display, 'clear')
    await renderFinalScene(display, createDemoFinalSnapshot())
    expect(clearSpy).toHaveBeenCalledWith(0, 0, 0)
  })

  it('draws "FINAL" at (1, 1) in red with FONT_SMALL size 8', async () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    await renderFinalScene(display, createDemoFinalSnapshot())
    expect(drawTextSpy).toHaveBeenCalledWith('FINAL', 1, 1, 8, FONT_SMALL, 'rgb(255, 80, 80)')
  })

  it('draws away placeholder rect at (1, 1, 10, 10) when logo is null', async () => {
    const display = new ClientDisplay(makeConfig())
    const rectSpy = jest.spyOn(display, 'drawRectangle')
    await renderFinalScene(display, createDemoFinalSnapshot())
    expect(rectSpy).toHaveBeenCalledWith(1, 1, 10, 10, undefined, 'rgb(100, 100, 100)')
  })

  it('draws home placeholder rect at (1, 13, 10, 10) when logo is null', async () => {
    const display = new ClientDisplay(makeConfig())
    const rectSpy = jest.spyOn(display, 'drawRectangle')
    await renderFinalScene(display, createDemoFinalSnapshot())
    expect(rectSpy).toHaveBeenCalledWith(1, 13, 10, 10, undefined, 'rgb(100, 100, 100)')
  })

  it('draws away abbreviation at x=13, y=2 (topY+1)', async () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    const snap = createDemoFinalSnapshot()
    await renderFinalScene(display, snap)
    const abbrCall = drawTextSpy.mock.calls.find(c => c[1] === 13 && c[2] === 2)
    expect(abbrCall).toBeDefined()
    expect(abbrCall![0]).toBe(snap.away.abbr.slice(0, 4))
  })

  it('draws home abbreviation at x=13, y=14 (botY+1)', async () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    const snap = createDemoFinalSnapshot()
    await renderFinalScene(display, snap)
    const abbrCall = drawTextSpy.mock.calls.find(c => c[1] === 13 && c[2] === 14)
    expect(abbrCall).toBeDefined()
    expect(abbrCall![0]).toBe(snap.home.abbr.slice(0, 4))
  })

  it('draws scores in white with FONT_LARGE', async () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    await renderFinalScene(display, createDemoFinalSnapshot())
    const scoreCalls = drawTextSpy.mock.calls.filter(
      c => c[3] === 12 && c[5] === 'rgb(255, 255, 255)'
    )
    expect(scoreCalls).toHaveLength(2)
    for (const call of scoreCalls) {
      expect(call[4]).toBe(FONT_LARGE)
    }
  })

  it('has no bottom status line (no green text)', async () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    await renderFinalScene(display, createDemoFinalSnapshot())
    const greenCall = drawTextSpy.mock.calls.find(c => c[5] === 'rgb(0, 255, 0)')
    expect(greenCall).toBeUndefined()
  })

  it('draws logo images when available', async () => {
    const mockImg = new Image()
    mockLoadTeamLogo.mockResolvedValue(mockImg)
    const display = new ClientDisplay(makeConfig())
    const drawImageSpy = jest.spyOn(display, 'drawImage')
    const rectSpy = jest.spyOn(display, 'drawRectangle')
    await renderFinalScene(display, createDemoFinalSnapshot())
    expect(drawImageSpy).toHaveBeenCalledWith(mockImg, 1, 1, 10, 10)
    expect(drawImageSpy).toHaveBeenCalledWith(mockImg, 1, 13, 10, 10)
    expect(rectSpy).not.toHaveBeenCalled()
  })
})

// ─── renderLiveBigLogos ───────────────────────────────────────────────────────

describe('renderLiveBigLogos', () => {
  beforeEach(() => {
    mockLoadTeamLogo.mockResolvedValue(null)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('calls clear with black (0,0,0)', async () => {
    const display = new ClientDisplay(makeConfig())
    const clearSpy = jest.spyOn(display, 'clear')
    await renderLiveBigLogos(display, createDemoLiveSnapshot())
    expect(clearSpy).toHaveBeenCalledWith(0, 0, 0)
  })

  it('draws status text at y=0 in gray with FONT_SMALL', async () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    await renderLiveBigLogos(display, createDemoLiveSnapshot())
    const statusCall = drawTextSpy.mock.calls.find(c => c[2] === 0)
    expect(statusCall).toBeDefined()
    expect(statusCall![5]).toBe('rgb(150, 150, 150)')
    expect(statusCall![3]).toBe(8)
    expect(statusCall![4]).toBe(FONT_SMALL)
  })

  it('centers status text horizontally', async () => {
    const display = new ClientDisplay(makeConfig()) // w=64
    jest.spyOn(display, 'getTextWidth').mockReturnValue(10)
    const drawTextSpy = jest.spyOn(display, 'drawText')
    await renderLiveBigLogos(display, createDemoLiveSnapshot())
    const statusCall = drawTextSpy.mock.calls.find(c => c[2] === 0)
    expect(statusCall).toBeDefined()
    // x = floor((64 - 10) / 2) = 27
    expect(statusCall![1]).toBe(27)
  })

  it('draws home logo at (1, 9) for h=32 display', async () => {
    const mockImg = new Image()
    mockLoadTeamLogo.mockResolvedValue(mockImg)
    const display = new ClientDisplay(makeConfig()) // h=32
    const drawImageSpy = jest.spyOn(display, 'drawImage')
    await renderLiveBigLogos(display, createDemoLiveSnapshot())
    // yLogoTop = 1 + 8 = 9, desiredLogoH = 16 (h=32 not > 32)
    expect(drawImageSpy).toHaveBeenCalledWith(mockImg, 1, 9, 16, 16)
  })

  it('draws away logo at (w-desiredLogoH-2, 9) for h=32 display', async () => {
    const mockImg = new Image()
    mockLoadTeamLogo.mockResolvedValue(mockImg)
    const display = new ClientDisplay(makeConfig()) // w=64, h=32
    const drawImageSpy = jest.spyOn(display, 'drawImage')
    await renderLiveBigLogos(display, createDemoLiveSnapshot())
    // w - desiredLogoH - 2 = 64 - 16 - 2 = 46
    expect(drawImageSpy).toHaveBeenCalledWith(mockImg, 46, 9, 16, 16)
  })

  it('draws placeholder rects for logos when null', async () => {
    const display = new ClientDisplay(makeConfig()) // w=64, h=32
    const rectSpy = jest.spyOn(display, 'drawRectangle')
    await renderLiveBigLogos(display, createDemoLiveSnapshot())
    expect(rectSpy).toHaveBeenCalledWith(1, 9, 16, 16, undefined, 'rgb(100, 100, 100)')
    expect(rectSpy).toHaveBeenCalledWith(46, 9, 16, 16, undefined, 'rgb(100, 100, 100)')
  })

  it('draws home abbreviation at x=1, y=h-9', async () => {
    const display = new ClientDisplay(makeConfig()) // h=32
    const drawTextSpy = jest.spyOn(display, 'drawText')
    const snap = createDemoLiveSnapshot()
    await renderLiveBigLogos(display, snap)
    const homeAbbrCall = drawTextSpy.mock.calls.find(
      c => c[0] === snap.home.abbr.slice(0, 4) && c[1] === 1 && c[2] === 23
    )
    expect(homeAbbrCall).toBeDefined()
    expect(homeAbbrCall![5]).toBe('rgb(200, 200, 200)')
  })

  it('draws away abbreviation at y=h-9', async () => {
    const display = new ClientDisplay(makeConfig()) // h=32
    const drawTextSpy = jest.spyOn(display, 'drawText')
    const snap = createDemoLiveSnapshot()
    await renderLiveBigLogos(display, snap)
    const abbrCalls = drawTextSpy.mock.calls.filter(
      c => c[2] === 23 && c[5] === 'rgb(200, 200, 200)'
    )
    // Should have both home and away abbreviations at y=23
    expect(abbrCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('draws two scores in white between logos', async () => {
    const display = new ClientDisplay(makeConfig())
    const drawTextSpy = jest.spyOn(display, 'drawText')
    await renderLiveBigLogos(display, createDemoLiveSnapshot())
    const scoreCalls = drawTextSpy.mock.calls.filter(c => c[5] === 'rgb(255, 255, 255)')
    expect(scoreCalls).toHaveLength(2)
  })

  it('uses FONT_SMALL size 8 for scores on h=32 display (force_small)', async () => {
    const display = new ClientDisplay(makeConfig()) // h=32
    const drawTextSpy = jest.spyOn(display, 'drawText')
    await renderLiveBigLogos(display, createDemoLiveSnapshot())
    const scoreCalls = drawTextSpy.mock.calls.filter(c => c[5] === 'rgb(255, 255, 255)')
    for (const call of scoreCalls) {
      expect(call[3]).toBe(8)
      expect(call[4]).toBe(FONT_SMALL)
    }
  })

  it('uses FONT_SMALL size 8 for scores on h=32 display with short scores', async () => {
    const display = new ClientDisplay(makeConfig({ height: 32 }))
    const drawTextSpy = jest.spyOn(display, 'drawText')
    await renderLiveBigLogos(display, createDemoLiveSnapshot())
    const scoreCalls = drawTextSpy.mock.calls.filter(c => c[5] === 'rgb(255, 255, 255)')
    for (const call of scoreCalls) {
      expect(call[3]).toBe(8)
      expect(call[4]).toBe(FONT_SMALL)
    }
  })

  it('uses banner variant when loading logos', async () => {
    const snap = createDemoLiveSnapshot()
    const display = new ClientDisplay(makeConfig())
    await renderLiveBigLogos(display, snap)
    expect(mockLoadTeamLogo).toHaveBeenCalledWith(
      snap.home.id,
      snap.home.abbr,
      snap.sport.code,
      'banner'
    )
    expect(mockLoadTeamLogo).toHaveBeenCalledWith(
      snap.away.id,
      snap.away.abbr,
      snap.sport.code,
      'banner'
    )
  })
})
