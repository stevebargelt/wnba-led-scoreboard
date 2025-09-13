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

const FN_CONFIG = process.env.NEXT_PUBLIC_FUNCTION_ON_CONFIG_WRITE!
const FN_ACTION = process.env.NEXT_PUBLIC_FUNCTION_ON_ACTION!
const FN_MINT = process.env.NEXT_PUBLIC_FUNCTION_MINT_DEVICE_TOKEN!

export default function DevicePage() {
  const router = useRouter()
  const { id } = router.query
  const [configText, setConfigText] = useState('')
  const [device, setDevice] = useState<{
    id: string
    name?: string
    last_seen_ts?: string | null
  } | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [mintedToken, setMintedToken] = useState('')
  const [favorites, setFavorites] = useState<
    { name: string; id?: string | null; abbr?: string | null }[]
  >([])
  const [newFav, setNewFav] = useState<{ name: string; abbr?: string; id?: string }>({
    name: '',
    abbr: '',
  })
  const [teamList, setTeamList] = useState<{ name: string; abbr?: string; id?: string }[]>([])
  const [schemaError, setSchemaError] = useState<string>('')
  const [schemaErrors, setSchemaErrors] = useState<any[]>([])
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
      // Load teams from server (assets/teams.json) if available
      try {
        const r = await fetch('/api/teams')
        const j = await r.json()
        if (Array.isArray(j.teams) && j.teams.length) setTeamList(j.teams)
      } catch {}
      // load latest config for convenience
      const { data } = await supabase
        .from('configs')
        .select('content')
        .eq('device_id', id)
        .order('version_ts', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data?.content) setConfigText(JSON.stringify(data.content, null, 2))
      if (data?.content?.favorites) setFavorites(data.content.favorites as any)
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
      const { data: ev } = await supabase
        .from('events')
        .select('id,type,created_at,payload')
        .eq('device_id', id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (ev) setEvents(ev)

      // Load device sport configuration for Multi-Sport Favorites editor
      try {
        const { data: sess } = await supabase.auth.getSession()
        const jwt = sess.session?.access_token
        // Fetch available sports/teams to resolve identifiers to canonical names/abbrs
        let sportDirectory: Record<string, any[]> = {}
        try {
          const sRes = await fetch('/api/sports', { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} })
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
            const byAbbr = list.find(t => String(t.abbreviation).toUpperCase() === idStr.toUpperCase())
            if (byAbbr) return { id: String(byAbbr.id), name: byAbbr.name, abbr: byAbbr.abbreviation }
            const byName = list.find(t => String(t.name).toLowerCase() === idStr.toLowerCase())
            if (byName) return { id: String(byName.id), name: byName.name, abbr: byName.abbreviation }
            return { id: idStr, name: idStr, abbr: idStr }
          }

          // Map DB rows to editor format with enrichment using directory if available
          const wnba = sportConfigs.find(c => String(c.sport) === 'wnba') || {
            sport: 'wnba', enabled: true, favorite_teams: [], priority: 1,
          }
          const nhl = sportConfigs.find(c => String(c.sport) === 'nhl') || {
            sport: 'nhl', enabled: false, favorite_teams: [], priority: 2,
          }
          const mapFavs = (arr: any[], sport: string) =>
            (Array.isArray(arr) ? arr : []).map(v => resolveFav(sport, v))
          setMultiSportConfig({
            sports: [
              { sport: 'wnba', enabled: !!wnba.enabled, favorites: mapFavs(wnba.favorite_teams, 'wnba') },
              { sport: 'nhl', enabled: !!nhl.enabled, favorites: mapFavs(nhl.favorite_teams, 'nhl') },
            ],
          })
        }
      } catch (e) {
        // Non-fatal for the page
        console.warn('Failed to load device sport configs for favorites editor', e)
      }
    })()
  }, [id])

  // realtime subscriptions
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`device-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'devices', filter: `id=eq.${id}` },
        payload => {
          setDevice(payload.new as any)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events', filter: `device_id=eq.${id}` },
        payload => {
          setEvents(prev =>
            [
              {
                id: (payload.new as any).id,
                type: (payload.new as any).type,
                created_at: (payload.new as any).created_at,
                payload: (payload.new as any).payload,
              },
              ...prev,
            ].slice(0, 50)
          )
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  const applyConfig = async () => {
    if (!id) return
    try {
      const base = configText?.trim() ? JSON.parse(configText) : {}
      const content = {
        ...base,
        favorites,
        timezone,
        matrix,
        refresh: refreshCfg,
        render: renderCfg,
      }
      const validate = makeValidator()
      const ok = validate(content)
      if (!ok) {
        const err = validate.errors?.[0]
        const path = err?.instancePath || err?.schemaPath || ''
        const msg = err?.message || 'invalid config'
        setSchemaError(`${path} ${msg}`)
        setSchemaErrors(validate.errors || [])
        setMessage('Validation failed')
        return
      }
      setSchemaError('')
      setSchemaErrors([])
      setLoading(true)
      // Use the signed-in user's access token to authorize on-config-write (ownership enforced server-side)
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      if (!jwt) {
        setMessage('Not signed in')
        setLoading(false)
        return
      }
      const resp = await fetch(FN_CONFIG, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ device_id: id, content }),
      })
      setMessage(resp.ok ? 'Applied config' : `Failed: ${await resp.text()}`)
    } catch (e: any) {
      setMessage(`Invalid JSON: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const sendAction = async (type: string, payload?: any) => {
    if (!id) return
    setLoading(true)
    const resp = await fetch(FN_ACTION, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      },
      body: JSON.stringify({ device_id: id, type, payload: payload ?? {} }),
    })
    setMessage(resp.ok ? `${type} sent` : `Failed: ${await resp.text()}`)
    setLoading(false)
  }

  const mintDeviceToken = async () => {
    if (!id) return
    setLoading(true)
    setMessage('')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      if (!jwt) {
        setMessage('Not signed in')
        setLoading(false)
        return
      }
      const resp = await fetch(FN_MINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ device_id: id, ttl_days: 30 }),
      })
      const body = await resp.json()
      if (resp.ok && body.token) {
        setMintedToken(body.token as string)
        setMessage('Token minted. Copy it to the Pi as DEVICE_TOKEN and restart the agent.')
      } else {
        setMessage(`Mint failed: ${body.error || 'Unknown error'}`)
      }
    } catch (e: any) {
      setMessage(`Mint failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const isDeviceOnline = useMemo(() => {
    if (!device?.last_seen_ts) return false
    const last = new Date(device.last_seen_ts).getTime()
    return Date.now() - last < 90_000
  }, [device?.last_seen_ts])

  // Drag and drop handlers for favorites
  const onDragStart = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    e.dataTransfer.setData('text/plain', String(index))
  }
  const onDrop = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    const from = Number(e.dataTransfer.getData('text/plain'))
    if (Number.isNaN(from)) return
    e.preventDefault()
    const next = favorites.slice()
    const [moved] = next.splice(from, 1)
    next.splice(index, 0, moved)
    setFavorites(next)
  }
  const onDragOver = (e: React.DragEvent<HTMLLIElement>) => e.preventDefault()
  const removeFav = (i: number) => setFavorites(favorites.filter((_, idx) => idx !== i))
  const addFav = () => {
    if (!newFav.name.trim()) return
    const found = teamList.find(t => t.name.toLowerCase() === newFav.name.trim().toLowerCase())
    setFavorites([
      ...favorites,
      {
        name: newFav.name.trim(),
        abbr: (newFav.abbr || found?.abbr || '').toUpperCase() || undefined,
        id: found?.id,
      },
    ])
    setNewFav({ name: '', abbr: '' })
  }
  const enrichFavorites = () => {
    let updates = 0
    const next = favorites.map(f => {
      if (f.id && f.abbr) return f
      const byName = teamList.find(t => t.name?.toLowerCase() === (f.name || '').toLowerCase())
      const byAbbr = f.abbr
        ? teamList.find(t => (t.abbr || '').toUpperCase() === (f.abbr || '').toUpperCase())
        : undefined
      const match = byName || byAbbr
      if (!match) return f
      updates += 1
      return {
        ...f,
        id: match.id || f.id,
        abbr: (f.abbr || match.abbr || '').toUpperCase() || undefined,
        name: f.name || match.name,
      }
    })
    setFavorites(next)
    setMessage(updates ? `Auto-filled ${updates} favorite(s)` : 'No matches found to auto-fill')
  }
  const moveUp = (i: number) => {
    if (i <= 0) return
    const next = favorites.slice()
    const [m] = next.splice(i, 1)
    next.splice(i - 1, 0, m)
    setFavorites(next)
  }
  const moveDown = (i: number) => {
    if (i >= favorites.length - 1) return
    const next = favorites.slice()
    const [m] = next.splice(i, 1)
    next.splice(i + 1, 0, m)
    setFavorites(next)
  }
  const syncToJson = () => {
    let base: any = {}
    try {
      if (configText && configText.trim().length > 0) {
        base = JSON.parse(configText)
      }
    } catch (e: any) {
      // Proceed with empty base but inform user
      setMessage('Parsed with defaults (existing JSON was invalid).')
    }
    const merged = {
      ...DEFAULTS,
      ...base,
      favorites,
      timezone,
      matrix,
      refresh: refreshCfg,
      render: renderCfg,
    }
    setConfigText(JSON.stringify(merged, null, 2))
    if (!schemaError) setMessage(`Favorites synced into JSON (${favorites.length})`)
  }

  const loadLatestConfig = async () => {
    if (!id) return
    setLoading(true)
    setMessage('')
    try {
      const { data } = await supabase
        .from('configs')
        .select('content')
        .eq('device_id', id)
        .order('version_ts', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data?.content) {
        setConfigText(JSON.stringify(data.content, null, 2))
        if (Array.isArray((data.content as any).favorites))
          setFavorites((data.content as any).favorites)
        setMessage('Loaded latest saved config')
      } else {
        setMessage('No prior config found; using editor values')
      }
    } catch (e: any) {
      setMessage('Failed to load latest config: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

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
        <Tabs defaultValue="actions" className="w-full">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="sports">Multi-Sport</TabsTrigger>
            <TabsTrigger value="favorites">Sport Favorites</TabsTrigger>
            <TabsTrigger value="actions">Device Actions</TabsTrigger>
            <TabsTrigger value="token">Device Token</TabsTrigger>
            <TabsTrigger value="config">Legacy Config</TabsTrigger>
            <TabsTrigger value="events">Recent Events</TabsTrigger>
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

          <TabsContent value="actions">
            <Card>
              <CardHeader>
                <CardTitle>Device Actions</CardTitle>
              </CardHeader>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => sendAction('PING')}
                  disabled={loading}
                  variant="secondary"
                  size="sm"
                >
                  PING
                </Button>
                <Button
                  onClick={() => sendAction('RESTART', { service: 'wnba-led.service' })}
                  disabled={loading}
                  variant="warning"
                  size="sm"
                >
                  Restart App
                </Button>
                <Button
                  onClick={() => sendAction('FETCH_ASSETS')}
                  disabled={loading}
                  variant="secondary"
                  size="sm"
                >
                  Fetch Assets
                </Button>
                <Button
                  onClick={() => sendAction('SELF_TEST')}
                  disabled={loading}
                  variant="secondary"
                  size="sm"
                >
                  Self Test
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="token">
            <Card>
              <CardHeader>
                <CardTitle>Device Token Management</CardTitle>
              </CardHeader>
              <div className="space-y-4">
                <Button onClick={mintDeviceToken} disabled={loading} loading={loading}>
                  Mint Device Token
                </Button>
                {mintedToken && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      DEVICE_TOKEN:
                    </label>
                    <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md text-sm break-all whitespace-pre-wrap border border-gray-300 dark:border-gray-600">
                      {mintedToken}
                    </pre>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

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

              {/* Favorites Editor */}
              <Card>
                <CardHeader>
                  <CardTitle>Favorites Editor</CardTitle>
                </CardHeader>
                <div className="space-y-4">
                  <ul className="space-y-2">
                    {favorites.map((f, i) => (
                      <li
                        key={i}
                        draggable
                        onDragStart={e => onDragStart(e, i)}
                        onDrop={e => onDrop(e, i)}
                        onDragOver={onDragOver}
                        className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700"
                      >
                        <span className="cursor-grab text-gray-400">⋮⋮</span>
                        <select
                          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
                          value={f.name}
                          onChange={e => {
                            const name = e.target.value
                            const found = teamList.find(t => t.name === name)
                            const next = favorites.slice()
                            next[i] = {
                              name,
                              abbr: (next[i].abbr || found?.abbr || '').toUpperCase() || undefined,
                              id: found?.id || next[i].id,
                            }
                            setFavorites(next)
                          }}
                        >
                          <option value="">Select team…</option>
                          {teamList.map(t => (
                            <option key={`${t.name}-${t.abbr}`} value={t.name}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <Input
                          placeholder="abbr"
                          value={f.abbr || ''}
                          onChange={e => {
                            const next = favorites.slice()
                            next[i] = { ...next[i], abbr: e.target.value }
                            setFavorites(next)
                          }}
                          className="w-20"
                        />
                        <Input
                          placeholder="id"
                          value={f.id || ''}
                          onChange={e => {
                            const next = favorites.slice()
                            next[i] = { ...next[i], id: e.target.value || undefined }
                            setFavorites(next)
                          }}
                          className="w-40"
                        />
                        <Button
                          onClick={() => moveUp(i)}
                          variant="ghost"
                          size="sm"
                          aria-label="move up"
                        >
                          ↑
                        </Button>
                        <Button
                          onClick={() => moveDown(i)}
                          variant="ghost"
                          size="sm"
                          aria-label="move down"
                        >
                          ↓
                        </Button>
                        <Button onClick={() => removeFav(i)} variant="ghost" size="sm">
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-8">
                      <MultiSportTeamSelector
                        selectedTeam={newFav.name ? newFav : null}
                        onTeamSelect={team =>
                          setNewFav({
                            name: team.name,
                            abbr: team.abbr,
                            id: team.id,
                          })
                        }
                        placeholder="Search teams across all sports..."
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        placeholder="abbr"
                        value={newFav.abbr || ''}
                        onChange={e => setNewFav({ ...newFav, abbr: e.target.value })}
                        className="w-full text-center"
                      />
                    </div>
                    <div className="col-span-2">
                      <Button onClick={addFav} size="sm" className="w-full">
                        Add
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={syncToJson} variant="secondary" size="sm">
                      Sync Favorites into JSON
                    </Button>
                    <Button onClick={enrichFavorites} variant="secondary" size="sm">
                      Auto-fill Team IDs (from assets)
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Configuration JSON */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Configuration JSON</CardTitle>
                    <Button
                      onClick={loadLatestConfig}
                      disabled={loading}
                      variant="secondary"
                      size="sm"
                    >
                      Load Latest Config
                    </Button>
                  </div>
                </CardHeader>
                <div className="space-y-4">
                  {schemaErrors.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                      <p className="text-red-800 dark:text-red-200 font-medium mb-2">
                        Schema errors:
                      </p>
                      <ul className="text-red-700 dark:text-red-300 text-sm space-y-1">
                        {schemaErrors.map((e, idx) => (
                          <li key={idx}>
                            <code className="bg-red-100 dark:bg-red-800 px-1 rounded text-xs">
                              {e.instancePath || e.schemaPath}
                            </code>{' '}
                            — {e.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <textarea
                    className="w-full h-96 p-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                    value={configText}
                    onChange={e => setConfigText(e.target.value)}
                    placeholder="Configuration JSON..."
                  />
                  <div className="flex justify-between items-center">
                    <Button onClick={applyConfig} disabled={loading} loading={loading}>
                      Apply Config
                    </Button>
                    {message && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle>Recent Events</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                {events.length > 0 ? (
                  events.map(ev => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                    >
                      <code className="text-sm bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                        {ev.type}
                      </code>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(ev.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No recent events</p>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}
