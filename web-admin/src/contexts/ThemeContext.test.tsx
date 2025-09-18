import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from './ThemeContext'

describe('ThemeContext', () => {
  let setItemSpy: jest.SpyInstance

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    })
  })

  beforeEach(() => {
    localStorage.clear()
    setItemSpy = jest.spyOn(Object.getPrototypeOf(window.localStorage), 'setItem')
  })

  afterEach(() => {
    setItemSpy.mockRestore()
  })

  it('provides theme values and updates storage', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultTheme="light">{children}</ThemeProvider>
    )

    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.theme).toBe('light')

    act(() => {
      result.current.setTheme('dark')
    })

    expect(result.current.theme).toBe('dark')
    expect(setItemSpy).toHaveBeenCalledWith('theme', 'dark')
  })
})
