import React from 'react'
import { clsx } from 'clsx'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  label,
  className = '',
}: ToggleProps) {
  const sizeClasses = {
    sm: {
      toggle: 'h-5 w-9',
      thumb: 'h-3 w-3',
      thumbTranslate: checked ? 'translate-x-5' : 'translate-x-1',
    },
    md: {
      toggle: 'h-6 w-11',
      thumb: 'h-4 w-4',
      thumbTranslate: checked ? 'translate-x-6' : 'translate-x-1',
    },
    lg: {
      toggle: 'h-7 w-12',
      thumb: 'h-5 w-5',
      thumbTranslate: checked ? 'translate-x-6' : 'translate-x-1',
    },
  }

  const sizes = sizeClasses[size]

  return (
    <div className={clsx('flex items-center', className)}>
      {label && <label className="mr-3 text-sm font-medium text-gray-700">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          sizes.toggle,
          checked ? 'bg-blue-600' : 'bg-gray-200',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className="sr-only">
          {checked ? 'Disable' : 'Enable'} {label}
        </span>
        <span
          className={clsx(
            'inline-block transform rounded-full bg-white transition-transform',
            sizes.thumb,
            sizes.thumbTranslate
          )}
        />
      </button>
    </div>
  )
}
