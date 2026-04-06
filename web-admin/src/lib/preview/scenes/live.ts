import { Canvas, CanvasRenderingContext2D } from 'canvas'
import { GameSnapshot } from '../../canvas/types'
import { loadTeamLogo } from '../logos'

export interface DrawLiveOptions {
  canvas: Canvas
  ctx: CanvasRenderingContext2D
  snapshot: GameSnapshot
  nowLocal: Date
  fontSmall: string
  fontLarge: string
  logoVariant?: 'mini' | 'small' | 'banner'
}

export async function drawLive(options: DrawLiveOptions): Promise<void> {
  const { canvas, ctx, snapshot, fontSmall, fontLarge, logoVariant = 'mini' } = options

  const w = canvas.width
  const h = canvas.height

  const rowH = 12
  const topY = 1
  const botY = topY + rowH
  const logoX = 1
  const abbrX = 13
  const scoreRightX = w - 1

  const sportCode = snapshot.sport.id

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

  ctx.font = fontSmall
  ctx.fillStyle = 'rgb(200, 200, 200)'
  ctx.textBaseline = 'top'
  ctx.fillText(snapshot.away.abbr.slice(0, 4), abbrX, topY + 1)

  const awayScore = String(snapshot.away.score)
  ctx.font = fontLarge
  ctx.fillStyle = 'rgb(255, 255, 255)'
  const awayScoreWidth = ctx.measureText(awayScore).width
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

  ctx.font = fontSmall
  ctx.fillStyle = 'rgb(200, 200, 200)'
  ctx.fillText(snapshot.home.abbr.slice(0, 4), abbrX, botY + 1)

  const homeScore = String(snapshot.home.score)
  ctx.font = fontLarge
  ctx.fillStyle = 'rgb(255, 255, 255)'
  const homeScoreWidth = ctx.measureText(homeScore).width
  ctx.fillText(homeScore, scoreRightX - homeScoreWidth, botY)

  const status = `${snapshot.period_name} ${snapshot.display_clock || ''}`.trim()
  ctx.font = fontSmall
  ctx.fillStyle = 'rgb(0, 255, 0)'
  const statusWidth = ctx.measureText(status).width
  const statusHeight = 8
  ctx.fillText(status, Math.floor((w - statusWidth) / 2), h - statusHeight - 1)
}
