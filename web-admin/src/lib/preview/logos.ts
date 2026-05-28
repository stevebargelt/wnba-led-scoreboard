const logoCache = new Map<string, HTMLImageElement | null>()

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function tryPaths(paths: string[]): Promise<HTMLImageElement | null> {
  for (const path of paths) {
    const result = await loadImage(path)
    if (result !== null) return result
  }
  return null
}

export async function loadTeamLogo(
  teamId: string | undefined,
  abbr: string | undefined,
  sport: string,
  variant: 'mini' | 'banner'
): Promise<HTMLImageElement | null> {
  if (!teamId && !abbr) return null

  const cacheKey = `${sport}_${teamId}_${variant}`
  if (logoCache.has(cacheKey)) {
    return logoCache.get(cacheKey) ?? null
  }

  const paths: string[] = []

  if (teamId) {
    paths.push(`/assets/logos/variants/${teamId}_${variant}.png`)
  }

  const sportLower = sport.toLowerCase()
  if (sportLower === 'wnba' || sportLower === 'basketball') {
    if (teamId) paths.push(`/assets/logos/${teamId}.png`)
  } else if (sportLower === 'nhl' || sportLower === 'hockey') {
    if (abbr) {
      const upperAbbr = abbr.toUpperCase()
      paths.push(`/assets/nhl_logos/${upperAbbr}.png`)
      paths.push(`/assets/nhl_logos/${upperAbbr}.svg`)
    }
  }

  if (abbr) {
    paths.push(`/assets/logos/${abbr}.png`)
  }

  const result = await tryPaths(paths)
  logoCache.set(cacheKey, result)
  return result
}

export function clearLogoCache(): void {
  logoCache.clear()
}
