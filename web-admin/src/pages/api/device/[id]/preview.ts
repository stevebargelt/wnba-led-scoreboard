import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'

const execAsync = promisify(exec)

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
    if (process.env.VERCEL || process.env.NETLIFY) {
      return res.status(503).json({
        error: 'Preview generation not available on serverless deployment',
        reason: 'serverless',
        details:
          'Preview generation requires Python runtime and file system access. ' +
          'For previews, deploy the web admin on a server with Python 3.8+ installed, ' +
          'or use a self-hosted environment. The preview feature will work on Railway, ' +
          'Render, or any VM-based hosting.',
      })
    }

    try {
      const scene = (req.query.scene as string) || 'live'
      const validScenes = ['idle', 'pregame', 'live', 'live_big', 'final']
      if (!validScenes.includes(scene)) {
        return res.status(400).json({ error: 'Invalid scene type' })
      }

      const projectRoot = path.resolve(process.cwd(), '..')
      const scriptPath = path.join(projectRoot, 'scripts', 'generate_preview.py')
      const outputDir = path.join(projectRoot, 'out', 'preview')

      const command = `cd ${projectRoot} && python3 ${scriptPath} --device-id ${deviceId} --scene ${scene} --output ${outputDir}`

      const { stdout, stderr } = await execAsync(command, {
        env: {
          ...process.env,
          PYTHONPATH: projectRoot,
        },
      })

      if (stderr) {
        console.error('Preview generation stderr:', stderr)
      }

      const result = JSON.parse(stdout)

      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Preview generation failed' })
      }

      const framePath = result.path
      const imageBuffer = await fs.readFile(framePath)

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
