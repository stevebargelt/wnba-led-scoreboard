import { ClientDisplay } from '../display'
import { DisplayConfig } from '../types'

const makeConfig = (overrides: Partial<DisplayConfig> = {}): DisplayConfig => ({
  width: 64,
  height: 32,
  brightness: 100,
  logo_variant: 'mini',
  live_layout: 'stacked',
  ...overrides,
})

describe('ClientDisplay', () => {
  it('creates a canvas with the configured dimensions', () => {
    const display = new ClientDisplay(makeConfig({ width: 64, height: 32 }))
    const canvas = display.getCanvas()
    expect(canvas.width).toBe(64)
    expect(canvas.height).toBe(32)
  })

  it('uses a provided canvas element', () => {
    const canvas = document.createElement('canvas')
    const display = new ClientDisplay(makeConfig(), canvas)
    expect(display.getCanvas()).toBe(canvas)
  })

  it('getContext returns CanvasRenderingContext2D', () => {
    const display = new ClientDisplay(makeConfig())
    const ctx = display.getContext()
    expect(ctx).toBeDefined()
  })

  it('clear fills the canvas with the specified color', () => {
    const display = new ClientDisplay(makeConfig())
    const ctx = display.getContext()
    display.clear(0, 0, 0)
    expect(ctx.fillStyle).toBe('#000000')
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 64, 32)
  })

  it('clear sets fillStyle to the given RGB values', () => {
    const display = new ClientDisplay(makeConfig())
    const ctx = display.getContext()
    display.clear(255, 128, 0)
    expect(ctx.fillStyle).toBe('#ff8000')
  })

  it('toDataURL returns a PNG data URL by default', () => {
    const display = new ClientDisplay(makeConfig())
    const url = display.toDataURL()
    expect(typeof url).toBe('string')
    expect(url.startsWith('data:')).toBe(true)
  })

  it('toDataURL passes the type argument to the canvas', () => {
    const display = new ClientDisplay(makeConfig())
    const canvas = display.getCanvas()
    const spy = jest.spyOn(canvas, 'toDataURL')
    display.toDataURL('image/jpeg')
    expect(spy).toHaveBeenCalledWith('image/jpeg')
  })

  it('drawText does not throw', () => {
    const display = new ClientDisplay(makeConfig())
    expect(() => {
      display.drawText('Hello', 10, 5, 8, 'monospace', 'rgb(255,255,255)')
    }).not.toThrow()
  })

  it('drawText sets font, fillStyle, textAlign, textBaseline, and calls fillText', () => {
    const display = new ClientDisplay(makeConfig())
    const ctx = display.getContext()
    display.drawText('Score', 0, 0, 12, 'ScoreLarge', 'white', 'center')
    expect(ctx.font).toBe('12px ScoreLarge')
    expect(ctx.fillStyle).toBe('#ffffff')
    expect(ctx.textAlign).toBe('center')
    expect(ctx.textBaseline).toBe('top')
    expect(ctx.fillText).toHaveBeenCalledWith('Score', 0, 0)
  })

  it('drawRectangle fills when fillColor is provided', () => {
    const display = new ClientDisplay(makeConfig())
    const ctx = display.getContext()
    display.drawRectangle(5, 5, 10, 10, 'red')
    expect(ctx.fillRect).toHaveBeenCalledWith(5, 5, 10, 10)
  })

  it('drawRectangle strokes when strokeColor is provided', () => {
    const display = new ClientDisplay(makeConfig())
    const ctx = display.getContext()
    display.drawRectangle(5, 5, 10, 10, undefined, 'blue', 2)
    expect(ctx.strokeRect).toHaveBeenCalledWith(5, 5, 10, 10)
    expect(ctx.lineWidth).toBe(2)
  })

  it('drawRectangle does not throw when no fill or stroke', () => {
    const display = new ClientDisplay(makeConfig())
    expect(() => {
      display.drawRectangle(0, 0, 5, 5)
    }).not.toThrow()
  })

  it('getTextWidth returns a number', () => {
    const display = new ClientDisplay(makeConfig())
    const width = display.getTextWidth('Test', 8, 'monospace')
    expect(typeof width).toBe('number')
  })

  it('getTextWidth uses monospace fallback when fontFamily is omitted', () => {
    const display = new ClientDisplay(makeConfig())
    const ctx = display.getContext()
    display.getTextWidth('Hi', 8)
    expect(ctx.font).toBe('8px monospace')
  })

  it('drawImage does not throw', () => {
    const display = new ClientDisplay(makeConfig())
    const img = new Image()
    expect(() => {
      display.drawImage(img, 0, 0)
    }).not.toThrow()
  })

  it('drawImage with dimensions calls drawImage with w/h', () => {
    const display = new ClientDisplay(makeConfig())
    const ctx = display.getContext()
    const img = new Image()
    display.drawImage(img, 2, 3, 10, 10)
    expect(ctx.drawImage).toHaveBeenCalledWith(img, 2, 3, 10, 10)
  })
})
