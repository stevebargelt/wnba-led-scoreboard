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

  if (req.method === 'GET') {
    try {
      // Load enabled leagues for this device with league details
      const { data: leagues, error: leaguesError } = await userScoped
        .from('device_leagues')
        .select('enabled, priority, league:leagues(code, is_active)')
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
        .filter((league: any) => league.league?.code && league.league?.is_active === true)
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
      const { sportConfigs } = req.body || {}
      if (!Array.isArray(sportConfigs)) {
        return res.status(400).json({ error: 'sportConfigs must be an array' })
      }

      const { data: allLeagues, error: leagueLookupError } = await userScoped
        .from('leagues')
        .select('id, code')

      if (leagueLookupError) return res.status(500).json({ error: leagueLookupError.message })

      const leagueMap = new Map((allLeagues || []).map((l: any) => [String(l.code), String(l.id)]))

      const rpcLeagues = sportConfigs
        .map((config: any) => {
          const leagueId = leagueMap.get(String(config.sport))
          if (!leagueId) return null
          const teamIds = Array.isArray(config.favorite_teams)
            ? config.favorite_teams
            : Array.isArray(config.favoriteTeams)
              ? config.favoriteTeams
              : []
          return {
            league_id: leagueId,
            enabled: Boolean(config.enabled),
            priority: Number(config.priority),
            team_ids: teamIds.map(String),
          }
        })
        .filter(Boolean)

      const { error: rpcError } = await userScoped.rpc('save_device_teams', {
        p_device_id: deviceId,
        p_leagues: rpcLeagues,
      })

      if (rpcError) return res.status(500).json({ error: rpcError.message })

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
