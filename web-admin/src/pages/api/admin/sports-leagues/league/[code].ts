import type { NextApiRequest, NextApiResponse } from 'next'
import type { LeagueConfig } from '@/types/sports'
import { withAuth, getAdminClient, type AuthenticatedUser } from '@/lib/auth'

async function handler(req: NextApiRequest, res: NextApiResponse, user: AuthenticatedUser) {
  const { code } = req.query

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'League code is required' })
  }

  const admin = getAdminClient()

  if (req.method === 'GET') {
    try {
      // Fetch specific league from database
      const { data: league, error } = await admin
        .from('leagues')
        .select('*')
        .eq('code', code)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'League not found' })
        }
        console.error(`Error fetching league ${code}:`, error)
        return res.status(500).json({ error: 'Failed to fetch league' })
      }

      // Get sport code from sport_id
      let sportCode = ''
      if (league.sport_id) {
        const { data: sport } = await admin
          .from('sports')
          .select('code')
          .eq('id', league.sport_id)
          .single()
        sportCode = sport?.code || ''
      }

      // Parse current_season if it's a string
      let currentSeason = league.current_season || {}
      if (typeof currentSeason === 'string') {
        try {
          currentSeason = JSON.parse(currentSeason)
        } catch (e) {
          console.error('Failed to parse current_season:', e)
          currentSeason = {}
        }
      }

      // Transform the data to match the expected format
      const transformedLeague = {
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

      return res.status(200).json(transformedLeague)
    } catch (error) {
      console.error(`Error in GET /api/admin/sports-leagues/league/${code}:`, error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'PUT') {
    try {
      const updatedLeague: LeagueConfig = req.body

      // Log what we're receiving
      const bodySize = JSON.stringify(req.body).length
      console.log(`PUT /api/admin/sports-leagues/league/${code}:`, {
        bodySize,
        currentSeasonSize: updatedLeague.currentSeason
          ? JSON.stringify(updatedLeague.currentSeason).length
          : 0,
        currentSeasonKeys: updatedLeague.currentSeason
          ? Object.keys(updatedLeague.currentSeason)
          : [],
      })

      // Safety check - prevent saving huge payloads
      if (bodySize > 100000) {
        // 100KB limit
        console.error('Payload too large:', bodySize, 'bytes')
        console.error(
          'Current season sample:',
          JSON.stringify(updatedLeague.currentSeason).substring(0, 500)
        )
        return res
          .status(400)
          .json({
            error: `Payload too large (${bodySize} bytes). This usually indicates a data serialization issue.`,
          })
      }

      // Validate the league configuration
      if (!updatedLeague.name || !updatedLeague.code) {
        return res.status(400).json({ error: 'League name and code are required' })
      }

      // Clean current_season to ensure it only has the expected fields
      let cleanCurrentSeason = null
      if (updatedLeague.currentSeason) {
        cleanCurrentSeason = {
          startDate: updatedLeague.currentSeason.startDate || '',
          endDate: updatedLeague.currentSeason.endDate || '',
          playoffStart: updatedLeague.currentSeason.playoffStart || null,
          isActive: updatedLeague.currentSeason.isActive || false,
        }
      }

      // Get sport_id from sportCode if provided
      let sportId = null
      if (updatedLeague.sportCode) {
        const { data: sport } = await admin
          .from('sports')
          .select('id')
          .eq('code', updatedLeague.sportCode)
          .single()
        sportId = sport?.id
      }

      // Update the league in the database
      const updateData: any = {
        name: updatedLeague.name,
        code: updatedLeague.code,
        api_config: updatedLeague.api,
        team_count: updatedLeague.teamCount,
        conference_structure: updatedLeague.conferenceStructure,
        timing_overrides: updatedLeague.timingOverrides,
        current_season: cleanCurrentSeason,
        updated_at: new Date().toISOString(),
      }

      // Only update sport_id if we have one
      if (sportId) {
        updateData.sport_id = sportId
      }

      const { data, error } = await admin
        .from('leagues')
        .update(updateData)
        .eq('code', code)
        .select()
        .single()

      if (error) {
        console.error(`Error updating league ${code}:`, error)
        return res.status(500).json({ error: 'Failed to update league' })
      }

      return res.status(200).json({
        success: true,
        league: data,
      })
    } catch (error) {
      console.error(`Error in PUT /api/admin/sports-leagues/league/${code}:`, error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      // Delete the league from the database
      const { error } = await admin.from('leagues').delete().eq('code', code)

      if (error) {
        console.error(`Error deleting league ${code}:`, error)
        return res.status(500).json({ error: 'Failed to delete league' })
      }

      return res.status(200).json({ success: true })
    } catch (error) {
      console.error(`Error in DELETE /api/admin/sports-leagues/league/${code}:`, error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
  return res.status(405).json({ error: 'Method not allowed' })
}

// Export handler wrapped with admin authentication
export default withAuth(handler, true)
