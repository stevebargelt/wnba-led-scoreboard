import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, getAdminClient, type AuthenticatedUser } from '@/lib/auth'

async function handler(req: NextApiRequest, res: NextApiResponse, user: AuthenticatedUser) {
  const admin = getAdminClient()

  if (req.method === 'GET') {
    try {
      // Fetch sports from database
      const { data: sports, error: sportsError } = await admin
        .from('sports')
        .select('*')
        .order('name')

      if (sportsError) {
        console.error('Error fetching sports:', sportsError)
        return res.status(500).json({ error: 'Failed to fetch sports' })
      }

      // Fetch leagues from database
      const { data: leagues, error: leaguesError } = await admin
        .from('leagues')
        .select('*')
        .order('name')

      if (leaguesError) {
        console.error('Error fetching leagues:', leaguesError)
        return res.status(500).json({ error: 'Failed to fetch leagues' })
      }

      // Transform the data to match the expected format
      const transformedSports =
        sports?.map(sport => ({
          id: sport.id,
          name: sport.name,
          code: sport.code,
          timing: sport.config?.timing || {},
          scoring: sport.config?.scoring || {},
          terminology: sport.config?.terminology || {},
          extensions: sport.config?.extensions || {},
        })) || []

      const transformedLeagues =
        leagues?.map(league => {
          // Find the sport code from the sport_id
          const sport = sports?.find(s => s.id === league.sport_id)
          const sportCode = sport?.code || ''

          // Parse current_season if it's a string
          let currentSeason = league.current_season || {}
          if (typeof currentSeason === 'string') {
            try {
              currentSeason = JSON.parse(currentSeason)
            } catch (e) {
              console.error('Failed to parse current_season for league', league.code, ':', e)
              currentSeason = {}
            }
          }

          return {
            id: league.id,
            name: league.name,
            code: league.code,
            sportCode: sportCode,
            sportId: league.sport_id,
            api: league.api_config || {},
            teamCount: league.team_count,
            conferenceStructure: league.conference_structure || {},
            timingOverrides: league.timing_overrides || {},
            currentSeason: currentSeason,
          }
        }) || []

      return res.status(200).json({
        sports: transformedSports,
        leagues: transformedLeagues,
      })
    } catch (error) {
      console.error('Error in GET /api/admin/sports-leagues:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'PUT') {
    try {
      const { sports, leagues } = req.body

      // Update sports if provided
      if (sports && Array.isArray(sports)) {
        for (const sport of sports) {
          const { id, name, code, timing, scoring, terminology, extensions } = sport

          const config = {
            timing,
            scoring,
            terminology,
            extensions,
          }

          const { error } = await admin
            .from('sports')
            .update({
              name,
              code,
              config,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)

          if (error) {
            console.error(`Error updating sport ${code}:`, error)
            return res.status(500).json({ error: `Failed to update sport ${code}` })
          }
        }
      }

      // Update leagues if provided
      if (leagues && Array.isArray(leagues)) {
        for (const league of leagues) {
          const {
            id,
            name,
            code,
            sportId,
            api,
            teamCount,
            conferenceStructure,
            timingOverrides,
            currentSeason,
          } = league

          const updateData: any = {
            name,
            code,
            api_config: api,
            team_count: teamCount,
            conference_structure: conferenceStructure,
            timing_overrides: timingOverrides,
            current_season: currentSeason,
            updated_at: new Date().toISOString(),
          }

          // Only update sport_id if provided
          if (sportId) {
            updateData.sport_id = sportId
          }

          const { error } = await admin.from('leagues').update(updateData).eq('id', id)

          if (error) {
            console.error(`Error updating league ${code}:`, error)
            return res.status(500).json({ error: `Failed to update league ${code}` })
          }
        }
      }

      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Error in PUT /api/admin/sports-leagues:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    try {
      const { sport, league } = req.body

      // Create new sport if provided
      if (sport) {
        const { name, code, timing, scoring, terminology, extensions } = sport

        const config = {
          timing,
          scoring,
          terminology,
          extensions,
        }

        const { data, error } = await admin
          .from('sports')
          .insert({
            name,
            code,
            config,
          })
          .select()
          .single()

        if (error) {
          console.error('Error creating sport:', error)
          return res.status(500).json({ error: 'Failed to create sport' })
        }

        return res.status(201).json({ success: true, sport: data })
      }

      // Create new league if provided
      if (league) {
        const {
          name,
          code,
          sportId,
          sportCode,
          api,
          teamCount,
          conferenceStructure,
          timingOverrides,
          currentSeason,
        } = league

        // Get sport_id from sportCode if not provided
        let actualSportId = sportId
        if (!actualSportId && sportCode) {
          const { data: sportData } = await admin
            .from('sports')
            .select('id')
            .eq('code', sportCode)
            .single()

          actualSportId = sportData?.id
        }

        const config = {
          api,
          teamCount,
          conferenceStructure,
          timingOverrides,
          currentSeason,
        }

        const { data, error } = await admin
          .from('leagues')
          .insert({
            name,
            code,
            sport_id: actualSportId,
            api_config: api,
            team_count: teamCount,
            conference_structure: conferenceStructure,
            timing_overrides: timingOverrides,
            current_season: currentSeason,
          })
          .select()
          .single()

        if (error) {
          console.error('Error creating league:', error)
          return res.status(500).json({ error: 'Failed to create league' })
        }

        return res.status(201).json({ success: true, league: data })
      }

      return res.status(400).json({ error: 'No sport or league data provided' })
    } catch (error) {
      console.error('Error in POST /api/admin/sports-leagues:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}

// Export handler wrapped with admin authentication
export default withAuth(handler, true)
