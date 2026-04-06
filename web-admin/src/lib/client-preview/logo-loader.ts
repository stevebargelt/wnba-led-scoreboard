const logoCache = new Map<string, HTMLImageElement | null>()

function getSportLogoPath(sport: string, teamId: string, filename: string): string {
  if (sport === 'nhl') {
    return `/assets/nhl_logos/${filename}`
  }
  return `/assets/logos/${filename}`
}

function getVariantPath(teamId: string, variant: string, sport?: string): string {
  const cacheKey = sport ? `${sport}_${teamId}` : teamId
  return `/assets/logos/variants/${cacheKey}_${variant}.png`
}

async function loadImageSafe(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)

    img.src = url
  })
}

export async function loadTeamLogo(
  teamId: string | undefined,
  abbr: string | undefined,
  sport: string = 'wnba',
  variant: 'mini' | 'banner' = 'mini'
): Promise<HTMLImageElement | null> {
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
    const candidates = [
      getSportLogoPath(sport, keyId, `${keyId}.png`),
      getSportLogoPath(sport, keyId, `${keyId}.svg`),
    ]

    if (abbr) {
      const abbrUpper = abbr.toUpperCase()
      candidates.push(
        getSportLogoPath(sport, keyId, `${abbrUpper}.png`),
        getSportLogoPath(sport, keyId, `${abbrUpper}.svg`)
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
