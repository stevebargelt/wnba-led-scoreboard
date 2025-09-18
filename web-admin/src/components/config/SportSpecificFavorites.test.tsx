import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { SportSpecificFavorites } from './SportSpecificFavorites'

jest.mock('@/lib/useMultiSportTeams', () => ({
  useMultiSportTeams: jest.fn(),
}))

const mockUseMultiSportTeams = require('@/lib/useMultiSportTeams').useMultiSportTeams as jest.Mock

const baseHookReturn = {
  loading: false,
  error: null,
  getTeamsForSport: () => [],
}

describe('SportSpecificFavorites', () => {
  beforeEach(() => {
    mockUseMultiSportTeams.mockReset()
  })

  it('renders loading state', () => {
    mockUseMultiSportTeams.mockReturnValue({ ...baseHookReturn, loading: true })
    render(
      <SportSpecificFavorites
        sport="wnba"
        selectedTeams={[]}
        onTeamsChange={jest.fn()}
        onAddTeam={jest.fn()}
      />
    )
    expect(screen.getByText(/loading teams/i)).toBeInTheDocument()
  })

  it('renders error state', () => {
    mockUseMultiSportTeams.mockReturnValue({ ...baseHookReturn, error: 'boom' })
    render(
      <SportSpecificFavorites
        sport="nhl"
        selectedTeams={[]}
        onTeamsChange={jest.fn()}
        onAddTeam={jest.fn()}
      />
    )
    expect(screen.getByText(/error loading teams/i)).toBeInTheDocument()
  })

  it('allows selecting and removing teams', () => {
    const onAddTeam = jest.fn()
    const onTeamsChange = jest.fn()
    const teams = [
      {
        id: '18',
        name: 'Seattle Storm',
        abbreviation: 'SEA',
        sport: 'wnba',
        conference: 'West',
        division: 'West',
      },
    ]

    mockUseMultiSportTeams.mockReturnValue({
      loading: false,
      error: null,
      getTeamsForSport: () => teams,
    })

    render(
      <SportSpecificFavorites
        sport="wnba"
        selectedTeams={[]}
        onTeamsChange={onTeamsChange}
        onAddTeam={onAddTeam}
      />
    )

    fireEvent.click(screen.getByText('↓'))
    fireEvent.click(screen.getByRole('button', { name: /seattle storm/i }))
    expect(onAddTeam).toHaveBeenCalledWith({ name: 'Seattle Storm', abbr: 'SEA', id: '18' })

    // Re-render with team selected to test removal
    render(
      <SportSpecificFavorites
        sport="wnba"
        selectedTeams={['Seattle Storm']}
        onTeamsChange={onTeamsChange}
        onAddTeam={onAddTeam}
      />
    )

    fireEvent.click(screen.getByLabelText(/remove seattle storm/i))
    expect(onTeamsChange).toHaveBeenCalled()
  })
})
