import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { DisplayPreview } from '../DisplayPreview'

const mockGeneratePreview = jest.fn().mockResolvedValue('data:image/png;base64,mock')

jest.mock('../../../lib/preview', () => ({
  PreviewGenerator: jest.fn().mockImplementation(() => ({
    generatePreview: mockGeneratePreview,
  })),
  loadPreviewFonts: jest.fn().mockResolvedValue({ small: true, large: true }),
  GameState: { PRE: 'PRE', LIVE: 'LIVE', FINAL: 'FINAL' },
  createDemoPregameSnapshot: jest.fn().mockReturnValue({ state: 'PRE' }),
  createDemoLiveSnapshot: jest.fn().mockReturnValue({ state: 'LIVE' }),
  createDemoFinalSnapshot: jest.fn().mockReturnValue({ state: 'FINAL' }),
  createNhlDemoPregameSnapshot: jest.fn().mockReturnValue({ state: 'PRE' }),
  createNhlDemoLiveSnapshot: jest.fn().mockReturnValue({ state: 'LIVE' }),
  createNhlDemoFinalSnapshot: jest.fn().mockReturnValue({ state: 'FINAL' }),
}))

describe('DisplayPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGeneratePreview.mockResolvedValue('data:image/png;base64,mock')
  })

  it('renders without crash', async () => {
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })
    expect(screen.getByText('Display Preview')).toBeInTheDocument()
  })

  it('shows all 5 scene buttons', async () => {
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })
    expect(screen.getByRole('button', { name: /idle/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pregame/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^live$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /big logos/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /final/i })).toBeInTheDocument()
  })

  it('shows a refresh button', async () => {
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
  })

  it('renders canvas element with native dimensions', async () => {
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })
    await waitFor(() => {
      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
      expect(canvas).toHaveAttribute('width', '64')
      expect(canvas).toHaveAttribute('height', '32')
    })
  })

  it('renders canvas with 8x CSS dimensions', async () => {
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })
    await waitFor(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement
      expect(canvas).toBeInTheDocument()
      expect(canvas.style.width).toBe('512px')
      expect(canvas.style.height).toBe('256px')
      expect(canvas.style.imageRendering).toBe('pixelated')
    })
  })

  it('respects custom matrixConfig dimensions', async () => {
    await act(async () => {
      render(
        <DisplayPreview
          deviceId="device-1"
          matrixConfig={{ width: 64, height: 32, brightness: 80 }}
        />
      )
    })
    await waitFor(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement
      expect(canvas).toBeInTheDocument()
      expect(canvas).toHaveAttribute('width', '64')
      expect(canvas).toHaveAttribute('height', '32')
      expect(canvas.style.width).toBe('512px')
      expect(canvas.style.height).toBe('256px')
    })
  })

  it('clicking a scene button updates the active selection', async () => {
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })

    const pregameButton = screen.getByRole('button', { name: /pregame/i })

    await act(async () => {
      fireEvent.click(pregameButton)
    })

    // After clicking pregame, it should have the primary variant class
    expect(pregameButton).toHaveClass('bg-primary-600')
  })

  it('default selected scene is live', async () => {
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })
    const liveButton = screen.getByRole('button', { name: /^live$/i })
    expect(liveButton).toHaveClass('bg-primary-600')
  })

  it('calls loadPreviewFonts on mount', async () => {
    const { loadPreviewFonts } = require('../../../lib/preview')
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })
    expect(loadPreviewFonts).toHaveBeenCalledTimes(1)
  })

  it('calls PreviewGenerator.generatePreview after fonts load', async () => {
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })
    await waitFor(() => {
      expect(mockGeneratePreview).toHaveBeenCalled()
    })
  })

  it('shows WNBA and NHL sport toggle buttons', async () => {
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })
    expect(screen.getByRole('button', { name: /^wnba$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^nhl$/i })).toBeInTheDocument()
  })

  it('default selected sport is WNBA', async () => {
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })
    const wnbaButton = screen.getByRole('button', { name: /^wnba$/i })
    expect(wnbaButton).toHaveClass('bg-primary-600')
  })

  it('clicking NHL button selects NHL sport', async () => {
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })

    const nhlButton = screen.getByRole('button', { name: /^nhl$/i })
    await act(async () => {
      fireEvent.click(nhlButton)
    })
    expect(nhlButton).toHaveClass('bg-primary-600')
  })

  it('uses NHL snapshot functions when NHL is selected and scene is live', async () => {
    const { createNhlDemoLiveSnapshot } = require('../../../lib/preview')
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })

    const nhlButton = screen.getByRole('button', { name: /^nhl$/i })
    await act(async () => {
      fireEvent.click(nhlButton)
    })

    await waitFor(() => {
      expect(createNhlDemoLiveSnapshot).toHaveBeenCalled()
    })
  })

  it('uses WNBA snapshot functions when WNBA is selected', async () => {
    const { createDemoLiveSnapshot } = require('../../../lib/preview')
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })

    await waitFor(() => {
      expect(createDemoLiveSnapshot).toHaveBeenCalled()
    })
  })

  it('does not import or use supabase', () => {
    const componentSource = require('fs').readFileSync(
      require('path').join(__dirname, '../DisplayPreview.tsx'),
      'utf-8'
    )
    expect(componentSource).not.toContain('supabaseClient')
    expect(componentSource).not.toContain('supabase')
  })

  it('does not contain fetch calls', () => {
    const componentSource = require('fs').readFileSync(
      require('path').join(__dirname, '../DisplayPreview.tsx'),
      'utf-8'
    )
    expect(componentSource).not.toContain('fetch(')
  })
})

describe('sport toggle integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGeneratePreview.mockResolvedValue('data:image/png;base64,mock')
  })

  it('sport toggle renders both WNBA and NHL buttons', async () => {
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })
    expect(screen.getByRole('button', { name: /^wnba$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^nhl$/i })).toBeInTheDocument()
  })

  it('default sport is WNBA with only WNBA button active', async () => {
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })
    const wnbaButton = screen.getByRole('button', { name: /^wnba$/i })
    const nhlButton = screen.getByRole('button', { name: /^nhl$/i })
    expect(wnbaButton).toHaveClass('bg-primary-600')
    expect(nhlButton).not.toHaveClass('bg-primary-600')
  })

  it('switching sport to NHL triggers preview regeneration', async () => {
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })
    // Wait for initial preview generation after fonts load
    await waitFor(() => expect(mockGeneratePreview).toHaveBeenCalledTimes(1))

    const nhlButton = screen.getByRole('button', { name: /^nhl$/i })
    await act(async () => {
      fireEvent.click(nhlButton)
    })

    await waitFor(() => expect(mockGeneratePreview).toHaveBeenCalledTimes(2))
  })

  it('switching to NHL while on final scene uses NHL final snapshot', async () => {
    const { createNhlDemoFinalSnapshot, createDemoFinalSnapshot } = require('../../../lib/preview')
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })

    // Navigate to final scene (still WNBA)
    const finalButton = screen.getByRole('button', { name: /final/i })
    await act(async () => {
      fireEvent.click(finalButton)
    })
    await waitFor(() => expect(createDemoFinalSnapshot).toHaveBeenCalled())

    const callsBefore = (createNhlDemoFinalSnapshot as jest.Mock).mock.calls.length

    // Switch to NHL — should now use NHL final snapshot
    const nhlButton = screen.getByRole('button', { name: /^nhl$/i })
    await act(async () => {
      fireEvent.click(nhlButton)
    })

    await waitFor(() => {
      expect((createNhlDemoFinalSnapshot as jest.Mock).mock.calls.length).toBeGreaterThan(
        callsBefore
      )
    })
  })

  it('switching scene to pregame while NHL is selected uses NHL pregame snapshot', async () => {
    const { createNhlDemoPregameSnapshot } = require('../../../lib/preview')
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })

    // Select NHL first
    const nhlButton = screen.getByRole('button', { name: /^nhl$/i })
    await act(async () => {
      fireEvent.click(nhlButton)
    })

    // Now switch to pregame scene
    const pregameButton = screen.getByRole('button', { name: /pregame/i })
    await act(async () => {
      fireEvent.click(pregameButton)
    })

    await waitFor(() => {
      expect(createNhlDemoPregameSnapshot).toHaveBeenCalled()
    })
  })

  it('switching scene to final while NHL is selected uses NHL final snapshot', async () => {
    const { createNhlDemoFinalSnapshot } = require('../../../lib/preview')
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })

    // Select NHL
    const nhlButton = screen.getByRole('button', { name: /^nhl$/i })
    await act(async () => {
      fireEvent.click(nhlButton)
    })

    // Switch to final scene
    const finalButton = screen.getByRole('button', { name: /final/i })
    await act(async () => {
      fireEvent.click(finalButton)
    })

    await waitFor(() => {
      expect(createNhlDemoFinalSnapshot).toHaveBeenCalled()
    })
  })

  it('switching back to WNBA after NHL uses WNBA snapshot functions', async () => {
    const { createDemoLiveSnapshot, createNhlDemoLiveSnapshot } = require('../../../lib/preview')
    await act(async () => {
      render(<DisplayPreview deviceId="device-1" />)
    })

    // Switch to NHL
    const nhlButton = screen.getByRole('button', { name: /^nhl$/i })
    await act(async () => {
      fireEvent.click(nhlButton)
    })
    await waitFor(() => expect(createNhlDemoLiveSnapshot).toHaveBeenCalled())

    const wnbaCalls = (createDemoLiveSnapshot as jest.Mock).mock.calls.length

    // Switch back to WNBA
    const wnbaButton = screen.getByRole('button', { name: /^wnba$/i })
    await act(async () => {
      fireEvent.click(wnbaButton)
    })

    await waitFor(() => {
      expect((createDemoLiveSnapshot as jest.Mock).mock.calls.length).toBeGreaterThan(wnbaCalls)
    })
  })
})
