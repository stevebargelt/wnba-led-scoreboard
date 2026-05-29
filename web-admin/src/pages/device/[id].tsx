import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import { Layout } from '../../components/layout'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  StatusBadge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../../components/ui'
import { DeviceTeamsTab } from '../../components/config/DeviceTeamsTab'

const SETTINGS_DEFAULTS = {
  brightness: 80,
  timezone: 'America/Los_Angeles',
  pregameSec: 30,
  ingameSec: 5,
  finalSec: 60,
}

interface SettingsState {
  brightness: number
  timezone: string
  pregameSec: number
  ingameSec: number
  finalSec: number
}

function settingsEqual(a: SettingsState, b: SettingsState): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export default function DevicePage() {
  const router = useRouter()
  const { id } = router.query

  const [device, setDevice] = useState<{
    id: string
    name?: string
    last_seen_ts?: string | null
  } | null>(null)

  const [settings, setSettings] = useState<SettingsState>(SETTINGS_DEFAULTS)
  const [settingsClean, setSettingsClean] = useState<SettingsState>(SETTINGS_DEFAULTS)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteNameInput, setDeleteNameInput] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const deleteInputRef = useRef<HTMLInputElement>(null)

  const settingsIsDirty = !settingsEqual(settings, settingsClean)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const { data: dev } = await supabase
        .from('devices')
        .select('id,name,last_seen_ts')
        .eq('id', id)
        .maybeSingle()
      if (dev) setDevice(dev)

      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      if (!jwt) return

      const resp = await fetch(`/api/device/${id}/config`, {
        headers: { Authorization: `Bearer ${jwt}` },
      })
      if (resp.ok) {
        const data = await resp.json()
        const loaded: SettingsState = {
          brightness: data.brightness ?? SETTINGS_DEFAULTS.brightness,
          timezone: data.timezone ?? SETTINGS_DEFAULTS.timezone,
          pregameSec: data.refresh_pregame_sec ?? SETTINGS_DEFAULTS.pregameSec,
          ingameSec: data.refresh_ingame_sec ?? SETTINGS_DEFAULTS.ingameSec,
          finalSec: data.refresh_final_sec ?? SETTINGS_DEFAULTS.finalSec,
        }
        setSettings(loaded)
        setSettingsClean(loaded)
      }
    })()
  }, [id])

  useEffect(() => {
    if (!id) return
    const loadDevice = async () => {
      const { data } = await supabase.from('devices').select('*').eq('id', id).single()
      if (data) setDevice(data)
    }
    loadDevice()
    const interval = setInterval(loadDevice, 30000)
    return () => clearInterval(interval)
  }, [id])

  async function saveSettings() {
    if (!id) return
    setSettingsLoading(true)
    setMessage('')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      if (!jwt) {
        setMessage('Not signed in')
        return
      }
      const resp = await fetch(`/api/device/${id}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          brightness: settings.brightness,
          timezone: settings.timezone,
          refresh_pregame_sec: settings.pregameSec,
          refresh_ingame_sec: settings.ingameSec,
          refresh_final_sec: settings.finalSec,
        }),
      })
      if (resp.ok) {
        setSettingsClean(settings)
        setMessage('Settings saved.')
      } else {
        const body = await resp.json()
        setMessage(`Save failed: ${body?.error || 'Unknown error'}`)
      }
    } catch (e: any) {
      setMessage(`Error: ${e.message}`)
    } finally {
      setSettingsLoading(false)
    }
  }

  function discardSettings() {
    setSettings(settingsClean)
    setMessage('')
  }

  function openDeleteConfirm() {
    setDeleteNameInput('')
    setDeleteError('')
    setShowDeleteConfirm(true)
    setTimeout(() => deleteInputRef.current?.focus(), 50)
  }

  function cancelDelete() {
    setShowDeleteConfirm(false)
    setDeleteNameInput('')
    setDeleteError('')
  }

  async function confirmDelete() {
    if (!id) return
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      if (!jwt) {
        setDeleteError('Not signed in')
        return
      }
      const resp = await fetch(`/api/device/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${jwt}` },
      })
      if (resp.ok || resp.status === 204) {
        router.push('/')
      } else {
        const body = resp.headers.get('content-type')?.includes('application/json')
          ? await resp.json()
          : {}
        setDeleteError(body?.error || `Delete failed (${resp.status})`)
      }
    } catch (e: any) {
      setDeleteError(`Error: ${e.message}`)
    } finally {
      setDeleteLoading(false)
    }
  }

  const isDeviceOnline = useMemo(() => {
    if (!device?.last_seen_ts) return false
    return Date.now() - new Date(device.last_seen_ts).getTime() < 90_000
  }, [device?.last_seen_ts])

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => router.push('/')}
              leftIcon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              }
            >
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                {device?.name || 'Device Configuration'}
              </h1>
              <div className="flex items-center space-x-4">
                <p className="text-[var(--color-text-secondary)] text-sm">ID: {id}</p>
                {device && (
                  <div className="flex items-center space-x-2">
                    <StatusBadge online={isDeviceOnline} size="sm" />
                    <span className="text-xs text-[var(--color-text-muted)]">
                      Last seen:{' '}
                      {device.last_seen_ts ? new Date(device.last_seen_ts).toLocaleString() : '—'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="teams" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="teams">
            <DeviceTeamsTab deviceId={id as string} />
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-6">
              {settingsIsDirty && (
                <div
                  role="alert"
                  className="rounded-token-sm bg-amber-soft border border-[var(--color-amber)] px-4 py-2 text-sm text-amber-fg"
                >
                  Unsaved changes
                </div>
              )}

              {/* Display card: Brightness + Timezone */}
              <Card>
                <CardHeader>
                  <CardTitle>Display</CardTitle>
                </CardHeader>
                <form
                  className="space-y-4"
                  onSubmit={e => {
                    e.preventDefault()
                    saveSettings()
                  }}
                >
                  <div className="space-y-1">
                    <label
                      htmlFor="brightness"
                      className="block text-sm font-medium text-[var(--color-text-secondary)]"
                    >
                      Brightness: {settings.brightness}
                    </label>
                    <input
                      id="brightness"
                      type="range"
                      min={1}
                      max={100}
                      value={settings.brightness}
                      aria-label="Brightness"
                      aria-valuemin={1}
                      aria-valuemax={100}
                      aria-valuenow={settings.brightness}
                      onChange={e =>
                        setSettings(s => ({ ...s, brightness: Number(e.target.value) }))
                      }
                      className="w-full accent-[var(--color-accent)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="timezone"
                      className="block text-sm font-medium text-[var(--color-text-secondary)]"
                    >
                      Timezone
                    </label>
                    <input
                      id="timezone"
                      type="text"
                      value={settings.timezone}
                      onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
                      placeholder="America/Los_Angeles"
                      className="block w-full h-[42px] rounded-token-sm border border-[var(--color-border)] bg-[var(--color-surface-3)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                    />
                  </div>

                  {/* Advanced — Refresh Cadence accordion */}
                  <details className="group rounded-token-sm border border-[var(--color-border)] bg-[var(--color-surface-2)]">
                    <summary className="flex items-center justify-between cursor-pointer px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] select-none list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)] rounded-token-sm">
                      <span>Advanced</span>
                      <svg
                        className="w-4 h-4 transition-transform group-open:rotate-180"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </summary>
                    <div className="px-4 pb-4 pt-2 space-y-4 border-t border-[var(--color-border)]">
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Refresh Cadence — The device automatically backs off polling.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label
                            htmlFor="pregame-refresh"
                            className="block text-sm font-medium text-[var(--color-text-secondary)]"
                          >
                            Pre-game (sec)
                          </label>
                          <input
                            id="pregame-refresh"
                            type="number"
                            value={settings.pregameSec}
                            onChange={e =>
                              setSettings(s => ({ ...s, pregameSec: Number(e.target.value) }))
                            }
                            className="block w-full h-[42px] rounded-token-sm border border-[var(--color-border)] bg-[var(--color-surface-3)] text-[var(--color-text-primary)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label
                            htmlFor="ingame-refresh"
                            className="block text-sm font-medium text-[var(--color-text-secondary)]"
                          >
                            In-game (sec)
                          </label>
                          <input
                            id="ingame-refresh"
                            type="number"
                            value={settings.ingameSec}
                            onChange={e =>
                              setSettings(s => ({ ...s, ingameSec: Number(e.target.value) }))
                            }
                            className="block w-full h-[42px] rounded-token-sm border border-[var(--color-border)] bg-[var(--color-surface-3)] text-[var(--color-text-primary)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label
                            htmlFor="final-refresh"
                            className="block text-sm font-medium text-[var(--color-text-secondary)]"
                          >
                            Final (sec)
                          </label>
                          <input
                            id="final-refresh"
                            type="number"
                            value={settings.finalSec}
                            onChange={e =>
                              setSettings(s => ({ ...s, finalSec: Number(e.target.value) }))
                            }
                            className="block w-full h-[42px] rounded-token-sm border border-[var(--color-border)] bg-[var(--color-surface-3)] text-[var(--color-text-primary)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                          />
                        </div>
                      </div>
                    </div>
                  </details>
                </form>
              </Card>

              <div className="flex justify-end gap-3">
                <Button variant="secondary" disabled={!settingsIsDirty} onClick={discardSettings}>
                  Discard
                </Button>
                <Button
                  disabled={!settingsIsDirty || settingsLoading}
                  loading={settingsLoading}
                  onClick={saveSettings}
                >
                  Save
                </Button>
              </div>
              {message && <p className="text-sm text-[var(--color-text-secondary)]">{message}</p>}

              {/* Danger Zone */}
              <div
                className="rounded-card border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-5"
                aria-label="Danger zone"
              >
                <h3 className="text-base font-semibold text-[var(--color-danger)] mb-1">
                  Danger Zone
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                  Irreversible and destructive actions.
                </p>

                {!showDeleteConfirm ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        Delete this device
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Permanently removes the device and all its configuration.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={openDeleteConfirm}
                      leftIcon={
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      }
                    >
                      Delete this device
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-[var(--color-text-primary)]">
                      This action <strong>cannot be undone</strong>. This will permanently delete
                      the device <strong>&ldquo;{device?.name}&rdquo;</strong> and all associated
                      configuration.
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Please type{' '}
                      <code className="rounded px-1 py-0.5 text-xs font-mono bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                        {device?.name}
                      </code>{' '}
                      to confirm.
                    </p>
                    <div className="space-y-1">
                      <label
                        htmlFor="delete-confirm-input"
                        className="block text-sm font-medium text-[var(--color-text-secondary)]"
                      >
                        Device name
                      </label>
                      <input
                        id="delete-confirm-input"
                        ref={deleteInputRef}
                        type="text"
                        value={deleteNameInput}
                        onChange={e => setDeleteNameInput(e.target.value)}
                        placeholder={device?.name ?? ''}
                        autoComplete="off"
                        aria-describedby={deleteError ? 'delete-error' : undefined}
                        className="block w-full h-[42px] rounded-token-sm border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]"
                      />
                    </div>
                    {deleteError && (
                      <p
                        id="delete-error"
                        role="alert"
                        className="text-sm text-[var(--color-danger)]"
                      >
                        {deleteError}
                      </p>
                    )}
                    <div className="flex gap-3">
                      <Button
                        variant="destructive"
                        disabled={deleteNameInput.trim() !== (device?.name ?? '') || deleteLoading}
                        loading={deleteLoading}
                        onClick={confirmDelete}
                      >
                        Delete this device
                      </Button>
                      <Button variant="secondary" onClick={cancelDelete} disabled={deleteLoading}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}
