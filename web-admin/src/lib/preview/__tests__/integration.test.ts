import {
  PreviewGenerator,
  ClientDisplay,
  GameState,
  createDemoPregameSnapshot,
  createDemoLiveSnapshot,
  createDemoFinalSnapshot,
  createNhlDemoPregameSnapshot,
  createNhlDemoLiveSnapshot,
  createNhlDemoFinalSnapshot,
  getPeriodName,
  type DisplayConfig,
  type GameSnapshot,
} from '../index'

jest.mock('../logos', () => ({
  loadTeamLogo: jest.fn().mockResolvedValue(null),
  clearLogoCache: jest.fn(),
}))

const makeConfig = (overrides: Partial<DisplayConfig> = {}): DisplayConfig => ({
  width: 64,
  height: 32,
  brightness: 100,
  logo_variant: 'mini',
  live_layout: 'stacked',
  ...overrides,
})

describe('PreviewGenerator integration (no scene mocks)', () => {
  let generator: PreviewGenerator

  beforeEach(() => {
    generator = new PreviewGenerator()
  })

  it('generates a valid PNG data URL for null snapshot (idle scene)', async () => {
    const result = await generator.generatePreview(makeConfig(), null)
    expect(typeof result).toBe('string')
    expect(result.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('generates a valid PNG data URL for WNBA PRE state', async () => {
    const snapshot = createDemoPregameSnapshot()
    expect(snapshot.state).toBe(GameState.PRE)
    const result = await generator.generatePreview(makeConfig(), snapshot)
    expect(result.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('generates a valid PNG data URL for WNBA LIVE stacked state', async () => {
    const snapshot = createDemoLiveSnapshot()
    expect(snapshot.state).toBe(GameState.LIVE)
    const result = await generator.generatePreview(makeConfig({ live_layout: 'stacked' }), snapshot)
    expect(result.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('generates a valid PNG data URL for WNBA LIVE big-logos state', async () => {
    const snapshot = createDemoLiveSnapshot()
    const result = await generator.generatePreview(makeConfig({ live_layout: 'big-logos' }), snapshot)
    expect(result.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('generates a valid PNG data URL for WNBA FINAL state', async () => {
    const snapshot = createDemoFinalSnapshot()
    expect(snapshot.state).toBe(GameState.FINAL)
    const result = await generator.generatePreview(makeConfig(), snapshot)
    expect(result.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('generates a valid PNG data URL for NHL PRE state', async () => {
    const snapshot = createNhlDemoPregameSnapshot()
    const result = await generator.generatePreview(makeConfig(), snapshot)
    expect(result.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('generates a valid PNG data URL for NHL LIVE state', async () => {
    const snapshot = createNhlDemoLiveSnapshot()
    const result = await generator.generatePreview(makeConfig(), snapshot)
    expect(result.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('generates a valid PNG data URL for NHL FINAL state', async () => {
    const snapshot = createNhlDemoFinalSnapshot()
    const result = await generator.generatePreview(makeConfig(), snapshot)
    expect(result.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('does not throw for any demo snapshot', async () => {
    const snapshots: GameSnapshot[] = [
      createDemoPregameSnapshot(),
      createDemoLiveSnapshot(),
      createDemoFinalSnapshot(),
      createNhlDemoPregameSnapshot(),
      createNhlDemoLiveSnapshot(),
      createNhlDemoFinalSnapshot(),
    ]
    for (const snapshot of snapshots) {
      await expect(generator.generatePreview(makeConfig(), snapshot)).resolves.not.toThrow()
    }
  })
})

describe('barrel exports', () => {
  it('exports PreviewGenerator as a constructor', () => {
    expect(typeof PreviewGenerator).toBe('function')
    const instance = new PreviewGenerator()
    expect(typeof instance.generatePreview).toBe('function')
  })

  it('exports ClientDisplay as a constructor', () => {
    expect(typeof ClientDisplay).toBe('function')
    const display = new ClientDisplay(makeConfig())
    expect(typeof display.toDataURL).toBe('function')
  })

  it('exports GameState enum with correct values', () => {
    expect(GameState.PRE).toBe('PRE')
    expect(GameState.LIVE).toBe('LIVE')
    expect(GameState.FINAL).toBe('FINAL')
  })

  it('exports demo data factories as functions', () => {
    expect(typeof createDemoPregameSnapshot).toBe('function')
    expect(typeof createDemoLiveSnapshot).toBe('function')
    expect(typeof createDemoFinalSnapshot).toBe('function')
    expect(typeof createNhlDemoPregameSnapshot).toBe('function')
    expect(typeof createNhlDemoLiveSnapshot).toBe('function')
    expect(typeof createNhlDemoFinalSnapshot).toBe('function')
    expect(typeof getPeriodName).toBe('function')
  })

  it('demo data factories return correct GameState values', () => {
    expect(createDemoPregameSnapshot().state).toBe(GameState.PRE)
    expect(createDemoLiveSnapshot().state).toBe(GameState.LIVE)
    expect(createDemoFinalSnapshot().state).toBe(GameState.FINAL)
    expect(createNhlDemoPregameSnapshot().state).toBe(GameState.PRE)
    expect(createNhlDemoLiveSnapshot().state).toBe(GameState.LIVE)
    expect(createNhlDemoFinalSnapshot().state).toBe(GameState.FINAL)
  })
})
