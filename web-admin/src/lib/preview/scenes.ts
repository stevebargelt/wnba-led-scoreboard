import { ClientDisplay } from './display'
import { loadTeamLogo } from './logos'
import { FONT_SMALL, FONT_LARGE } from './fonts'
import { GameSnapshot } from './types'

function _formatStartTime(date: Date): string {
  let hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${String(minutes).padStart(2, '0')} ${ampm}`
}

export function renderIdleScene(display: ClientDisplay): void {
  display.clear(0, 0, 0)

  const now = new Date()
  const weekday = now.toLocaleDateString('en-US', { weekday: 'short' })
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const msg = `${weekday} ${month}/${day} — No games`

  display.drawText(msg.slice(0, 20), 1, 1, 8, FONT_SMALL, 'rgb(180, 180, 180)')
}

export async function renderLiveStacked(display: ClientDisplay, snapshot: GameSnapshot): Promise<void> {
  display.clear(0, 0, 0)

  const canvas = display.getCanvas()
  const w = canvas.width
  const h = canvas.height

  const rowH = 12
  const topY = 1
  const botY = topY + rowH
  const logoX = 1
  const abbrX = 13
  const scoreRightX = w - 1

  // Away row
  const awayLogo = await loadTeamLogo(snapshot.away.id, snapshot.away.abbr, snapshot.sport.code, 'mini')
  if (awayLogo) {
    display.drawImage(awayLogo, logoX, topY, 10, 10)
  } else {
    display.drawRectangle(logoX, topY, 10, 10, undefined, 'rgb(100, 100, 100)')
  }
  display.drawText(snapshot.away.abbr.slice(0, 4), abbrX, topY + 1, 8, FONT_SMALL, 'rgb(200, 200, 200)')
  const awayScore = String(snapshot.away.score)
  const awayScoreX = scoreRightX - display.getTextWidth(awayScore, 12, FONT_LARGE)
  display.drawText(awayScore, awayScoreX, topY, 12, FONT_LARGE, 'rgb(255, 255, 255)')

  // Home row
  const homeLogo = await loadTeamLogo(snapshot.home.id, snapshot.home.abbr, snapshot.sport.code, 'mini')
  if (homeLogo) {
    display.drawImage(homeLogo, logoX, botY, 10, 10)
  } else {
    display.drawRectangle(logoX, botY, 10, 10, undefined, 'rgb(100, 100, 100)')
  }
  display.drawText(snapshot.home.abbr.slice(0, 4), abbrX, botY + 1, 8, FONT_SMALL, 'rgb(200, 200, 200)')
  const homeScore = String(snapshot.home.score)
  const homeScoreX = scoreRightX - display.getTextWidth(homeScore, 12, FONT_LARGE)
  display.drawText(homeScore, homeScoreX, botY, 12, FONT_LARGE, 'rgb(255, 255, 255)')

  // Status line (bottom center)
  const statusText = `${snapshot.period_name} ${snapshot.display_clock}`.trim()
  const statusWidth = display.getTextWidth(statusText, 8, FONT_SMALL)
  const statusX = Math.floor((w - statusWidth) / 2)
  const statusY = h - 9
  display.drawText(statusText, statusX, statusY, 8, FONT_SMALL, 'rgb(0, 255, 0)')
}

export async function renderPregameScene(display: ClientDisplay, snapshot: GameSnapshot): Promise<void> {
  display.clear(0, 0, 0)

  const canvas = display.getCanvas()
  const w = canvas.width
  const h = canvas.height

  const topY = 2
  const logoSize = 10

  const awayLogo = await loadTeamLogo(snapshot.away.id, snapshot.away.abbr, snapshot.sport.code, 'mini')
  if (awayLogo) {
    display.drawImage(awayLogo, 2, topY, logoSize, logoSize)
  }

  const homeLogo = await loadTeamLogo(snapshot.home.id, snapshot.home.abbr, snapshot.sport.code, 'mini')
  if (homeLogo) {
    display.drawImage(homeLogo, w - logoSize - 2, topY, logoSize, logoSize)
  }

  display.drawText('VS', Math.floor(w / 2) - 6, topY + 1, 8, FONT_SMALL, 'rgb(200, 200, 200)')

  const secs = Math.max(0, snapshot.seconds_to_start)
  const hh = Math.floor(secs / 3600)
  const mm = Math.floor((secs % 3600) / 60)
  const ss = secs % 60
  let ctext: string
  if (hh > 0) {
    ctext = `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  } else {
    ctext = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  }
  const countdownWidth = display.getTextWidth(ctext, 12, FONT_LARGE)
  const countdownH = 10
  const countdownX = Math.floor((w - countdownWidth) / 2)
  const countdownY = Math.floor((h - countdownH) / 2)
  display.drawText(ctext, countdownX, countdownY, 12, FONT_LARGE, 'rgb(255, 200, 0)')

  const startTime = _formatStartTime(snapshot.start_time_local)
  display.drawText(startTime, 1, h - 9, 8, FONT_SMALL, 'rgb(150, 150, 150)')
}

export async function renderFinalScene(display: ClientDisplay, snapshot: GameSnapshot): Promise<void> {
  display.clear(0, 0, 0)

  const canvas = display.getCanvas()
  const w = canvas.width

  display.drawText('FINAL', 1, 1, 8, FONT_SMALL, 'rgb(255, 80, 80)')

  const topY = 1
  const botY = topY + 12
  const logoX = 1
  const abbrX = 13
  const scoreRightX = w - 1

  const awayLogo = await loadTeamLogo(snapshot.away.id, snapshot.away.abbr, snapshot.sport.code, 'mini')
  if (awayLogo) {
    display.drawImage(awayLogo, logoX, topY, 10, 10)
  } else {
    display.drawRectangle(logoX, topY, 10, 10, undefined, 'rgb(100, 100, 100)')
  }
  display.drawText(snapshot.away.abbr.slice(0, 4), abbrX, topY + 1, 8, FONT_SMALL, 'rgb(200, 200, 200)')
  const awayScore = String(snapshot.away.score)
  const awayScoreX = scoreRightX - display.getTextWidth(awayScore, 12, FONT_LARGE)
  display.drawText(awayScore, awayScoreX, topY, 12, FONT_LARGE, 'rgb(255, 255, 255)')

  const homeLogo = await loadTeamLogo(snapshot.home.id, snapshot.home.abbr, snapshot.sport.code, 'mini')
  if (homeLogo) {
    display.drawImage(homeLogo, logoX, botY, 10, 10)
  } else {
    display.drawRectangle(logoX, botY, 10, 10, undefined, 'rgb(100, 100, 100)')
  }
  display.drawText(snapshot.home.abbr.slice(0, 4), abbrX, botY + 1, 8, FONT_SMALL, 'rgb(200, 200, 200)')
  const homeScore = String(snapshot.home.score)
  const homeScoreX = scoreRightX - display.getTextWidth(homeScore, 12, FONT_LARGE)
  display.drawText(homeScore, homeScoreX, botY, 12, FONT_LARGE, 'rgb(255, 255, 255)')
}

export async function renderLiveBigLogos(display: ClientDisplay, snapshot: GameSnapshot): Promise<void> {
  display.clear(0, 0, 0)

  const canvas = display.getCanvas()
  const w = canvas.width
  const h = canvas.height

  const statusText = `${snapshot.period_name} ${snapshot.display_clock}`.trim()
  const statusWidth = display.getTextWidth(statusText, 8, FONT_SMALL)
  const statusX = Math.floor((w - statusWidth) / 2)
  display.drawText(statusText, statusX, 0, 8, FONT_SMALL, 'rgb(150, 150, 150)')

  const yLogoTop = 1 + 8  // 1 + approximate FONT_SMALL text height
  const desiredLogoH = h > 32 ? 20 : 16

  const homeLogo = await loadTeamLogo(snapshot.home.id, snapshot.home.abbr, snapshot.sport.code, 'banner')
  if (homeLogo) {
    display.drawImage(homeLogo, 1, yLogoTop, desiredLogoH, desiredLogoH)
  } else {
    display.drawRectangle(1, yLogoTop, desiredLogoH, desiredLogoH, undefined, 'rgb(100, 100, 100)')
  }

  const awayLogo = await loadTeamLogo(snapshot.away.id, snapshot.away.abbr, snapshot.sport.code, 'banner')
  if (awayLogo) {
    display.drawImage(awayLogo, w - desiredLogoH - 2, yLogoTop, desiredLogoH, desiredLogoH)
  } else {
    display.drawRectangle(w - desiredLogoH - 2, yLogoTop, desiredLogoH, desiredLogoH, undefined, 'rgb(100, 100, 100)')
  }

  const yAbbr = h - 9
  display.drawText(snapshot.home.abbr.slice(0, 4), 1, yAbbr, 8, FONT_SMALL, 'rgb(200, 200, 200)')
  const awayAbbrWidth = display.getTextWidth(snapshot.away.abbr.slice(0, 4), 8, FONT_SMALL)
  display.drawText(snapshot.away.abbr.slice(0, 4), w - awayAbbrWidth - 2, yAbbr, 8, FONT_SMALL, 'rgb(200, 200, 200)')

  const homeScore = String(snapshot.home.score)
  const awayScore = String(snapshot.away.score)
  const forceSmall = h <= 32 || homeScore.length > 2 || awayScore.length > 2
  const scoreFontSize = forceSmall ? 8 : 12
  const scoreFont = forceSmall ? FONT_SMALL : FONT_LARGE
  const scoreFontH = forceSmall ? 8 : 10

  const logoMidY = yLogoTop + Math.floor(desiredLogoH / 2)
  const scoreY = logoMidY - Math.floor(scoreFontH / 2)

  const centerX = Math.floor(w / 2)
  const gap = 1
  const homeScoreWidth = display.getTextWidth(homeScore, scoreFontSize, scoreFont)
  display.drawText(homeScore, centerX - gap - homeScoreWidth, scoreY, scoreFontSize, scoreFont, 'rgb(255, 255, 255)')
  display.drawText(awayScore, centerX + gap, scoreY, scoreFontSize, scoreFont, 'rgb(255, 255, 255)')
}
