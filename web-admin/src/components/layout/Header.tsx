import React from 'react'
import { Bars3Icon } from '@heroicons/react/24/outline'
import { ThemeToggleButton } from '../ui/ThemeToggle'

interface HeaderProps {
  onMobileMenuToggle?: () => void
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  return (
    <header
      role="banner"
      className="h-14 flex items-center justify-between px-4 lg:px-6 bg-[var(--color-surface)] border-b border-[var(--color-border)] sticky top-0 z-30 flex-shrink-0"
    >
      {/* Mobile hamburger */}
      <button
        className="lg:hidden p-2 -ml-2 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        onClick={onMobileMenuToggle}
        aria-label="Open navigation menu"
      >
        <Bars3Icon className="w-5 h-5" />
      </button>

      {/* Product name */}
      <span className="text-[14px] font-semibold text-[var(--color-text-secondary)] hidden lg:block">
        LED Scoreboard Admin
      </span>

      {/* Mobile: product name centered */}
      <span className="text-[14px] font-semibold text-[var(--color-text-secondary)] lg:hidden absolute left-1/2 -translate-x-1/2">
        LED Scoreboard Admin
      </span>

      {/* Theme toggle */}
      <ThemeToggleButton />
    </header>
  )
}
