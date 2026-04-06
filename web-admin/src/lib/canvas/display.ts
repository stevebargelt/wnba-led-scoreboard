import { createCanvas, Canvas, CanvasRenderingContext2D } from 'canvas'
import { GameSnapshot, DisplayConfig } from './types'

export class CanvasDisplay {
  private canvas: Canvas
  private ctx: CanvasRenderingContext2D
  private config: DisplayConfig

  constructor(config: DisplayConfig) {
    this.config = config
    this.canvas = createCanvas(config.width, config.height)
    this.ctx = this.canvas.getContext('2d')
  }

  clear(r: number = 0, g: number = 0, b: number = 0): void {
    this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
    this.ctx.fillRect(0, 0, this.config.width, this.config.height)
  }

  drawRectangle(
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor?: string,
    strokeColor?: string,
    strokeWidth?: number
  ): void {
    if (fillColor) {
      this.ctx.fillStyle = fillColor
      this.ctx.fillRect(x, y, width, height)
    }
    if (strokeColor && strokeWidth) {
      this.ctx.strokeStyle = strokeColor
      this.ctx.lineWidth = strokeWidth
      this.ctx.strokeRect(x, y, width, height)
    }
  }

  drawText(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    fontFamily: string = 'monospace',
    color: string = '#FFFFFF',
    align: 'left' | 'center' | 'right' = 'left'
  ): void {
    this.ctx.font = `${fontSize}px ${fontFamily}`
    this.ctx.fillStyle = color
    this.ctx.textAlign = align
    this.ctx.textBaseline = 'top'
    this.ctx.fillText(text, x, y)
  }

  getTextWidth(text: string, fontSize: number, fontFamily: string = 'monospace'): number {
    this.ctx.font = `${fontSize}px ${fontFamily}`
    return this.ctx.measureText(text).width
  }

  getCanvas(): Canvas {
    return this.canvas
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx
  }

  toBuffer(): Buffer {
    return this.canvas.toBuffer('image/png')
  }
}
