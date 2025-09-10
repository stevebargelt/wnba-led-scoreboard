import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs/promises'
import path from 'path'

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
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
