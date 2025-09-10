import React from 'react'
import { Bars3Icon, BellIcon } from '@heroicons/react/24/outline'
import { ThemeToggleButton } from '../ui/ThemeToggle'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

export function Header() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Mobile menu button */}
          <div className="flex items-center lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Open sidebar"
            >
              <Bars3Icon className="h-6 w-6" />
            </Button>
          </div>

          {/* Logo and title */}
          <div className="flex items-center">
            <div className="flex-shrink-0 lg:hidden">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                WNBA LED Admin
              </h1>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-2">
            {/* Notifications */}
            <Button variant="ghost" size="sm" aria-label="View notifications">
              <div className="relative">
                <BellIcon className="h-5 w-5" />
                {/* Notification badge */}
                <Badge
                  size="sm"
                  variant="error"
                  className="absolute -top-2 -right-2 min-w-5 h-5 flex items-center justify-center p-0 text-xs"
                >
                  2
                </Badge>
              </div>
            </Button>

            {/* Theme toggle */}
            <ThemeToggleButton />

            {/* User menu would go here */}
            <div className="ml-3">
              <Button variant="ghost" size="sm">
                Profile
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
