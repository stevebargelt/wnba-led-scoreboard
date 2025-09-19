import { useState, useEffect } from 'react'
import { Layout } from '@/components/layout'
import { Card } from '@/components/ui/Card'
import { SimpleTabs } from '@/components/ui/SimpleTabs'
import { SportHierarchyView } from '@/components/sports/SportHierarchyView'
import { LeagueConfigEditor } from '@/components/sports/LeagueConfigEditor'
import { SportConfigViewer } from '@/components/sports/SportConfigViewer'
import { fetchSportsAndLeagues, updateLeague } from '@/lib/sportsLeagues'
import type { SportConfig, LeagueConfig, SportHierarchy } from '@/types/sports'

export default function SportsLeaguesPage() {
  const [sports, setSports] = useState<SportConfig[]>([])
  const [leagues, setLeagues] = useState<LeagueConfig[]>([])
  const [selectedSport, setSelectedSport] = useState<SportConfig | null>(null)
  const [selectedLeague, setSelectedLeague] = useState<LeagueConfig | null>(null)
  const [activeTab, setActiveTab] = useState('hierarchy')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSportsAndLeagues()
  }, [])

  const loadSportsAndLeagues = async () => {
    try {
      const data = await fetchSportsAndLeagues()
      setSports(data.sports || [])
      setLeagues(data.leagues || [])
    } catch (error) {
      console.error('Failed to fetch sports and leagues:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSportSelect = (sport: SportConfig) => {
    setSelectedSport(sport)
    setSelectedLeague(null)
    setActiveTab('sport')
  }

  const handleLeagueSelect = (league: LeagueConfig) => {
    const sport = sports.find(s => s.code === league.sportCode)
    setSelectedSport(sport || null)
    setSelectedLeague(league)
    setActiveTab('league')
  }

  const handleLeagueUpdate = async (league: LeagueConfig) => {
    try {
      setIsLoading(true)
      await updateLeague(league.code, league)

      // Reload all data
      const data = await fetchSportsAndLeagues()
      setSports(data.sports || [])
      setLeagues(data.leagues || [])

      // Update the selected league with fresh data
      const updatedLeague = data.leagues?.find(l => l.code === league.code)
      if (updatedLeague) {
        setSelectedLeague(updatedLeague)
      }

      // Show success message
      console.log('League updated successfully')
    } catch (error) {
      console.error('Failed to update league:', error)
      // You could add a toast notification here
      alert('Failed to update league. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Build hierarchy data
  const hierarchyData: SportHierarchy[] = sports.map(sport => ({
    sport,
    leagues: leagues.filter(league => league.sportCode === sport.code),
  }))

  const tabs = [
    { id: 'hierarchy', label: 'Overview', icon: '🏆' },
    { id: 'sport', label: 'Sport Details', icon: '⚙️', disabled: !selectedSport },
    { id: 'league', label: 'League Config', icon: '🎯', disabled: !selectedLeague },
  ]

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading sports and leagues...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Sports & Leagues Management
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Configure sport rules and league-specific settings
          </p>
        </div>

        <SimpleTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />

        <div className="space-y-6">
          {activeTab === 'hierarchy' && (
            <SportHierarchyView
              hierarchyData={hierarchyData}
              onSportSelect={handleSportSelect}
              onLeagueSelect={handleLeagueSelect}
            />
          )}

          {activeTab === 'sport' && selectedSport && (
            <SportConfigViewer
              sport={selectedSport}
              leagues={leagues.filter(l => l.sportCode === selectedSport.code)}
            />
          )}

          {activeTab === 'league' && selectedLeague && selectedSport && (
            <LeagueConfigEditor
              league={selectedLeague}
              sport={selectedSport}
              onSave={handleLeagueUpdate}
              onCancel={() => setActiveTab('hierarchy')}
            />
          )}
        </div>
      </div>
    </Layout>
  )
}
