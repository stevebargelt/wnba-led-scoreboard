import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing Supabase env' })
  }

  const authHeader = req.headers.authorization || ''
  const tokenMatch = authHeader.match(/^Bearer\s+(.*)$/i)
  if (!tokenMatch) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }
  const accessToken = tokenMatch[1]

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: userData, error: authError } = await supabase.auth.getUser(accessToken)
  if (authError || !userData?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const root = path.resolve(process.cwd(), '..')
    const file = path.join(root, 'assets', 'teams.json')
    const data = await fs.readFile(file, 'utf-8')
    const json = JSON.parse(data)
    // Normalize to minimal shape expected by UI
    const teams = (json.teams || []).map((t: any) => ({
      id: String(t.id),
      name: t.name || t.displayName,
      abbr: (t.abbr || '').toUpperCase(),
    }))
    res.status(200).json({ teams })
  } catch (e) {
    // Fallback to a small static list when file missing
    res.status(200).json({
      teams: [
        { name: 'Atlanta Dream', abbr: 'ATL' },
        { name: 'Chicago Sky', abbr: 'CHI' },
        { name: 'Connecticut Sun', abbr: 'CON' },
        { name: 'Dallas Wings', abbr: 'DAL' },
        { name: 'Indiana Fever', abbr: 'IND' },
        { name: 'Las Vegas Aces', abbr: 'LVA' },
        { name: 'Los Angeles Sparks', abbr: 'LAS' },
        { name: 'Minnesota Lynx', abbr: 'MIN' },
        { name: 'New York Liberty', abbr: 'NYL' },
        { name: 'Phoenix Mercury', abbr: 'PHX' },
        { name: 'Seattle Storm', abbr: 'SEA' },
        { name: 'Washington Mystics', abbr: 'WAS' },
      ],
    })
  }
}
