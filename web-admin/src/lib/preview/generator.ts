import { CanvasDisplay } from '../canvas/display'
import {
  renderIdleScene,
  renderPregameScene,
  renderLiveScene,
  renderFinalScene,
} from '../canvas/scenes'
import {
  createDemoPregameSnapshot,
  createDemoLiveSnapshot,
  createDemoFinalSnapshot,
} from '../canvas/demo-data'
import { DeviceConfiguration, DisplayConfig, GameSnapshot } from '../canvas/types'

export interface PreviewGeneratorConfig {
  outputDir?: string
}

export class PreviewGenerator {
  private config: DeviceConfiguration
  private outputDir: string

  constructor(config: DeviceConfiguration, options: PreviewGeneratorConfig = {}) {
    this.config = config
    this.outputDir = options.outputDir || 'out/preview'
  }

  private createDisplayConfig(): DisplayConfig {
    return {
      width: this.config.matrix_config.width,
      height: this.config.matrix_config.height,
      brightness: this.config.matrix_config.brightness,
      logo_variant: this.config.render_config.logo_variant,
      live_layout: this.config.render_config.live_layout,
    }
  }

  generateIdleScene(): Buffer {
    const displayConfig = this.createDisplayConfig()
    const display = new CanvasDisplay(displayConfig)

    renderIdleScene(display)

    return display.toBuffer()
  }

  generatePregameScene(snapshot?: GameSnapshot): Buffer {
    const displayConfig = this.createDisplayConfig()
    const display = new CanvasDisplay(displayConfig)

    const gameSnapshot = snapshot || createDemoPregameSnapshot()
    renderPregameScene(display, gameSnapshot)

    return display.toBuffer()
  }

  async generateLiveScene(snapshot?: GameSnapshot, bigLogos?: boolean): Promise<Buffer> {
    const displayConfig = this.createDisplayConfig()
    const display = new CanvasDisplay(displayConfig)

    const gameSnapshot = snapshot || createDemoLiveSnapshot()
    const useBigLogos = bigLogos ?? this.config.render_config.live_layout === 'big-logos'

    await renderLiveScene(display, gameSnapshot, useBigLogos)

    return display.toBuffer()
  }

  generateFinalScene(snapshot?: GameSnapshot): Buffer {
    const displayConfig = this.createDisplayConfig()
    const display = new CanvasDisplay(displayConfig)

    const gameSnapshot = snapshot || createDemoFinalSnapshot()
    renderFinalScene(display, gameSnapshot)

    return display.toBuffer()
  }

  async generateAllScenes(): Promise<{
    idle: Buffer
    pregame: Buffer
    live: Buffer
    liveBig: Buffer
    final: Buffer
  }> {
    return {
      idle: this.generateIdleScene(),
      pregame: this.generatePregameScene(),
      live: await this.generateLiveScene(undefined, false),
      liveBig: await this.generateLiveScene(undefined, true),
      final: this.generateFinalScene(),
    }
  }
}
