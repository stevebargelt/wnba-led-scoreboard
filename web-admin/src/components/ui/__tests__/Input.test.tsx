import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../Input'

describe('Input Component', () => {
  it('renders with default props', () => {
    render(<Input />)
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
  })

  it('renders with label', () => {
    render(<Input label="Test Label" />)
    expect(screen.getByText('Test Label')).toBeInTheDocument()
    expect(screen.getByLabelText('Test Label')).toBeInTheDocument()
  })

  it('shows required indicator when required', () => {
    render(<Input label="Required Field" required />)
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('displays error message', () => {
    render(<Input error="This field is required" />)
    expect(screen.getByText('This field is required')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('displays helper text when no error', () => {
    render(<Input helperText="Enter your email address" />)
    expect(screen.getByText('Enter your email address')).toBeInTheDocument()
  })

  it('prioritizes error over helper text', () => {
    render(<Input error="Error message" helperText="Helper text" />)
    expect(screen.getByText('Error message')).toBeInTheDocument()
    expect(screen.queryByText('Helper text')).not.toBeInTheDocument()
  })

  it('handles user input correctly', async () => {
    const user = userEvent.setup()
    const handleChange = jest.fn()
    
    render(<Input onChange={handleChange} />)
    const input = screen.getByRole('textbox')
    
    await user.type(input, 'test value')
    
    expect(handleChange).toHaveBeenCalled()
    expect(input).toHaveValue('test value')
  })

  it('renders with left icon', () => {
    const LeftIcon = <span data-testid="left-icon">@</span>
    render(<Input leftIcon={LeftIcon} />)
    expect(screen.getByTestId('left-icon')).toBeInTheDocument()
  })

  it('renders with right icon', () => {
    const RightIcon = <span data-testid="right-icon">✓</span>
    render(<Input rightIcon={RightIcon} />)
    expect(screen.getByTestId('right-icon')).toBeInTheDocument()
  })

  it('applies error styling when error is present', () => {
    render(<Input error="Error message" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('sets correct accessibility attributes', () => {
    render(<Input label="Email" error="Invalid email" id="email-input" />)
    const input = screen.getByRole('textbox')
    
    expect(input).toHaveAttribute('id', 'email-input')
    expect(input).toHaveAttribute('aria-describedby', 'email-input-error')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('forwards additional input props', () => {
    render(<Input type="email" placeholder="Enter email" disabled />)
    const input = screen.getByRole('textbox')
    
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('placeholder', 'Enter email')
    expect(input).toBeDisabled()
  })

  it('applies custom className', () => {
    render(<Input className="custom-input-class" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('custom-input-class')
  })
})