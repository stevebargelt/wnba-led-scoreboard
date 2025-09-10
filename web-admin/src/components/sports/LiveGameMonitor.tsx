import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SportType } from './SportCard'

interface LiveGame {
  sport: SportType
  eventId: string
  homeTeam: {
    name: string
    abbreviation: string
    score: number
  }
  awayTeam: {
    name: string
    abbreviation: string
    score: number
  }
  state: 'PRE' | 'LIVE' | 'FINAL'
  period: string
  clock: string
  startTime: string
  priorityScore: number
  isSelected: boolean
  selectionReason?: string
}

interface LiveGameMonitorProps {
  deviceId: string
  onGameOverride: (sport: SportType, gameEventId: string, reason: string) => Promise<void>
}

const SPORT_ICONS = {
  wnba: '🏀',
  nhl: '🏒', 
  nba: '🏀',
  mlb: '⚾',
  nfl: '🏈'
}

const STATE_COLORS = {
  PRE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  LIVE: 'bg-red-100 text-red-800 border-red-200',
  FINAL: 'bg-gray-100 text-gray-800 border-gray-200'
}

export function LiveGameMonitor({ deviceId, onGameOverride }: LiveGameMonitorProps) {
  const [liveGames, setLiveGames] = useState<LiveGame[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGame, setSelectedGame] = useState<LiveGame | null>(null)
  const [overrideReason, setOverrideReason] = useState('')

  useEffect(() => {
    loadLiveGames()
    const interval = setInterval(loadLiveGames, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [deviceId])

  const loadLiveGames = async () => {
    try {
      // This would fetch current games from a new API endpoint
      // For now, simulate with mock data
      const mockGames: LiveGame[] = [
        {
          sport: 'wnba',
          eventId: 'wnba_12345',
          homeTeam: { name: 'Seattle Storm', abbreviation: 'SEA', score: 78 },
          awayTeam: { name: 'Las Vegas Aces', abbreviation: 'LVA', score: 82 },
          state: 'LIVE',
          period: 'Q4',
          clock: '3:45',
          startTime: '2025-09-10T19:00:00Z',
          priorityScore: 1500,
          isSelected: true,
          selectionReason: 'WNBA priority #1 (LIVE game boost, favorite team)'
        },
        {
          sport: 'nhl',
          eventId: 'nhl_67890',
          homeTeam: { name: 'Seattle Kraken', abbreviation: 'SEA', score: 2 },
          awayTeam: { name: 'Vegas Golden Knights', abbreviation: 'VGK', score: 1 },
          state: 'LIVE',
          period: 'P2',
          clock: '15:23',
          startTime: '2025-09-10T19:30:00Z',
          priorityScore: 1200,
          isSelected: false,
          selectionReason: 'NHL priority #2 (LIVE game boost, favorite team)'
        }
      ]
      
      setLiveGames(mockGames)
    } catch (error) {
      console.error('Error loading live games:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGameSelect = async (game: LiveGame) => {
    setSelectedGame(game)
    
    if (game.eventId && onGameOverride) {
      try {
        await onGameOverride(game.sport, game.eventId, overrideReason || 'Manual selection from live monitor')
        setOverrideReason('')
        await loadLiveGames() // Refresh
      } catch (error) {
        console.error('Error overriding game:', error)
      }
    }
  }

  if (loading) {
    return (
      <Card>
        <div className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-12 bg-gray-200 rounded"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  const currentGame = liveGames.find(g => g.isSelected)
  const availableGames = liveGames.filter(g => !g.isSelected)

  return (
    <div className="space-y-4">
      {/* Current Game Display */}
      {currentGame && (
        <Card className="border-blue-200 bg-blue-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-blue-900">Currently Displaying</h3>
              <div className="flex items-center space-x-2">
                <span className="text-lg">{SPORT_ICONS[currentGame.sport]}</span>
                <Badge variant="default" className="border-blue-300 text-blue-700">
                  {currentGame.sport.toUpperCase()}
                </Badge>
                <Badge className={STATE_COLORS[currentGame.state]}>
                  {currentGame.state}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="text-right">
                <div className="font-medium">{currentGame.awayTeam.abbreviation}</div>
                <div className="text-2xl font-bold">{currentGame.awayTeam.score}</div>
              </div>
              
              <div className="text-center">
                <div className="text-sm text-gray-600">@</div>
                <div className="font-medium">{currentGame.period}</div>
                <div className="text-sm">{currentGame.clock}</div>
              </div>
              
              <div className="text-left">
                <div className="font-medium">{currentGame.homeTeam.abbreviation}</div>
                <div className="text-2xl font-bold">{currentGame.homeTeam.score}</div>
              </div>
            </div>

            {currentGame.selectionReason && (
              <div className="mt-3 text-xs text-blue-600 bg-blue-100 p-2 rounded">
                Selection reason: {currentGame.selectionReason}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Available Games */}
      {availableGames.length > 0 && (
        <Card>
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Other Active Games</h3>
            <div className="space-y-2">
              {availableGames.map(game => (
                <div 
                  key={game.eventId}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{SPORT_ICONS[game.sport]}</span>
                    <div>
                      <div className="font-medium">
                        {game.awayTeam.abbreviation} {game.awayTeam.score} - {game.homeTeam.score} {game.homeTeam.abbreviation}
                      </div>
                      <div className="text-sm text-gray-600">
                        {game.period} • {game.clock}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge variant="default" className="text-xs">
                      {game.sport.toUpperCase()}
                    </Badge>
                    <Badge className={STATE_COLORS[game.state]} size="sm">
                      {game.state}
                    </Badge>
                    <Badge variant="default" size="sm">
                      Score: {game.priorityScore}
                    </Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleGameSelect(game)}
                    >
                      Show This Game
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* No Games Available */}
      {liveGames.length === 0 && (
        <Card>
          <div className="p-8 text-center">
            <div className="text-4xl mb-2">🎯</div>
            <h3 className="font-medium text-gray-900 mb-2">No Active Games</h3>
            <p className="text-sm text-gray-600">
              No games are currently available across enabled sports.
            </p>
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={loadLiveGames}
              className="mt-3"
            >
              Refresh Games
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}