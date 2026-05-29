import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE'])
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

  // Verify device ownership via RLS — returns null if device doesn't exist or belongs to another user
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

  try {
    const { error: deleteError } = await userScoped.from('devices').delete().eq('id', deviceId)

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message })
    }

    return res.status(204).end()
  } catch (e: any) {
    console.error('DELETE /device/[id] error:', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
