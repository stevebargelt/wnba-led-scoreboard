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
 * Fetch sports and leagues with proper relationships
 */
export async function fetchSportsAndLeagues() {
  // Fetch sports
  const { data: sportsData, error: sportsError } = await supabase
    .from('sports')
    .select('*')
    .order('name')

  if (sportsError) {
    console.error('Error fetching sports:', sportsError)
    return { sports: [], leagues: [] }
  }

  // Fetch leagues with sport relationship
  const { data: leaguesData, error: leaguesError } = await supabase
    .from('leagues')
    .select(
      `
      *,
      sport:sports(code)
    `
    )
    .order('name')

  if (leaguesError) {
    console.error('Error fetching leagues:', leaguesError)
    return { sports: [], leagues: [] }
  }

  // Map to TypeScript types
  const sports: SportConfig[] = sportsData.map(sport => ({
    name: sport.name,
    code: sport.code,
    timing: sport.timing,
    scoring: sport.scoring,
    terminology: sport.terminology,
    extensions: sport.extensions || {},
  }))

  const leagues: LeagueConfig[] = leaguesData.map(league => ({
    name: league.name,
    code: league.code,
    sportCode: league.sport?.code || '',
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

  return { sports, leagues }
}

/**
 * Update a league configuration
 */
export async function updateLeague(leagueCode: string, updates: Partial<LeagueConfig>) {
  const updateData: any = {}

  // Map TypeScript types to database columns
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.api !== undefined) updateData.api_config = updates.api
  if (updates.currentSeason !== undefined) updateData.current_season = updates.currentSeason
  if (updates.timingOverrides !== undefined) updateData.timing_overrides = updates.timingOverrides
  if (updates.scoringOverrides !== undefined)
    updateData.scoring_overrides = updates.scoringOverrides
  if (updates.terminologyOverrides !== undefined)
    updateData.terminology_overrides = updates.terminologyOverrides
  if (updates.teamCount !== undefined) updateData.team_count = updates.teamCount
  if (updates.conferenceStructure !== undefined)
    updateData.conference_structure = updates.conferenceStructure

  const { data, error } = await supabase
    .from('leagues')
    .update(updateData)
    .eq('code', leagueCode)
    .select()

  if (error) {
    console.error('Error updating league:', error)
    throw error
  }

  return data
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
