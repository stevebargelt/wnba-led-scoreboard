import React from 'react'
import { clsx } from 'clsx'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg'
  shadow?: 'none' | 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

const paddingVariants = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

const shadowVariants = {
  none: '',
  sm: 'shadow-[0_1px_3px_var(--color-shadow)]',
  md: 'shadow-[0_1px_3px_var(--color-shadow)]',
  lg: 'shadow-[0_4px_12px_var(--color-shadow)]',
}

export function Card({ padding = 'md', shadow = 'sm', children, className, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-[var(--color-surface)] rounded-card border border-[var(--color-border)]',
        paddingVariants[padding],
        shadowVariants[shadow],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function CardHeader({ children, className, ...props }: CardHeaderProps) {
  return (
    <div
      className={clsx('border-b border-[var(--color-border)] pb-4 mb-4', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export function CardTitle({ children, className, as: Heading = 'h3', ...props }: CardTitleProps) {
  return (
    <Heading
      className={clsx('text-lg font-semibold text-[var(--color-text-primary)]', className)}
      {...props}
    >
      {children}
    </Heading>
  )
}
