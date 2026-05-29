import React from 'react'
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline'
import { useTheme } from '../../contexts/ThemeContext'
import { Button } from './Button'
import { clsx } from 'clsx'

/** 3-way picker (light / dark / system) — keep for backward compat */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const themes = [
    { key: 'light' as const, icon: SunIcon, label: 'Light mode' },
    { key: 'dark' as const, icon: MoonIcon, label: 'Dark mode' },
    { key: 'system' as const, icon: ComputerDesktopIcon, label: 'System theme' },
  ]

  return (
    <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
      {themes.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          onClick={() => setTheme(key)}
          className={clsx(
            'flex items-center justify-center px-3 py-1.5 text-sm font-medium transition-colors rounded-md',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
            theme === key
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          )}
          aria-label={label}
          title={label}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}

/** Single icon button that cycles light → dark → system; used in the shell header */
export function ThemeToggleButton() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const cycleTheme = () => {
    const themes = ['light', 'dark', 'system'] as const
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  const Icon = resolvedTheme === 'dark' ? SunIcon : MoonIcon

  return (
    <button
      onClick={cycleTheme}
      className={clsx(
        'w-10 h-10 flex items-center justify-center rounded-md',
        'bg-[var(--color-surface)] border border-[var(--color-border)]',
        'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]'
      )}
      aria-label={`Current: ${theme} theme. Click to switch.`}
    >
      <Icon className="w-[18px] h-[18px]" />
    </button>
  )
}
