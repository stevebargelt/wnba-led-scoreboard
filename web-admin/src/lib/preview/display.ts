import { DisplayConfig } from './types'

export class ClientDisplay {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private config: DisplayConfig

  constructor(config: DisplayConfig, canvas?: HTMLCanvasElement) {
    this.config = config
    if (canvas) {
      this.canvas = canvas
    } else {
      this.canvas = document.createElement('canvas')
    }
    this.canvas.width = config.width
    this.canvas.height = config.height
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2d context from canvas')
    this.ctx = ctx
  }

  clear(r: number, g: number, b: number): void {
    this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
    this.ctx.fillRect(0, 0, this.config.width, this.config.height)
  }

  drawText(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    fontFamily: string,
    color: string,
    align: CanvasTextAlign = 'left'
  ): void {
    this.ctx.font = `${fontSize}px ${fontFamily}`
    this.ctx.fillStyle = color
    this.ctx.textAlign = align
    this.ctx.textBaseline = 'top'
    this.ctx.fillText(text, x, y)
  }

  drawImage(image: HTMLImageElement, x: number, y: number, width?: number, height?: number): void {
    if (width !== undefined && height !== undefined) {
      this.ctx.drawImage(image, x, y, width, height)
    } else {
      this.ctx.drawImage(image, x, y)
    }
  }

  drawRectangle(
    x: number,
    y: number,
    w: number,
    h: number,
    fillColor?: string,
    strokeColor?: string,
    strokeWidth?: number
  ): void {
    if (fillColor) {
      this.ctx.fillStyle = fillColor
      this.ctx.fillRect(x, y, w, h)
    }
    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor
      this.ctx.lineWidth = strokeWidth ?? 1
      this.ctx.strokeRect(x, y, w, h)
    }
  }

  getTextWidth(text: string, fontSize: number, fontFamily?: string): number {
    this.ctx.font = `${fontSize}px ${fontFamily ?? 'monospace'}`
    return this.ctx.measureText(text).width
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx
  }

  toDataURL(type?: string): string {
    return this.canvas.toDataURL(type)
  }
}
