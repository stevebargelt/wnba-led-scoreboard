import React from 'react'
import { clsx } from 'clsx'

interface Tab {
  id: string
  label: string
  icon?: string
  disabled?: boolean
}

interface SimpleTabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  className?: string
}

export function SimpleTabs({ tabs, activeTab, onTabChange, className }: SimpleTabsProps) {
  return (
    <div className={clsx('border-b border-gray-200 dark:border-gray-700', className)}>
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            disabled={tab.disabled}
            className={clsx(
              'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                : tab.disabled
                  ? 'border-transparent text-gray-400 cursor-not-allowed'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            )}
          >
            <span className="flex items-center">
              {tab.icon && <span className="mr-2">{tab.icon}</span>}
              {tab.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  )
}