export const FONT_SMALL = '04B03'
export const FONT_LARGE = 'ScoreLarge'
export const FONT_FALLBACK = 'monospace'

interface FontState {
  loaded: boolean
  small: boolean
  large: boolean
}

let _state: FontState = { loaded: false, small: false, large: false }

export async function loadPreviewFonts(): Promise<{ small: boolean; large: boolean }> {
  if (_state.loaded) {
    return { small: _state.small, large: _state.large }
  }

  if (typeof FontFace === 'undefined') {
    _state = { loaded: true, small: false, large: false }
    return { small: false, large: false }
  }

  const results = await Promise.allSettled([
    _loadFont(FONT_SMALL, '/assets/fonts/pixel/04B_03B_.TTF'),
    _loadFont(FONT_LARGE, '/assets/fonts/pixel/score_large.otf'),
  ])

  _state = {
    loaded: true,
    small: results[0].status === 'fulfilled',
    large: results[1].status === 'fulfilled',
  }

  return { small: _state.small, large: _state.large }
}

async function _loadFont(family: string, url: string): Promise<void> {
  const font = new FontFace(family, `url(${url})`)
  const loaded = await font.load()
  if (
    typeof document !== 'undefined' &&
    document.fonts &&
    typeof document.fonts.add === 'function'
  ) {
    document.fonts.add(loaded)
  }
}

export function _resetFontState(): void {
  _state = { loaded: false, small: false, large: false }
}
