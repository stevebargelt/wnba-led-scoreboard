import { loadImage, Image } from 'canvas'
import * as path from 'path'
import * as fs from 'fs'

const ASSETS_BASE = path.resolve(__dirname, '../../../../../../assets')
const LOGOS_DIR = path.join(ASSETS_BASE, 'logos')
const VARIANTS_DIR = path.join(LOGOS_DIR, 'variants')
const NHL_LOGOS_DIR = path.join(ASSETS_BASE, 'nhl_logos')

const SPORT_LOGO_DIRS: Record<string, string> = {
  wnba: LOGOS_DIR,
  nhl: NHL_LOGOS_DIR,
}

let NHL_ABBR_TO_NUMERIC: Record<string, string> = {}

const nhlTeamsFile = path.join(ASSETS_BASE, 'nhl_teams.json')
if (fs.existsSync(nhlTeamsFile)) {
  try {
    const data = fs.readFileSync(nhlTeamsFile, 'utf-8')
    const teams = JSON.parse(data)
    NHL_ABBR_TO_NUMERIC = teams.reduce((acc: Record<string, string>, team: any) => {
      if (team.abbreviation && team.id) {
        acc[team.abbreviation.toUpperCase()] = String(team.id)
      }
      return acc
    }, {})
  } catch {
    NHL_ABBR_TO_NUMERIC = {}
  }
}

const logoCache = new Map<string, Image | null>()

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

function getVariantPath(teamId: string, variant: string, sport?: string): string {
  const cacheKey = sport ? `${sport}_${teamId}` : teamId
  return path.join(VARIANTS_DIR, `${cacheKey}_${variant}.png`)
}

export type LogoVariant = 'mini' | 'small' | 'banner'

export interface LogoOptions {
  teamId?: string
  abbr?: string
  sport?: string
  variant?: LogoVariant
}

export async function loadTeamLogo(options: LogoOptions): Promise<Image | null> {
  const { teamId, abbr, sport = 'wnba', variant = 'mini' } = options

  if (!teamId && !abbr) {
    return null
  }

  const keyId = teamId || abbr?.toUpperCase() || ''
  const sportLower = sport.toLowerCase()
  const cacheKey = `${sportLower}_${keyId}_${variant}`

  if (logoCache.has(cacheKey)) {
    return logoCache.get(cacheKey) || null
  }

  const variantPath = getVariantPath(keyId, variant, sportLower)
  let image = await loadImageSafe(variantPath)

  if (!image) {
    const sportDir = SPORT_LOGO_DIRS[sportLower] || LOGOS_DIR
    const candidates: string[] = []

    candidates.push(path.join(sportDir, `${keyId}.png`))
    candidates.push(path.join(sportDir, `${keyId}.svg`))

    if (abbr) {
      const abbrUpper = abbr.toUpperCase()
      candidates.push(path.join(sportDir, `${abbrUpper}.png`))
      candidates.push(path.join(sportDir, `${abbrUpper}.svg`))

      if (sportLower === 'nhl' && NHL_ABBR_TO_NUMERIC[abbrUpper]) {
        const numericId = NHL_ABBR_TO_NUMERIC[abbrUpper]
        candidates.push(path.join(sportDir, `${numericId}.png`))
        candidates.push(path.join(sportDir, `${numericId}.svg`))
      }
    }

    if (sportLower === 'nhl' && NHL_ABBR_TO_NUMERIC[keyId.toUpperCase()]) {
      const numericId = NHL_ABBR_TO_NUMERIC[keyId.toUpperCase()]
      candidates.push(path.join(sportDir, `${numericId}.png`))
      candidates.push(path.join(sportDir, `${numericId}.svg`))
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

export function getLogoVariantDimensions(variant: LogoVariant): {
  height: number
  maxWidth: number
} {
  switch (variant) {
    case 'mini':
      return { height: 10, maxWidth: 18 }
    case 'small':
      return { height: 15, maxWidth: 30 }
    case 'banner':
      return { height: 20, maxWidth: 60 }
  }
}
