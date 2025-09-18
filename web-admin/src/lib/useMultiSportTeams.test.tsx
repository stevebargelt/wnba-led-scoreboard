import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { useMultiSportTeams } from './useMultiSportTeams'

jest.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
  },
}))

import { supabase } from './supabaseClient'

const mockGetSession = supabase.auth.getSession as unknown as jest.Mock

describe('useMultiSportTeams', () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    ;(console.error as jest.Mock).mockRestore()
  })

  it('fetches teams and exposes helper functions', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'abc' } } })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sports: {
          wnba: [
            {
              id: '18',
              name: 'Seattle Storm',
              abbreviation: 'SEA',
              sport: 'wnba',
              conference: 'West',
            },
          ],
        },
      }),
    }) as any

    const { result } = renderHook(() => useMultiSportTeams())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.teams.wnba).toHaveLength(1)
    expect(result.current.findTeam('SEA')?.name).toBe('Seattle Storm')
    expect(result.current.getTeamsByGroup('conference').West).toHaveLength(1)
  })

  it('surfaces errors when fetch fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as any

    const { result } = renderHook(() => useMultiSportTeams())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toMatch(/failed to fetch teams/i)
    expect(result.current.teams).toEqual({})
  })
})
