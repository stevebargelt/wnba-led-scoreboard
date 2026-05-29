import React from 'react'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../StatusBadge'

const now = () => new Date().toISOString()
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

describe('StatusBadge', () => {
  it('shows Online when last_seen_ts is within 90 seconds', () => {
    render(<StatusBadge lastSeenTs={ago(30_000)} />)
    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByLabelText('Online')).toBeInTheDocument()
  })

  it('shows Offline when last_seen_ts is older than 90 seconds', () => {
    render(<StatusBadge lastSeenTs={ago(120_000)} />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
    expect(screen.getByLabelText('Offline')).toBeInTheDocument()
  })

  it('shows Offline when last_seen_ts is null', () => {
    render(<StatusBadge lastSeenTs={null} />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('shows Offline when last_seen_ts is exactly at the 90s boundary', () => {
    render(<StatusBadge lastSeenTs={ago(90_001)} />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('shows Online when last_seen_ts is just now', () => {
    render(<StatusBadge lastSeenTs={now()} />)
    expect(screen.getByText('Online')).toBeInTheDocument()
  })

  it('renders a dot indicator', () => {
    const { container } = render(<StatusBadge lastSeenTs={null} />)
    const dot = container.querySelector('[aria-hidden="true"]')
    expect(dot).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<StatusBadge lastSeenTs={null} className="my-custom" />)
    const badge = screen.getByLabelText('Offline')
    expect(badge).toHaveClass('my-custom')
  })
})
