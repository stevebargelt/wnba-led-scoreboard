import { useState, useEffect } from 'react'

export interface Team {
  id: string
  name: string
  abbreviation: string
  sport: string
  conference?: string
  division?: string
  colors?: {
    primary: string
    secondary: string
  }
}

export interface SportTeams {
  [sport: string]: Team[]
}

export function useMultiSportTeams() {
  const [teams, setTeams] = useState<SportTeams>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/sports')
        if (!response.ok) {
          throw new Error('Failed to fetch teams')
        }

        const data = await response.json()
        setTeams(data.sports || {})
      } catch (err) {
        console.error('Error fetching teams:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch teams')
        
        // Fallback to legacy WNBA teams if API fails
        const { WNBATEAMS } = await import('./wnbaTeams')
        const legacyTeams = WNBATEAMS.map(team => ({
          id: team.id || team.abbr,
          name: team.name,
          abbreviation: team.abbr,
          sport: 'wnba'
        }))
        setTeams({ wnba: legacyTeams })
      } finally {
        setLoading(false)
      }
    }

    fetchTeams()
  }, [])

  // Helper functions
  const getAllTeams = (): Team[] => {
    return Object.values(teams).flat()
  }

  const getTeamsByGroup = (groupBy: 'sport' | 'conference' | 'division' = 'sport') => {
    const allTeams = getAllTeams()
    const grouped: { [key: string]: Team[] } = {}

    allTeams.forEach(team => {
      let key: string
      if (groupBy === 'sport') {
        key = team.sport.toUpperCase()
      } else if (groupBy === 'conference') {
        key = team.conference || 'Unknown Conference'
      } else {
        key = team.division || 'Unknown Division'
      }

      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(team)
    })

    return grouped
  }

  const findTeam = (identifier: string): Team | undefined => {
    const allTeams = getAllTeams()
    return allTeams.find(
      team =>
        team.id === identifier ||
        team.name.toLowerCase() === identifier.toLowerCase() ||
        team.abbreviation.toLowerCase() === identifier.toLowerCase()
    )
  }

  const getTeamsForSport = (sport: string): Team[] => {
    return teams[sport.toLowerCase()] || []
  }

  return {
    teams,
    loading,
    error,
    getAllTeams,
    getTeamsByGroup,
    findTeam,
    getTeamsForSport
  }
}

// Legacy compatibility export
export function useLegacyTeams() {
  const { teams, loading, error } = useMultiSportTeams()
  
  // Convert to legacy format for backward compatibility
  const legacyTeams = teams.wnba?.map(team => ({
    name: team.name,
    abbr: team.abbreviation,
    id: team.id
  })) || []

  return { teams: legacyTeams, loading, error }
}