import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import { Layout } from '../components/layout'
import { Card, CardHeader, CardTitle, Button, Input, StatusBadge } from '../components/ui'
import { PlusIcon, UserIcon } from '@heroicons/react/24/outline'

type Device = { id: string; name: string; last_seen_ts: string | null }

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [session, setSession] = useState<any>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [newDeviceName, setNewDeviceName] = useState('')

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

  const createDevice = async () => {
    setMessage('')
    if (!newDeviceName.trim()) {
      setMessage('Enter a device name')
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setMessage('Sign in first')
      return
    }
    const { data, error } = await supabase
      .from('devices')
      .insert({ name: newDeviceName, owner_user_id: userData.user.id })
      .select('id,name')
      .single()
    if (error) setMessage(error.message)
    else {
      setDevices((prev) => [...prev, { id: data!.id, name: data!.name, last_seen_ts: null }])
      setNewDeviceName('')
      setMessage('Device created. Open it and mint a token from its page.')
    }
  }

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
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
    if (error) setMessage(error.message)
    else setMessage('Sign-up complete. Check your email for confirmation (if required).')
  }

  const isDeviceOnline = (last_seen_ts: string | null): boolean => {
    if (!last_seen_ts) return false
    const last = new Date(last_seen_ts).getTime()
    const now = Date.now()
    return now - last < 90_000 // 90s freshness window
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">
              WNBA LED Web Admin
            </CardTitle>
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
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<UserIcon className="h-4 w-4" />}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              <p className="text-sm text-center text-red-600 dark:text-red-400">
                {message}
              </p>
            )}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your LED scoreboards and devices
            </p>
          </div>
          <div className="flex space-x-3">
            <Link href="/register">
              <Button leftIcon={<PlusIcon className="h-4 w-4" />}>
                Add Device
              </Button>
            </Link>
            <Button variant="secondary" onClick={() => supabase.auth.signOut()}>
              Sign Out
            </Button>
          </div>
        </div>

        {/* Quick device creation */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Device Setup</CardTitle>
          </CardHeader>
          <div className="flex space-x-3">
            <Input
              placeholder="Device name (e.g., Living Room Display)"
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              className="flex-1"
            />
            <Button onClick={createDevice} loading={loading}>
              Create Device
            </Button>
          </div>
          {message && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {message}
            </p>
          )}
        </Card>

        {/* Devices list */}
        <Card>
          <CardHeader>
            <CardTitle>Your Devices ({devices.length})</CardTitle>
          </CardHeader>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              <span className="ml-2 text-gray-600 dark:text-gray-400">Loading devices...</span>
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No devices found. Create your first device above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div>
                      <Link href={`/device/${device.id}`}>
                        <span className="font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer">
                          {device.name}
                        </span>
                      </Link>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Last seen: {device.last_seen_ts 
                          ? new Date(device.last_seen_ts).toLocaleString()
                          : 'Never'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <StatusBadge online={isDeviceOnline(device.last_seen_ts)} />
                    <Link href={`/device/${device.id}`}>
                      <Button variant="secondary" size="sm">
                        Configure
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  )
}
