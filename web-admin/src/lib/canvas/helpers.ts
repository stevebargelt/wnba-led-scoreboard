import { Image } from 'canvas'
import { CanvasDisplay } from './display'
import { GameSnapshot } from './types'

export function drawRightAlignedText(
  display: CanvasDisplay,
  text: string,
  rightX: number,
  y: number,
  fontSize: number,
  fontFamily: string = 'monospace',
  color: string = '#FFFFFF'
): void {
  const textWidth = display.getTextWidth(text, fontSize, fontFamily)
  display.drawText(text, rightX - textWidth, y, fontSize, fontFamily, color)
}

export function drawCenterAlignedText(
  display: CanvasDisplay,
  text: string,
  canvasWidth: number,
  y: number,
  fontSize: number,
  fontFamily: string = 'monospace',
  color: string = '#FFFFFF'
): void {
  const textWidth = display.getTextWidth(text, fontSize, fontFamily)
  const x = Math.floor((canvasWidth - textWidth) / 2)
  display.drawText(text, x, y, fontSize, fontFamily, color)
}

export function drawLogoOrPlaceholder(
  display: CanvasDisplay,
  logo: Image | null,
  x: number,
  y: number,
  width: number,
  height: number,
  placeholderColor: string = 'rgb(100, 100, 100)'
): void {
  if (logo) {
    display.drawImage(logo, x, y, width, height)
  } else {
    display.drawRectangle(x, y, width, height, undefined, placeholderColor, 1)
  }
}

export function getSportCode(snapshot: GameSnapshot): string {
  return snapshot.sport.id
}

export function getLeagueCode(snapshot: GameSnapshot): string {
  return snapshot.league.id
}
