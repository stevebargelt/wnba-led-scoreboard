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
        expect(screen.getByText('WNBA LED Scoreboard')).toBeInTheDocument()
      })
    })

    it('displays theme toggle functionality', async () => {
      render(
        <Providers>
          <Home />
        </Providers>
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument()
      })
    })

    it('shows device registration link', async () => {
      render(
        <Providers>
          <Home />
        </Providers>
      )

      await waitFor(() => {
        expect(screen.getByText(/register a new device/i)).toBeInTheDocument()
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
        expect(screen.getByText('Register New Device')).toBeInTheDocument()
      })
    })

    it('displays device registration form', async () => {
      render(
        <Providers>
          <Register />
        </Providers>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/device name/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /register device/i })).toBeInTheDocument()
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

      // Theme toggle should be present and functional
      const themeToggle = await screen.findByRole('button', { name: /toggle theme/i })
      expect(themeToggle).toBeInTheDocument()
    })
  })

  describe('Layout Integration', () => {
    it('applies consistent layout across pages', async () => {
      const { rerender } = render(
        <Providers>
          <Home />
        </Providers>
      )

      // Check for navigation elements
      expect(screen.getByRole('banner')).toBeInTheDocument()

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
