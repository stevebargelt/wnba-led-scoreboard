import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Use service role client that bypasses RLS for debugging
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { deviceId } = req.query

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.authorization
    const token = authHeader?.split(' ')[1]

    if (!token) {
      return res.status(401).json({
        error: 'No auth token provided',
        debug: { authHeader: req.headers.authorization },
      })
    }

    // Check auth token validity using admin client
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token)

    if (userError) {
      return res.status(401).json({
        error: 'Auth error',
        details: userError.message,
        debug: { userError },
      })
    }

    if (!user) {
      return res.status(401).json({
        error: 'Not authenticated',
        debug: { user: null },
      })
    }

    // Check device ownership using admin client
    const { data: device, error: deviceError } = await supabaseAdmin
      .from('devices')
      .select('id, name, owner_user_id')
      .eq('id', deviceId)
      .single()

    if (deviceError) {
      return res.status(500).json({
        error: 'Device query failed',
        details: deviceError.message,
        debug: { deviceError },
      })
    }

    if (!device) {
      return res.status(404).json({
        error: 'Device not found',
        debug: { deviceId },
      })
    }

    const isOwner = device.owner_user_id === user.id

    // Test a simple insert to the device_sport_config table
    let insertTest = null
    let insertError = null

    try {
      const { data, error } = await supabaseAdmin
        .from('device_sport_config')
        .insert({
          device_id: deviceId,
          sport: 'wnba',
          enabled: true,
          priority: 1,
          favorite_teams: ['test'],
        })
        .select()

      insertTest = data
      insertError = error
    } catch (err) {
      insertError = err
    }

    // Clean up test data if it was inserted
    if (insertTest && insertTest.length > 0) {
      await supabaseAdmin.from('device_sport_config').delete().eq('id', insertTest[0].id)
    }

    return res.status(200).json({
      debug: {
        user: {
          id: user.id,
          email: user.email,
          aud: user.aud,
          role: user.role,
        },
        device: {
          id: device.id,
          name: device.name,
          owner_user_id: device.owner_user_id,
          isOwner,
        },
        auth: {
          authenticated: !!user,
          userId: user.id,
          deviceOwnerId: device.owner_user_id,
          ownershipMatch: isOwner,
        },
        insertTest: {
          success: !insertError,
          error: insertError?.message || null,
          data: insertTest,
        },
      },
    })
  } catch (error) {
    console.error('RLS debug error:', error)
    return res.status(500).json({
      error: 'Debug query failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
