/**
 * Regression tests for the FONT_SMALL bug: 04B_24__.TTF (large pixel font) was silently
 * loaded instead of 04B_03B_.TTF (small pixel font). No error surfaced — wrong glyphs
 * rendered perfectly. These tests catch that entire class of silent font mis-wiring.
 */

import * as fs from 'fs'
import * as path from 'path'
import { FONT_SMALL, FONT_LARGE, loadPreviewFonts, _resetFontState } from '../fonts'

beforeEach(() => {
  _resetFontState()
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ── File-system sanity: the correct TTF must exist on disk ─────────────────────

describe('font asset files', () => {
  it('04B_03B_.TTF (small pixel font) exists in public/assets/fonts/pixel/', () => {
    // If this file is deleted, FONT_SMALL silently falls back to system fonts
    const fontPath = path.resolve(__dirname, '../../../../public/assets/fonts/pixel/04B_03B_.TTF')
    expect(fs.existsSync(fontPath)).toBe(true)
  })

  it('04B_24__.TTF (large pixel font) exists in public/assets/fonts/pixel/', () => {
    // Belt-and-suspenders: large font must also be present for FONT_LARGE to work
    const fontPath = path.resolve(__dirname, '../../../../public/assets/fonts/pixel/04B_24__.TTF')
    expect(fs.existsSync(fontPath)).toBe(true)
  })
})

// ── Runtime wiring: loadPreviewFonts must pass the right file to FontFace ────────

describe('loadPreviewFonts font-file wiring', () => {
  function makeCapturingMockFontFace(): {
    MockFontFace: jest.Mock
    calls: Array<[string, string]>
  } {
    const calls: Array<[string, string]> = []
    const MockFontFace = jest.fn().mockImplementation((family: string, src: string) => {
      calls.push([family, src])
      return { load: jest.fn().mockResolvedValue({}) }
    })
    return { MockFontFace, calls }
  }

  it('registers FONT_SMALL with the 04B_03B_.TTF file, not 04B_24__.TTF', async () => {
    // The original bug: FONT_SMALL pointed at 04B_24__.TTF (Go's large font file)
    const { MockFontFace, calls } = makeCapturingMockFontFace()
    ;(global as any).FontFace = MockFontFace
    const mockAdd = jest.fn()
    Object.defineProperty(document, 'fonts', {
      value: { add: mockAdd },
      writable: true,
      configurable: true,
    })

    await loadPreviewFonts()

    const smallFontCall = calls.find(([family]) => family === FONT_SMALL)
    expect(smallFontCall).toBeDefined()
    // Must use the small pixel font file
    expect(smallFontCall![1]).toContain('04B_03B_')
    // Must NOT accidentally load the large font file
    expect(smallFontCall![1]).not.toContain('04B_24__')
  })

  it('registers FONT_SMALL with the exact expected URL', async () => {
    // Locks in the full URL — catches path renames as well as wrong-file regressions
    const { MockFontFace, calls } = makeCapturingMockFontFace()
    ;(global as any).FontFace = MockFontFace
    const mockAdd = jest.fn()
    Object.defineProperty(document, 'fonts', {
      value: { add: mockAdd },
      writable: true,
      configurable: true,
    })

    await loadPreviewFonts()

    const smallFontCall = calls.find(([family]) => family === FONT_SMALL)
    expect(smallFontCall![1]).toBe('url(/assets/fonts/pixel/04B_03B_.TTF)')
  })

  it('registers the 04B_03B_.TTF file under the "04B03" family (not "04B24")', async () => {
    // If the family name drifts, every canvas drawText using FONT_SMALL renders with system fallback
    const { MockFontFace, calls } = makeCapturingMockFontFace()
    ;(global as any).FontFace = MockFontFace
    const mockAdd = jest.fn()
    Object.defineProperty(document, 'fonts', {
      value: { add: mockAdd },
      writable: true,
      configurable: true,
    })

    await loadPreviewFonts()

    const smallFontCall = calls.find(([, src]) => src.includes('04B_03B_'))
    expect(smallFontCall).toBeDefined()
    // Family name must be '04B03', not '04B24' (the old wrong value)
    expect(smallFontCall![0]).toBe('04B03')
    expect(smallFontCall![0]).toBe(FONT_SMALL)
  })

  it('does not cross-wire: FONT_LARGE is not loaded from 04B_03B_.TTF', async () => {
    // Guard against the inverse swap: large font accidentally getting the small file
    const { MockFontFace, calls } = makeCapturingMockFontFace()
    ;(global as any).FontFace = MockFontFace
    const mockAdd = jest.fn()
    Object.defineProperty(document, 'fonts', {
      value: { add: mockAdd },
      writable: true,
      configurable: true,
    })

    await loadPreviewFonts()

    const crossWiredCall = calls.find(
      ([family, src]) => family === FONT_LARGE && src.includes('04B_03B_')
    )
    expect(crossWiredCall).toBeUndefined()
  })

  it('FONT_SMALL and FONT_LARGE map to distinct font family names', async () => {
    // Prevents a future refactor from accidentally aliasing both constants to the same family
    expect(FONT_SMALL).not.toBe(FONT_LARGE)
    expect(FONT_SMALL).toBe('04B03')
    expect(FONT_LARGE).toBe('ScoreLarge')
  })
})

// ── Scene integration: scenes pass FONT_SMALL (not FONT_LARGE) for small-text calls ──

describe('scene rendering uses correct font constants for small text', () => {
  it('renderFinalScene passes FONT_SMALL for the "FINAL" text and abbreviations', async () => {
    // "FINAL" text and team abbreviations must use the small font; only scores use FONT_LARGE
    const { renderFinalScene } = await import('../scenes')
    const { ClientDisplay } = await import('../display')
    const { createDemoFinalSnapshot } = await import('../demo-data')

    jest.mock('../logos', () => ({
      loadTeamLogo: jest.fn().mockResolvedValue(null),
      clearLogoCache: jest.fn(),
    }))

    const display = new ClientDisplay({
      width: 64,
      height: 32,
      brightness: 100,
      logo_variant: 'mini',
      live_layout: 'stacked',
    })
    const drawTextSpy = jest.spyOn(display, 'drawText')

    await renderFinalScene(display, createDemoFinalSnapshot())

    const smallFontCalls = drawTextSpy.mock.calls.filter(c => c[4] === FONT_SMALL)
    // "FINAL" + away abbr + home abbr = at least 3 calls using FONT_SMALL
    expect(smallFontCalls.length).toBeGreaterThanOrEqual(3)
    // The "FINAL" label specifically must use FONT_SMALL ('04B03')
    const finalLabelCall = drawTextSpy.mock.calls.find(c => c[0] === 'FINAL')
    expect(finalLabelCall).toBeDefined()
    expect(finalLabelCall![4]).toBe('04B03')
    expect(finalLabelCall![4]).toBe(FONT_SMALL)
  })
})
