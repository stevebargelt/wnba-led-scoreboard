import { ClientDisplay } from './display'
import { renderIdleScene, renderPregameScene, renderLiveScene, renderFinalScene } from './scenes'
import { DisplayConfig, GameSnapshot, GameState } from '../canvas/types'

export class ClientPreviewGenerator {
  async generatePreview(
    config: DisplayConfig,
    snapshot: GameSnapshot | null,
    existingCanvas?: HTMLCanvasElement
  ): Promise<string> {
    const display = new ClientDisplay(config, existingCanvas)

    if (!snapshot) {
      renderIdleScene(display)
      return display.toDataURL()
    }

    const bigLogos = config.live_layout === 'big-logos'

    switch (snapshot.state) {
      case GameState.PRE:
        await renderPregameScene(display, snapshot)
        break

      case GameState.LIVE:
        await renderLiveScene(display, snapshot, bigLogos)
        break

      case GameState.FINAL:
        await renderFinalScene(display, snapshot)
        break

      default:
        renderIdleScene(display)
    }

    return display.toDataURL()
  }
}
