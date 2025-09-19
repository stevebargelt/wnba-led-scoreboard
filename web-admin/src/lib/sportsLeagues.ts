/**
 * Supabase client functions for sports and leagues
 */

import { supabase } from './supabaseClient'
import type { SportConfig, LeagueConfig } from '@/types/sports'

/**
 * Fetch all sports from database
 */
export async function fetchSports(): Promise<SportConfig[]> {
  const { data, error } = await supabase.from('sports').select('*').order('name')

  if (error) {
    console.error('Error fetching sports:', error)
    return []
  }

  // Map database format to TypeScript types
  return data.map(sport => ({
    name: sport.name,
    code: sport.code,
    timing: sport.timing,
    scoring: sport.scoring,
    terminology: sport.terminology,
    extensions: sport.extensions || {},
  }))
}

/**
 * Fetch all leagues from database
 */
export async function fetchLeagues(): Promise<LeagueConfig[]> {
  const { data, error } = await supabase.from('leagues').select('*').order('name')

  if (error) {
    console.error('Error fetching leagues:', error)
    return []
  }

  // Map database format to TypeScript types
  return data.map(league => ({
    name: league.name,
    code: league.code,
    sportCode: '', // We'll need to join with sports table to get this
    api: league.api_config,
    currentSeason: league.current_season,
    timingOverrides: league.timing_overrides,
    scoringOverrides: league.scoring_overrides,
    terminologyOverrides: league.terminology_overrides,
    teamCount: league.team_count,
    conferenceStructure: league.conference_structure,
    teamAssetsUrl: league.team_assets_url,
    logoUrlTemplate: league.logo_url_template,
  }))
}

/**
 * Fetch sports and leagues via API endpoint
 */
export async function fetchSportsAndLeagues() {
  try {
    // Get auth token for API call
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const response = await fetch('/api/admin/sports-leagues', {
      headers: {
        Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
      },
    })

    if (!response.ok) {
      console.error('Error fetching sports and leagues:', response.statusText)
      return { sports: [], leagues: [] }
    }

    const data = await response.json()
    return {
      sports: data.sports || [],
      leagues: data.leagues || [],
    }
  } catch (error) {
    console.error('Error fetching sports and leagues:', error)
    return { sports: [], leagues: [] }
  }
}

/**
 * Update a league configuration via API endpoint
 */
export async function updateLeague(leagueCode: string, updates: Partial<LeagueConfig>) {
  // Get auth token for API call
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const response = await fetch(`/api/admin/sports-leagues/league/${leagueCode}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    const error = await response.json()
    console.error('Error updating league:', error)
    throw new Error(error.error || 'Failed to update league')
  }

  const result = await response.json()
  return result.league
}

/**
 * Fetch league teams
 */
export async function fetchLeagueTeams(leagueCode: string) {
  const { data, error } = await supabase
    .from('league_teams')
    .select(
      `
      *,
      league:leagues!inner(code)
    `
    )
    .eq('league.code', leagueCode)
    .order('name')

  if (error) {
    console.error('Error fetching league teams:', error)
    return []
  }

  return data.map(team => ({
    id: team.team_id,
    name: team.name,
    abbreviation: team.abbreviation,
    logo_url: team.logo_url,
    colors: team.colors,
    conference: team.conference,
    division: team.division,
  }))
}

/**
 * Get device league preferences
 */
export async function getDeviceLeagues(deviceId: string) {
  const { data, error } = await supabase
    .from('device_leagues')
    .select(
      `
      *,
      league:leagues(*)
    `
    )
    .eq('device_id', deviceId)
    .order('priority')

  if (error) {
    console.error('Error fetching device leagues:', error)
    return []
  }

  return data
}

/**
 * Update device league preferences
 */
export async function updateDeviceLeagues(
  deviceId: string,
  leagues: Array<{ leagueId: string; enabled: boolean; priority: number }>
) {
  // Delete existing preferences
  await supabase.from('device_leagues').delete().eq('device_id', deviceId)

  // Insert new preferences
  const inserts = leagues.map(league => ({
    device_id: deviceId,
    league_id: league.leagueId,
    enabled: league.enabled,
    priority: league.priority,
  }))

  const { error } = await supabase.from('device_leagues').insert(inserts)

  if (error) {
    console.error('Error updating device leagues:', error)
    throw error
  }
}

/**
 * Get device favorite teams
 */
export async function getDeviceFavoriteTeams(deviceId: string, leagueId?: string) {
  let query = supabase.from('device_favorite_teams').select('*').eq('device_id', deviceId)

  if (leagueId) {
    query = query.eq('league_id', leagueId)
  }

  const { data, error } = await query.order('priority')

  if (error) {
    console.error('Error fetching device favorite teams:', error)
    return []
  }

  return data
}

/**
 * Update device favorite teams for a league
 */
export async function updateDeviceFavoriteTeams(
  deviceId: string,
  leagueId: string,
  teamIds: string[]
) {
  // Delete existing favorites for this league
  await supabase
    .from('device_favorite_teams')
    .delete()
    .eq('device_id', deviceId)
    .eq('league_id', leagueId)

  // Insert new favorites
  const inserts = teamIds.map((teamId, index) => ({
    device_id: deviceId,
    league_id: leagueId,
    team_id: teamId,
    priority: index + 1,
  }))

  const { error } = await supabase.from('device_favorite_teams').insert(inserts)

  if (error) {
    console.error('Error updating device favorite teams:', error)
    throw error
  }
}
