import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import { Layout } from '../components/layout'
import { Card, CardHeader, CardTitle, Button, Input, DeviceCard } from '../components/ui'
import { PlusIcon, UserIcon, TvIcon } from '@heroicons/react/24/outline'

type Device = { id: string; name: string; last_seen_ts: string | null }

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [session, setSession] = useState<any>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('devices')
        .select('id, name, last_seen_ts')
        .order('name')
      if (!error && data) setDevices(data as Device[])
      setLoading(false)
    })()
  }, [session])

  const signIn = async () => {
    setMessage('')
    if (!email || !password) {
      setMessage('Email and password required')
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(error.message)
  }

  const signUp = async () => {
    setMessage('')
    if (!email || !password) {
      setMessage('Email and password required')
      return
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) setMessage(error.message)
    else setMessage('Sign-up complete. Check your email for confirmation (if required).')
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">WNBA LED Web Admin</CardTitle>
            <p className="text-center text-gray-600 dark:text-gray-400 mt-2">
              Sign in to manage your LED scoreboards
            </p>
          </CardHeader>

          <div className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              leftIcon={<UserIcon className="h-4 w-4" />}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />

            <div className="flex space-x-2">
              <Button onClick={signIn} loading={loading} className="flex-1">
                Sign In
              </Button>
              <Button onClick={signUp} variant="secondary" loading={loading} className="flex-1">
                Sign Up
              </Button>
            </div>

            {message && (
              <p className="text-sm text-center text-red-600 dark:text-red-400">{message}</p>
            )}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <Layout>
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Dashboard</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Manage your LED scoreboards</p>
        </div>
        <Link href="/devices/new">
          <Button leftIcon={<PlusIcon className="h-4 w-4" />}>Add Device</Button>
        </Link>
      </div>

      {loading ? (
        /* Loading skeleton */
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          aria-label="Loading devices"
          aria-busy="true"
        >
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="bg-[var(--color-surface)] rounded-card border border-[var(--color-border)] p-5 animate-pulse"
              aria-hidden="true"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-[var(--color-surface-2)] rounded w-3/4" />
                  <div className="h-5 bg-[var(--color-surface-2)] rounded w-16" />
                </div>
                <div className="w-10 h-10 rounded-md bg-[var(--color-surface-2)]" />
              </div>
              <div className="mt-3 h-3 bg-[var(--color-surface-2)] rounded w-2/3" />
              <div className="mt-4 h-9 bg-[var(--color-surface-2)] rounded-[var(--radius-md)]" />
            </div>
          ))}
        </div>
      ) : devices.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-card bg-[var(--color-surface-2)] flex items-center justify-center mb-4">
            <TvIcon className="w-7 h-7 text-[var(--color-text-muted)]" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
            No devices yet
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6 max-w-xs">
            Add your first LED scoreboard to get started.
          </p>
          <Link href="/devices/new">
            <Button leftIcon={<PlusIcon className="h-4 w-4" />}>Add Device</Button>
          </Link>
        </div>
      ) : (
        /* Device grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {devices.map(device => (
            <DeviceCard
              key={device.id}
              id={device.id}
              name={device.name}
              lastSeenTs={device.last_seen_ts}
            />
          ))}
        </div>
      )}
    </Layout>
  )
}
