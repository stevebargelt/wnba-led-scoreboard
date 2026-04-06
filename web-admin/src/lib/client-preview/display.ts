import { DisplayConfig } from '../canvas/types'

export class ClientDisplay {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private config: DisplayConfig

  constructor(config: DisplayConfig, existingCanvas?: HTMLCanvasElement) {
    this.config = config

    if (existingCanvas) {
      this.canvas = existingCanvas
      this.canvas.width = config.width
      this.canvas.height = config.height
    } else {
      this.canvas = document.createElement('canvas')
      this.canvas.width = config.width
      this.canvas.height = config.height
    }

    const ctx = this.canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas')
    }
    this.ctx = ctx
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

  drawImage(image: HTMLImageElement, x: number, y: number, width?: number, height?: number): void {
    if (width !== undefined && height !== undefined) {
      this.ctx.drawImage(image, x, y, width, height)
    } else {
      this.ctx.drawImage(image, x, y)
    }
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx
  }

  toDataURL(type: string = 'image/png'): string {
    return this.canvas.toDataURL(type)
  }
}
