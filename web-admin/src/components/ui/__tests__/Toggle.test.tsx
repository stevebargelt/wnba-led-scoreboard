import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toggle } from '../Toggle'

describe('Toggle', () => {
  it('calls onChange with toggled value when clicked', () => {
    const onChange = jest.fn()
    render(<Toggle checked={false} onChange={onChange} label="Alerts" />)

    const button = screen.getByRole('button', { name: /enable alerts/i })
    fireEvent.click(button)

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('does not call onChange when disabled', () => {
    const onChange = jest.fn()
    render(<Toggle checked={true} onChange={onChange} label="Notifications" disabled />)

    const button = screen.getByRole('button', { name: /disable notifications/i })
    fireEvent.click(button)

    expect(onChange).not.toHaveBeenCalled()
  })
})
