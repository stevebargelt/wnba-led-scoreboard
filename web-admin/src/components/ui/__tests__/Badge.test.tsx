import React from 'react'
import { render, screen } from '@testing-library/react'
import { Badge, StatusBadge } from '../Badge'

describe('Badge Component', () => {
  it('renders with default props', () => {
    render(<Badge>Default Badge</Badge>)
    expect(screen.getByText('Default Badge')).toBeInTheDocument()
  })

  it('renders different variants correctly', () => {
    const variants = ['default', 'success', 'warning', 'error', 'info'] as const

    variants.forEach(variant => {
      const { rerender } = render(<Badge variant={variant}>Test</Badge>)
      expect(screen.getByText('Test')).toBeInTheDocument()
      rerender(<></>)
    })
  })

  it('renders different sizes correctly', () => {
    const sizes = ['sm', 'md', 'lg'] as const

    sizes.forEach(size => {
      const { rerender } = render(<Badge size={size}>Test</Badge>)
      expect(screen.getByText('Test')).toBeInTheDocument()
      rerender(<></>)
    })
  })

  it('renders with dot when dot prop is true', () => {
    render(<Badge dot>With Dot</Badge>)
    const badge = screen.getByText('With Dot').parentElement
    expect(badge?.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Badge className="custom-badge">Custom</Badge>)
    const badge = screen.getByText('Custom')
    expect(badge).toHaveClass('custom-badge')
  })

  it('forwards additional props', () => {
    render(<Badge data-testid="test-badge">Test</Badge>)
    expect(screen.getByTestId('test-badge')).toBeInTheDocument()
  })
})

describe('StatusBadge Component', () => {
  it('renders online status correctly', () => {
    render(<StatusBadge online={true} />)
    expect(screen.getByText('online')).toBeInTheDocument()
  })

  it('renders offline status correctly', () => {
    render(<StatusBadge online={false} />)
    expect(screen.getByText('offline')).toBeInTheDocument()
  })

  it('applies success variant when online', () => {
    render(<StatusBadge online={true} />)
    const badge = screen.getByText('online')
    expect(badge).toHaveClass('bg-success-100')
  })

  it('applies default variant when offline', () => {
    render(<StatusBadge online={false} />)
    const badge = screen.getByText('offline')
    expect(badge).toHaveClass('bg-gray-100')
  })

  it('shows dot indicator', () => {
    render(<StatusBadge online={true} />)
    const badge = screen.getByText('online').parentElement
    expect(badge?.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })

  it('forwards additional props except variant, dot, and children', () => {
    render(<StatusBadge online={true} size="lg" className="custom-status" />)
    const badge = screen.getByText('online')
    expect(badge).toHaveClass('custom-status')
  })
})
