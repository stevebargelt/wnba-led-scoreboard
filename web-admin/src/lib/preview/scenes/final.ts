import { createCanvas, Canvas, CanvasRenderingContext2D } from 'canvas'
import { loadTeamLogo, LogoVariant } from '../logos'
import { getFontManager } from '../fonts'

export interface TeamInfo {
  id: string
  name: string
  abbr: string
  score: number
}

export interface Sport {
  id: string
  name: string
  code?: string
}

export interface GameSnapshot {
  sport: Sport
  home: TeamInfo
  away: TeamInfo
}

export interface FinalSceneOptions {
  width?: number
  height?: number
  logoVariant?: LogoVariant
}

export async function drawFinalScene(
  snapshot: GameSnapshot,
  options: FinalSceneOptions = {}
): Promise<Canvas> {
  const { width = 64, height = 32, logoVariant = 'mini' } = options

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const fontManager = getFontManager()

  ctx.fillStyle = 'rgb(0, 0, 0)'
  ctx.fillRect(0, 0, width, height)

  const rowH = 12
  const topY = 1
  const botY = topY + rowH
  const logoX = 1
  const abbrX = 13
  const scoreRightX = width - 1

  ctx.fillStyle = 'rgb(255, 80, 80)'
  ctx.font = fontManager.getSmallFont()
  ctx.textBaseline = 'top'
  ctx.fillText('FINAL', 1, 1)

  const sportCode = snapshot.sport.code || snapshot.sport.id

  const awayLogo = await loadTeamLogo({
    teamId: snapshot.away.id,
    abbr: snapshot.away.abbr,
    sport: sportCode,
    variant: logoVariant,
  })

  if (awayLogo) {
    ctx.drawImage(awayLogo, logoX, topY, 10, 10)
  } else {
    ctx.strokeStyle = 'rgb(100, 100, 100)'
    ctx.lineWidth = 1
    ctx.strokeRect(logoX, topY, 10, 10)
  }

  ctx.fillStyle = 'rgb(200, 200, 200)'
  ctx.font = fontManager.getSmallFont()
  ctx.fillText(snapshot.away.abbr.slice(0, 4), abbrX, topY + 1)

  const awayScore = String(snapshot.away.score)
  ctx.font = fontManager.getScoreLargeFont()
  const awayScoreWidth = ctx.measureText(awayScore).width
  ctx.fillStyle = 'rgb(255, 255, 255)'
  ctx.fillText(awayScore, scoreRightX - awayScoreWidth, topY)

  const homeLogo = await loadTeamLogo({
    teamId: snapshot.home.id,
    abbr: snapshot.home.abbr,
    sport: sportCode,
    variant: logoVariant,
  })

  if (homeLogo) {
    ctx.drawImage(homeLogo, logoX, botY, 10, 10)
  } else {
    ctx.strokeStyle = 'rgb(100, 100, 100)'
    ctx.lineWidth = 1
    ctx.strokeRect(logoX, botY, 10, 10)
  }

  ctx.fillStyle = 'rgb(200, 200, 200)'
  ctx.font = fontManager.getSmallFont()
  ctx.fillText(snapshot.home.abbr.slice(0, 4), abbrX, botY + 1)

  const homeScore = String(snapshot.home.score)
  ctx.font = fontManager.getScoreLargeFont()
  const homeScoreWidth = ctx.measureText(homeScore).width
  ctx.fillStyle = 'rgb(255, 255, 255)'
  ctx.fillText(homeScore, scoreRightX - homeScoreWidth, botY)

  return canvas
}
