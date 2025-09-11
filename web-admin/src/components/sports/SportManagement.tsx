import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Toggle } from '@/components/ui/Toggle'
import { SportCard, SportType, SportConfig } from './SportCard'
import { supabase } from '@/lib/supabaseClient'

interface SportManagementProps {
  deviceId: string
}

interface PrioritySettings {
  conflictResolution: 'priority' | 'live_first' | 'manual'
  liveGameBoost: boolean
  favoriteTeamBoost: boolean
  closeGameBoost: boolean
  playoffBoost: boolean
}

interface CurrentGame {
  sport: SportType
  eventId: string
  matchup: string
  state: string
  priorityScore: number
  reason: string
}

export function SportManagement({ deviceId }: SportManagementProps) {
  const [sportConfigs, setSportConfigs] = useState<SportConfig[]>([])
  const [availableTeams, setAvailableTeams] = useState<Record<SportType, any[]>>({
    wnba: [],
    nhl: [],
    nba: [],
    mlb: [],
    nfl: [],
  })
  const [prioritySettings, setPrioritySettings] = useState<PrioritySettings>({
    conflictResolution: 'priority',
    liveGameBoost: true,
    favoriteTeamBoost: true,
    closeGameBoost: true,
    playoffBoost: true,
  })
  const [currentGame, setCurrentGame] = useState<CurrentGame | null>(null)
  const [activeOverride, setActiveOverride] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draggedSport, setDraggedSport] = useState<SportType | null>(null)

  useEffect(() => {
    loadData()
  }, [deviceId])

  const loadData = async () => {
    try {
      setLoading(true)

      // Load available sports and teams
      const sportsRes = await fetch('/api/sports')
      const sportsData = await sportsRes.json()

      if (sportsData.sports) {
        setAvailableTeams(sportsData.sports)
      }

      // Load device sport configuration
      const deviceRes = await fetch(`/api/device/${deviceId}/sports`)
      const deviceData = await deviceRes.json()

      if (deviceData.sportConfigs) {
        // Convert to SportConfig format with proper typing
        const configs: SportConfig[] = deviceData.sportConfigs.map(
          (config: any): SportConfig => ({
            sport: config.sport as SportType,
            enabled: Boolean(config.enabled),
            priority: Number(config.priority),
            favoriteTeams: Array.isArray(config.favorite_teams) ? config.favorite_teams : [],
          })
        )

        // Ensure all sports are represented
        const allSports: SportType[] = ['wnba', 'nhl', 'nba', 'mlb', 'nfl']
        const configMap = new Map(configs.map(c => [c.sport, c]))

        const fullConfigs: SportConfig[] = allSports.map((sport): SportConfig => {
          const existing = configMap.get(sport)
          if (existing) {
            return existing
          }

          return {
            sport,
            enabled: sport === 'wnba', // WNBA enabled by default
            priority: sport === 'wnba' ? 1 : allSports.indexOf(sport) + 1,
            favoriteTeams: [],
          }
        })

        setSportConfigs(fullConfigs)
      }

      if (deviceData.activeOverride) {
        setActiveOverride(deviceData.activeOverride)
      }
    } catch (error) {
      console.error('Error loading sport management data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSportToggle = (sport: SportType, enabled: boolean) => {
    setSportConfigs(prev =>
      prev.map(config => (config.sport === sport ? { ...config, enabled } : config))
    )
  }

  const handlePriorityChange = (sport: SportType, priority: number) => {
    setSportConfigs(prev =>
      prev.map(config => (config.sport === sport ? { ...config, priority } : config))
    )
  }

  const handleFavoriteTeamsChange = (sport: SportType, teams: string[]) => {
    setSportConfigs(prev =>
      prev.map(config => (config.sport === sport ? { ...config, favoriteTeams: teams } : config))
    )
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      const response = await fetch(`/api/device/${deviceId}/sports`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sportConfigs: sportConfigs.map(config => ({
            sport: config.sport,
            enabled: config.enabled,
            priority: config.priority,
            favoriteTeams: config.favoriteTeams,
          })),
          prioritySettings,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save configuration')
      }

      console.log('Sport configuration saved successfully')

      // Refresh data to show updated state
      await loadData()
    } catch (error) {
      console.error('Error saving sport configuration:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleOverrideGame = async (sport: SportType, gameEventId: string, reason: string = '') => {
    try {
      const response = await fetch(`/api/device/${deviceId}/sports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'override_game',
          sport,
          gameEventId,
          reason,
          durationMinutes: 60,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create game override')
      }

      await loadData() // Refresh to show new override
    } catch (error) {
      console.error('Error creating game override:', error)
    }
  }

  const handleClearOverride = async () => {
    try {
      const response = await fetch(`/api/device/${deviceId}/sports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'clear_override',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to clear override')
      }

      await loadData() // Refresh
    } catch (error) {
      console.error('Error clearing override:', error)
    }
  }

  // Drag and drop for priority reordering
  const handleDragStart = (sport: SportType) => {
    setDraggedSport(sport)
  }

  const handleDragEnd = () => {
    setDraggedSport(null)
  }

  const handleDrop = (targetSport: SportType) => {
    if (!draggedSport || draggedSport === targetSport) return

    // Swap priorities
    const draggedConfig = sportConfigs.find(c => c.sport === draggedSport)
    const targetConfig = sportConfigs.find(c => c.sport === targetSport)

    if (draggedConfig && targetConfig) {
      const newPriority = targetConfig.priority
      handlePriorityChange(draggedSport, newPriority)
      handlePriorityChange(targetSport, draggedConfig.priority)
    }
  }

  if (loading) {
    return <div className="p-4">Loading sport configuration...</div>
  }

  const enabledSports = sportConfigs.filter(c => c.enabled).length
  const hasChanges = true // You could implement change tracking

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Sport Configuration</h2>
          <p className="text-sm text-gray-600">
            Manage which sports are displayed and their priorities
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant={enabledSports > 1 ? 'success' : 'default'}>
            {enabledSports} Sport{enabledSports !== 1 ? 's' : ''} Enabled
          </Badge>
          <Button onClick={handleSave} disabled={saving || !hasChanges} size="sm">
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </div>

      {/* Active Override Alert */}
      {activeOverride && (
        <Card className="border-orange-200 bg-orange-50">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-orange-800">Manual Override Active</h3>
                <p className="text-sm text-orange-600">
                  Showing {activeOverride.sport.toUpperCase()} game {activeOverride.game_event_id}
                  {activeOverride.reason && ` - ${activeOverride.reason}`}
                </p>
                <p className="text-xs text-orange-500">
                  Expires: {new Date(activeOverride.expires_at).toLocaleString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleClearOverride}
                className="border-orange-300 text-orange-700 hover:bg-orange-100"
              >
                Clear Override
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Sport Cards */}
      <div className="space-y-4">
        {sportConfigs
          .sort((a, b) => a.priority - b.priority)
          .map(config => (
            <div
              key={config.sport}
              onDrop={e => {
                e.preventDefault()
                handleDrop(config.sport)
              }}
              onDragOver={e => e.preventDefault()}
            >
              <SportCard
                sportConfig={config}
                availableTeams={availableTeams[config.sport] || []}
                onToggle={handleSportToggle}
                onPriorityChange={handlePriorityChange}
                onFavoriteTeamsChange={handleFavoriteTeamsChange}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                isDragging={draggedSport === config.sport}
              />
            </div>
          ))}
      </div>

      {/* Priority Settings */}
      <Card>
        <div className="p-4">
          <h3 className="font-medium text-gray-900 mb-3">Priority Settings</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Live games get priority boost</span>
              <Toggle
                checked={prioritySettings.liveGameBoost}
                onChange={checked =>
                  setPrioritySettings(prev => ({ ...prev, liveGameBoost: checked }))
                }
                size="sm"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Favorite teams get priority boost</span>
              <Toggle
                checked={prioritySettings.favoriteTeamBoost}
                onChange={checked =>
                  setPrioritySettings(prev => ({ ...prev, favoriteTeamBoost: checked }))
                }
                size="sm"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Close games get priority boost</span>
              <Toggle
                checked={prioritySettings.closeGameBoost}
                onChange={checked =>
                  setPrioritySettings(prev => ({ ...prev, closeGameBoost: checked }))
                }
                size="sm"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Conflict resolution strategy</span>
              <select
                value={prioritySettings.conflictResolution}
                onChange={e =>
                  setPrioritySettings(prev => ({
                    ...prev,
                    conflictResolution: e.target.value as any,
                  }))
                }
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="priority">Sport Priority Order</option>
                <option value="live_first">Live Games First</option>
                <option value="manual">Manual Selection Only</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card>
        <div className="p-4">
          <h3 className="font-medium text-gray-900 mb-3">Quick Actions</h3>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => handleSportToggle('wnba', true)}>
              Enable WNBA
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleSportToggle('nhl', true)}>
              Enable NHL
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSportConfigs(prev => prev.map(config => ({ ...config, favoriteTeams: [] })))
              }}
            >
              Clear All Favorites
            </Button>
            <Button size="sm" variant="secondary" onClick={loadData}>
              Refresh Data
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
