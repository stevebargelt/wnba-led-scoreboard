import { useEffect, useMemo, useState } from 'react'
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Device Configuration
              </h1>
              <div className="flex items-center space-x-4">
                <p className="text-gray-600 dark:text-gray-400">Device ID: {id}</p>
                {device && (
                  <div className="flex items-center space-x-2">
                    <StatusBadge online={isDeviceOnline} size="sm" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
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
              <Card>
                <CardHeader>
                  <CardTitle>Device Settings</CardTitle>
                </CardHeader>
                {settingsIsDirty && (
                  <div
                    role="alert"
                    className="rounded-md bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-600 px-4 py-2 text-sm text-amber-800 dark:text-amber-200 mb-4"
                  >
                    Unsaved changes
                  </div>
                )}
                <form
                  className="space-y-4"
                  onSubmit={e => { e.preventDefault(); saveSettings() }}
                >
                  <div className="space-y-1">
                    <label
                      htmlFor="brightness"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-200"
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
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="timezone"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                    >
                      Timezone
                    </label>
                    <input
                      id="timezone"
                      type="text"
                      value={settings.timezone}
                      onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
                      placeholder="America/Los_Angeles"
                      className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label
                        htmlFor="pregame-refresh"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                      >
                        Pregame Refresh (sec)
                      </label>
                      <input
                        id="pregame-refresh"
                        type="number"
                        value={settings.pregameSec}
                        onChange={e =>
                          setSettings(s => ({ ...s, pregameSec: Number(e.target.value) }))
                        }
                        className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="ingame-refresh"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                      >
                        Ingame Refresh (sec)
                      </label>
                      <input
                        id="ingame-refresh"
                        type="number"
                        value={settings.ingameSec}
                        onChange={e =>
                          setSettings(s => ({ ...s, ingameSec: Number(e.target.value) }))
                        }
                        className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="final-refresh"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                      >
                        Final Refresh (sec)
                      </label>
                      <input
                        id="final-refresh"
                        type="number"
                        value={settings.finalSec}
                        onChange={e =>
                          setSettings(s => ({ ...s, finalSec: Number(e.target.value) }))
                        }
                        className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </form>
              </Card>
              <div className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  disabled={!settingsIsDirty}
                  onClick={discardSettings}
                >
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
              {message && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}
