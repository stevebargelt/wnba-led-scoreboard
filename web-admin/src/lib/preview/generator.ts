import { ClientDisplay } from './display'
import {
  renderIdleScene,
  renderPregameScene,
  renderLiveStacked,
  renderFinalScene,
  renderLiveBigLogos,
} from './scenes'
import { DisplayConfig, GameSnapshot, GameState } from './types'

export class PreviewGenerator {
  async generatePreview(
    config: DisplayConfig,
    snapshot: GameSnapshot | null,
    canvas?: HTMLCanvasElement
  ): Promise<string> {
    const display = new ClientDisplay(config, canvas)

    if (!snapshot) {
      renderIdleScene(display)
      return display.toDataURL()
    }

    switch (snapshot.state) {
      case GameState.PRE:
        await renderPregameScene(display, snapshot)
        break
      case GameState.LIVE:
        if (config.live_layout === 'big-logos') {
          await renderLiveBigLogos(display, snapshot)
        } else {
          await renderLiveStacked(display, snapshot)
        }
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
