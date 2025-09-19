import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id: deviceId } = req.query
  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ error: 'Device ID is required' })
  }

  const authHeader = req.headers.authorization || ''
  const tokenMatch = authHeader.match(/^Bearer\s+(.*)$/i)
  if (!tokenMatch) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }
  const accessToken = tokenMatch[1]

  const userScoped = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: authError } = await userScoped.auth.getUser(accessToken)
  if (authError || !userData?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  console.log('Authenticated user ID:', userData.user.id)

  // Ensure the authenticated user can access this device (leverages RLS)
  const { data: deviceRow, error: deviceErr } = await userScoped
    .from('devices')
    .select('id, user_id')
    .eq('id', deviceId)
    .maybeSingle()

  if (deviceErr && deviceErr.code !== 'PGRST116') {
    return res.status(500).json({ error: deviceErr.message })
  }
  if (!deviceRow) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  console.log('Device check:', {
    deviceId,
    deviceUserId: deviceRow.user_id,
    currentUserId: userData.user.id,
  })

  if (req.method === 'GET') {
    try {
      // Load enabled leagues for this device with league details
      const { data: leagues, error: leaguesError } = await userScoped
        .from('device_leagues')
        .select('enabled, priority, league:leagues(code)')
        .eq('device_id', deviceId)
        .order('priority', { ascending: true })

      if (leaguesError && leaguesError.code !== 'PGRST116') {
        return res.status(500).json({ error: leaguesError.message })
      }

      // Load favorite teams for this device with league details
      const { data: favorites, error: favError } = await userScoped
        .from('device_favorite_teams')
        .select('team_id, league:leagues(code)')
        .eq('device_id', deviceId)

      if (favError && favError.code !== 'PGRST116') {
        return res.status(500).json({ error: favError.message })
      }

      // Convert to the format expected by the frontend
      const favoritesByLeague = (favorites || []).reduce((acc: any, fav: any) => {
        const leagueCode = fav.league?.code
        if (leagueCode) {
          if (!acc[leagueCode]) acc[leagueCode] = []
          acc[leagueCode].push(fav.team_id)
        }
        return acc
      }, {})

      // Build sport configs from leagues data
      const existingConfigs = (leagues || [])
        .filter((league: any) => league.league?.code)
        .map((league: any) => ({
          sport: league.league.code,
          enabled: league.enabled,
          priority: league.priority,
          favorite_teams: favoritesByLeague[league.league.code] || [],
        }))

      // If no configs exist, return empty array (frontend will show defaults)
      const configs = existingConfigs

      // Load active override, if any
      const nowIso = new Date().toISOString()
      const { data: override, error: ovErr } = await userScoped
        .from('game_overrides')
        .select('sport, game_event_id, reason, expires_at')
        .eq('device_id', deviceId)
        .gt('expires_at', nowIso)
        .order('overridden_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (ovErr && ovErr.code !== 'PGRST116') {
        // Ignore no rows error; otherwise surface
        return res.status(500).json({ error: ovErr.message })
      }

      return res.status(200).json({ sportConfigs: configs ?? [], activeOverride: override ?? null })
    } catch (e: any) {
      console.error('GET /device/[id]/sports error:', e)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'PUT') {
    try {
      const { sportConfigs, prioritySettings } = req.body || {}
      console.log('PUT /api/device/[id]/sports - received:', { deviceId, sportConfigs })

      if (!Array.isArray(sportConfigs)) {
        return res.status(400).json({ error: 'sportConfigs must be an array' })
      }

      // First, get ALL league IDs (not just the ones in sportConfigs)
      const { data: allLeagues, error: leagueLookupError } = await userScoped
        .from('leagues')
        .select('id, code')

      if (leagueLookupError) return res.status(500).json({ error: leagueLookupError.message })

      console.log('Found leagues in database:', allLeagues)
      const leagueMap = new Map((allLeagues || []).map((l: any) => [l.code, l.id]))

      // Prepare upsert data for ALL leagues (to ensure we update disabled ones too)
      const configMap = new Map(sportConfigs.map((c: any) => [String(c.sport), c]))

      const leagueRows: any[] = []
      leagueMap.forEach((leagueId, code) => {
        const config = configMap.get(code)
        leagueRows.push({
          device_id: deviceId,
          league_id: leagueId,
          enabled: config ? Boolean(config.enabled) : false,
          priority: config ? Number(config.priority) : 999,
        })
      })

      // Upsert leagues configuration
      if (leagueRows.length > 0) {
        console.log('Upserting league rows:', leagueRows)
        const { error: leaguesError } = await userScoped.from('device_leagues').upsert(leagueRows, {
          onConflict: 'device_id,league_id',
        })

        if (leaguesError) {
          console.error('Error upserting leagues:', leaguesError)
          return res.status(500).json({ error: leaguesError.message })
        }
        console.log('Successfully upserted league configurations')
      }

      // Update favorite teams
      // First delete existing favorites
      const { error: deleteError } = await userScoped
        .from('device_favorite_teams')
        .delete()
        .eq('device_id', deviceId)

      if (deleteError) return res.status(500).json({ error: deleteError.message })

      // Then insert new favorites
      const favoriteRows: any[] = []
      for (const config of sportConfigs) {
        const leagueId = leagueMap.get(String(config.sport))
        if (!leagueId) continue

        const teams = Array.isArray(config.favoriteTeams)
          ? config.favoriteTeams
          : Array.isArray(config.favorite_teams)
            ? config.favorite_teams
            : []

        for (const teamId of teams) {
          favoriteRows.push({
            device_id: deviceId,
            league_id: leagueId,
            team_id: String(teamId),
            priority: 999,
          })
        }
      }

      if (favoriteRows.length > 0) {
        const { error: favError } = await userScoped
          .from('device_favorite_teams')
          .insert(favoriteRows)

        if (favError) return res.status(500).json({ error: favError.message })
      }

      // Update priority settings in device_config if provided
      if (prioritySettings) {
        const { error: configError } = await userScoped.from('device_config').upsert({
          device_id: deviceId,
          priority_config: {
            sport_order: sportConfigs
              .filter((c: any) => c.enabled)
              .sort((a: any, b: any) => a.priority - b.priority)
              .map((c: any) => c.sport),
            live_game_boost: prioritySettings.liveGameBoost,
            favorite_team_boost: prioritySettings.favoriteTeamBoost,
            close_game_boost: prioritySettings.closeGameBoost,
            playoff_boost: prioritySettings.playoffBoost,
            conflict_resolution: prioritySettings.conflictResolution,
          },
          updated_at: new Date().toISOString(),
        })

        if (configError) return res.status(500).json({ error: configError.message })
      }

      // Optionally: persist global priority settings in a future table
      return res.status(200).json({ success: true })
    } catch (e: any) {
      console.error('PUT /device/[id]/sports error:', e)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    try {
      const { action, sport, gameEventId, reason, durationMinutes } = req.body || {}
      if (!action) return res.status(400).json({ error: 'action is required' })

      if (action === 'override_game') {
        if (!sport || !gameEventId) {
          return res.status(400).json({ error: 'sport and gameEventId required' })
        }

        const expires = new Date()
        expires.setMinutes(expires.getMinutes() + Number(durationMinutes || 60))

        const { error } = await userScoped.from('game_overrides').insert({
          device_id: deviceId,
          sport: String(sport),
          game_event_id: String(gameEventId),
          reason: reason ? String(reason) : null,
          expires_at: expires.toISOString(),
          overridden_by_user_id: userData.user.id,
        })

        if (error) return res.status(500).json({ error: error.message })
        return res.status(200).json({ success: true, expiresAt: expires.toISOString() })
      }

      if (action === 'clear_override') {
        const nowIso = new Date().toISOString()
        const { error } = await userScoped
          .from('game_overrides')
          .delete()
          .eq('device_id', deviceId)
          .gt('expires_at', nowIso)
        if (error) return res.status(500).json({ error: error.message })
        return res.status(200).json({ success: true })
      }

      return res.status(400).json({ error: 'Invalid action' })
    } catch (e: any) {
      console.error('POST /device/[id]/sports error:', e)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'POST'])
  return res.status(405).json({ error: `Method ${req.method} not allowed` })
}
