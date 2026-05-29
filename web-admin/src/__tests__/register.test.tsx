import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NewDevice from '@/pages/devices/new'
import { ThemeProvider } from '@/contexts/ThemeContext'

jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
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
      <NewDevice />
    </ThemeProvider>
  )

describe('NewDevice page', () => {
  const originalClipboard = navigator.clipboard

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockAuth.getSession.mockResolvedValue({ data: { session: null } })
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
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.com'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  afterEach(() => {
    jest.useRealTimers()
    ;(navigator as any).clipboard = originalClipboard
  })

  it('renders step 1 with device name input', () => {
    renderWithProviders()
    expect(screen.getByText(/add device/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/device name/i)).toBeInTheDocument()
  })

  it('disables Create Device when name is empty', () => {
    renderWithProviders()
    expect(screen.getByRole('button', { name: /create device/i })).toBeDisabled()
  })

  it('requires authentication before creating device', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null } })
    renderWithProviders()
    fireEvent.change(screen.getByLabelText(/device name/i), { target: { value: 'Lobby Display' } })
    fireEvent.click(screen.getByRole('button', { name: /create device/i }))
    await waitFor(() => expect(screen.getByText(/sign in first/i)).toBeInTheDocument())
  })

  it('creates device and shows env vars in step 2', async () => {
    renderWithProviders()
    fireEvent.change(screen.getByLabelText(/device name/i), { target: { value: 'Lobby Display' } })
    fireEvent.click(screen.getByRole('button', { name: /create device/i }))

    await waitFor(() => expect(screen.getByText(/device created/i)).toBeInTheDocument())

    expect(screen.getByText('device-1')).toBeInTheDocument()
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
    expect(screen.getByText('anon-key')).toBeInTheDocument()
  })

  it('shows no-device-token info callout in step 2', async () => {
    renderWithProviders()
    fireEvent.change(screen.getByLabelText(/device name/i), { target: { value: 'Lobby Display' } })
    fireEvent.click(screen.getByRole('button', { name: /create device/i }))

    await waitFor(() => expect(screen.getByText(/device created/i)).toBeInTheDocument())

    expect(screen.getByText(/no device token is needed/i)).toBeInTheDocument()
  })

  it('does not show DEVICE_TOKEN anywhere', async () => {
    renderWithProviders()
    fireEvent.change(screen.getByLabelText(/device name/i), { target: { value: 'Lobby Display' } })
    fireEvent.click(screen.getByRole('button', { name: /create device/i }))

    await waitFor(() => expect(screen.getByText(/device created/i)).toBeInTheDocument())

    expect(screen.queryByText(/DEVICE_TOKEN/)).not.toBeInTheDocument()
  })
})
