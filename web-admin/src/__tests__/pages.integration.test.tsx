import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '../contexts/ThemeContext'
import Home from '../pages/index'
import NewDevice from '../pages/devices/new'

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
)

// Mock fetch for API calls (e.g. /api/auth/is-admin)
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ isAdmin: false }),
} as Response)

describe('Page Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ isAdmin: false }),
    })
  })

  describe('Home Page', () => {
    it('renders home page without crashing', async () => {
      render(
        <Providers>
          <Home />
        </Providers>
      )

      await waitFor(() => {
        expect(screen.getByText('WNBA LED Web Admin')).toBeInTheDocument()
      })
    })

    it('displays login form', async () => {
      render(
        <Providers>
          <Home />
        </Providers>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
      })
    })

    it('shows sign up link', async () => {
      render(
        <Providers>
          <Home />
        </Providers>
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument()
      })
    })
  })

  describe('NewDevice Page', () => {
    it('renders new device page without crashing', async () => {
      render(
        <Providers>
          <NewDevice />
        </Providers>
      )

      await waitFor(() => {
        expect(screen.getByText(/add device/i)).toBeInTheDocument()
      })
    })

    it('displays application layout with branding', async () => {
      render(
        <Providers>
          <NewDevice />
        </Providers>
      )

      await waitFor(() => {
        expect(screen.getAllByText('LED Admin').length).toBeGreaterThan(0)
      })
    })
  })

  describe('Theme Context Integration', () => {
    it('provides theme context to child components', async () => {
      render(
        <Providers>
          <Home />
        </Providers>
      )

      expect(screen.getByText('WNBA LED Web Admin')).toBeInTheDocument()
    })
  })

  describe('Layout Integration', () => {
    it('applies consistent layout across pages', async () => {
      const { rerender } = render(
        <Providers>
          <Home />
        </Providers>
      )

      // Home page login form renders before layout (unauthenticated)
      expect(screen.getByText('WNBA LED Web Admin')).toBeInTheDocument()

      rerender(
        <Providers>
          <NewDevice />
        </Providers>
      )

      // Layout header should be present on pages that use Layout
      await waitFor(() => {
        expect(screen.getByRole('banner')).toBeInTheDocument()
      })
    })
  })
})
