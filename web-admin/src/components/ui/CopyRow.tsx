import React, { useState } from 'react'
import { DocumentDuplicateIcon, CheckIcon } from '@heroicons/react/24/outline'
import { clsx } from 'clsx'

export interface CopyRowProps {
  label: string
  value: string
  className?: string
}

export function CopyRow({ label, value, className }: CopyRowProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API may not be available in all contexts
    }
  }

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] font-mono-machine">
        {label}
      </span>

      <div className="flex items-stretch gap-0">
        {/* Value box */}
        <div
          className={clsx(
            'flex-1 min-w-0 px-3 py-2 rounded-l-[var(--radius-sm)]',
            'bg-[var(--color-surface-3)] border border-[var(--color-border)]',
            'text-[13px] text-[var(--color-text-primary)] font-mono-machine truncate',
            'border-r-0'
          )}
        >
          {value}
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={clsx(
            'flex items-center justify-center px-3 rounded-r-[var(--radius-sm)]',
            'bg-[var(--color-surface-3)] border border-[var(--color-border)]',
            'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
            'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
            'flex-shrink-0'
          )}
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <CheckIcon className="w-4 h-4 text-[var(--color-success)]" />
          ) : (
            <DocumentDuplicateIcon className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  )
}
