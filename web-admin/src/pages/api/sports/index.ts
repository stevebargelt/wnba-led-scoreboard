import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabaseClient'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      // Get all available sports and teams
      const { data: sportTeams, error } = await supabase
        .from('sport_teams')
        .select('*')
        .eq('is_active', true)
        .order('sport, name')

      if (error) {
        console.error('Error fetching sport teams:', error)
        return res.status(500).json({ error: 'Failed to fetch sport teams' })
      }

      // Group teams by sport
      const sportData = sportTeams?.reduce((acc: any, team: any) => {
        if (!acc[team.sport]) {
          acc[team.sport] = []
        }
        acc[team.sport].push({
          id: team.external_id,
          name: team.display_name || team.name,
          abbreviation: team.abbreviation,
          conference: team.conference,
          division: team.division,
          colors: team.colors,
          logoUrls: team.logo_urls
        })
        return acc
      }, {})

      res.status(200).json({ sports: sportData || {} })
    } catch (error) {
      console.error('API error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  } else {
    res.setHeader('Allow', ['GET'])
    res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}