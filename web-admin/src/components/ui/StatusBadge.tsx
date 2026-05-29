import React from 'react'
import { clsx } from 'clsx'

function isWithin90s(lastSeenTs: string | null): boolean {
  if (!lastSeenTs) return false
  return Date.now() - new Date(lastSeenTs).getTime() < 90_000
}

export interface StatusBadgeProps {
  /** Primary freshness-based API: pass last_seen_ts directly */
  lastSeenTs?: string | null
  /** Backward-compat: explicit boolean (overrides lastSeenTs if provided) */
  online?: boolean
  /** Size variant (backward-compat) */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function StatusBadge({ lastSeenTs, online, size = 'md', className }: StatusBadgeProps) {
  const isOnline = online !== undefined ? online : isWithin90s(lastSeenTs ?? null)

  const textSize = size === 'sm' ? 'text-[11px]' : 'text-[12px]'

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-pill font-semibold leading-none',
        textSize,
        isOnline
          ? 'bg-success-soft text-success-fg'
          : 'bg-surface-2 text-[var(--color-text-secondary)]',
        className
      )}
      aria-label={isOnline ? 'Online' : 'Offline'}
    >
      <span
        className={clsx(
          'w-2 h-2 rounded-full flex-shrink-0',
          isOnline ? 'bg-success-dot' : 'bg-offline-dot'
        )}
        aria-hidden="true"
      />
      {isOnline ? 'Online' : 'Offline'}
    </span>
  )
}
