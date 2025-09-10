import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../Button'

describe('Button Component', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('bg-primary-600', 'text-white')
  })

  it('renders different variants correctly', () => {
    const variants = ['primary', 'secondary', 'ghost', 'warning'] as const

    variants.forEach(variant => {
      const { rerender } = render(<Button variant={variant}>Test</Button>)
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      rerender(<></>)
    })
  })

  it('renders different sizes correctly', () => {
    const sizes = ['sm', 'md', 'lg'] as const

    sizes.forEach(size => {
      const { rerender } = render(<Button size={size}>Test</Button>)
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      rerender(<></>)
    })
  })

  it('handles click events', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('shows loading state correctly', () => {
    render(<Button loading>Loading</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(screen.getByText('Loading')).toBeInTheDocument()
    // Check for loading spinner
    expect(button.querySelector('svg')).toBeInTheDocument()
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('renders with left and right icons', () => {
    const LeftIcon = <span data-testid="left-icon">←</span>
    const RightIcon = <span data-testid="right-icon">→</span>

    render(
      <Button leftIcon={LeftIcon} rightIcon={RightIcon}>
        With Icons
      </Button>
    )

    expect(screen.getByTestId('left-icon')).toBeInTheDocument()
    expect(screen.getByTestId('right-icon')).toBeInTheDocument()
    expect(screen.getByText('With Icons')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })

  it('forwards additional props to button element', () => {
    render(
      <Button data-testid="custom-button" aria-label="Custom button">
        Test
      </Button>
    )
    const button = screen.getByTestId('custom-button')
    expect(button).toHaveAttribute('aria-label', 'Custom button')
  })
})
