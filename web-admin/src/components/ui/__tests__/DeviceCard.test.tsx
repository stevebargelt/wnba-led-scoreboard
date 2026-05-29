import React from 'react'
import { render, screen } from '@testing-library/react'
import { DeviceCard } from '../DeviceCard'

const baseProps = {
  id: 'device-123',
  name: 'Living Room Panel',
  lastSeenTs: null,
}

describe('DeviceCard', () => {
  it('renders device name', () => {
    render(<DeviceCard {...baseProps} />)
    expect(screen.getByText('Living Room Panel')).toBeInTheDocument()
  })

  it('links device name to configure page', () => {
    render(<DeviceCard {...baseProps} />)
    const links = screen.getAllByRole('link')
    expect(links.some(l => l.getAttribute('href')?.includes('device-123'))).toBe(true)
  })

  it('renders Configure button linking to device page', () => {
    render(<DeviceCard {...baseProps} />)
    expect(screen.getByText('Configure')).toBeInTheDocument()
  })

  it('uses custom configureHref when provided', () => {
    render(<DeviceCard {...baseProps} configureHref="/devices/device-123/teams" />)
    const links = screen.getAllByRole('link')
    expect(links.some(l => l.getAttribute('href') === '/devices/device-123/teams')).toBe(true)
  })

  it('shows last-seen text', () => {
    render(<DeviceCard {...baseProps} />)
    expect(screen.getByText(/last seen/i)).toBeInTheDocument()
  })

  it('shows offline badge when lastSeenTs is null', () => {
    render(<DeviceCard {...baseProps} />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('shows online badge when lastSeenTs is recent', () => {
    const recentTs = new Date(Date.now() - 10_000).toISOString()
    render(<DeviceCard {...baseProps} lastSeenTs={recentTs} />)
    expect(screen.getByText('Online')).toBeInTheDocument()
  })

  it('applies custom className to article', () => {
    const { container } = render(<DeviceCard {...baseProps} className="custom-card" />)
    expect(container.querySelector('article')).toHaveClass('custom-card')
  })
})
