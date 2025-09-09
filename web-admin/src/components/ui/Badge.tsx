import React from 'react'
import { clsx } from 'clsx'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info'
export type BadgeSize = 'sm' | 'md' | 'lg'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  children: React.ReactNode
}

const badgeVariants = {
  default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  success: 'bg-success-100 text-success-800 dark:bg-success-800 dark:text-success-100',
  warning: 'bg-warning-100 text-warning-800 dark:bg-warning-800 dark:text-warning-100',
  error: 'bg-error-100 text-error-800 dark:bg-error-800 dark:text-error-100',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100',
}

const badgeSizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
}

const dotColors = {
  default: 'bg-gray-400',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
  info: 'bg-blue-500',
}

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium',
        badgeVariants[variant],
        badgeSizes[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full mr-1.5',
            dotColors[variant]
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}

// Status Badge Components for common use cases
export function StatusBadge({ online, ...props }: { online: boolean } & Omit<BadgeProps, 'variant' | 'dot' | 'children'>) {
  return (
    <Badge
      variant={online ? 'success' : 'default'}
      dot
      {...props}
    >
      {online ? 'online' : 'offline'}
    </Badge>
  )
}