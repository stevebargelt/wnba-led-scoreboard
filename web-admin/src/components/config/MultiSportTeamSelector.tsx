import React, { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useMultiSportTeams, Team } from '@/lib/useMultiSportTeams'

interface MultiSportTeamSelectorProps {
  selectedTeam: { name: string; abbr?: string; id?: string } | null
  onTeamSelect: (team: { name: string; abbr: string; id?: string }) => void
  placeholder?: string
  className?: string
}

const SPORT_ICONS = {
  wnba: '🏀',
  nhl: '🏒',
  nba: '🏀',
  mlb: '⚾',
  nfl: '🏈',
}

const SPORT_COLORS = {
  wnba: 'bg-orange-100 text-orange-800 border-orange-200',
  nhl: 'bg-blue-100 text-blue-800 border-blue-200',
  nba: 'bg-red-100 text-red-800 border-red-200',
  mlb: 'bg-green-100 text-green-800 border-green-200',
  nfl: 'bg-purple-100 text-purple-800 border-purple-200',
}

export function MultiSportTeamSelector({
  selectedTeam,
  onTeamSelect,
  placeholder = 'Search teams...',
  className = '',
}: MultiSportTeamSelectorProps) {
  const { teams, loading, error, getTeamsByGroup } = useMultiSportTeams()
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedSport, setSelectedSport] = useState<string>('all')

  const filteredTeams = useMemo(() => {
    const teamsByGroup = getTeamsByGroup('sport')
    const allTeams = Object.values(teamsByGroup).flat()

    let filtered = allTeams

    // Filter by sport if selected
    if (selectedSport !== 'all') {
      filtered = filtered.filter(team => team.sport === selectedSport)
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        team =>
          team.name.toLowerCase().includes(term) || team.abbreviation.toLowerCase().includes(term)
      )
    }

    // Group filtered results by sport for display
    const grouped: { [sport: string]: Team[] } = {}
    filtered.forEach(team => {
      if (!grouped[team.sport]) {
        grouped[team.sport] = []
      }
      grouped[team.sport].push(team)
    })

    return grouped
  }, [searchTerm, selectedSport, getTeamsByGroup])

  const availableSports = Object.keys(teams)

  const handleTeamClick = (team: Team) => {
    onTeamSelect({
      name: team.name,
      abbr: team.abbreviation,
      id: team.id,
    })
    setIsOpen(false)
    setSearchTerm('')
  }

  if (loading) {
    return (
      <div className={`relative ${className}`}>
        <Input placeholder="Loading teams..." disabled className="pr-10" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`relative ${className}`}>
        <Input placeholder="Error loading teams" disabled className="pr-10" />
        <p className="text-xs text-red-600 mt-1">Error: {error}. Using WNBA teams only.</p>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Input
          value={selectedTeam?.name || searchTerm}
          onChange={e => {
            setSearchTerm(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pr-10"
        />

        {selectedTeam && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onTeamSelect({ name: '', abbr: '' })
              setSearchTerm('')
            }}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 px-1 h-6"
          >
            ✕
          </Button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-hidden">
          {/* Sport Filter */}
          <div className="p-3 border-b border-gray-200">
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant={selectedSport === 'all' ? 'primary' : 'ghost'}
                onClick={() => setSelectedSport('all')}
                className="px-2 py-1 text-xs h-6"
              >
                All Sports
              </Button>
              {availableSports.map(sport => (
                <Button
                  key={sport}
                  size="sm"
                  variant={selectedSport === sport ? 'primary' : 'ghost'}
                  onClick={() => setSelectedSport(sport)}
                  className="px-2 py-1 text-xs h-6"
                >
                  {SPORT_ICONS[sport as keyof typeof SPORT_ICONS]} {sport.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          {/* Teams List */}
          <div className="max-h-64 overflow-y-auto">
            {Object.entries(filteredTeams).map(([sport, sportTeams]) => (
              <div key={sport}>
                {/* Sport Header */}
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center space-x-2">
                    <span>{SPORT_ICONS[sport as keyof typeof SPORT_ICONS]}</span>
                    <span className="font-medium text-sm text-gray-700">{sport.toUpperCase()}</span>
                    <Badge
                      variant="info"
                      size="sm"
                      className={
                        SPORT_COLORS[sport as keyof typeof SPORT_COLORS] ||
                        'bg-gray-100 text-gray-800'
                      }
                    >
                      {sportTeams.length} teams
                    </Badge>
                  </div>
                </div>

                {/* Teams */}
                <div className="max-h-48 overflow-y-auto">
                  {sportTeams.map(team => (
                    <button
                      key={`${sport}-${team.id}`}
                      onClick={() => handleTeamClick(team)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{team.name}</div>
                          {team.conference && (
                            <div className="text-xs text-gray-500">
                              {team.conference} • {team.division}
                            </div>
                          )}
                        </div>
                        <Badge variant="info" size="sm">
                          {team.abbreviation}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* No Results */}
          {Object.keys(filteredTeams).length === 0 && (
            <div className="p-4 text-center text-gray-500">
              <div className="text-sm">No teams found</div>
              {searchTerm && (
                <div className="text-xs">
                  Try searching for a different team name or abbreviation
                </div>
              )}
            </div>
          )}

          {/* Close Button */}
          <div className="p-2 border-t border-gray-200 bg-gray-50">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              className="w-full text-xs"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Click Outside Handler */}
      {isOpen && (
        <button
          className="fixed inset-0 z-40 cursor-default"
          onClick={() => setIsOpen(false)}
          onKeyDown={e => e.key === 'Escape' && setIsOpen(false)}
          aria-label="Close team selector"
          type="button"
        />
      )}
    </div>
  )
}
