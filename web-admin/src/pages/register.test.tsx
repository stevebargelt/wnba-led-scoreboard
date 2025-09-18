import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import RegisterDevice from './register'
import { ThemeProvider } from '@/contexts/ThemeContext'

jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
    },
    from: jest.fn(),
  },
}))

import { supabase } from '@/lib/supabaseClient'

const mockAuth = supabase.auth as any
const mockFrom = supabase.from as jest.Mock

const renderWithProviders = () =>
  render(
    <ThemeProvider defaultTheme="light">
      <RegisterDevice />
    </ThemeProvider>
  )

describe('RegisterDevice page', () => {
  const originalClipboard = navigator.clipboard

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'jwt-token' } } })
    mockFrom.mockReturnValue({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'device-1' }, error: null }),
        }),
      }),
    })
    ;(navigator as any).clipboard = {
      writeText: jest.fn().mockResolvedValue(undefined),
    }
    process.env.NEXT_PUBLIC_FUNCTION_MINT_DEVICE_TOKEN = 'https://example.com/mint'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.com'
  })

  afterEach(() => {
    jest.useRealTimers()
    ;(navigator as any).clipboard = originalClipboard
  })

  it('disables submit when name is empty', () => {
    renderWithProviders()
    expect(screen.getByText(/create device/i)).toBeDisabled()
  })

  it('requires authentication before creating device', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null } })
    renderWithProviders()
    fireEvent.change(screen.getByLabelText(/device name/i), { target: { value: 'Lobby Display' } })
    fireEvent.click(screen.getByText(/create device/i))
    await waitFor(() => expect(screen.getByText(/sign in first/i)).toBeInTheDocument())
  })

  it('creates device, mints token, and allows copying identifiers', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'demo-token-123' }),
    }) as any

    renderWithProviders()
    fireEvent.change(screen.getByLabelText(/device name/i), { target: { value: 'Lobby Display' } })
    fireEvent.click(screen.getByText(/create device/i))

    await waitFor(() =>
      expect(screen.getByText(/device created and token minted/i)).toBeInTheDocument()
    )

    expect(screen.getByText('device-1')).toBeInTheDocument()
    expect(screen.getAllByText(/demo-token-123/).length).toBeGreaterThan(0)

    const copyButtons = screen.getAllByRole('button', { name: /copy/i })
    fireEvent.click(copyButtons[0])
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
    act(() => {
      jest.runOnlyPendingTimers()
    })
  })
})
