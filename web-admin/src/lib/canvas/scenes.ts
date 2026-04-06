import { CanvasDisplay } from './display'
import { GameSnapshot, GameState } from './types'

export function renderIdleScene(display: CanvasDisplay): void {
  display.clear(0, 0, 0)

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: '2-digit',
    day: '2-digit',
  })
  const msg = `${dateStr} - No games`

  display.drawText(msg.slice(0, 20), 1, 1, 8, 'monospace', 'rgb(180, 180, 180)')
}

export function renderPregameScene(display: CanvasDisplay, snapshot: GameSnapshot): void {
  display.clear(0, 0, 0)

  const w = display.getCanvas().width
  const h = display.getCanvas().height

  const awayAbbr = snapshot.away.abbr.slice(0, 4)
  const homeAbbr = snapshot.home.abbr.slice(0, 4)

  display.drawRectangle(1, 1, 10, 10, undefined, 'rgb(100, 100, 100)', 1)
  display.drawText(awayAbbr, 13, 2, 8, 'monospace', 'rgb(200, 200, 200)')

  display.drawRectangle(1, 13, 10, 10, undefined, 'rgb(100, 100, 100)', 1)
  display.drawText(homeAbbr, 13, 14, 8, 'monospace', 'rgb(200, 200, 200)')

  const status = snapshot.status_detail || 'Soon'
  const statusWidth = display.getTextWidth(status, 8)
  display.drawText(
    status,
    Math.floor((w - statusWidth) / 2),
    h - 9,
    8,
    'monospace',
    'rgb(255, 255, 0)'
  )
}

export function renderLiveScene(
  display: CanvasDisplay,
  snapshot: GameSnapshot,
  bigLogos: boolean = false
): void {
  display.clear(0, 0, 0)

  const w = display.getCanvas().width
  const h = display.getCanvas().height

  if (bigLogos) {
    renderLiveBigLogos(display, snapshot, w, h)
  } else {
    renderLiveStacked(display, snapshot, w, h)
  }
}

function renderLiveStacked(
  display: CanvasDisplay,
  snapshot: GameSnapshot,
  w: number,
  h: number
): void {
  const rowH = 12
  const topY = 1
  const botY = topY + rowH
  const logoX = 1
  const abbrX = 13
  const scoreRightX = w - 1

  display.drawRectangle(logoX, topY, 10, 10, undefined, 'rgb(100, 100, 100)', 1)
  display.drawText(
    snapshot.away.abbr.slice(0, 4),
    abbrX,
    topY + 1,
    8,
    'monospace',
    'rgb(200, 200, 200)'
  )
  const awayScore = String(snapshot.away.score)
  const awayScoreWidth = display.getTextWidth(awayScore, 10)
  display.drawText(
    awayScore,
    scoreRightX - awayScoreWidth,
    topY,
    10,
    'monospace',
    'rgb(255, 255, 255)'
  )

  display.drawRectangle(logoX, botY, 10, 10, undefined, 'rgb(100, 100, 100)', 1)
  display.drawText(
    snapshot.home.abbr.slice(0, 4),
    abbrX,
    botY + 1,
    8,
    'monospace',
    'rgb(200, 200, 200)'
  )
  const homeScore = String(snapshot.home.score)
  const homeScoreWidth = display.getTextWidth(homeScore, 10)
  display.drawText(
    homeScore,
    scoreRightX - homeScoreWidth,
    botY,
    10,
    'monospace',
    'rgb(255, 255, 255)'
  )

  const status = `${snapshot.period_name} ${snapshot.display_clock || ''}`.trim()
  const statusWidth = display.getTextWidth(status, 8)
  display.drawText(
    status,
    Math.floor((w - statusWidth) / 2),
    h - 9,
    8,
    'monospace',
    'rgb(0, 255, 0)'
  )
}

function renderLiveBigLogos(
  display: CanvasDisplay,
  snapshot: GameSnapshot,
  w: number,
  h: number
): void {
  const centerX = Math.floor(w / 2)
  const logoSize = 20
  const logoY = 2

  display.drawRectangle(
    centerX - logoSize - 2,
    logoY,
    logoSize,
    logoSize,
    undefined,
    'rgb(100, 100, 100)',
    1
  )
  display.drawRectangle(centerX + 2, logoY, logoSize, logoSize, undefined, 'rgb(100, 100, 100)', 1)

  display.drawText(
    snapshot.away.abbr.slice(0, 3),
    centerX - logoSize,
    logoY + logoSize + 2,
    8,
    'monospace',
    'rgb(200, 200, 200)',
    'center'
  )
  display.drawText(
    snapshot.home.abbr.slice(0, 3),
    centerX + logoSize / 2,
    logoY + logoSize + 2,
    8,
    'monospace',
    'rgb(200, 200, 200)',
    'center'
  )

  const awayScore = String(snapshot.away.score)
  const homeScore = String(snapshot.home.score)
  const scoreText = `${awayScore} - ${homeScore}`
  const scoreWidth = display.getTextWidth(scoreText, 10)
  display.drawText(
    scoreText,
    Math.floor((w - scoreWidth) / 2),
    h - 12,
    10,
    'monospace',
    'rgb(255, 255, 255)'
  )

  const status = `${snapshot.period_name} ${snapshot.display_clock || ''}`.trim()
  const statusWidth = display.getTextWidth(status, 8)
  display.drawText(
    status,
    Math.floor((w - statusWidth) / 2),
    h - 4,
    8,
    'monospace',
    'rgb(0, 255, 0)'
  )
}

export function renderFinalScene(display: CanvasDisplay, snapshot: GameSnapshot): void {
  display.clear(0, 0, 0)

  const w = display.getCanvas().width
  const h = display.getCanvas().height

  const rowH = 12
  const topY = 1
  const botY = topY + rowH
  const logoX = 1
  const abbrX = 13
  const scoreRightX = w - 1

  display.drawRectangle(logoX, topY, 10, 10, undefined, 'rgb(100, 100, 100)', 1)
  display.drawText(
    snapshot.away.abbr.slice(0, 4),
    abbrX,
    topY + 1,
    8,
    'monospace',
    'rgb(200, 200, 200)'
  )
  const awayScore = String(snapshot.away.score)
  const awayScoreWidth = display.getTextWidth(awayScore, 10)
  display.drawText(
    awayScore,
    scoreRightX - awayScoreWidth,
    topY,
    10,
    'monospace',
    'rgb(255, 255, 255)'
  )

  display.drawRectangle(logoX, botY, 10, 10, undefined, 'rgb(100, 100, 100)', 1)
  display.drawText(
    snapshot.home.abbr.slice(0, 4),
    abbrX,
    botY + 1,
    8,
    'monospace',
    'rgb(200, 200, 200)'
  )
  const homeScore = String(snapshot.home.score)
  const homeScoreWidth = display.getTextWidth(homeScore, 10)
  display.drawText(
    homeScore,
    scoreRightX - homeScoreWidth,
    botY,
    10,
    'monospace',
    'rgb(255, 255, 255)'
  )

  const status = 'Final'
  const statusWidth = display.getTextWidth(status, 8)
  display.drawText(
    status,
    Math.floor((w - statusWidth) / 2),
    h - 9,
    8,
    'monospace',
    'rgb(255, 0, 0)'
  )
}
