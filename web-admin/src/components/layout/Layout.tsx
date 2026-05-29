import React, { useState } from 'react'
import { Navigation } from './Navigation'
import { Header } from './Header'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Sidebar */}
      <Navigation
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main column (offset for desktop sidebar) */}
      <div className="flex flex-col flex-1 lg:pl-64 min-w-0">
        <Header onMobileMenuToggle={() => setMobileSidebarOpen(true)} />

        <main
          id="main-content"
          className="flex-1 p-4 lg:p-8"
        >
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}
