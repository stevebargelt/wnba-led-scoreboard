import type { NextApiRequest, NextApiResponse } from 'next'
import type { LeagueConfig } from '@/types/sports'

// In production, this would update the Python backend
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.query

  if (req.method === 'PUT') {
    // Update league configuration
    const updatedLeague: LeagueConfig = req.body

    // Here we would:
    // 1. Validate the league configuration
    // 2. Update the Python backend via internal API
    // 3. Persist to database

    // For now, just echo back the updated league
    console.log(`Updating league ${code}:`, updatedLeague)

    res.status(200).json({
      success: true,
      league: updatedLeague,
    })
  } else if (req.method === 'GET') {
    // Get single league configuration
    // In production, fetch from Python backend
    res.status(200).json({
      code: code,
      // ... league data
    })
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
