import { drawFinalScene } from '@/lib/preview/scenes/final'
import * as logosModule from '@/lib/preview/logos'
import * as fontsModule from '@/lib/preview/fonts'

jest.mock('@/lib/preview/logos', () => ({
  loadTeamLogo: jest.fn(),
}))

jest.mock('@/lib/preview/fonts', () => ({
  getFontManager: jest.fn(),
}))

describe('drawFinalScene', () => {
  let mockSnapshot: {
    sport: { id: string; name: string; code?: string }
    home: { id: string; name: string; abbr: string; score: number }
    away: { id: string; name: string; abbr: string; score: number }
  }
  let mockFontManager: {
    getSmallFont: jest.Mock
    getScoreLargeFont: jest.Mock
  }

  beforeEach(() => {
    mockSnapshot = {
      sport: { id: 'basketball', name: 'Basketball', code: 'basketball' },
      home: { id: 'home-id', name: 'Home Team', abbr: 'HOM', score: 95 },
      away: { id: 'away-id', name: 'Away Team', abbr: 'AWY', score: 88 },
    }

    mockFontManager = {
      getSmallFont: jest.fn().mockReturnValue('8px monospace'),
      getScoreLargeFont: jest.fn().mockReturnValue('10px monospace'),
    }
    ;(fontsModule.getFontManager as jest.Mock).mockReturnValue(mockFontManager)
    ;(logosModule.loadTeamLogo as jest.Mock).mockResolvedValue(null)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should create canvas with default dimensions', async () => {
    const canvas = await drawFinalScene(mockSnapshot)

    expect(canvas.width).toBe(64)
    expect(canvas.height).toBe(32)
  })

  it('should create canvas with custom dimensions', async () => {
    const canvas = await drawFinalScene(mockSnapshot, {
      width: 128,
      height: 64,
    })

    expect(canvas.width).toBe(128)
    expect(canvas.height).toBe(64)
  })

  it('should use font manager for fonts', async () => {
    await drawFinalScene(mockSnapshot)

    expect(fontsModule.getFontManager).toHaveBeenCalled()
    expect(mockFontManager.getSmallFont).toHaveBeenCalled()
    expect(mockFontManager.getScoreLargeFont).toHaveBeenCalled()
  })

  it('should complete without errors', async () => {
    await expect(drawFinalScene(mockSnapshot)).resolves.toBeDefined()
  })

  it('should return a canvas element', async () => {
    const canvas = await drawFinalScene(mockSnapshot)

    expect(canvas).toBeDefined()
    expect(typeof canvas.getContext).toBe('function')
  })

  it('should load team logos with correct parameters', async () => {
    await drawFinalScene(mockSnapshot)

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
    await drawFinalScene(mockSnapshot, { logoVariant: 'small' })

    expect(logosModule.loadTeamLogo).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'small',
      })
    )
  })

  it('should use banner logo variant when specified', async () => {
    await drawFinalScene(mockSnapshot, { logoVariant: 'banner' })

    expect(logosModule.loadTeamLogo).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'banner',
      })
    )
  })

  it('should use sport code when available', async () => {
    mockSnapshot.sport.code = 'nba'

    await drawFinalScene(mockSnapshot)

    expect(logosModule.loadTeamLogo).toHaveBeenCalledWith(
      expect.objectContaining({
        sport: 'nba',
      })
    )
  })

  it('should fallback to sport id when code not available', async () => {
    delete mockSnapshot.sport.code

    await drawFinalScene(mockSnapshot)

    expect(logosModule.loadTeamLogo).toHaveBeenCalledWith(
      expect.objectContaining({
        sport: 'basketball',
      })
    )
  })

  it('should handle long team abbreviations', async () => {
    mockSnapshot.home.abbr = 'VERYLONGNAME'
    mockSnapshot.away.abbr = 'ANOTHERLONGNAME'

    await expect(drawFinalScene(mockSnapshot)).resolves.toBeDefined()
  })

  it('should handle zero scores', async () => {
    mockSnapshot.home.score = 0
    mockSnapshot.away.score = 0

    await expect(drawFinalScene(mockSnapshot)).resolves.toBeDefined()
  })

  it('should handle high scores', async () => {
    mockSnapshot.home.score = 150
    mockSnapshot.away.score = 145

    await expect(drawFinalScene(mockSnapshot)).resolves.toBeDefined()
  })

  it('should load both team logos', async () => {
    await drawFinalScene(mockSnapshot)

    expect(logosModule.loadTeamLogo).toHaveBeenCalledTimes(2)
  })

  it('should handle different sports', async () => {
    mockSnapshot.sport = { id: 'hockey', name: 'Hockey', code: 'nhl' }

    await drawFinalScene(mockSnapshot)

    expect(logosModule.loadTeamLogo).toHaveBeenCalledWith(
      expect.objectContaining({
        sport: 'nhl',
      })
    )
  })

  it('should create canvas with correct aspect ratio', async () => {
    const canvas = await drawFinalScene(mockSnapshot)

    expect(canvas.width / canvas.height).toBe(2)
  })

  it('should handle custom canvas size maintaining aspect ratio', async () => {
    const canvas = await drawFinalScene(mockSnapshot, {
      width: 128,
      height: 64,
    })

    expect(canvas.width / canvas.height).toBe(2)
  })

  it('should call font manager methods', async () => {
    await drawFinalScene(mockSnapshot)

    expect(mockFontManager.getSmallFont).toHaveBeenCalled()
    expect(mockFontManager.getScoreLargeFont).toHaveBeenCalled()
  })

  it('should complete successfully with null logos', async () => {
    ;(logosModule.loadTeamLogo as jest.Mock).mockResolvedValue(null)

    const canvas = await drawFinalScene(mockSnapshot)

    expect(canvas).toBeDefined()
    expect(canvas.width).toBe(64)
    expect(canvas.height).toBe(32)
  })
})
