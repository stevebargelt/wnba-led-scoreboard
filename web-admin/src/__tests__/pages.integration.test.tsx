import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '../contexts/ThemeContext'
import Home from '../pages/index'
import Register from '../pages/register'

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
)

// Mock fetch for API calls
global.fetch = jest.fn()

describe('Page Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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

  describe('Register Page', () => {
    it('renders register page without crashing', async () => {
      render(
        <Providers>
          <Register />
        </Providers>
      )

      await waitFor(() => {
        expect(screen.getByText(/register device/i)).toBeInTheDocument()
      })
    })

    it('displays application layout', async () => {
      render(
        <Providers>
          <Register />
        </Providers>
      )

      await waitFor(() => {
        expect(screen.getAllByText('WNBA LED Admin').length).toBeGreaterThan(0)
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

      // Check that theme context is provided (test passes if no errors)
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

      // Check for common elements
      expect(screen.getByText('WNBA LED Web Admin')).toBeInTheDocument()

      rerender(
        <Providers>
          <Register />
        </Providers>
      )

      // Layout should persist across page changes
      expect(screen.getByRole('banner')).toBeInTheDocument()
    })
  })
})
