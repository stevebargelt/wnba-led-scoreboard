import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const DEFAULTS = {
  brightness: 80,
  timezone: 'America/Los_Angeles',
  refresh_pregame_sec: 30,
  refresh_ingame_sec: 5,
  refresh_final_sec: 60,
}

// Matches IANA timezone names like "America/Los_Angeles", "Etc/GMT+5", "UTC"
const TIMEZONE_RE = /^[A-Za-z][A-Za-z0-9/_+\-]{0,62}$/

function toPositiveInt(val: unknown): number | null {
  const n = Math.trunc(Number(val))
  return Number.isFinite(n) && n > 0 ? n : null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', ['GET', 'PUT'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

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
    const { data, error } = await userScoped
      .from('device_config')
      .select('brightness, timezone, refresh_pregame_sec, refresh_ingame_sec, refresh_final_sec')
      .eq('device_id', deviceId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({
      brightness: data?.brightness ?? DEFAULTS.brightness,
      timezone: data?.timezone ?? DEFAULTS.timezone,
      refresh_pregame_sec: data?.refresh_pregame_sec ?? DEFAULTS.refresh_pregame_sec,
      refresh_ingame_sec: data?.refresh_ingame_sec ?? DEFAULTS.refresh_ingame_sec,
      refresh_final_sec: data?.refresh_final_sec ?? DEFAULTS.refresh_final_sec,
    })
  }

  const { brightness, timezone, refresh_pregame_sec, refresh_ingame_sec, refresh_final_sec } =
    req.body || {}

  const brightnessNum = Number(brightness)
  if (!Number.isFinite(brightnessNum) || brightnessNum < 1 || brightnessNum > 100) {
    return res.status(400).json({ error: 'brightness must be a number between 1 and 100' })
  }

  const pregame = toPositiveInt(refresh_pregame_sec)
  if (pregame === null) {
    return res
      .status(400)
      .json({ error: 'refresh_pregame_sec must be a positive integer greater than zero' })
  }
  const ingame = toPositiveInt(refresh_ingame_sec)
  if (ingame === null) {
    return res
      .status(400)
      .json({ error: 'refresh_ingame_sec must be a positive integer greater than zero' })
  }
  const finalSec = toPositiveInt(refresh_final_sec)
  if (finalSec === null) {
    return res
      .status(400)
      .json({ error: 'refresh_final_sec must be a positive integer greater than zero' })
  }

  if (typeof timezone !== 'string' || !TIMEZONE_RE.test(timezone)) {
    return res
      .status(400)
      .json({ error: 'timezone must be a valid IANA timezone string (e.g. America/Los_Angeles)' })
  }

  const { error: upsertError } = await userScoped.from('device_config').upsert({
    device_id: deviceId,
    brightness: Math.round(brightnessNum),
    timezone,
    refresh_pregame_sec: pregame,
    refresh_ingame_sec: ingame,
    refresh_final_sec: finalSec,
    updated_at: new Date().toISOString(),
  })

  if (upsertError) {
    return res.status(500).json({ error: upsertError.message })
  }

  return res.status(200).json({ success: true })
}
