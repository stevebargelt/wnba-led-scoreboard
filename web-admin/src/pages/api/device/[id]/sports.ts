import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id: deviceId } = req.query

  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ error: 'Device ID is required' })
  }

  console.log('[DEV] Multi-sport API endpoint called for device:', deviceId)

  if (req.method === 'GET') {
    try {
      // For now, return mock data until auth is properly configured
      // TODO: Implement proper database queries once RLS is working
      console.log('[DEV] Returning mock sport configuration for device:', deviceId)

      const mockSportConfigs = [
        {
          sport: 'wnba',
          enabled: true,
          priority: 1,
          favorite_teams: ['SEA', 'LVA'],
        },
        {
          sport: 'nhl',
          enabled: false,
          priority: 2,
          favorite_teams: ['SEA', 'VGK'],
        },
      ]

      res.status(200).json({
        sportConfigs: mockSportConfigs,
        activeOverride: null,
      })
    } catch (error) {
      console.error('API error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  } else if (req.method === 'PUT') {
    try {
      const { sportConfigs, prioritySettings } = req.body

      if (!Array.isArray(sportConfigs)) {
        return res.status(400).json({ error: 'sportConfigs must be an array' })
      }

      // Mock save for testing UI
      console.log('[DEV] Mock saving sport configuration:', { 
        deviceId, 
        sportConfigs: sportConfigs.length,
        prioritySettings 
      })
      
      // TODO: Implement real database save once auth is working
      res.status(200).json({ success: true, message: 'Configuration saved (development mode)' })
    } catch (error) {
      console.error('API error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  } else if (req.method === 'POST') {
    try {
      const { action, sport, gameEventId, reason, durationMinutes } = req.body

      console.log('[DEV] Mock game override action:', { action, sport, gameEventId, reason })

      if (action === 'override_game') {
        const expiresAt = new Date()
        expiresAt.setMinutes(expiresAt.getMinutes() + (durationMinutes || 60))
        
        res.status(200).json({ success: true, expiresAt: expiresAt.toISOString(), message: 'Override created (development mode)' })
      } else if (action === 'clear_override') {
        res.status(200).json({ success: true, message: 'Override cleared (development mode)' })
      } else {
        res.status(400).json({ error: 'Invalid action' })
      }
    } catch (error) {
      console.error('API error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT', 'POST'])
    res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}
