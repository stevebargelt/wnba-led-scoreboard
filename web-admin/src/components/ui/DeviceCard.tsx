import React from 'react'
import Link from 'next/link'
import { TvIcon, ClockIcon } from '@heroicons/react/24/outline'
import { clsx } from 'clsx'
import { StatusBadge } from './StatusBadge'

export interface DeviceCardProps {
  id: string
  name: string
  lastSeenTs: string | null
  configureHref?: string
  className?: string
}

function formatRelativeTime(ts: string | null): string {
  if (!ts) return 'Never'
  const diff = Date.now() - new Date(ts).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs} seconds ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

export function DeviceCard({ id, name, lastSeenTs, configureHref, className }: DeviceCardProps) {
  const href = configureHref ?? `/device/${id}`

  return (
    <article
      className={clsx(
        'bg-[var(--color-surface)] rounded-card border border-[var(--color-border)] p-5',
        'shadow-[0_1px_3px_var(--color-shadow)]',
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={href}
            className="text-[17px] font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded"
          >
            {name}
          </Link>
          <div className="mt-1">
            <StatusBadge lastSeenTs={lastSeenTs} />
          </div>
        </div>

        <div
          className="flex-shrink-0 w-10 h-10 rounded-md bg-[var(--color-surface-2)] flex items-center justify-center"
          aria-hidden="true"
        >
          <TvIcon className="w-5 h-5 text-[var(--color-text-muted)]" />
        </div>
      </div>

      {/* Last seen */}
      <p className="mt-3 flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)]">
        <ClockIcon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
        Last seen {formatRelativeTime(lastSeenTs)}
      </p>

      {/* Configure button */}
      <Link
        href={href}
        className={clsx(
          'mt-4 w-full flex items-center justify-center rounded-[var(--radius-md)]',
          'py-[10px] px-4 text-[14px] font-semibold',
          'bg-[var(--color-surface)] border border-[var(--color-border-strong)] text-[var(--color-text-primary)]',
          'hover:bg-[var(--color-surface-2)] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]'
        )}
      >
        Configure
      </Link>
    </article>
  )
}
