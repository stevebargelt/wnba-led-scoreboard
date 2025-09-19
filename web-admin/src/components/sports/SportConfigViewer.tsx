import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { SportConfig, LeagueConfig } from '@/types/sports'

interface SportConfigViewerProps {
  sport: SportConfig
  leagues: LeagueConfig[]
}

export function SportConfigViewer({ sport, leagues }: SportConfigViewerProps) {
  const renderTimingConfig = () => (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <span className="mr-2">⏱️</span>
        Timing Configuration
      </h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600 dark:text-gray-400">Period Type:</span>
          <span className="ml-2 font-medium capitalize">{sport.timing.periodType}</span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Regulation Periods:</span>
          <span className="ml-2 font-medium">{sport.timing.regulationPeriods}</span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Period Duration:</span>
          <span className="ml-2 font-medium">{sport.timing.periodDurationMinutes} min</span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Clock Direction:</span>
          <span className="ml-2 font-medium capitalize">
            {sport.timing.clockDirection === 'down'
              ? 'Count Down'
              : sport.timing.clockDirection === 'up'
                ? 'Count Up'
                : 'No Clock'}
          </span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Has Overtime:</span>
          <span className="ml-2 font-medium">{sport.timing.hasOvertime ? 'Yes' : 'No'}</span>
        </div>
        {sport.timing.hasOvertime && (
          <div>
            <span className="text-gray-600 dark:text-gray-400">OT Duration:</span>
            <span className="ml-2 font-medium">{sport.timing.overtimeDurationMinutes} min</span>
          </div>
        )}
        {sport.timing.hasShootout && (
          <div>
            <span className="text-gray-600 dark:text-gray-400">Has Shootout:</span>
            <span className="ml-2 font-medium">Yes</span>
          </div>
        )}
        <div>
          <span className="text-gray-600 dark:text-gray-400">Intermission:</span>
          <span className="ml-2 font-medium">{sport.timing.intermissionDurationMinutes} min</span>
        </div>
      </div>
    </Card>
  )

  const renderScoringConfig = () => (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <span className="mr-2">🎯</span>
        Scoring Configuration
      </h3>
      <div className="space-y-2">
        <div className="text-sm">
          <span className="text-gray-600 dark:text-gray-400">Default Score Value:</span>
          <span className="ml-2 font-medium">{sport.scoring.defaultScoreValue} point(s)</span>
        </div>
        <div className="mt-3">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Score Types:</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(sport.scoring.scoringTypes).map(([type, value]) => (
              <Badge key={type} variant="default" size="sm">
                {type}: {value} pt{value !== 1 ? 's' : ''}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )

  const renderTerminologyConfig = () => (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <span className="mr-2">📝</span>
        Terminology
      </h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600 dark:text-gray-400">Game Start:</span>
          <span className="ml-2 font-medium">{sport.terminology.gameStartTerm}</span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Period End:</span>
          <span className="ml-2 font-medium">{sport.terminology.periodEndTerm}</span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Game End:</span>
          <span className="ml-2 font-medium">{sport.terminology.gameEndTerm}</span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Overtime:</span>
          <span className="ml-2 font-medium">{sport.terminology.overtimeTerm}</span>
        </div>
      </div>
    </Card>
  )

  const renderExtensions = () => {
    if (!sport.extensions || Object.keys(sport.extensions).length === 0) {
      return null
    }

    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="mr-2">🔧</span>
          Sport-Specific Features
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {Object.entries(sport.extensions).map(([key, value]) => (
            <div key={key}>
              <span className="text-gray-600 dark:text-gray-400">
                {key
                  .replace(/_/g, ' ')
                  .replace(/([A-Z])/g, ' $1')
                  .trim()}
                :
              </span>
              <span className="ml-2 font-medium">
                {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  const renderLeagues = () => (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <span className="mr-2">🏆</span>
        Associated Leagues
      </h3>
      {leagues.length === 0 ? (
        <p className="text-gray-500">No leagues configured for this sport</p>
      ) : (
        <div className="space-y-3">
          {leagues.map(league => (
            <div
              key={league.code}
              className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{league.name}</div>
                  <div className="text-xs text-gray-500">{league.code.toUpperCase()}</div>
                </div>
                <Badge variant="info" size="sm">
                  {league.teamCount} teams
                </Badge>
              </div>
              {league.timingOverrides && Object.keys(league.timingOverrides).length > 0 && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  <strong>Overrides:</strong> {Object.keys(league.timingOverrides).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{sport.name}</h2>
          <p className="text-gray-600 dark:text-gray-400">Sport code: {sport.code}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {renderTimingConfig()}
        {renderScoringConfig()}
        {renderTerminologyConfig()}
        {renderExtensions()}
      </div>

      <div className="mt-6">{renderLeagues()}</div>
    </div>
  )
}
