import { CanvasDisplay } from './display'
import { DisplayConfig, DeviceConfiguration } from './types'
import {
  renderIdleScene,
  renderPregameScene,
  renderLiveScene,
  renderFinalScene,
} from './scenes'
import {
  createDemoPregameSnapshot,
  createDemoLiveSnapshot,
  createDemoFinalSnapshot,
} from './demo-data'

export type SceneType = 'idle' | 'pregame' | 'live' | 'live_big' | 'final'

export class PreviewGenerator {
  private config: DisplayConfig

  constructor(deviceConfig: DeviceConfiguration) {
    this.config = {
      width: deviceConfig.matrix_config.width,
      height: deviceConfig.matrix_config.height,
      brightness: deviceConfig.matrix_config.brightness,
      logo_variant: deviceConfig.render_config.logo_variant,
      live_layout: deviceConfig.render_config.live_layout,
    }
  }

  async generatePreview(scene: SceneType): Promise<Buffer> {
    const display = new CanvasDisplay(this.config)

    switch (scene) {
      case 'idle':
        renderIdleScene(display)
        break
      case 'pregame':
        renderPregameScene(display, createDemoPregameSnapshot())
        break
      case 'live':
        await renderLiveScene(display, createDemoLiveSnapshot(), false)
        break
      case 'live_big':
        await renderLiveScene(display, createDemoLiveSnapshot(), true)
        break
      case 'final':
        renderFinalScene(display, createDemoFinalSnapshot())
        break
      default:
        await renderLiveScene(display, createDemoLiveSnapshot(), false)
    }

    return display.toBuffer()
  }
}
