import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Home from '@/pages/index'
import { ThemeProvider } from '@/contexts/ThemeContext'

jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      getUser: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(),
  },
}))

import { supabase } from '@/lib/supabaseClient'

const mockAuth = supabase.auth as any
const mockFrom = supabase.from as jest.Mock

const subscription = { unsubscribe: jest.fn() }

function setupAuthMocks(session: any) {
  mockAuth.getSession.mockResolvedValue({ data: { session } })
  mockAuth.onAuthStateChange.mockImplementation(callback => {
    if (session) callback('SIGNED_IN', session)
    return { data: { subscription } }
  })
  mockAuth.signInWithPassword.mockResolvedValue({ error: null })
  mockAuth.signUp.mockResolvedValue({ error: null })
  mockAuth.getUser.mockResolvedValue({ data: { user: session?.user ?? null } })
}

describe('Home page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupAuthMocks(null)
    mockFrom.mockImplementation(() => ({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    }))
  })

  const renderWithProviders = () =>
    render(
      <ThemeProvider defaultTheme="light">
        <Home />
      </ThemeProvider>
    )

  it('shows sign-in form when unauthenticated', async () => {
    renderWithProviders()

    expect(await screen.findByText(/sign in to manage/i)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Sign In'))
    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret' } })
    fireEvent.click(screen.getByText('Sign In'))

    await waitFor(() =>
      expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'secret',
      })
    )
  })

  it('displays devices when authenticated', async () => {
    setupAuthMocks({ user: { id: '1' } })
    mockFrom.mockImplementationOnce(() => ({
      select: () => ({
        order: () =>
          Promise.resolve({
            data: [{ id: 'device1', name: 'Living Room', last_seen_ts: null }],
            error: null,
          }),
      }),
    }))

    renderWithProviders()

    expect(await screen.findByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument()
    expect(await screen.findByText(/living room/i)).toBeInTheDocument()
  })

  it('shows empty state when authenticated with no devices', async () => {
    setupAuthMocks({ user: { id: '1' } })
    mockFrom.mockImplementationOnce(() => ({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    }))

    renderWithProviders()

    expect(await screen.findByText(/no devices yet/i)).toBeInTheDocument()
    const addButtons = await screen.findAllByRole('link', { name: /add device/i })
    expect(addButtons.length).toBeGreaterThan(0)
    expect((addButtons[0] as HTMLAnchorElement).href).toContain('/devices/new')
  })
})
