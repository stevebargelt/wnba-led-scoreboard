import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs/promises'
import path from 'path'
import { withAuth, getAdminClient, type AuthenticatedUser } from '@/lib/auth'

type Sport = 'wnba' | 'nhl' | 'nba' | 'mlb' | 'nfl'

function guessSportFromFilename(file: string): Sport | null {
  const base = path.basename(file).toLowerCase()
  if (base.includes('wnba_teams')) return 'wnba'
  if (base.includes('nhl_teams')) return 'nhl'
  if (base.includes('nba_teams')) return 'nba'
  if (base.includes('mlb_teams')) return 'mlb'
  if (base.includes('nfl_teams')) return 'nfl'
  return null
}

function normalizeTeams(
  leagueId: string,
  sport: Sport,
  json: any
): Array<{
  league_id: string
  team_id: string
  name: string
  abbreviation: string
  logo_url: string | null
  conference: string | null
  division: string | null
  is_active: boolean
}> {
  const arr: any[] = Array.isArray(json) ? json : Array.isArray(json?.teams) ? json.teams : []
  return arr
    .map(t => {
      const team_id = String(t.id ?? t.teamId ?? t.team_id ?? t.abbr ?? t.triCode ?? '').trim()
      const abbreviation = String(t.abbr ?? t.abbreviation ?? t.triCode ?? '')
        .toUpperCase()
        .trim()
      const name = String(t.name ?? t.teamName ?? t.displayName ?? '').trim()
      const conference = t.conference ? String(t.conference) : null
      const division = t.division ? String(t.division) : null
      if (!team_id || !name || !abbreviation) return null
      return {
        league_id: leagueId,
        team_id,
        name,
        abbreviation,
        logo_url: t.logo_url ?? null,
        conference,
        division,
        is_active: true,
      }
    })
    .filter(Boolean) as any
}

async function handler(req: NextApiRequest, res: NextApiResponse, _user: AuthenticatedUser) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const admin = getAdminClient()

    const { data: leagues, error: leaguesError } = await admin
      .from('leagues')
      .select('id, code')

    if (leaguesError) {
      return res.status(500).json({ error: `Failed to load leagues: ${leaguesError.message}` })
    }

    const codeToId = new Map((leagues || []).map((l: any) => [String(l.code), String(l.id)]))

    const root = path.resolve(process.cwd(), '..')
    const assetsDir = path.join(root, 'assets')
    const files = (await fs.readdir(assetsDir)).filter(f => f.endsWith('_teams.json'))
    if (files.length === 0) {
      return res.status(400).json({ error: 'No *_teams.json files found in assets/' })
    }

    const results: Record<string, { upserted: number; skipped: number }> = {}
    for (const f of files) {
      const sport = guessSportFromFilename(f)
      if (!sport) continue

      const leagueId = codeToId.get(sport)
      if (!leagueId) {
        console.warn(`seed-teams: no league found for sport code "${sport}", skipping`)
        results[sport] = { upserted: 0, skipped: 0 }
        continue
      }

      const full = path.join(assetsDir, f)
      const text = await fs.readFile(full, 'utf-8')
      const json = JSON.parse(text)
      const rows = normalizeTeams(leagueId, sport, json)
      if (!rows.length) {
        results[sport] = { upserted: 0, skipped: 0 }
        continue
      }

      let upserted = 0
      const chunkSize = 500
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const { error } = await admin
          .from('league_teams')
          .upsert(chunk, { onConflict: 'league_id,team_id' })
        if (error) {
          return res.status(500).json({ error: `Upsert failed for ${sport}: ${error.message}` })
        }
        upserted += chunk.length
      }
      results[sport] = { upserted, skipped: 0 }
    }

    return res.status(200).json({ ok: true, results })
  } catch (e: any) {
    console.error('seed-teams error:', e)
    return res.status(500).json({ error: e?.message || 'Internal error' })
  }
}

export default withAuth(handler, true)
