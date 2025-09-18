import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Toggle } from '@/components/ui/Toggle'
import { Badge } from '@/components/ui/Badge'
import type { LeagueConfig, SportConfig, TimingConfig } from '@/types/sports'

interface LeagueConfigEditorProps {
  league: LeagueConfig
  sport: SportConfig
  onSave: (league: LeagueConfig) => void
  onCancel: () => void
}

export function LeagueConfigEditor({ league, sport, onSave, onCancel }: LeagueConfigEditorProps) {
  const [editedLeague, setEditedLeague] = useState<LeagueConfig>({
    ...league,
    timingOverrides: league.timingOverrides || {},
  })

  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleTimingOverride = (field: keyof TimingConfig, value: any) => {
    setEditedLeague({
      ...editedLeague,
      timingOverrides: {
        ...editedLeague.timingOverrides,
        [field]: value,
      },
    })
  }

  const removeTimingOverride = (field: keyof TimingConfig) => {
    const newOverrides = { ...editedLeague.timingOverrides }
    delete newOverrides[field]
    setEditedLeague({
      ...editedLeague,
      timingOverrides: newOverrides,
    })
  }

  const handleSave = () => {
    onSave(editedLeague)
  }

  const getEffectiveValue = (field: keyof TimingConfig): any => {
    if (editedLeague.timingOverrides?.[field] !== undefined) {
      return editedLeague.timingOverrides[field]
    }
    return sport.timing[field]
  }

  const isOverridden = (field: keyof TimingConfig): boolean => {
    return editedLeague.timingOverrides?.[field] !== undefined
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{league.name}</h2>
          <p className="text-gray-600 dark:text-gray-400">
            League code: {league.code} • Sport: {sport.name}
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>

      {/* Basic Information */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              League Name
            </label>
            <Input
              value={editedLeague.name}
              onChange={e => setEditedLeague({ ...editedLeague, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Team Count
            </label>
            <Input
              type="number"
              value={editedLeague.teamCount}
              onChange={e =>
                setEditedLeague({
                  ...editedLeague,
                  teamCount: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>
        </div>
      </Card>

      {/* Timing Overrides */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Timing Configuration</h3>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Period Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Period Duration (minutes)
              {isOverridden('periodDurationMinutes') && (
                <Badge variant="info" size="sm" className="ml-2">
                  Override
                </Badge>
              )}
            </label>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                value={getEffectiveValue('periodDurationMinutes')}
                onChange={e =>
                  handleTimingOverride('periodDurationMinutes', parseFloat(e.target.value) || 0)
                }
              />
              {isOverridden('periodDurationMinutes') && (
                <button
                  onClick={() => removeTimingOverride('periodDurationMinutes')}
                  className="text-red-600 hover:text-red-700"
                  title="Reset to sport default"
                >
                  ✕
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Sport default: {sport.timing.periodDurationMinutes} min
            </p>
          </div>

          {/* Overtime Duration */}
          {sport.timing.hasOvertime && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Overtime Duration (minutes)
                {isOverridden('overtimeDurationMinutes') && (
                  <Badge variant="info" size="sm" className="ml-2">
                    Override
                  </Badge>
                )}
              </label>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  value={getEffectiveValue('overtimeDurationMinutes')}
                  onChange={e =>
                    handleTimingOverride('overtimeDurationMinutes', parseFloat(e.target.value) || 0)
                  }
                />
                {isOverridden('overtimeDurationMinutes') && (
                  <button
                    onClick={() => removeTimingOverride('overtimeDurationMinutes')}
                    className="text-red-600 hover:text-red-700"
                    title="Reset to sport default"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Sport default: {sport.timing.overtimeDurationMinutes} min
              </p>
            </div>
          )}

          {showAdvanced && (
            <>
              {/* Has Shootout */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Has Shootout
                  {isOverridden('hasShootout') && (
                    <Badge variant="info" size="sm" className="ml-2">
                      Override
                    </Badge>
                  )}
                </label>
                <div className="flex items-center space-x-2">
                  <Toggle
                    checked={getEffectiveValue('hasShootout')}
                    onChange={checked => handleTimingOverride('hasShootout', checked)}
                    label="Enable Shootout"
                  />
                  {isOverridden('hasShootout') && (
                    <button
                      onClick={() => removeTimingOverride('hasShootout')}
                      className="text-red-600 hover:text-red-700"
                      title="Reset to sport default"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Intermission Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Intermission Duration (minutes)
                  {isOverridden('intermissionDurationMinutes') && (
                    <Badge variant="info" size="sm" className="ml-2">
                      Override
                    </Badge>
                  )}
                </label>
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    value={getEffectiveValue('intermissionDurationMinutes')}
                    onChange={e =>
                      handleTimingOverride(
                        'intermissionDurationMinutes',
                        parseFloat(e.target.value) || 0
                      )
                    }
                  />
                  {isOverridden('intermissionDurationMinutes') && (
                    <button
                      onClick={() => removeTimingOverride('intermissionDurationMinutes')}
                      className="text-red-600 hover:text-red-700"
                      title="Reset to sport default"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Show overrides summary */}
        {Object.keys(editedLeague.timingOverrides || {}).length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              Active Overrides:
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(editedLeague.timingOverrides || {}).map(([key, value]) => (
                <Badge key={key} variant="info" size="sm">
                  {key}: {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* API Configuration */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">API Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Base URL
            </label>
            <Input
              value={editedLeague.api.baseUrl}
              onChange={e =>
                setEditedLeague({
                  ...editedLeague,
                  api: { ...editedLeague.api, baseUrl: e.target.value },
                })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rate Limit (per minute)
              </label>
              <Input
                type="number"
                value={editedLeague.api.rateLimitPerMinute}
                onChange={e =>
                  setEditedLeague({
                    ...editedLeague,
                    api: {
                      ...editedLeague.api,
                      rateLimitPerMinute: parseInt(e.target.value) || 60,
                    },
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cache TTL (seconds)
              </label>
              <Input
                type="number"
                value={editedLeague.api.cacheTTLSeconds}
                onChange={e =>
                  setEditedLeague({
                    ...editedLeague,
                    api: {
                      ...editedLeague.api,
                      cacheTTLSeconds: parseInt(e.target.value) || 300,
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Season Information */}
      {editedLeague.currentSeason && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Current Season</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={editedLeague.currentSeason.startDate}
                onChange={e =>
                  setEditedLeague({
                    ...editedLeague,
                    currentSeason: {
                      ...editedLeague.currentSeason!,
                      startDate: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <Input
                type="date"
                value={editedLeague.currentSeason.endDate}
                onChange={e =>
                  setEditedLeague({
                    ...editedLeague,
                    currentSeason: {
                      ...editedLeague.currentSeason!,
                      endDate: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Playoff Start
              </label>
              <Input
                type="date"
                value={editedLeague.currentSeason.playoffStart || ''}
                onChange={e =>
                  setEditedLeague({
                    ...editedLeague,
                    currentSeason: {
                      ...editedLeague.currentSeason!,
                      playoffStart: e.target.value || undefined,
                    },
                  })
                }
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
