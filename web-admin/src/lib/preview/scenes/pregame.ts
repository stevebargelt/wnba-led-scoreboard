import { Canvas, CanvasRenderingContext2D } from 'canvas'
import { GameSnapshot } from '../../canvas/types'
import { loadTeamLogo, LogoVariant } from '../logos'

export interface Scene {
  draw(
    canvas: Canvas,
    ctx: CanvasRenderingContext2D,
    snapshot: GameSnapshot | null,
    currentTime: Date,
    fontSmall: string,
    fontLarge: string,
    ...kwargs: Record<string, unknown>[]
  ): Promise<void>
  getName(): string
}

const SPORT_START_TERMS: Record<string, string> = {
  basketball: 'Tip-Off',
  hockey: 'Puck Drop',
  baseball: 'First Pitch',
  football: 'Kickoff',
  soccer: 'Kickoff',
}

function getStartTerm(sportId: string): string {
  return SPORT_START_TERMS[sportId.toLowerCase()] || 'Start'
}

function formatCountdown(seconds: number): string {
  const secs = Math.max(0, seconds)
  const hh = Math.floor(secs / 3600)
  const mm = Math.floor((secs % 3600) / 60)
  const ss = secs % 60

  if (hh > 0) {
    return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  } else {
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  }
}

function formatStartTime(startTime: Date, sportId: string): string {
  const startTerm = getStartTerm(sportId)
  const hours = startTime.getHours()
  const minutes = startTime.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  const displayMinutes = String(minutes).padStart(2, '0')

  return `${startTerm} ${displayHours}:${displayMinutes} ${ampm}`
}

export class PregameScene implements Scene {
  async draw(
    canvas: Canvas,
    ctx: CanvasRenderingContext2D,
    snapshot: GameSnapshot | null,
    currentTime: Date,
    fontSmall: string,
    fontLarge: string,
    ...kwargs: Record<string, unknown>[]
  ): Promise<void> {
    if (!snapshot) {
      return
    }

    const w = canvas.width
    const h = canvas.height
    const topY = 2
    const logoVariant: LogoVariant = 'mini'

    ctx.fillStyle = 'rgb(0, 0, 0)'
    ctx.fillRect(0, 0, w, h)

    const sportCode = snapshot.sport.id

    const awayLogo = await loadTeamLogo({
      teamId: snapshot.away.id,
      abbr: snapshot.away.abbr,
      sport: sportCode,
      variant: logoVariant,
    })

    const homeLogo = await loadTeamLogo({
      teamId: snapshot.home.id,
      abbr: snapshot.home.abbr,
      sport: sportCode,
      variant: logoVariant,
    })

    if (awayLogo) {
      ctx.drawImage(awayLogo, 2, topY)
    }

    if (homeLogo) {
      const logoWidth = homeLogo.width
      ctx.drawImage(homeLogo, w - logoWidth - 2, topY)
    }

    ctx.font = fontSmall
    ctx.fillStyle = 'rgb(200, 200, 200)'
    ctx.textBaseline = 'top'
    ctx.fillText('VS', Math.floor(w / 2) - 6, topY + 1)

    const countdownText = formatCountdown(snapshot.seconds_to_start)
    ctx.font = fontLarge
    ctx.fillStyle = 'rgb(255, 200, 0)'
    const countdownWidth = ctx.measureText(countdownText).width
    ctx.fillText(countdownText, Math.floor((w - countdownWidth) / 2), Math.floor(h / 2) - 4)

    const startTimeText = formatStartTime(snapshot.start_time_local, sportCode)
    ctx.font = fontSmall
    ctx.fillStyle = 'rgb(150, 150, 150)'
    ctx.fillText(startTimeText, 1, h - 9)
  }

  getName(): string {
    return 'pregame'
  }
}
