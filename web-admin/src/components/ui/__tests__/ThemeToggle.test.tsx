import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeToggle, ThemeToggleButton } from '../ThemeToggle'
import { useTheme } from '../../../contexts/ThemeContext'

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: jest.fn(),
}))

const mockUseTheme = useTheme as jest.Mock

describe('Theme toggles', () => {
  beforeEach(() => {
    mockUseTheme.mockReset()
  })

  it('allows selecting explicit themes', () => {
    const setTheme = jest.fn()
    mockUseTheme.mockReturnValue({ theme: 'light', setTheme, resolvedTheme: 'light' })

    render(<ThemeToggle />)

    fireEvent.click(screen.getByRole('button', { name: /dark mode/i }))
    expect(setTheme).toHaveBeenCalledWith('dark')

    fireEvent.click(screen.getByRole('button', { name: /system theme/i }))
    expect(setTheme).toHaveBeenCalledWith('system')
  })

  it('cycles themes when using ThemeToggleButton', () => {
    const setTheme = jest.fn()
    mockUseTheme.mockReturnValue({ theme: 'light', setTheme, resolvedTheme: 'light' })

    render(<ThemeToggleButton />)

    fireEvent.click(screen.getByRole('button'))
    expect(setTheme).toHaveBeenCalledWith('dark')
  })
})
