import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'

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

  useEffect(() => {
    if (!id) return
    ;(async () => {
      // load latest config for convenience
      const { data } = await supabase
        .from('configs')
        .select('content')
        .eq('device_id', id)
        .order('version_ts', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data?.content) setConfigText(JSON.stringify(data.content, null, 2))
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
      const content = JSON.parse(configText)
      setLoading(true)
      const resp = await fetch(FN_CONFIG, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
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

  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h2>Device {id}</h2>
      <div>
        <button onClick={() => sendAction('PING')} disabled={loading}>PING</button>{' '}
        <button onClick={() => sendAction('RESTART', { service: 'wnba-led.service' })} disabled={loading}>Restart App</button>{' '}
        <button onClick={() => sendAction('FETCH_ASSETS')} disabled={loading}>Fetch Assets</button>{' '}
        <button onClick={() => sendAction('SELF_TEST')} disabled={loading}>Self Test</button>
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
      <h3>Config JSON</h3>
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
