import { loadTeamLogo, clearLogoCache } from '../logos'

let imageInstances: MockImage[] = []

class MockImage {
  crossOrigin: string = ''
  private _src: string = ''
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor() {
    imageInstances.push(this)
  }

  get src(): string {
    return this._src
  }

  set src(value: string) {
    this._src = value
  }

  triggerLoad() {
    this.onload?.()
  }

  triggerError() {
    this.onerror?.()
  }
}

beforeEach(() => {
  imageInstances = []
  clearLogoCache()
  ;(global as any).Image = MockImage
})

afterEach(() => {
  delete (global as any).Image
})

describe('loadTeamLogo', () => {
  it('returns null immediately when both teamId and abbr are undefined', async () => {
    const result = await loadTeamLogo(undefined, undefined, 'wnba', 'mini')
    expect(result).toBeNull()
    expect(imageInstances).toHaveLength(0)
  })

  it('constructs the variant path as first candidate', async () => {
    const promise = loadTeamLogo('11', 'PHX', 'wnba', 'mini')
    expect(imageInstances.length).toBeGreaterThan(0)
    expect(imageInstances[0].src).toBe('/assets/logos/variants/11_mini.png')
    imageInstances[0].triggerLoad()
    const result = await promise
    expect(result).toBe(imageInstances[0])
  })

  it('constructs banner variant path correctly', async () => {
    const promise = loadTeamLogo('6', 'LAS', 'wnba', 'banner')
    expect(imageInstances[0].src).toBe('/assets/logos/variants/6_banner.png')
    imageInstances[0].triggerLoad()
    await promise
  })

  it('falls back to WNBA logo path when variant fails', async () => {
    const promise = loadTeamLogo('11', 'PHX', 'wnba', 'mini')
    imageInstances[0].triggerError() // variant fails
    // next attempt: /assets/logos/11.png
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(imageInstances[1].src).toBe('/assets/logos/11.png')
    imageInstances[1].triggerLoad()
    const result = await promise
    expect(result).toBe(imageInstances[1])
  })

  it('falls back to NHL PNG then SVG paths for hockey sport', async () => {
    const promise = loadTeamLogo('1', 'BOS', 'nhl', 'mini')
    // First: variant path
    imageInstances[0].triggerError()
    await new Promise(resolve => setTimeout(resolve, 0))
    // Second: /assets/nhl_logos/BOS.png
    expect(imageInstances[1].src).toBe('/assets/nhl_logos/BOS.png')
    imageInstances[1].triggerError()
    await new Promise(resolve => setTimeout(resolve, 0))
    // Third: /assets/nhl_logos/BOS.svg
    expect(imageInstances[2].src).toBe('/assets/nhl_logos/BOS.svg')
    imageInstances[2].triggerLoad()
    const result = await promise
    expect(result).toBe(imageInstances[2])
  })

  it('uppercases NHL abbreviations in path', async () => {
    const promise = loadTeamLogo('1', 'bos', 'hockey', 'mini')
    imageInstances[0].triggerError() // variant
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(imageInstances[1].src).toBe('/assets/nhl_logos/BOS.png')
    imageInstances[1].triggerLoad()
    await promise
  })

  it('falls back to /assets/logos/{ABBR}.png as final fallback', async () => {
    const promise = loadTeamLogo('11', 'PHX', 'wnba', 'mini')
    imageInstances[0].triggerError() // variant
    await new Promise(resolve => setTimeout(resolve, 0))
    imageInstances[1].triggerError() // wnba teamId
    await new Promise(resolve => setTimeout(resolve, 0))
    // abbr fallback
    expect(imageInstances[2].src).toBe('/assets/logos/PHX.png')
    imageInstances[2].triggerLoad()
    const result = await promise
    expect(result).toBe(imageInstances[2])
  })

  it('returns null when all paths fail', async () => {
    const promise = loadTeamLogo('11', 'PHX', 'wnba', 'mini')
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 0))
      if (i < imageInstances.length) imageInstances[i].triggerError()
    }
    const result = await promise
    expect(result).toBeNull()
  })

  it('caches successful result — second call returns same reference, only one Image created per path', async () => {
    const p1 = loadTeamLogo('11', 'PHX', 'wnba', 'mini')
    imageInstances[0].triggerLoad()
    const result1 = await p1

    const countAfterFirst = imageInstances.length

    const result2 = await loadTeamLogo('11', 'PHX', 'wnba', 'mini')
    expect(imageInstances.length).toBe(countAfterFirst) // no new images created
    expect(result2).toBe(result1)
  })

  it('caches null results — second call with same args does not create new Image', async () => {
    const p1 = loadTeamLogo('999', 'ZZZ', 'wnba', 'mini')
    // drain all path attempts
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 0))
      if (i < imageInstances.length) imageInstances[i].triggerError()
    }
    const result1 = await p1
    expect(result1).toBeNull()

    const countAfterFirst = imageInstances.length

    const result2 = await loadTeamLogo('999', 'ZZZ', 'wnba', 'mini')
    expect(imageInstances.length).toBe(countAfterFirst)
    expect(result2).toBeNull()
  })

  it('clearLogoCache causes a new Image to be created on next call', async () => {
    const p1 = loadTeamLogo('11', 'PHX', 'wnba', 'mini')
    imageInstances[0].triggerLoad()
    await p1

    const countAfterFirst = imageInstances.length

    clearLogoCache()

    const p2 = loadTeamLogo('11', 'PHX', 'wnba', 'mini')
    expect(imageInstances.length).toBeGreaterThan(countAfterFirst)
    imageInstances[countAfterFirst].triggerLoad()
    const result2 = await p2
    expect(result2).toBe(imageInstances[countAfterFirst])
  })

  it('sets crossOrigin to anonymous on each image', async () => {
    const promise = loadTeamLogo('11', 'PHX', 'wnba', 'mini')
    expect(imageInstances[0].crossOrigin).toBe('anonymous')
    imageInstances[0].triggerLoad()
    await promise
  })

  it('only uses abbr fallback when teamId is undefined', async () => {
    const promise = loadTeamLogo(undefined, 'PHX', 'wnba', 'mini')
    // No variant path (teamId undefined), no WNBA teamId path — only abbr fallback
    expect(imageInstances[0].src).toBe('/assets/logos/PHX.png')
    imageInstances[0].triggerLoad()
    await promise
  })
})
