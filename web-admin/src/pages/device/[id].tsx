import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import { MultiSportTeamSelector } from '../../components/config/MultiSportTeamSelector'
import { MultiSportFavoritesEditor } from '../../components/config/MultiSportFavoritesEditor'
import { makeValidator } from '@/lib/schema'
import { Layout } from '../../components/layout'
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Input,
  StatusBadge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../../components/ui'
import { SportManagement } from '../../components/sports/SportManagement'
import { LiveGameMonitor } from '../../components/sports/LiveGameMonitor'

// Removed edge function endpoints - now using direct database writes

export default function DevicePage() {
  const router = useRouter()
  const { id } = router.query
  const [device, setDevice] = useState<{
    id: string
    name?: string
    last_seen_ts?: string | null
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  // Removed: mintedToken, configText, schemaErrors - no longer needed with direct UI
  const [multiSportConfig, setMultiSportConfig] = useState<any>(null)
  const handleMultiSportConfigChange = useCallback((config: any) => {
    setMultiSportConfig(config)
  }, [])
  // Inline editable settings (with reasonable defaults)
  const DEFAULTS = {
    timezone: 'America/Los_Angeles',
    matrix: {
      width: 64,
      height: 32,
      chain_length: 1,
      parallel: 1,
      gpio_slowdown: 2,
      hardware_mapping: 'adafruit-hat',
      brightness: 80,
      pwm_bits: 11,
    },
    refresh: { pregame_sec: 30, ingame_sec: 5, final_sec: 60 },
    render: { live_layout: 'stacked', logo_variant: 'mini' },
  }
  const [timezone, setTimezone] = useState<string>(DEFAULTS.timezone)
  const [matrix, setMatrix] = useState(DEFAULTS.matrix)
  const [refreshCfg, setRefreshCfg] = useState(DEFAULTS.refresh)
  const [renderCfg, setRenderCfg] = useState(DEFAULTS.render)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      // Load device config from new simplified table
      const { data } = await supabase
        .from('device_config')
        .select('*')
        .eq('device_id', id)
        .maybeSingle()
      if (data) {
        setTimezone(data.timezone || DEFAULTS.timezone)
        setMatrix(data.matrix_config || DEFAULTS.matrix)
        setRefreshCfg(data.refresh_config || DEFAULTS.refresh)
        setRenderCfg(data.render_config || DEFAULTS.render)
      }
      if ((data?.content as any)?.timezone) setTimezone((data!.content as any).timezone)
      if ((data?.content as any)?.matrix) setMatrix((data!.content as any).matrix)
      if ((data?.content as any)?.refresh) setRefreshCfg((data!.content as any).refresh)
      if ((data?.content as any)?.render) setRenderCfg((data!.content as any).render)
      const { data: dev } = await supabase
        .from('devices')
        .select('id,name,last_seen_ts')
        .eq('id', id)
        .maybeSingle()
      if (dev) setDevice(dev)
      // Events removed - no longer tracking device events

      // Load device sport configuration for Multi-Sport Favorites editor
      try {
        const { data: sess } = await supabase.auth.getSession()
        const jwt = sess.session?.access_token
        // Fetch available sports/teams to resolve identifiers to canonical names/abbrs
        let sportDirectory: Record<string, any[]> = {}
        try {
          const sRes = await fetch('/api/sports', {
            headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
          })
          if (sRes.ok) {
            const sJson = await sRes.json()
            sportDirectory = sJson.sports || {}
          }
        } catch {}

        const resp = await fetch(`/api/device/${id}/sports`, {
          headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
        })
        if (resp.ok) {
          const body = await resp.json()
          const sportConfigs: any[] = body.sportConfigs || []
          // Helper to resolve identifier to {id,name,abbr}
          const resolveFav = (sport: string, identifier: any) => {
            const list = (sportDirectory[sport] || []) as any[]
            const idStr = String(identifier)
            const byId = list.find(t => String(t.id) === idStr)
            if (byId) return { id: String(byId.id), name: byId.name, abbr: byId.abbreviation }
            const byAbbr = list.find(
              t => String(t.abbreviation).toUpperCase() === idStr.toUpperCase()
            )
            if (byAbbr)
              return { id: String(byAbbr.id), name: byAbbr.name, abbr: byAbbr.abbreviation }
            const byName = list.find(t => String(t.name).toLowerCase() === idStr.toLowerCase())
            if (byName)
              return { id: String(byName.id), name: byName.name, abbr: byName.abbreviation }
            return { id: idStr, name: idStr, abbr: idStr }
          }

          // Map DB rows to editor format with enrichment using directory if available
          const wnba = sportConfigs.find(c => String(c.sport) === 'wnba') || {
            sport: 'wnba',
            enabled: true,
            favorite_teams: [],
            priority: 1,
          }
          const nhl = sportConfigs.find(c => String(c.sport) === 'nhl') || {
            sport: 'nhl',
            enabled: false,
            favorite_teams: [],
            priority: 2,
          }
          const mapFavs = (arr: any[], sport: string) =>
            (Array.isArray(arr) ? arr : []).map(v => resolveFav(sport, v))
          setMultiSportConfig({
            sports: [
              {
                sport: 'wnba',
                enabled: !!wnba.enabled,
                favorites: mapFavs(wnba.favorite_teams, 'wnba'),
              },
              {
                sport: 'nhl',
                enabled: !!nhl.enabled,
                favorites: mapFavs(nhl.favorite_teams, 'nhl'),
              },
            ],
          })
        }
      } catch (e) {
        // Non-fatal for the page
        console.warn('Failed to load device sport configs for favorites editor', e)
      }
    })()
  }, [id])

  // Poll for device updates periodically (removed realtime subscriptions)
  useEffect(() => {
    if (!id) return

    // Load initial device data
    const loadDevice = async () => {
      const { data } = await supabase.from('devices').select('*').eq('id', id).single()

      if (data) {
        setDevice(data)
      }
    }

    loadDevice()

    // Optionally poll for updates every 30 seconds
    const interval = setInterval(loadDevice, 30000)

    return () => clearInterval(interval)
  }, [id])

  const saveConfig = async () => {
    if (!id) return
    setLoading(true)
    setMessage('')

    try {
      // Build priority config from multiSportConfig if available
      const priorityConfig: any = {
        sport_order: ['wnba', 'nhl', 'nba'],
        live_game_boost: true,
        favorite_team_boost: true,
        close_game_boost: true,
        close_game_threshold: 5,
        playoff_boost: true,
        conflict_resolution: 'priority',
      }

      if (multiSportConfig?.sports) {
        // Extract sport order from enabled sports
        priorityConfig.sport_order = multiSportConfig.sports
          .filter((s: any) => s.enabled)
          .sort((a: any, b: any) => a.priority - b.priority)
          .map((s: any) => s.sport)
      }

      // Update device_config table directly
      const { error } = await supabase.from('device_config').upsert({
        device_id: id as string,
        timezone,
        matrix_config: matrix,
        refresh_config: refreshCfg,
        render_config: renderCfg,
        priority_config: priorityConfig,
        updated_at: new Date().toISOString(),
      })

      if (error) {
        setMessage(`Save failed: ${error.message}`)
      } else {
        setMessage('Configuration saved successfully')
      }
    } catch (e: any) {
      setMessage(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Removed sendAction - no longer needed with direct database updates
  // Removed buildApplyFromDb - configuration is now saved directly to database

  // Removed previewFromDb - configuration is now loaded directly from database

  const seedTeams = async () => {
    try {
      setLoading(true)
      setMessage('')
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      if (!jwt) {
        setMessage('Not signed in')
        setLoading(false)
        return
      }
      const resp = await fetch('/api/admin/seed-teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
      })
      const body = await resp.json()
      if (resp.ok) {
        const parts = Object.entries(body.results || {})
          .map(([sport, r]: any) => `${sport}: ${r.upserted}`)
          .join(', ')
        setMessage(`Seeded teams (${parts || 'no files found'})`)
      } else {
        setMessage(`Seed failed: ${body?.error || 'Unknown error'}`)
      }
    } catch (e: any) {
      setMessage(`Seed error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Removed mintDeviceToken - no longer needed with direct Supabase

  const isDeviceOnline = useMemo(() => {
    if (!device?.last_seen_ts) return false
    const last = new Date(device.last_seen_ts).getTime()
    return Date.now() - last < 90_000
  }, [device?.last_seen_ts])

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header with back button */}
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

        {/* Tabbed Interface */}
        <Tabs defaultValue="sports" className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="sports">Sports</TabsTrigger>
            <TabsTrigger value="favorites">Favorite Teams</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
            {/* Removed Device Actions, Token, and Events tabs - no longer needed */}
          </TabsList>

          <TabsContent value="sports">
            <div className="space-y-6">
              <SportManagement deviceId={id as string} />
              <LiveGameMonitor
                deviceId={id as string}
                onGameOverride={async (sport, gameEventId, reason) => {
                  // This will be handled by the SportManagement component
                  console.log('Game override requested:', { sport, gameEventId, reason })
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="favorites">
            <MultiSportFavoritesEditor
              deviceId={id as string}
              onConfigChange={handleMultiSportConfigChange}
              initialConfig={multiSportConfig}
            />
          </TabsContent>

          {/* Removed Device Actions and Token tabs content */}

          <TabsContent value="config">
            <div className="space-y-6">
              {/* Device Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Device Settings</CardTitle>
                </CardHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Timezone"
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                    placeholder="America/Los_Angeles"
                  />
                  <Input
                    label="Brightness"
                    type="number"
                    min={1}
                    max={100}
                    value={matrix.brightness.toString()}
                    onChange={e => setMatrix({ ...matrix, brightness: Number(e.target.value) })}
                  />
                  <Input
                    label="Matrix Width"
                    type="number"
                    value={matrix.width.toString()}
                    onChange={e => setMatrix({ ...matrix, width: Number(e.target.value) })}
                  />
                  <Input
                    label="Matrix Height"
                    type="number"
                    value={matrix.height.toString()}
                    onChange={e => setMatrix({ ...matrix, height: Number(e.target.value) })}
                  />
                  <Input
                    label="Pregame Refresh (sec)"
                    type="number"
                    value={refreshCfg.pregame_sec.toString()}
                    onChange={e =>
                      setRefreshCfg({ ...refreshCfg, pregame_sec: Number(e.target.value) })
                    }
                  />
                  <Input
                    label="Ingame Refresh (sec)"
                    type="number"
                    value={refreshCfg.ingame_sec.toString()}
                    onChange={e =>
                      setRefreshCfg({ ...refreshCfg, ingame_sec: Number(e.target.value) })
                    }
                  />
                  <Input
                    label="Final Refresh (sec)"
                    type="number"
                    value={refreshCfg.final_sec.toString()}
                    onChange={e =>
                      setRefreshCfg({ ...refreshCfg, final_sec: Number(e.target.value) })
                    }
                  />
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Live Layout
                    </label>
                    <select
                      className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      value={renderCfg.live_layout}
                      onChange={e =>
                        setRenderCfg({ ...renderCfg, live_layout: e.target.value as any })
                      }
                    >
                      <option value="stacked">Stacked</option>
                      <option value="big-logos">Big Logos</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Logo Variant
                    </label>
                    <select
                      className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      value={renderCfg.logo_variant}
                      onChange={e =>
                        setRenderCfg({ ...renderCfg, logo_variant: e.target.value as any })
                      }
                    >
                      <option value="mini">Mini</option>
                      <option value="banner">Banner</option>
                    </select>
                  </div>
                </div>
              </Card>

              {/* Favorites Editor removed: sport favorites are managed in the Sport Favorites tab and DB */}

              {/* Save button */}
              <div className="flex justify-end gap-4">
                <Button
                  onClick={seedTeams}
                  disabled={loading}
                  variant="secondary"
                  size="sm"
                  title="Admin: Import team data from local assets into database"
                >
                  Import Team Data
                </Button>
                <Button onClick={saveConfig} disabled={loading} loading={loading}>
                  Save Configuration
                </Button>
              </div>
              {message && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{message}</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}
