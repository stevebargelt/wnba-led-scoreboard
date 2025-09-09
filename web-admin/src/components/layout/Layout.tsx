import React from 'react'
import { Navigation } from './Navigation'
import { Header } from './Header'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Skip to main content link for accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      
      <Header />
      
      <div className="flex">
        <Navigation />
        
        <main
          id="main-content"
          className="flex-1 p-4 lg:p-8 ml-0 lg:ml-64 transition-all duration-200 ease-in-out"
        >
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}