import { FontManager, getFontManager } from './fonts'

jest.mock('canvas', () => ({
  registerFont: jest.fn(),
}))

jest.mock('fs', () => ({
  readFileSync: jest.fn(() =>
    JSON.stringify({
      default: { font: '04B_24__.TTF', size: 8 },
      period: { font: '04B_24__.TTF', size: 8 },
      clock: { font: '04B_24__.TTF', size: 8 },
      score: { font: 'score_large.otf', size: 16 },
      small: { font: '04B_03B_.TTF', size: 6 },
      team_name: { font: '04B_03B_.TTF', size: 8 },
    })
  ),
}))

describe('FontManager', () => {
  let fontManager: FontManager

  beforeEach(() => {
    fontManager = new FontManager('config/fonts.json', 'assets/fonts/pixel')
  })

  it('should return default font string', () => {
    const font = fontManager.getDefaultFont()
    expect(font).toBe("8px '04B_24__'")
  })

  it('should return period font string', () => {
    const font = fontManager.getPeriodFont()
    expect(font).toBe("8px '04B_24__'")
  })

  it('should return clock font string', () => {
    const font = fontManager.getClockFont()
    expect(font).toBe("8px '04B_24__'")
  })

  it('should return score font string', () => {
    const font = fontManager.getScoreFont()
    expect(font).toBe("16px 'score_large'")
  })

  it('should return small font string', () => {
    const font = fontManager.getSmallFont()
    expect(font).toBe("6px '04B_03B_'")
  })

  it('should return team name font string', () => {
    const font = fontManager.getTeamNameFont()
    expect(font).toBe("8px '04B_03B_'")
  })

  it('should cache font strings', () => {
    const font1 = fontManager.getDefaultFont()
    const font2 = fontManager.getDefaultFont()
    expect(font1).toBe(font2)
  })

  it('should handle missing font configuration', () => {
    const font = fontManager.getFont('nonexistent')
    expect(font).toBe("8px '04B_24__'")
  })
})

describe('getFontManager', () => {
  it('should return singleton instance', () => {
    const manager1 = getFontManager()
    const manager2 = getFontManager()
    expect(manager1).toBe(manager2)
  })
})
