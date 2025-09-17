import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'

// Admin-only endpoint: seeds/upserts sport teams from local assets/*_teams.json
// AuthN: requires Authorization: Bearer <userJWT> and service role key on server
// AuthZ: optional ADMIN_EMAILS env (comma-separated) to restrict callers

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean)

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

function normalizeTeams(sport: Sport, json: any): Array<{
  sport: Sport
  external_id: string
  name: string
  display_name: string
  abbreviation: string
  conference?: string | null
  division?: string | null
  is_active: boolean
}> {
  const arr: any[] = Array.isArray(json) ? json : Array.isArray(json?.teams) ? json.teams : []
  return arr
    .map((t) => {
      const id = String(t.id ?? t.teamId ?? t.team_id ?? t.abbr ?? t.triCode ?? '').trim()
      const abbr = String(t.abbr ?? t.abbreviation ?? t.triCode ?? '').toUpperCase().trim()
      const name = String(t.name ?? t.teamName ?? t.displayName ?? '').trim()
      const display = String(t.displayName ?? t.name ?? t.teamName ?? '').trim()
      const conference = t.conference ? String(t.conference) : null
      const division = t.division ? String(t.division) : null
      if (!id || !name || !abbr) return null
      return {
        sport,
        external_id: id,
        name,
        display_name: display || name,
        abbreviation: abbr,
        conference,
        division,
        is_active: true,
      }
    })
    .filter(Boolean) as any
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' })
  }

  try {
    // Verify caller is authenticated; restrict to ADMIN_EMAILS if provided
    const token = (req.headers.authorization || '').split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Missing Authorization token' })

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(token)
    if (userErr || !user) {
      return res.status(401).json({ error: 'Invalid auth token' })
    }
    if (adminEmails.length && !adminEmails.includes(user.email || '')) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    // Scan assets for *_teams.json
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
      const full = path.join(assetsDir, f)
      const text = await fs.readFile(full, 'utf-8')
      const json = JSON.parse(text)
      const rows = normalizeTeams(sport, json)
      if (!rows.length) {
        results[sport] = { upserted: 0, skipped: 0 }
        continue
      }

      // Upsert in batches to avoid payload limits
      let upserted = 0
      const chunkSize = 500
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const { error } = await admin.from('sport_teams').upsert(chunk, { onConflict: 'sport,external_id' })
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

