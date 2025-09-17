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
    .select('id')
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
      // Load sport configs for this device
      const { data: configs, error } = await userScoped
        .from('device_sport_config')
        .select('sport, enabled, priority, favorite_teams')
        .eq('device_id', deviceId)
        .order('priority', { ascending: true })

      if (error) return res.status(500).json({ error: error.message })

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
      if (!Array.isArray(sportConfigs)) {
        return res.status(400).json({ error: 'sportConfigs must be an array' })
      }

      // Normalize and upsert rows (unique on device_id+sport)
      const rows = sportConfigs.map((c: any) => ({
        device_id: deviceId,
        sport: String(c.sport),
        enabled: Boolean(c.enabled),
        priority: Number(c.priority),
        favorite_teams: Array.isArray(c.favoriteTeams)
          ? c.favoriteTeams
          : Array.isArray(c.favorite_teams)
            ? c.favorite_teams
            : [],
      }))

      const { error } = await userScoped
        .from('device_sport_config')
        .upsert(rows, { onConflict: 'device_id,sport' })

      if (error) return res.status(500).json({ error: error.message })

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
