import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { PreviewGenerator, SceneType, DeviceConfiguration } from '../../../../lib/canvas'

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
      const scene = (req.query.scene as string) || 'live'
      const validScenes: SceneType[] = ['idle', 'pregame', 'live', 'live_big', 'final']
      if (!validScenes.includes(scene as SceneType)) {
        return res.status(400).json({ error: 'Invalid scene type' })
      }

      const { data: configData, error: configErr } = await userScoped
        .from('device_config')
        .select('*')
        .eq('device_id', deviceId)
        .maybeSingle()

      if (configErr || !configData) {
        return res.status(500).json({ error: 'Failed to load device configuration' })
      }

      const deviceConfig: DeviceConfiguration = {
        device_id: deviceId,
        matrix_config: {
          width: configData.matrix_width || 64,
          height: configData.matrix_height || 32,
          brightness: configData.matrix_brightness || 75,
          pwm_bits: configData.matrix_pwm_bits || 11,
          hardware_mapping: configData.matrix_hardware_mapping || 'regular',
          chain_length: configData.matrix_chain_length || 1,
          parallel: configData.matrix_parallel || 1,
          gpio_slowdown: configData.matrix_gpio_slowdown || 1,
        },
        render_config: {
          logo_variant: configData.logo_variant || 'small',
          live_layout: configData.live_layout || 'stacked',
        },
      }

      const generator = new PreviewGenerator(deviceConfig)
      const imageBuffer = await generator.generatePreview(scene as SceneType)

      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'no-store, must-revalidate')
      return res.send(imageBuffer)
    } catch (error: any) {
      console.error('Preview generation error:', error)
      return res.status(500).json({
        error: 'Failed to generate preview',
        details: error.message,
      })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
