import { createCanvas, Canvas, CanvasRenderingContext2D, Image } from 'canvas'
import { GameSnapshot } from '../../canvas/types'
import { getFontManager } from '../fonts'
import { loadTeamLogo } from '../logos'

interface TextSize {
  width: number
  height: number
}

function fitLogo(
  img: Image,
  maxW: number = 20,
  maxH: number = 20
): { img: Image | Canvas; w: number; h: number } {
  const w = img.width
  const h = img.height
  if (w <= maxW && h <= maxH) {
    return { img, w, h }
  }
  const scale = Math.min(maxW / w, maxH / h)
  const nw = Math.max(1, Math.floor(w * scale))
  const nh = Math.max(1, Math.floor(h * scale))
  const resized = createCanvas(nw, nh)
  const resizedCtx = resized.getContext('2d')
  resizedCtx.drawImage(img, 0, 0, nw, nh)
  return { img: resized, w: nw, h: nh }
}

function textSize(ctx: CanvasRenderingContext2D, text: string, font: string): TextSize {
  ctx.font = font
  const metrics = ctx.measureText(text)
  const width = Math.max(0, metrics.width)
  const height = Math.max(0, metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent)
  return { width, height }
}

export async function drawLiveBig(
  canvas: Canvas,
  ctx: CanvasRenderingContext2D,
  snap: GameSnapshot,
  logoVariant: string = 'banner'
): Promise<void> {
  const w = canvas.width
  const h = canvas.height

  const fontManager = getFontManager()
  const fontSmall = fontManager.getSmallFont()
  const fontLarge = fontManager.getLargeFont()

  const periodLabel = snap.period_name
  const clock = (snap.display_clock || '').trim()
  const status = `${periodLabel} ${clock}`.trim()
  let sth = 0
  if (status) {
    const { width: stw, height: statusHeight } = textSize(ctx, status, fontSmall)
    sth = statusHeight
    ctx.font = fontSmall
    ctx.fillStyle = 'rgb(200, 200, 200)'
    ctx.textBaseline = 'top'
    ctx.fillText(status, Math.floor((w - stw) / 2), 0)
  }

  const desiredLogoH = h > 32 ? 20 : 16
  const habbr = snap.home.abbr.slice(0, 4)
  const aabbr = snap.away.abbr.slice(0, 4)
  const { height: hth } = textSize(ctx, habbr || 'HOM', fontSmall)
  const { height: ath } = textSize(ctx, aabbr || 'AWY', fontSmall)
  const abbrH = Math.max(hth, ath)

  const yLogoTop = 1 + sth
  const bottomMargin = 2
  const yAbbr = Math.max(yLogoTop + 1, h - abbrH - bottomMargin)
  const maxLogoH = Math.max(10, yAbbr - yLogoTop - 1)
  const logoH = Math.min(desiredLogoH, maxLogoH)

  const leftX = 1
  const homeX = leftX
  const sportCode = snap.sport.id

  const alogo = await loadTeamLogo({
    teamId: snap.away.id,
    abbr: snap.away.abbr,
    sport: sportCode,
    variant: logoVariant === 'banner' ? 'banner' : 'mini',
  })
  const hlogo = await loadTeamLogo({
    teamId: snap.home.id,
    abbr: snap.home.abbr,
    sport: sportCode,
    variant: logoVariant === 'banner' ? 'banner' : 'mini',
  })

  let homeW = 20
  let homeH = logoH
  if (hlogo) {
    const fitted = fitLogo(hlogo, 20, logoH)
    ctx.drawImage(fitted.img, homeX, yLogoTop)
    homeW = fitted.w
    homeH = fitted.h
  } else {
    ctx.strokeStyle = 'rgb(100, 100, 100)'
    ctx.lineWidth = 1
    ctx.strokeRect(homeX, yLogoTop, homeW, homeH)
  }

  let awayW = 20
  let awayH = logoH
  let awayX = Math.max(1, w - awayW - 2)
  if (alogo) {
    const fitted = fitLogo(alogo, 20, logoH)
    awayW = fitted.w
    awayH = fitted.h
    awayX = Math.max(1, w - awayW - 2)
    ctx.drawImage(fitted.img, awayX, yLogoTop)
  } else {
    ctx.strokeStyle = 'rgb(100, 100, 100)'
    ctx.lineWidth = 1
    ctx.strokeRect(awayX, yLogoTop, awayW, awayH)
  }

  ctx.font = fontSmall
  ctx.fillStyle = 'rgb(220, 220, 220)'
  ctx.textBaseline = 'top'
  const { width: htw } = textSize(ctx, habbr, fontSmall)
  const { width: atw } = textSize(ctx, aabbr, fontSmall)
  let hx = homeX + Math.max(0, Math.floor((homeW - htw) / 2))
  const hy = yAbbr
  hx = Math.max(1, Math.min(hx, w - htw - 2))
  ctx.fillText(habbr, hx, hy)

  let ax = awayX + Math.max(0, Math.floor((awayW - atw) / 2))
  const ay = yAbbr
  ax = Math.max(1, Math.min(ax, w - atw - 2))
  ctx.fillText(aabbr, ax, ay)

  let colL = homeX + homeW + 3
  let colR = awayX - 3
  if (colR <= colL) {
    colL = 22
    colR = w - 22
  }
  const mid = Math.floor((colL + colR) / 2)
  const gap = 2

  const forceSmall = h <= 32
  const hscore = String(snap.home.score)
  const ascore = String(snap.away.score)

  let hFont = forceSmall || hscore.length > 2 ? fontSmall : fontLarge
  let aFont = forceSmall || ascore.length > 2 ? fontSmall : fontLarge
  let { width: hstw, height: hsth } = textSize(ctx, hscore, hFont)
  let { width: astw, height: asth } = textSize(ctx, ascore, aFont)

  const leftWidth = Math.max(2, mid - gap - colL)
  const rightWidth = Math.max(2, colR - (mid + gap))

  if (hstw > leftWidth && hFont !== fontSmall) {
    hFont = fontSmall
    const newSize = textSize(ctx, hscore, hFont)
    hstw = newSize.width
    hsth = newSize.height
  }
  if (astw > rightWidth && aFont !== fontSmall) {
    aFont = fontSmall
    const newSize = textSize(ctx, ascore, aFont)
    astw = newSize.width
    asth = newSize.height
  }

  const maxScoreH = Math.max(hsth, asth)
  let scoreY = yLogoTop + Math.max(0, Math.floor((logoH - maxScoreH) / 2))
  if (scoreY + maxScoreH > yAbbr - 1) {
    scoreY = Math.max(yLogoTop, yAbbr - 1 - maxScoreH)
  }

  const hxX = Math.max(colL, mid - gap - hstw)
  const axX = Math.min(colR - astw, mid + gap)

  ctx.font = hFont
  ctx.fillStyle = 'rgb(255, 255, 255)'
  ctx.textBaseline = 'top'
  ctx.fillText(hscore, hxX, scoreY)

  ctx.font = aFont
  ctx.fillStyle = 'rgb(255, 255, 255)'
  ctx.textBaseline = 'top'
  ctx.fillText(ascore, axX, scoreY)
}
