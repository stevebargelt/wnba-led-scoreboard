import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { SportSpecificFavorites } from './SportSpecificFavorites'

interface FavoriteTeam {
  name: string
  abbr: string
  id?: string
}

interface MultiSportConfigEditorProps {
  deviceId: string
  onConfigChange?: (config: any) => void
}

export function MultiSportConfigEditor({ deviceId, onConfigChange }: MultiSportConfigEditorProps) {
  const [wnbaFavorites, setWnbaFavorites] = useState<FavoriteTeam[]>([])
  const [nhlFavorites, setNhlFavorites] = useState<FavoriteTeam[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load existing favorites when component mounts
  useEffect(() => {
    loadExistingFavorites()
  }, [deviceId])

  const loadExistingFavorites = async () => {
    try {
      setLoading(true)

      // This would load from the main config in a real implementation
      // For now, initialize with sample data
      setWnbaFavorites([{ name: 'Seattle Storm', abbr: 'SEA', id: '18' }])
      setNhlFavorites([])
    } catch (error) {
      console.error('Error loading existing favorites:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleWnbaTeamsChange = (teams: FavoriteTeam[]) => {
    setWnbaFavorites(teams)
    notifyConfigChange()
  }

  const handleNhlTeamsChange = (teams: FavoriteTeam[]) => {
    setNhlFavorites(teams)
    notifyConfigChange()
  }

  const handleAddWnbaTeam = (team: FavoriteTeam) => {
    const isAlreadySelected = wnbaFavorites.some(
      existing => existing.name === team.name || existing.abbr === team.abbr
    )

    if (!isAlreadySelected) {
      const newFavorites = [...wnbaFavorites, team]
      setWnbaFavorites(newFavorites)
      notifyConfigChange()
    }
  }

  const handleAddNhlTeam = (team: FavoriteTeam) => {
    const isAlreadySelected = nhlFavorites.some(
      existing => existing.name === team.name || existing.abbr === team.abbr
    )

    if (!isAlreadySelected) {
      const newFavorites = [...nhlFavorites, team]
      setNhlFavorites(newFavorites)
      notifyConfigChange()
    }
  }

  const notifyConfigChange = () => {
    if (onConfigChange) {
      const combinedConfig = {
        sports: [
          {
            sport: 'wnba',
            favorites: wnbaFavorites,
          },
          {
            sport: 'nhl',
            favorites: nhlFavorites,
          },
        ],
      }
      onConfigChange(combinedConfig)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      // Create the configuration object
      const config = {
        sports: [
          {
            sport: 'wnba',
            enabled: wnbaFavorites.length > 0,
            priority: 1,
            favorites: wnbaFavorites,
          },
          {
            sport: 'nhl',
            enabled: nhlFavorites.length > 0,
            priority: 2,
            favorites: nhlFavorites,
          },
        ],
      }

      console.log('Saving multi-sport configuration:', config)

      // TODO: Integrate with actual config save mechanism
      // For now, just show success
    } catch (error) {
      console.error('Error saving multi-sport config:', error)
    } finally {
      setSaving(false)
    }
  }

  const totalFavorites = wnbaFavorites.length + nhlFavorites.length

  if (loading) {
    return (
      <Card>
        <div className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-2">
              <div className="h-8 bg-gray-200 rounded"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Multi-Sport Favorites Configuration</h3>
              <p className="text-sm text-gray-600">
                Configure favorite teams for each sport separately
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant={totalFavorites > 0 ? 'success' : 'default'}>
                {totalFavorites} Total Favorites
              </Badge>
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Sport-Specific Tabs */}
      <Tabs defaultValue="wnba" className="w-full">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="wnba" className="flex items-center space-x-2">
            <span>🏀</span>
            <span>WNBA</span>
            {wnbaFavorites.length > 0 && (
              <Badge variant="success" size="sm">
                {wnbaFavorites.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="nhl" className="flex items-center space-x-2">
            <span>🏒</span>
            <span>NHL</span>
            {nhlFavorites.length > 0 && (
              <Badge variant="success" size="sm">
                {nhlFavorites.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wnba">
          <SportSpecificFavorites
            sport="wnba"
            selectedTeams={wnbaFavorites.map(t => t.abbr)}
            onTeamsChange={handleWnbaTeamsChange}
            onAddTeam={handleAddWnbaTeam}
          />
        </TabsContent>

        <TabsContent value="nhl">
          <SportSpecificFavorites
            sport="nhl"
            selectedTeams={nhlFavorites.map(t => t.abbr)}
            onTeamsChange={handleNhlTeamsChange}
            onAddTeam={handleAddNhlTeam}
          />
        </TabsContent>
      </Tabs>

      {/* Combined Preview */}
      {totalFavorites > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <div className="p-4">
            <h4 className="font-medium text-blue-900 mb-2">Configuration Preview</h4>
            <div className="text-sm text-blue-800">
              <div>
                🏀 <strong>WNBA:</strong> {wnbaFavorites.map(t => t.abbr).join(', ') || 'None'}
              </div>
              <div>
                🏒 <strong>NHL:</strong> {nhlFavorites.map(t => t.abbr).join(', ') || 'None'}
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              The scoreboard will prioritize games from these favorite teams in each sport.
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
