import { Canvas, CanvasRenderingContext2D } from 'canvas'
import { GameSnapshot } from '../../canvas/types'

export interface Scene {
  draw(
    canvas: Canvas,
    ctx: CanvasRenderingContext2D,
    snapshot: GameSnapshot | null,
    currentTime: Date,
    fontSmall: string,
    fontLarge: string,
    ...kwargs: Record<string, unknown>[]
  ): void
  getName(): string
}

export class IdleScene implements Scene {
  draw(
    canvas: Canvas,
    ctx: CanvasRenderingContext2D,
    snapshot: GameSnapshot | null,
    currentTime: Date,
    fontSmall: string,
    fontLarge: string,
    ...kwargs: Record<string, unknown>[]
  ): void {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const day = dayNames[currentTime.getDay()]
    const month = String(currentTime.getMonth() + 1).padStart(2, '0')
    const date = String(currentTime.getDate()).padStart(2, '0')

    const msg = `${day} ${month}/${date} - No games`
    const truncatedMsg = msg.slice(0, 20)

    ctx.font = fontSmall
    ctx.fillStyle = 'rgb(180, 180, 180)'
    ctx.textBaseline = 'top'
    ctx.fillText(truncatedMsg, 1, 1)
  }

  getName(): string {
    return 'idle'
  }
}
