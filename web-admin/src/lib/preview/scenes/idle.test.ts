import { createCanvas } from 'canvas'
import { IdleScene } from './idle'

describe('IdleScene', () => {
  let scene: IdleScene
  let canvas: ReturnType<typeof createCanvas>
  let ctx: ReturnType<typeof canvas.getContext>

  beforeEach(() => {
    scene = new IdleScene()
    canvas = createCanvas(64, 32)
    ctx = canvas.getContext('2d')
  })

  it('should return correct scene name', () => {
    expect(scene.getName()).toBe('idle')
  })

  it('should draw idle message with current time', () => {
    const testDate = new Date('2024-04-06T12:30:00')
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'

    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    scene.draw(canvas, ctx, null, testDate, fontSmall, fontLarge)

    expect(fillTextSpy).toHaveBeenCalledWith('Sat 04/06 - No games', 1, 1)
    expect(ctx.font).toBe(fontSmall)
    expect(ctx.fillStyle).toBe('#b4b4b4')
  })

  it('should truncate message to 20 characters', () => {
    const testDate = new Date('2024-04-06T12:30:00')
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'

    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    scene.draw(canvas, ctx, null, testDate, fontSmall, fontLarge)

    const call = fillTextSpy.mock.calls[0]
    const drawnText = call[0] as string
    expect(drawnText.length).toBeLessThanOrEqual(20)
  })

  it('should format date correctly', () => {
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'
    const fillTextSpy = jest.spyOn(ctx, 'fillText')

    const monday = new Date('2024-04-01T12:00:00')
    scene.draw(canvas, ctx, null, monday, fontSmall, fontLarge)
    expect(fillTextSpy).toHaveBeenCalledWith('Mon 04/01 - No games', 1, 1)

    const sunday = new Date('2024-04-07T12:00:00')
    scene.draw(canvas, ctx, null, sunday, fontSmall, fontLarge)
    expect(fillTextSpy).toHaveBeenCalledWith('Sun 04/07 - No games', 1, 1)
  })

  it('should use gray color rgb(180, 180, 180)', () => {
    const testDate = new Date('2024-04-06T12:30:00')
    const fontSmall = '8px monospace'
    const fontLarge = '10px monospace'

    scene.draw(canvas, ctx, null, testDate, fontSmall, fontLarge)

    expect(ctx.fillStyle).toBe('#b4b4b4')
  })
})
