import React from 'react'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { MultiSportFavoritesEditor } from './MultiSportFavoritesEditor'
import { ThemeProvider } from '@/contexts/ThemeContext'

jest.mock('@/lib/useMultiSportTeams', () => ({
  useMultiSportTeams: jest.fn(),
}))

jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
  },
}))

import { useMultiSportTeams } from '@/lib/useMultiSportTeams'
import { supabase } from '@/lib/supabaseClient'

const mockUseTeams = useMultiSportTeams as jest.Mock
const mockGetSession = supabase.auth.getSession as jest.Mock

const teamsResponse = {
  wnba: [
    {
      id: '18',
      name: 'Seattle Storm',
      abbreviation: 'SEA',
      sport: 'wnba',
      conference: 'West',
      division: 'West',
    },
    { id: '22', name: 'Las Vegas Aces', abbreviation: 'LV', sport: 'wnba' },
  ],
  nhl: [
    {
      id: '55',
      name: 'Seattle Kraken',
      abbreviation: 'SEA',
      sport: 'nhl',
      conference: 'West',
      division: 'Pacific',
    },
  ],
}

const renderEditor = (props?: any) =>
  render(
    <ThemeProvider defaultTheme="light">
      <MultiSportFavoritesEditor
        deviceId="device-1"
        onConfigChange={jest.fn()}
        initialConfig={{
          sports: [
            {
              sport: 'wnba',
              enabled: true,
              favorites: [{ name: 'Seattle Storm', abbr: 'SEA', id: '18' }],
            },
            { sport: 'nhl', enabled: false, favorites: [] },
          ],
        }}
        {...props}
      />
    </ThemeProvider>
  )

describe('MultiSportFavoritesEditor', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockUseTeams.mockReturnValue({ teams: teamsResponse, loading: false, error: null })
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'jwt-token' } } })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('renders initial favorites and toggles sport', async () => {
    const onConfigChange = jest.fn()
    renderEditor({ onConfigChange })

    expect(await screen.findByText(/multi-sport favorites configuration/i)).toBeInTheDocument()
    const favoritesList = (await screen.findAllByRole('list'))[0]
    expect(within(favoritesList).getByText('Seattle Storm')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /enabled/i })[0])
    expect(onConfigChange).toHaveBeenCalled()
  })

  it('adds a favorite team manually', async () => {
    const onConfigChange = jest.fn()
    renderEditor({ onConfigChange })

    const nameInput = screen.getByPlaceholderText(/team name/i)
    fireEvent.change(nameInput, { target: { value: 'Las Vegas Aces' } })
    fireEvent.change(screen.getByPlaceholderText(/ABR/i), { target: { value: 'LV' } })
    fireEvent.click(screen.getByText(/^Add$/))

    const favoritesList = (await screen.findAllByRole('list'))[0]
    await waitFor(() =>
      expect(within(favoritesList).getByText('Las Vegas Aces')).toBeInTheDocument()
    )
    expect(onConfigChange).toHaveBeenCalled()
  })

  it('saves configuration via API', async () => {
    renderEditor()
    const saveButton = await screen.findByRole('button', { name: /save favorites/i })
    fireEvent.click(screen.getAllByRole('button', { name: /enabled/i })[0])
    await waitFor(() => expect(saveButton).not.toBeDisabled())
    fireEvent.click(saveButton)

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByText(/favorites saved/i).length).toBeGreaterThan(0))
    act(() => {
      jest.runOnlyPendingTimers()
    })
  })

  it('shows loading skeleton while fetching teams', () => {
    mockUseTeams.mockReturnValue({ teams: {}, loading: true, error: null })

    const { container } = renderEditor()

    expect(container.querySelector('.animate-pulse')).toBeTruthy()
    expect(screen.queryByText(/multi-sport favorites configuration/i)).not.toBeInTheDocument()
  })

  it('renders error state when team lookup fails', () => {
    mockUseTeams.mockReturnValue({ teams: { wnba: [], nhl: [] }, loading: false, error: 'Boom' })

    renderEditor()

    expect(screen.getByText(/error loading wnba teams: Boom/i)).toBeInTheDocument()
  })

  it('enriches placeholder favorites from the team directory', async () => {
    renderEditor({
      initialConfig: {
        sports: [
          { sport: 'wnba', enabled: true, favorites: [{ name: 'SEA', abbr: 'SEA' }] },
          { sport: 'nhl', enabled: false, favorites: [] },
        ],
      },
    })

    const favoritesList = (await screen.findAllByRole('list'))[0]
    await waitFor(() =>
      expect(within(favoritesList).getByText('Seattle Storm')).toBeInTheDocument()
    )
    expect(within(favoritesList).getByText(/ID: 18/)).toBeInTheDocument()
  })

  it('auto-fills incorrect identifiers on demand', async () => {
    renderEditor({
      initialConfig: {
        sports: [
          {
            sport: 'wnba',
            enabled: true,
            favorites: [{ name: 'Seattle Storm', abbr: 'SEA', id: 'wrong' }],
          },
          { sport: 'nhl', enabled: false, favorites: [] },
        ],
      },
    })

    fireEvent.click(screen.getByRole('button', { name: /auto-fill team ids/i }))

    const favoritesList = (await screen.findAllByRole('list'))[0]
    await waitFor(() => expect(within(favoritesList).getByText(/ID: 18/)).toBeInTheDocument())
  })

  it('reorders favorites within a sport', async () => {
    const onConfigChange = jest.fn()
    renderEditor({
      onConfigChange,
      initialConfig: {
        sports: [
          {
            sport: 'wnba',
            enabled: true,
            favorites: [
              { name: 'Seattle Storm', abbr: 'SEA', id: '18' },
              { name: 'Las Vegas Aces', abbr: 'LV', id: '22' },
            ],
          },
          { sport: 'nhl', enabled: false, favorites: [] },
        ],
      },
    })

    const favoritesList = (await screen.findAllByRole('list'))[0]
    expect(within(favoritesList).getAllByRole('listitem')[0]).toHaveTextContent('Seattle Storm')

    fireEvent.click(within(favoritesList).getAllByRole('button', { name: /move down/i })[0])

    await waitFor(() => {
      expect(onConfigChange.mock.calls.length).toBeGreaterThan(0)
      const latest = onConfigChange.mock.calls[onConfigChange.mock.calls.length - 1][0]
      const names = latest.sports[0].favorites.map((fav: any) => fav.name)
      expect(names).toEqual(['Las Vegas Aces', 'Seattle Storm'])
    })

    // removal is validated separately
  })

  it('removes a favorite team', async () => {
    const onConfigChange = jest.fn()
    renderEditor({
      onConfigChange,
      initialConfig: {
        sports: [
          {
            sport: 'wnba',
            enabled: true,
            favorites: [
              { name: 'Seattle Storm', abbr: 'SEA', id: '18' },
              { name: 'Las Vegas Aces', abbr: 'LV', id: '22' },
            ],
          },
          { sport: 'nhl', enabled: false, favorites: [] },
        ],
      },
    })

    const favoritesList = (await screen.findAllByRole('list'))[0]
    const initialCalls = onConfigChange.mock.calls.length
    fireEvent.click(within(favoritesList).getAllByText(/remove/i)[0])

    await waitFor(() => {
      expect(onConfigChange.mock.calls.length).toBeGreaterThan(initialCalls)
      const latest = onConfigChange.mock.calls[onConfigChange.mock.calls.length - 1][0]
      const favorites = latest.sports[0].favorites
      expect(favorites).toHaveLength(1)
      expect(favorites[0].name).toBe('Las Vegas Aces')
    })
  })

  it('enables the save button only after changes occur', async () => {
    renderEditor()

    const saveButton = await screen.findByRole('button', { name: /save favorites/i })
    expect(saveButton).toBeDisabled()

    fireEvent.click(screen.getAllByRole('button', { name: /enabled/i })[0])

    await waitFor(() => expect(saveButton).not.toBeDisabled())
  })

  it('does not attempt to save when the user is not signed in', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } })

    renderEditor()

    const saveButton = await screen.findByRole('button', { name: /save favorites/i })
    fireEvent.click(screen.getAllByRole('button', { name: /enabled/i })[0])
    await waitFor(() => expect(saveButton).not.toBeDisabled())
    fireEvent.click(saveButton)

    await waitFor(() => expect(screen.getAllByText(/not signed in/i).length).toBeGreaterThan(0))
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('surfaces API failures to the user', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      text: async () => 'something broke',
      status: 500,
    })

    renderEditor()

    const saveButton = await screen.findByRole('button', { name: /save favorites/i })
    fireEvent.click(screen.getAllByRole('button', { name: /enabled/i })[0])
    await waitFor(() => expect(saveButton).not.toBeDisabled())
    fireEvent.click(saveButton)

    await waitFor(() =>
      expect(screen.getAllByText(/save failed: something broke/i).length).toBeGreaterThan(0)
    )
  })
})
