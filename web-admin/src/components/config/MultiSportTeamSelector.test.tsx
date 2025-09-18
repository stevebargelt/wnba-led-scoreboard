import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MultiSportTeamSelector } from './MultiSportTeamSelector'

jest.mock('@/lib/useMultiSportTeams', () => ({
  useMultiSportTeams: jest.fn(),
}))

const mockUseTeams = require('@/lib/useMultiSportTeams').useMultiSportTeams as jest.Mock

const baseHook = {
  teams: {},
  loading: false,
  error: null,
  getTeamsByGroup: () => ({}),
}

describe('MultiSportTeamSelector', () => {
  beforeEach(() => {
    mockUseTeams.mockReset()
  })

  it('renders loading placeholder', () => {
    mockUseTeams.mockReturnValue({ ...baseHook, loading: true })
    render(<MultiSportTeamSelector selectedTeam={null} onTeamSelect={jest.fn()} />)
    expect(screen.getByPlaceholderText(/loading teams/i)).toBeDisabled()
  })

  it('renders error state', () => {
    mockUseTeams.mockReturnValue({ ...baseHook, error: 'boom' })
    render(<MultiSportTeamSelector selectedTeam={null} onTeamSelect={jest.fn()} />)
    expect(screen.getByPlaceholderText(/error loading teams/i)).toBeDisabled()
    expect(screen.getByText(/using wnba teams only/i)).toBeInTheDocument()
  })

  it('filters and selects teams', () => {
    const teams = {
      wnba: [
        { id: '18', name: 'Seattle Storm', abbreviation: 'SEA', sport: 'wnba' },
        { id: '22', name: 'Las Vegas Aces', abbreviation: 'LV', sport: 'wnba' },
      ],
      nhl: [{ id: '55', name: 'Seattle Kraken', abbreviation: 'SEA', sport: 'nhl' }],
    }
    const getTeamsByGroup = () => teams
    const onTeamSelect = jest.fn()
    mockUseTeams.mockReturnValue({ teams, loading: false, error: null, getTeamsByGroup })

    render(
      <MultiSportTeamSelector
        selectedTeam={null}
        onTeamSelect={onTeamSelect}
        placeholder="Search teams"
      />
    )

    fireEvent.focus(screen.getByPlaceholderText(/search teams/i))
    fireEvent.click(screen.getAllByText(/wnba/i)[0])
    fireEvent.change(screen.getByPlaceholderText(/search teams/i), { target: { value: 'storm' } })
    fireEvent.click(screen.getByText(/seattle storm/i))

    expect(onTeamSelect).toHaveBeenCalledWith({ name: 'Seattle Storm', abbr: 'SEA', id: '18' })
  })
})
