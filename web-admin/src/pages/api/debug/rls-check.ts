import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabaseClient'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { deviceId } = req.query

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Check current auth state
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      return res.status(401).json({ 
        error: 'Auth error',
        details: userError.message,
        debug: { userError }
      })
    }

    if (!user) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        debug: { user: null }
      })
    }

    // Check device ownership
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, name, owner_user_id')
      .eq('id', deviceId)
      .single()

    if (deviceError) {
      return res.status(500).json({ 
        error: 'Device query failed',
        details: deviceError.message,
        debug: { deviceError }
      })
    }

    if (!device) {
      return res.status(404).json({ 
        error: 'Device not found',
        debug: { deviceId }
      })
    }

    const isOwner = device.owner_user_id === user.id

    // Test a simple insert to the device_sport_config table
    let insertTest = null
    let insertError = null

    try {
      const { data, error } = await supabase
        .from('device_sport_config')
        .insert({
          device_id: deviceId,
          sport: 'wnba',
          enabled: true,
          priority: 1,
          favorite_teams: ['test']
        })
        .select()

      insertTest = data
      insertError = error
    } catch (err) {
      insertError = err
    }

    // Clean up test data if it was inserted
    if (insertTest && insertTest.length > 0) {
      await supabase
        .from('device_sport_config')
        .delete()
        .eq('id', insertTest[0].id)
    }

    return res.status(200).json({
      debug: {
        user: {
          id: user.id,
          email: user.email,
          aud: user.aud,
          role: user.role
        },
        device: {
          id: device.id,
          name: device.name,
          owner_user_id: device.owner_user_id,
          isOwner
        },
        auth: {
          authenticated: !!user,
          userId: user.id,
          deviceOwnerId: device.owner_user_id,
          ownershipMatch: isOwner
        },
        insertTest: {
          success: !insertError,
          error: insertError?.message || null,
          data: insertTest
        }
      }
    })

  } catch (error) {
    console.error('RLS debug error:', error)
    return res.status(500).json({ 
      error: 'Debug query failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}