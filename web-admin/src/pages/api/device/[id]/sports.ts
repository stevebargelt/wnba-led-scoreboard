import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabaseClient'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id: deviceId } = req.query

  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ error: 'Device ID is required' })
  }

  if (req.method === 'GET') {
    try {
      // Get sport configuration for this device
      const { data: sportConfigs, error } = await supabase
        .from('device_sport_config')
        .select('*')
        .eq('device_id', deviceId)
        .order('priority')

      if (error) {
        console.error('Error fetching device sport config:', error)
        return res.status(500).json({ error: 'Failed to fetch sport configuration' })
      }

      // Get active game override if any
      const { data: activeOverride, error: overrideError } = await supabase.rpc(
        'get_active_game_override',
        { target_device_id: deviceId }
      )

      if (overrideError) {
        console.error('Error fetching active override:', overrideError)
        // Don't fail the request, just log the error
      }

      res.status(200).json({
        sportConfigs: sportConfigs || [],
        activeOverride: activeOverride?.[0] || null,
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

      // Update sport configurations
      for (const config of sportConfigs) {
        const { sport, enabled, priority, favoriteTeams } = config

        // Upsert sport configuration
        const { error: upsertError } = await supabase.from('device_sport_config').upsert(
          {
            device_id: deviceId,
            sport,
            enabled: enabled ?? false,
            priority: priority ?? 1,
            favorite_teams: favoriteTeams || [],
          },
          {
            onConflict: 'device_id,sport',
          }
        )

        if (upsertError) {
          console.error('Error upserting sport config:', upsertError)
          return res.status(500).json({ error: `Failed to update ${sport} configuration` })
        }
      }

      // If priority settings provided, update the main config
      if (prioritySettings) {
        const configContent = {
          sport_priority: prioritySettings,
          updated_at: new Date().toISOString(),
        }

        const { error: configError } = await supabase.from('configs').insert({
          device_id: deviceId,
          content: configContent,
          source: 'cloud',
        })

        if (configError) {
          console.error('Error saving priority config:', configError)
          return res.status(500).json({ error: 'Failed to save priority configuration' })
        }
      }

      res.status(200).json({ success: true })
    } catch (error) {
      console.error('API error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  } else if (req.method === 'POST') {
    try {
      const { action, sport, gameEventId, reason, durationMinutes } = req.body

      if (action === 'override_game') {
        // Create game override
        const expiresAt = new Date()
        expiresAt.setMinutes(expiresAt.getMinutes() + (durationMinutes || 60))

        const { error: overrideError } = await supabase.from('game_overrides').insert({
          device_id: deviceId,
          sport,
          game_event_id: gameEventId,
          expires_at: expiresAt.toISOString(),
          reason: reason || 'Manual override from web admin',
        })

        if (overrideError) {
          console.error('Error creating game override:', overrideError)
          return res.status(500).json({ error: 'Failed to create game override' })
        }

        res.status(200).json({ success: true, expiresAt: expiresAt.toISOString() })
      } else if (action === 'clear_override') {
        // Clear any active overrides
        const { error: clearError } = await supabase
          .from('game_overrides')
          .update({ expires_at: new Date().toISOString() })
          .eq('device_id', deviceId)
          .gt('expires_at', new Date().toISOString())

        if (clearError) {
          console.error('Error clearing overrides:', clearError)
          return res.status(500).json({ error: 'Failed to clear override' })
        }

        res.status(200).json({ success: true })
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
