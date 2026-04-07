import { ClientPreviewGenerator } from '../preview-generator'
import { ClientDisplay } from '../display'
import { renderIdleScene, renderPregameScene, renderLiveScene, renderFinalScene } from '../scenes'
import { DisplayConfig, GameState } from '../../canvas/types'
import {
  createDemoPregameSnapshot,
  createDemoLiveSnapshot,
  createDemoFinalSnapshot,
} from '../../canvas/demo-data'

jest.mock('../logo-loader', () => ({
  loadTeamLogo: jest.fn().mockResolvedValue(null),
  clearLogoCache: jest.fn(),
}))

const TEST_CONFIG: DisplayConfig = {
  width: 64,
  height: 32,
  brightness: 75,
  logo_variant: 'small',
  live_layout: 'stacked',
}

describe('Client-Side Preview Integration Tests (Un-Mocked)', () => {
  let canvas: HTMLCanvasElement

  beforeEach(() => {
    canvas = document.createElement('canvas')
    canvas.width = TEST_CONFIG.width
    canvas.height = TEST_CONFIG.height
  })

  describe('ClientDisplay', () => {
    it('creates a display with correct dimensions', () => {
      const display = new ClientDisplay(TEST_CONFIG, canvas)
      const ctx = display.getContext()

      expect(display.getCanvas()).toBe(canvas)
      expect(ctx).toBeTruthy()
      expect(canvas.width).toBe(64)
      expect(canvas.height).toBe(32)
    })

    it('generates data URL output', () => {
      const display = new ClientDisplay(TEST_CONFIG, canvas)
      const dataUrl = display.toDataURL()

      expect(dataUrl).toMatch(/^data:image\/png;base64,/)
    })

    it('clears canvas to specified color', () => {
      const display = new ClientDisplay(TEST_CONFIG, canvas)
      display.clear(255, 0, 0)

      const ctx = display.getContext()
      expect(ctx.fillStyle).toBe('#ff0000')
    })
  })

  describe('Scene Rendering (Real Implementation)', () => {
    it('renders idle scene without errors', () => {
      const display = new ClientDisplay(TEST_CONFIG, canvas)

      expect(() => {
        renderIdleScene(display)
      }).not.toThrow()

      const dataUrl = display.toDataURL()
      expect(dataUrl).toMatch(/^data:image\/png;base64,/)
    })

    it('renders pregame scene without errors', () => {
      const display = new ClientDisplay(TEST_CONFIG, canvas)
      const snapshot = createDemoPregameSnapshot()

      expect(() => {
        renderPregameScene(display, snapshot)
      }).not.toThrow()

      const dataUrl = display.toDataURL()
      expect(dataUrl).toMatch(/^data:image\/png;base64,/)
    })

    it('renders live scene without errors', async () => {
      const display = new ClientDisplay(TEST_CONFIG, canvas)
      const snapshot = createDemoLiveSnapshot()

      await expect(renderLiveScene(display, snapshot, false)).resolves.not.toThrow()

      const dataUrl = display.toDataURL()
      expect(dataUrl).toMatch(/^data:image\/png;base64,/)
    })

    it('renders live big logos scene without errors', async () => {
      const display = new ClientDisplay(TEST_CONFIG, canvas)
      const snapshot = createDemoLiveSnapshot()

      await expect(renderLiveScene(display, snapshot, true)).resolves.not.toThrow()

      const dataUrl = display.toDataURL()
      expect(dataUrl).toMatch(/^data:image\/png;base64,/)
    })

    it('renders final scene without errors', () => {
      const display = new ClientDisplay(TEST_CONFIG, canvas)
      const snapshot = createDemoFinalSnapshot()

      expect(() => {
        renderFinalScene(display, snapshot)
      }).not.toThrow()

      const dataUrl = display.toDataURL()
      expect(dataUrl).toMatch(/^data:image\/png;base64,/)
    })
  })

  describe('ClientPreviewGenerator Integration', () => {
    it('generates idle preview', async () => {
      const generator = new ClientPreviewGenerator()
      const dataUrl = await generator.generatePreview(TEST_CONFIG, null, canvas)

      expect(dataUrl).toMatch(/^data:image\/png;base64,/)
    })

    it('generates pregame preview', async () => {
      const generator = new ClientPreviewGenerator()
      const snapshot = createDemoPregameSnapshot()

      const dataUrl = await generator.generatePreview(TEST_CONFIG, snapshot, canvas)

      expect(dataUrl).toMatch(/^data:image\/png;base64,/)
      expect(snapshot.state).toBe(GameState.PRE)
    })

    it('generates live preview with stacked layout', async () => {
      const generator = new ClientPreviewGenerator()
      const snapshot = createDemoLiveSnapshot()

      const dataUrl = await generator.generatePreview(TEST_CONFIG, snapshot, canvas)

      expect(dataUrl).toMatch(/^data:image\/png;base64,/)
      expect(snapshot.state).toBe(GameState.LIVE)
    })

    it('generates live preview with big logos layout', async () => {
      const generator = new ClientPreviewGenerator()
      const snapshot = createDemoLiveSnapshot()
      const config = { ...TEST_CONFIG, live_layout: 'big-logos' as const }

      const dataUrl = await generator.generatePreview(config, snapshot, canvas)

      expect(dataUrl).toMatch(/^data:image\/png;base64,/)
      expect(snapshot.state).toBe(GameState.LIVE)
    })

    it('generates final preview', async () => {
      const generator = new ClientPreviewGenerator()
      const snapshot = createDemoFinalSnapshot()

      const dataUrl = await generator.generatePreview(TEST_CONFIG, snapshot, canvas)

      expect(dataUrl).toMatch(/^data:image\/png;base64,/)
      expect(snapshot.state).toBe(GameState.FINAL)
    })

    it('can generate multiple scenes without error', async () => {
      const generator = new ClientPreviewGenerator()

      await expect(generator.generatePreview(TEST_CONFIG, null, canvas)).resolves.toMatch(
        /^data:image\/png;base64,/
      )

      const liveCanvas = document.createElement('canvas')
      liveCanvas.width = TEST_CONFIG.width
      liveCanvas.height = TEST_CONFIG.height

      await expect(
        generator.generatePreview(TEST_CONFIG, createDemoLiveSnapshot(), liveCanvas)
      ).resolves.toMatch(/^data:image\/png;base64,/)
    })
  })

  describe('Demo Data Validation', () => {
    it('pregame snapshot has correct structure', () => {
      const snapshot = createDemoPregameSnapshot()

      expect(snapshot.state).toBe(GameState.PRE)
      expect(snapshot.home.abbr).toBe('PHX')
      expect(snapshot.away.abbr).toBe('LA')
      expect(snapshot.status_detail).toBeTruthy()
    })

    it('live snapshot has correct structure', () => {
      const snapshot = createDemoLiveSnapshot()

      expect(snapshot.state).toBe(GameState.LIVE)
      expect(snapshot.home.score).toBeGreaterThan(0)
      expect(snapshot.away.score).toBeGreaterThan(0)
      expect(snapshot.display_clock).toBeTruthy()
      expect(snapshot.period_name).toBeTruthy()
    })

    it('final snapshot has correct structure', () => {
      const snapshot = createDemoFinalSnapshot()

      expect(snapshot.state).toBe(GameState.FINAL)
      expect(snapshot.home.score).toBeGreaterThan(0)
      expect(snapshot.away.score).toBeGreaterThan(0)
    })
  })
})
