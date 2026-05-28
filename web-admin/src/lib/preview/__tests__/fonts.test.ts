import { FONT_SMALL, FONT_LARGE, FONT_FALLBACK, loadPreviewFonts, _resetFontState } from '../fonts'

beforeEach(() => {
  _resetFontState()
})

describe('font constants', () => {
  it('exports FONT_SMALL as "04B03"', () => {
    expect(FONT_SMALL).toBe('04B03')
  })

  it('exports FONT_LARGE as "ScoreLarge"', () => {
    expect(FONT_LARGE).toBe('ScoreLarge')
  })

  it('exports FONT_FALLBACK as "monospace"', () => {
    expect(FONT_FALLBACK).toBe('monospace')
  })
})

describe('loadPreviewFonts', () => {
  it('returns { small: false, large: false } when FontFace is unavailable', async () => {
    const original = (global as any).FontFace
    delete (global as any).FontFace
    try {
      const result = await loadPreviewFonts()
      expect(result).toEqual({ small: false, large: false })
    } finally {
      ;(global as any).FontFace = original
    }
  })

  it('returns { small: true, large: true } when FontFace loads successfully', async () => {
    const mockFont = {
      load: jest.fn().mockResolvedValue({ family: 'TestFont' }),
    }
    const MockFontFace = jest.fn().mockReturnValue(mockFont)
    ;(global as any).FontFace = MockFontFace

    // Mock document.fonts.add
    const mockAdd = jest.fn()
    Object.defineProperty(document, 'fonts', {
      value: { add: mockAdd },
      writable: true,
      configurable: true,
    })

    const result = await loadPreviewFonts()
    expect(result.small).toBe(true)
    expect(result.large).toBe(true)
    expect(MockFontFace).toHaveBeenCalledTimes(2)
  })

  it('returns false for a font that fails to load', async () => {
    let callCount = 0
    const MockFontFace = jest.fn().mockImplementation(() => ({
      load: jest.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return Promise.resolve({ family: 'SmallFont' })
        return Promise.reject(new Error('Font load failed'))
      }),
    }))
    ;(global as any).FontFace = MockFontFace

    const result = await loadPreviewFonts()
    expect(result.small).toBe(true)
    expect(result.large).toBe(false)
  })

  it('does not load fonts twice on repeated calls', async () => {
    const mockFont = {
      load: jest.fn().mockResolvedValue({ family: 'TestFont' }),
    }
    const MockFontFace = jest.fn().mockReturnValue(mockFont)
    ;(global as any).FontFace = MockFontFace

    await loadPreviewFonts()
    await loadPreviewFonts()

    // Should only have been constructed twice (once per font, not twice per call)
    expect(MockFontFace).toHaveBeenCalledTimes(2)
  })

  it('returns cached result on second call', async () => {
    const mockFont = {
      load: jest.fn().mockResolvedValue({ family: 'TestFont' }),
    }
    ;(global as any).FontFace = jest.fn().mockReturnValue(mockFont)

    const first = await loadPreviewFonts()
    const second = await loadPreviewFonts()
    expect(second).toEqual(first)
  })
})
