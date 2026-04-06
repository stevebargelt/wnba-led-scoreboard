import { loadImage, Image } from 'canvas'
import * as path from 'path'
import * as fs from 'fs'

const ASSETS_BASE = path.resolve(__dirname, '../../../../../../assets')
const LOGOS_DIR = path.join(ASSETS_BASE, 'logos')
const VARIANTS_DIR = path.join(LOGOS_DIR, 'variants')
const NHL_LOGOS_DIR = path.join(ASSETS_BASE, 'nhl_logos')

const logoCache = new Map<string, Image | null>()

function getSportLogoDir(sport: string): string {
  if (sport === 'nhl') {
    return NHL_LOGOS_DIR
  }
  return LOGOS_DIR
}

function getVariantPath(teamId: string, variant: string, sport?: string): string {
  const cacheKey = sport ? `${sport}_${teamId}` : teamId
  return path.join(VARIANTS_DIR, `${cacheKey}_${variant}.png`)
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

async function loadImageSafe(filePath: string): Promise<Image | null> {
  try {
    if (!fileExists(filePath)) {
      return null
    }
    return await loadImage(filePath)
  } catch {
    return null
  }
}

export async function loadTeamLogo(
  teamId: string | undefined,
  abbr: string | undefined,
  sport: string = 'wnba',
  variant: 'mini' | 'banner' = 'mini'
): Promise<Image | null> {
  if (!teamId && !abbr) {
    return null
  }

  const keyId = teamId || abbr?.toUpperCase() || ''
  const cacheKey = `${sport}_${keyId}_${variant}`

  if (logoCache.has(cacheKey)) {
    return logoCache.get(cacheKey) || null
  }

  const variantPath = getVariantPath(keyId, variant, sport)
  let image = await loadImageSafe(variantPath)

  if (!image) {
    const sportDir = getSportLogoDir(sport)
    const candidates = [
      path.join(sportDir, `${keyId}.png`),
      path.join(sportDir, `${keyId}.svg`),
    ]

    if (abbr) {
      const abbrUpper = abbr.toUpperCase()
      candidates.push(
        path.join(sportDir, `${abbrUpper}.png`),
        path.join(sportDir, `${abbrUpper}.svg`)
      )
    }

    for (const candidate of candidates) {
      image = await loadImageSafe(candidate)
      if (image) {
        break
      }
    }
  }

  logoCache.set(cacheKey, image)
  return image
}

export function clearLogoCache(): void {
  logoCache.clear()
}
