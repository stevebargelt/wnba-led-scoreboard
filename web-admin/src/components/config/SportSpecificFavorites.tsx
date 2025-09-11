import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { useMultiSportTeams, Team } from '@/lib/useMultiSportTeams'

interface SportSpecificFavoritesProps {
  sport: 'wnba' | 'nhl'
  selectedTeams: string[] // Array of team names/abbreviations
  onTeamsChange: (teams: { name: string; abbr: string; id?: string }[]) => void
  onAddTeam: (team: { name: string; abbr: string; id?: string }) => void
}

const SPORT_INFO = {
  wnba: {
    name: 'WNBA',
    icon: '🏀',
    color: 'orange',
    description: 'Women\'s National Basketball Association'
  },
  nhl: {
    name: 'NHL', 
    icon: '🏒',
    color: 'blue',
    description: 'National Hockey League'
  }
}

export function SportSpecificFavorites({ 
  sport, 
  selectedTeams, 
  onTeamsChange, 
  onAddTeam 
}: SportSpecificFavoritesProps) {
  const { getTeamsForSport, loading, error } = useMultiSportTeams()
  const [searchTerm, setSearchTerm] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const sportTeams = getTeamsForSport(sport)
  const sportInfo = SPORT_INFO[sport]

  const filteredTeams = sportTeams.filter(team => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return team.name.toLowerCase().includes(term) || 
           team.abbreviation.toLowerCase().includes(term)
  })

  const handleTeamSelect = (team: Team) => {
    onAddTeam({
      name: team.name,
      abbr: team.abbreviation,
      id: team.id
    })
    setSearchTerm('')
    setIsExpanded(false)
  }

  const isTeamSelected = (team: Team) => {
    return selectedTeams.some(selected => 
      selected === team.name || 
      selected === team.abbreviation ||
      selected === team.id
    )
  }

  if (loading) {
    return (
      <Card className="opacity-50">
        <div className="p-4">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-xl">{sportInfo.icon}</span>
            <span className="font-medium">{sportInfo.name}</span>
          </div>
          <p className="text-sm text-gray-500">Loading teams...</p>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <div className="p-4">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-xl">{sportInfo.icon}</span>
            <span className="font-medium text-red-700">{sportInfo.name}</span>
          </div>
          <p className="text-sm text-red-600">Error loading teams: {error}</p>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="p-4">
        {/* Sport Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xl">{sportInfo.icon}</span>
            <div>
              <h3 className="font-medium">{sportInfo.name} Favorites</h3>
              <p className="text-xs text-gray-500">{sportInfo.description}</p>
            </div>
          </div>
          <Badge variant="info" size="sm">
            {selectedTeams.length} selected
          </Badge>
        </div>

        {/* Selected Teams */}
        {selectedTeams.length > 0 && (
          <div className="mb-3">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Teams:</h4>
            <div className="flex flex-wrap gap-1">
              {selectedTeams.map((teamIdentifier, index) => {
                const team = sportTeams.find(t => 
                  t.name === teamIdentifier || 
                  t.abbreviation === teamIdentifier ||
                  t.id === teamIdentifier
                )
                
                return (
                  <div key={index} className="flex items-center space-x-1">
                    <Badge variant="success" size="sm">
                      {team?.abbreviation || teamIdentifier}
                    </Badge>
                    <button
                      onClick={() => {
                        const newTeams = selectedTeams.filter((_, i) => i !== index)
                        const teamObjects = newTeams.map(id => {
                          const t = sportTeams.find(team => 
                            team.name === id || team.abbreviation === id || team.id === id
                          )
                          return {
                            name: t?.name || id,
                            abbr: t?.abbreviation || id,
                            id: t?.id
                          }
                        })
                        onTeamsChange(teamObjects)
                      }}
                      className="text-red-600 hover:text-red-800 text-xs"
                      aria-label={`Remove ${team?.name || teamIdentifier}`}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Add Team Section */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${sportInfo.name} teams...`}
              className="flex-1"
              onFocus={() => setIsExpanded(true)}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-2"
            >
              {isExpanded ? '↑' : '↓'}
            </Button>
          </div>

          {/* Team List */}
          {isExpanded && (
            <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
              {filteredTeams.length === 0 && (
                <div className="p-3 text-center text-gray-500 text-sm">
                  {searchTerm ? `No ${sportInfo.name} teams match "${searchTerm}"` : `No ${sportInfo.name} teams available`}
                </div>
              )}
              
              {filteredTeams.map(team => (
                <button
                  key={team.id}
                  onClick={() => handleTeamSelect(team)}
                  disabled={isTeamSelected(team)}
                  className={`w-full text-left p-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0 ${
                    isTeamSelected(team) ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{team.name}</div>
                      <div className="text-xs text-gray-500">
                        {team.conference} Conference • {team.division} Division
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="info" size="sm">
                        {team.abbreviation}
                      </Badge>
                      {isTeamSelected(team) && (
                        <Badge variant="success" size="sm">
                          ✓
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Add Popular Teams */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Add:</h4>
          <div className="flex flex-wrap gap-1">
            {sportTeams.slice(0, 6).map(team => (
              <Button
                key={team.id}
                size="sm"
                variant={isTeamSelected(team) ? "success" : "ghost"}
                onClick={() => !isTeamSelected(team) && handleTeamSelect(team)}
                disabled={isTeamSelected(team)}
                className="text-xs px-2 py-1 h-6"
              >
                {team.abbreviation}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}