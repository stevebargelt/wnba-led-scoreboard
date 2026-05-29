import { useState, useEffect } from 'react'
import { Layout } from '@/components/layout'
import { Card } from '@/components/ui/Card'
import { Toggle } from '@/components/ui/Toggle'
import { supabase } from '@/lib/supabaseClient'
import { fetchSportsAndLeagues } from '@/lib/sportsLeagues'
import type { SportConfig, LeagueConfig } from '@/types/sports'
import {
  ChevronRightIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline'

interface AdminLeague extends LeagueConfig {
  id?: string
}

export default function SportsLeaguesPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [sports, setSports] = useState<SportConfig[]>([])
  const [leagues, setLeagues] = useState<AdminLeague[]>([])
  const [selectedSportCode, setSelectedSportCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [updatingLeague, setUpdatingLeague] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        if (mounted) {
          setIsAdmin(false)
          setIsLoading(false)
        }
        return
      }

      try {
        const adminRes = await fetch('/api/auth/is-admin', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const adminData = await adminRes.json()
        if (!mounted) return
        const isAdminUser = adminData.isAdmin || false
        setIsAdmin(isAdminUser)

        if (isAdminUser) {
          const data = await fetchSportsAndLeagues()
          if (!mounted) return
          const sportsData: SportConfig[] = data.sports || []
          setSports(sportsData)
          setLeagues(data.leagues || [])
          if (sportsData.length > 0) {
            setSelectedSportCode(sportsData[0].code)
          }
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    init()
    return () => {
      mounted = false
    }
  }, [])

  const selectedSport = sports.find(s => s.code === selectedSportCode) ?? null
  const filteredLeagues = leagues.filter(l => l.sportCode === selectedSportCode)

  async function handleToggleEnabled(league: AdminLeague, enabled: boolean) {
    setUpdatingLeague(league.code)
    // Optimistic update
    setLeagues(prev => prev.map(l => (l.code === league.code ? { ...l, enabled } : l)))
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const resp = await fetch(`/api/admin/sports-leagues/league/${league.code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...league, enabled }),
      })
      if (!resp.ok) throw new Error('Update failed')
    } catch {
      // Revert on failure
      setLeagues(prev => prev.map(l => (l.code === league.code ? { ...l, enabled: !enabled } : l)))
    } finally {
      setUpdatingLeague(null)
    }
  }

  async function handleDeleteLeague(league: AdminLeague) {
    if (!confirm(`Delete league "${league.name}"? This cannot be undone.`)) return
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return
    await fetch(`/api/admin/sports-leagues/league/${league.code}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setLeagues(prev => prev.filter(l => l.code !== league.code))
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <span className="text-[var(--color-text-muted)] text-sm">Loading…</span>
        </div>
      </Layout>
    )
  }

  if (isAdmin === false) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh] px-4">
          <div
            role="alert"
            className="rounded-card bg-danger-soft border border-danger p-8 max-w-sm w-full text-center"
          >
            <div
              className="w-12 h-12 rounded-full bg-danger-soft border border-danger flex items-center justify-center mx-auto mb-4"
              aria-hidden="true"
            >
              <ShieldExclamationIcon className="w-6 h-6 text-danger" />
            </div>
            <h2 className="text-base font-semibold text-danger mb-2">Access Restricted</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              You don&apos;t have permission to access this area.
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* Admin banner */}
      <div
        role="status"
        className="mb-6 px-3 py-2 rounded-token-sm bg-amber-soft border border-[var(--color-amber)] flex items-center gap-2"
      >
        <ExclamationTriangleIcon className="w-4 h-4 text-amber flex-shrink-0" aria-hidden="true" />
        <span className="text-sm text-amber-fg">
          Admin view — changes affect all users&apos; devices.
        </span>
      </div>

      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Sports &amp; Leagues
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Global catalog — manage the sports and leagues available to all devices.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">
        {/* Left: sports list */}
        <nav
          aria-label="Sports"
          className="w-64 flex-shrink-0 bg-[var(--color-surface)] rounded-card border border-[var(--color-border)] overflow-hidden"
        >
          {sports.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--color-text-muted)]">No sports found.</p>
          ) : (
            <ul>
              {sports.map((sport, i) => {
                const leagueCount = leagues.filter(l => l.sportCode === sport.code).length
                const isSelected = sport.code === selectedSportCode
                return (
                  <li
                    key={sport.code}
                    className={i > 0 ? 'border-t border-[var(--color-border)]' : ''}
                  >
                    <button
                      onClick={() => setSelectedSportCode(sport.code)}
                      className={[
                        'w-full text-left flex items-center justify-between px-4 py-3 transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]',
                        isSelected
                          ? 'bg-accent-soft text-[var(--color-accent-soft-fg)]'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]',
                      ].join(' ')}
                      aria-pressed={isSelected}
                    >
                      <span className="text-sm font-medium">
                        {sport.name || sport.code.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className={[
                            'inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-semibold',
                            isSelected
                              ? 'bg-accent text-accent-fg'
                              : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]',
                          ].join(' ')}
                        >
                          {leagueCount}
                        </span>
                        <ChevronRightIcon
                          className={[
                            'w-4 h-4 flex-shrink-0',
                            isSelected
                              ? 'text-[var(--color-accent)]'
                              : 'text-[var(--color-text-muted)]',
                          ].join(' ')}
                          aria-hidden="true"
                        />
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </nav>

        {/* Right: league table */}
        <div className="flex-1 min-w-0">
          <Card padding="none">
            {/* Table header */}
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                {selectedSport?.name || 'Select a sport'}
              </h2>
            </div>

            {filteredLeagues.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">
                No leagues found for this sport.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th
                        scope="col"
                        className="px-5 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide"
                      >
                        League Name
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide"
                      >
                        Code
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide"
                      >
                        Enabled
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide"
                      >
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeagues.map((league, i) => (
                      <tr
                        key={league.code}
                        className={[
                          'transition-colors hover:bg-accent-soft',
                          i < filteredLeagues.length - 1
                            ? 'border-b border-[var(--color-border)]'
                            : '',
                        ].join(' ')}
                      >
                        <td className="px-5 py-3 font-medium text-[var(--color-text-primary)]">
                          {league.name}
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-mono-machine text-xs bg-accent-soft text-[var(--color-accent-soft-fg)] px-2 py-0.5 rounded-token-sm">
                            {league.code}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <Toggle
                            checked={league.enabled !== false}
                            onChange={enabled => handleToggleEnabled(league, enabled)}
                            disabled={updatingLeague === league.code}
                            label={league.enabled !== false ? 'Enabled' : 'Disabled'}
                          />
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => handleDeleteLeague(league)}
                            className="text-xs font-medium text-danger hover:text-danger-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] rounded"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  )
}
