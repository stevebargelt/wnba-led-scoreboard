import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Toggle } from '@/components/ui/Toggle'

export type SportType = 'wnba' | 'nhl' | 'nba' | 'mlb' | 'nfl'

export interface SportConfig {
  sport: SportType
  enabled: boolean
  priority: number
  favoriteTeams: string[]
}

interface SportCardProps {
  sportConfig: SportConfig
  availableTeams: Array<{
    id: string
    name: string
    abbreviation: string
    conference?: string
    division?: string
  }>
  onToggle: (sport: SportType, enabled: boolean) => void
  onPriorityChange: (sport: SportType, priority: number) => void
  onFavoriteTeamsChange: (sport: SportType, teams: string[]) => void
  onDragStart?: (sport: SportType) => void
  onDragEnd?: () => void
  isDragging?: boolean
}

const SPORT_DISPLAY_INFO = {
  wnba: {
    name: 'WNBA',
    fullName: "Women's National Basketball Association",
    icon: '🏀',
    color: 'orange',
    season: 'May - October',
  },
  nhl: {
    name: 'NHL',
    fullName: 'National Hockey League',
    icon: '🏒',
    color: 'blue',
    season: 'October - June',
  },
  nba: {
    name: 'NBA',
    fullName: 'National Basketball Association',
    icon: '🏀',
    color: 'red',
    season: 'October - June',
  },
  mlb: {
    name: 'MLB',
    fullName: 'Major League Baseball',
    icon: '⚾',
    color: 'green',
    season: 'March - October',
  },
  nfl: {
    name: 'NFL',
    fullName: 'National Football League',
    icon: '🏈',
    color: 'purple',
    season: 'September - February',
  },
}

export function SportCard({
  sportConfig,
  availableTeams,
  onToggle,
  onPriorityChange,
  onFavoriteTeamsChange,
  onDragStart,
  onDragEnd,
  isDragging = false,
}: SportCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(
    new Set(sportConfig.favoriteTeams)
  )

  const sportInfo = SPORT_DISPLAY_INFO[sportConfig.sport]

  const handleTeamToggle = (teamId: string) => {
    const newSelection = new Set(selectedTeams)
    if (newSelection.has(teamId)) {
      newSelection.delete(teamId)
    } else {
      newSelection.add(teamId)
    }

    setSelectedTeams(newSelection)
    onFavoriteTeamsChange(sportConfig.sport, Array.from(newSelection))
  }

  const handlePriorityChange = (change: number) => {
    const newPriority = Math.max(1, Math.min(10, sportConfig.priority + change))
    onPriorityChange(sportConfig.sport, newPriority)
  }

  return (
    <Card
      className={`transition-all duration-200 ${
        isDragging ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
      } ${sportConfig.enabled ? 'ring-2 ring-blue-200' : 'bg-gray-50'}`}
      draggable
      onDragStart={() => onDragStart?.(sportConfig.sport)}
      onDragEnd={onDragEnd}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{sportInfo.icon}</span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-lg">{sportInfo.name}</h3>
                <Badge variant={sportConfig.enabled ? 'success' : 'default'} size="sm">
                  Priority #{sportConfig.priority}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{sportInfo.fullName}</p>
              <p className="text-xs text-gray-500">{sportInfo.season}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Priority Controls */}
            <div className="flex flex-col space-y-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handlePriorityChange(-1)}
                disabled={sportConfig.priority <= 1}
                className="px-2 py-1 h-6 text-xs"
              >
                ↑
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handlePriorityChange(1)}
                disabled={sportConfig.priority >= 10}
                className="px-2 py-1 h-6 text-xs"
              >
                ↓
              </Button>
            </div>

            {/* Enable/Disable Toggle */}
            <Toggle
              checked={sportConfig.enabled}
              onChange={checked => onToggle(sportConfig.sport, checked)}
              label={sportInfo.name}
              size="md"
            />
          </div>
        </div>

        {/* Favorite Teams Section */}
        {sportConfig.enabled && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Favorite Teams ({selectedTeams.size})
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs"
              >
                {isExpanded ? 'Hide' : 'Show'} Teams
              </Button>
            </div>

            {/* Selected Teams Summary */}
            {selectedTeams.size > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {Array.from(selectedTeams)
                  .slice(0, 5)
                  .map(teamId => {
                    const team = availableTeams.find(t => t.id === teamId)
                    return team ? (
                      <Badge key={teamId} variant="info" size="sm">
                        {team.abbreviation}
                      </Badge>
                    ) : null
                  })}
                {selectedTeams.size > 5 && (
                  <Badge variant="default" size="sm">
                    +{selectedTeams.size - 5} more
                  </Badge>
                )}
              </div>
            )}

            {/* Team Selection */}
            {isExpanded && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md max-h-48 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  {availableTeams.map(team => (
                    <label
                      key={team.id}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTeams.has(team.id)}
                        onChange={() => handleTeamToggle(team.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">
                        <span className="font-medium">{team.abbreviation}</span>
                        <span className="text-gray-600 ml-1">{team.name}</span>
                      </span>
                    </label>
                  ))}
                </div>

                {availableTeams.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No teams available. Try fetching {sportInfo.name} assets first.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* Disabled State Message */}
        {!sportConfig.enabled && (
          <div className="text-center py-3">
            <p className="text-sm text-gray-500">
              Enable {sportInfo.name} to configure favorite teams
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
