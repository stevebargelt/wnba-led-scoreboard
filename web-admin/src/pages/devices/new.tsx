import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { Layout } from '@/components/layout'
import { Card, CardHeader, CardTitle, Button, Input, CopyRow } from '@/components/ui'
import { ArrowLeftIcon, CheckCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'

export default function NewDevice() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deviceId, setDeviceId] = useState<string | null>(null)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  const createDevice = async () => {
    setError('')
    if (!name.trim()) {
      setError('Enter a device name')
      return
    }
    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setError('Sign in first')
        return
      }
      const { data, error: dbError } = await supabase
        .from('devices')
        .insert({ name: name.trim(), user_id: userData.user.id })
        .select('id')
        .single()
      if (dbError) {
        setError(dbError.message)
      } else {
        setDeviceId(data!.id)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" leftIcon={<ArrowLeftIcon className="h-4 w-4" />}>
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {!deviceId ? (
          <Card>
            <CardHeader>
              <CardTitle as="h1">Add Device</CardTitle>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Give your LED scoreboard a name to get started.
              </p>
            </CardHeader>
            <div className="space-y-4">
              <Input
                label="Device name"
                placeholder="e.g., Living Room Display"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') createDevice()
                }}
                helperText="Choose a descriptive name to identify this device."
              />
              {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
              <Button fullWidth onClick={createDevice} loading={loading} disabled={!name.trim()}>
                Create Device
              </Button>
            </div>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CheckCircleIcon
                  className="w-7 h-7 text-[var(--color-success)] flex-shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <CardTitle as="h1">Device created!</CardTitle>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                    Copy these values into your Pi&apos;s{' '}
                    <code className="font-mono text-xs">.env</code>.
                  </p>
                </div>
              </div>
            </CardHeader>

            <div className="space-y-4">
              <CopyRow label="SUPABASE_URL" value={supabaseUrl} />
              <CopyRow label="SUPABASE_ANON_KEY" value={supabaseAnonKey} />
              <CopyRow label="DEVICE_ID" value={deviceId} />

              <div className="flex gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--color-accent-soft)]">
                <InformationCircleIcon
                  className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <p className="text-sm text-[var(--color-accent-soft-fg)]">
                  No device token is needed. The device authenticates using the anon key and its
                  DEVICE_ID.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Link href="/" className="flex-1">
                  <Button variant="secondary" fullWidth>
                    Back to Dashboard
                  </Button>
                </Link>
                <Link href={`/device/${deviceId}`} className="flex-1">
                  <Button fullWidth>Configure Device</Button>
                </Link>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  )
}
