import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { SportHierarchy, SportConfig, LeagueConfig } from '@/types/sports'

interface SportHierarchyViewProps {
  hierarchyData: SportHierarchy[]
  onSportSelect: (sport: SportConfig) => void
  onLeagueSelect: (league: LeagueConfig) => void
}

export function SportHierarchyView({
  hierarchyData,
  onSportSelect,
  onLeagueSelect,
}: SportHierarchyViewProps) {
  const [expandedSports, setExpandedSports] = useState<Set<string>>(new Set())

  const toggleSport = (sportCode: string) => {
    const newExpanded = new Set(expandedSports)
    if (newExpanded.has(sportCode)) {
      newExpanded.delete(sportCode)
    } else {
      newExpanded.add(sportCode)
    }
    setExpandedSports(newExpanded)
  }

  const getSportIcon = (sportCode: string): string => {
    const icons: Record<string, string> = {
      hockey: '🏒',
      basketball: '🏀',
      soccer: '⚽',
      football: '🏈',
      baseball: '⚾',
    }
    return icons[sportCode] || '🏆'
  }

  const getLeagueStatus = (league: LeagueConfig): 'active' | 'offseason' | 'upcoming' => {
    if (!league.currentSeason) return 'offseason'

    const now = new Date()
    const start = new Date(league.currentSeason.startDate)
    const end = new Date(league.currentSeason.endDate)

    if (now < start) return 'upcoming'
    if (now > end) return 'offseason'
    return 'active'
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {hierarchyData.map(({ sport, leagues }) => {
        const isExpanded = expandedSports.has(sport.code)

        return (
          <Card key={sport.code} className="hover:shadow-lg transition-shadow duration-200">
            <div
              className="p-4 cursor-pointer"
              onClick={() => toggleSport(sport.code)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  toggleSport(sport.code)
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">{getSportIcon(sport.code)}</span>
                  <div>
                    <h3 className="font-semibold text-lg">{sport.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {sport.timing.periodType === 'quarter' &&
                        `${sport.timing.regulationPeriods} Quarters`}
                      {sport.timing.periodType === 'period' &&
                        `${sport.timing.regulationPeriods} Periods`}
                      {sport.timing.periodType === 'half' &&
                        `${sport.timing.regulationPeriods} Halves`}
                      {sport.timing.periodType === 'inning' &&
                        `${sport.timing.regulationPeriods} Innings`}
                    </p>
                  </div>
                </div>
                <button
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={e => {
                    e.stopPropagation()
                    onSportSelect(sport)
                  }}
                >
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <Badge variant="default" size="sm">
                  {leagues.length} League{leagues.length !== 1 ? 's' : ''}
                </Badge>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                    isExpanded ? 'transform rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {isExpanded && leagues.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700">
                {leagues.map(league => {
                  const status = getLeagueStatus(league)

                  return (
                    <div
                      key={league.code}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      onClick={() => onLeagueSelect(league)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          onLeagueSelect(league)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{league.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {league.code.toUpperCase()} • {league.teamCount} teams
                          </div>
                        </div>
                        <Badge
                          variant={
                            status === 'active'
                              ? 'success'
                              : status === 'upcoming'
                                ? 'info'
                                : 'default'
                          }
                          size="sm"
                        >
                          {status}
                        </Badge>
                      </div>

                      {league.timingOverrides && (
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Overrides:</span>{' '}
                          {Object.keys(league.timingOverrides).join(', ')}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {isExpanded && leagues.length === 0 && (
              <div className="p-4 text-center text-gray-500 border-t border-gray-200 dark:border-gray-700">
                No leagues configured
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
