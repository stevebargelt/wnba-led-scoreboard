import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  HomeIcon,
  TrophyIcon,
  ArrowRightOnRectangleIcon,
  TvIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { clsx } from 'clsx'
import { supabase } from '@/lib/supabaseClient'

const SIDEBAR_WIDTH = 'w-64'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

const baseNav: NavItem[] = [{ name: 'Dashboard', href: '/', icon: HomeIcon }]

const adminNav: NavItem[] = [
  { name: 'Admin', href: '/admin/sports-leagues', icon: TrophyIcon },
]

interface SidebarContentProps {
  isAdmin: boolean
  email: string | null
  onSignOut: () => void
}

function SidebarContent({ isAdmin, email, onSignOut }: SidebarContentProps) {
  const router = useRouter()
  const navItems = isAdmin ? [...baseNav, ...adminNav] : baseNav

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)] border-r border-[var(--color-border)]">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-6">
        <div className="flex-shrink-0 w-[34px] h-[34px] rounded-md bg-accent flex items-center justify-center">
          <TvIcon className="w-5 h-5 text-accent-fg" aria-hidden="true" />
        </div>
        <span className="text-base font-bold text-[var(--color-text-primary)] leading-none">
          LED Admin
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-0.5" aria-label="Main navigation">
        {navItems.map(item => {
          const isActive =
            item.href === '/'
              ? router.pathname === '/'
              : router.pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[14px] font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
                isActive
                  ? 'bg-accent-soft text-[var(--color-accent)] [&_svg]:text-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon
                className={clsx(
                  'w-[18px] h-[18px] flex-shrink-0',
                  isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
                )}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: user chip + sign out */}
      <div className="flex-shrink-0 mt-auto">
        <div className="mx-4 border-t border-[var(--color-border)]" />
        <div className="px-4 py-4 space-y-1">
          {/* User chip */}
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div
              className="w-8 h-8 rounded-full bg-accent flex-shrink-0 flex items-center justify-center text-accent-fg text-[13px] font-semibold select-none"
              aria-hidden="true"
            >
              {email ? email[0].toUpperCase() : '?'}
            </div>
            <span className="text-[13px] text-[var(--color-text-secondary)] truncate min-w-0">
              {email ?? '—'}
            </span>
          </div>

          {/* Sign out */}
          <button
            onClick={onSignOut}
            className={clsx(
              'flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-[14px] font-medium',
              'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]'
            )}
          >
            <ArrowRightOnRectangleIcon className="w-[18px] h-[18px] flex-shrink-0" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

interface NavigationProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Navigation({ mobileOpen = false, onMobileClose }: NavigationProps) {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (session?.user?.email) {
        setEmail(session.user.email)
      }

      if (session?.access_token) {
        try {
          const res = await fetch('/api/auth/is-admin', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          const data = await res.json()
          if (mounted) setIsAdmin(data.isAdmin || false)
        } catch {
          // silently fail — admin item just won't render
        }
      }
    }

    init()
    return () => {
      mounted = false
    }
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <>
      {/* Desktop sidebar — always visible on lg+ */}
      <aside className={clsx('hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-40', SIDEBAR_WIDTH)}>
        <SidebarContent isAdmin={isAdmin} email={email} onSignOut={handleSignOut} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={onMobileClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <div className={clsx('relative flex flex-col', SIDEBAR_WIDTH)}>
            <div className="absolute top-3 right-3 z-10">
              <button
                onClick={onMobileClose}
                className="p-2 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                aria-label="Close sidebar"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="h-full overflow-y-auto">
              <SidebarContent isAdmin={isAdmin} email={email} onSignOut={handleSignOut} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
