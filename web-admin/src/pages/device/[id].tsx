import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import { WNBATEAMS } from '@/lib/wnbaTeams'
import { makeValidator } from '@/lib/schema'
import { Layout } from '../../components/layout'
import { Card, CardHeader, CardTitle, Button, Input } from '../../components/ui'

const FN_CONFIG = process.env.NEXT_PUBLIC_FUNCTION_ON_CONFIG_WRITE!
const FN_ACTION = process.env.NEXT_PUBLIC_FUNCTION_ON_ACTION!
const FN_MINT = process.env.NEXT_PUBLIC_FUNCTION_MINT_DEVICE_TOKEN!

export default function DevicePage() {
  const router = useRouter()
  const { id } = router.query
  const [configText, setConfigText] = useState('')
  const [device, setDevice] = useState<{ id: string; name?: string; last_seen_ts?: string | null } | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [mintedToken, setMintedToken] = useState('')
  const [favorites, setFavorites] = useState<{ name: string; id?: string | null; abbr?: string | null }[]>([])
  const [newFav, setNewFav] = useState<{ name: string; abbr?: string }>({ name: '', abbr: '' })
  const [teamList, setTeamList] = useState<{ name: string; abbr?: string; id?: string }[]>(WNBATEAMS)
  const [schemaError, setSchemaError] = useState<string>('')
  const [schemaErrors, setSchemaErrors] = useState<any[]>([])
  // Inline editable settings (with reasonable defaults)
  const DEFAULTS = {
    timezone: 'America/Los_Angeles',
    matrix: { width: 64, height: 32, chain_length: 1, parallel: 1, gpio_slowdown: 2, hardware_mapping: 'adafruit-hat', brightness: 80, pwm_bits: 11 },
    refresh: { pregame_sec: 30, ingame_sec: 5, final_sec: 60 },
    render: { live_layout: 'stacked', logo_variant: 'mini' }
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
      const { data: dev } = await supabase.from('devices').select('id,name,last_seen_ts').eq('id', id).maybeSingle()
      if (dev) setDevice(dev)
      const { data: ev } = await supabase
        .from('events')
        .select('id,type,created_at,payload')
        .eq('device_id', id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (ev) setEvents(ev)
    })()
  }, [id])

  // realtime subscriptions
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`device-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'devices', filter: `id=eq.${id}` }, (payload) => {
        setDevice(payload.new as any)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `device_id=eq.${id}` }, (payload) => {
        setEvents((prev) => [{ id: (payload.new as any).id, type: (payload.new as any).type, created_at: (payload.new as any).created_at, payload: (payload.new as any).payload }, ...prev].slice(0, 50))
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  const applyConfig = async () => {
    if (!id) return
    try {
      const base = configText?.trim() ? JSON.parse(configText) : {}
      const content = { ...base, favorites, timezone, matrix, refresh: refreshCfg, render: renderCfg }
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

  const onlineBadge = useMemo(() => {
    const last = device?.last_seen_ts ? new Date(device.last_seen_ts).getTime() : 0
    const fresh = last && Date.now() - last < 90_000
    return <span style={{ marginLeft: 8, color: fresh ? '#0c0' : '#888' }}>{fresh ? 'online' : 'offline'}</span>
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
      { name: newFav.name.trim(), abbr: (newFav.abbr || found?.abbr || '').toUpperCase() || undefined, id: found?.id }
    ])
    setNewFav({ name: '', abbr: '' })
  }
  const enrichFavorites = () => {
    let updates = 0
    const next = favorites.map((f) => {
      if (f.id && f.abbr) return f
      const byName = teamList.find(t => t.name?.toLowerCase() === (f.name || '').toLowerCase())
      const byAbbr = f.abbr ? teamList.find(t => (t.abbr || '').toUpperCase() === (f.abbr || '').toUpperCase()) : undefined
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
    const merged = { ...DEFAULTS, ...base, favorites, timezone, matrix, refresh: refreshCfg, render: renderCfg }
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
        if (Array.isArray((data.content as any).favorites)) setFavorites((data.content as any).favorites)
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
    <main style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h2>Device {id}</h2>
      <div>
        <button onClick={() => sendAction('PING')} disabled={loading}>PING</button>{' '}
        <button onClick={() => sendAction('RESTART', { service: 'wnba-led.service' })} disabled={loading}>Restart App</button>{' '}
        <button onClick={() => sendAction('FETCH_ASSETS')} disabled={loading}>Fetch Assets</button>{' '}
        <button onClick={() => sendAction('SELF_TEST')} disabled={loading}>Self Test</button>
      </div>
      <h3>Inline Settings</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <label>Timezone<br/>
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </label>
        <label>Brightness<br/>
          <input type="number" min={1} max={100} value={matrix.brightness} onChange={(e) => setMatrix({ ...matrix, brightness: Number(e.target.value) })} />
        </label>
        <label>Matrix Width<br/>
          <input type="number" value={matrix.width} onChange={(e) => setMatrix({ ...matrix, width: Number(e.target.value) })} />
        </label>
        <label>Matrix Height<br/>
          <input type="number" value={matrix.height} onChange={(e) => setMatrix({ ...matrix, height: Number(e.target.value) })} />
        </label>
        <label>Pregame (sec)<br/>
          <input type="number" value={refreshCfg.pregame_sec} onChange={(e) => setRefreshCfg({ ...refreshCfg, pregame_sec: Number(e.target.value) })} />
        </label>
        <label>Ingame (sec)<br/>
          <input type="number" value={refreshCfg.ingame_sec} onChange={(e) => setRefreshCfg({ ...refreshCfg, ingame_sec: Number(e.target.value) })} />
        </label>
        <label>Final (sec)<br/>
          <input type="number" value={refreshCfg.final_sec} onChange={(e) => setRefreshCfg({ ...refreshCfg, final_sec: Number(e.target.value) })} />
        </label>
        <label>Live Layout<br/>
          <select value={renderCfg.live_layout} onChange={(e) => setRenderCfg({ ...renderCfg, live_layout: e.target.value as any })}>
            <option value="stacked">stacked</option>
            <option value="big-logos">big-logos</option>
          </select>
        </label>
        <label>Logo Variant<br/>
          <select value={renderCfg.logo_variant} onChange={(e) => setRenderCfg({ ...renderCfg, logo_variant: e.target.value as any })}>
            <option value="mini">mini</option>
            <option value="banner">banner</option>
          </select>
        </label>
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={mintDeviceToken} disabled={loading}>Mint Device Token</button>
        {mintedToken && (
          <div style={{ marginTop: 6 }}>
            <small>DEVICE_TOKEN:</small>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f6f6f6', padding: 8 }}>{mintedToken}</pre>
          </div>
        )}
      </div>
      {device && (
        <p><strong>Status:</strong> {onlineBadge} — last seen: {device.last_seen_ts ?? '—'}</p>
      )}
      <h3>Favorites Editor</h3>
      <div>
        <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
          {favorites.map((f, i) => (
            <li key={i} draggable onDragStart={(e) => onDragStart(e, i)} onDrop={(e) => onDrop(e, i)} onDragOver={onDragOver} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 4, borderBottom: '1px solid #eee' }}>
              <span style={{ cursor: 'grab' }}>⋮⋮</span>
              <select value={f.name} onChange={(e) => {
                const name = e.target.value
                const found = teamList.find(t => t.name === name)
                const next = favorites.slice();
                next[i] = { name, abbr: (next[i].abbr || found?.abbr || '').toUpperCase() || undefined, id: found?.id || next[i].id }
                setFavorites(next)
              }}>
                <option value="">Select team…</option>
                {teamList.map((t) => (
                  <option key={`${t.name}-${t.abbr}`} value={t.name}>{t.name}</option>
                ))}
              </select>
              <input placeholder="abbr" value={f.abbr || ''} onChange={(e) => {
                const next = favorites.slice(); next[i] = { ...next[i], abbr: e.target.value }; setFavorites(next)
              }} style={{ width: 64 }} />
              <input placeholder="id" value={f.id || ''} onChange={(e) => {
                const next = favorites.slice(); next[i] = { ...next[i], id: e.target.value || undefined }; setFavorites(next)
              }} style={{ width: 160 }} />
              <button onClick={() => moveUp(i)} aria-label="move up">↑</button>
              <button onClick={() => moveDown(i)} aria-label="move down">↓</button>
              <button onClick={() => removeFav(i)}>Remove</button>
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input list="teams" placeholder="Team name" value={newFav.name} onChange={(e) => setNewFav({ ...newFav, name: e.target.value })} />
          <datalist id="teams">
            {WNBATEAMS.map((t) => (
              <option key={t.abbr} value={t.name}>{t.abbr}</option>
            ))}
          </datalist>
          <input placeholder="abbr" value={newFav.abbr || ''} onChange={(e) => setNewFav({ ...newFav, abbr: e.target.value })} style={{ width: 64 }} />
          <button onClick={addFav}>Add</button>
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={syncToJson}>Sync Favorites into JSON</button>
          <button style={{ marginLeft: 8 }} onClick={enrichFavorites}>Auto-fill Team IDs (from assets)</button>
        </div>
      </div>
      <h3>Config JSON</h3>
      <div style={{ marginBottom: 8 }}>
        <button onClick={loadLatestConfig} disabled={loading}>Load Latest Config</button>
      </div>
      {schemaErrors.length > 0 && (
        <div style={{ color: 'red' }}>
          <p>Schema errors:</p>
          <ul>
            {schemaErrors.map((e, idx) => (
              <li key={idx}><code>{e.instancePath || e.schemaPath}</code> — {e.message}</li>
            ))}
          </ul>
        </div>
      )}
      <textarea value={configText} onChange={(e) => setConfigText(e.target.value)} rows={18} style={{ width: '100%' }} />
      <div>
        <button onClick={applyConfig} disabled={loading}>Apply Config</button>
      </div>
      {message && <p>{message}</p>}
      <h3>Recent Events</h3>
      <ul>
        {events.map((ev) => (
          <li key={ev.id}><code>{ev.type}</code> — {new Date(ev.created_at).toLocaleString()}</li>
        ))}
      </ul>
      <p><a href="/">Back</a></p>
    </main>
  )
}
