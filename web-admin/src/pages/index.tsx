import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type Device = { id: string; name: string; last_seen_ts: string | null }

function onlineBadge(last_seen_ts: string | null): JSX.Element {
  if (!last_seen_ts) return <span style={{ marginLeft: 8, color: '#888' }}>offline</span>
  const last = new Date(last_seen_ts).getTime()
  const now = Date.now()
  const fresh = now - last < 90_000 // 90s freshness window
  return (
    <span style={{ marginLeft: 8, color: fresh ? '#0c0' : '#888' }}>
      {fresh ? 'online' : 'offline'}
    </span>
  )
}

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

  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>WNBA LED Web Admin</h1>
      <p><a href="/register">Register a new device</a></p>
      {!session ? (
        <section>
          <h3>Sign in (email + password)</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column', maxWidth: 320 }}>
            <input placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={signIn}>Sign in</button>
              <button onClick={signUp}>Sign up</button>
            </div>
            {message && <small>{message}</small>}
          </div>
        </section>
      ) : (
        <section>
          <p>Signed in</p>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
          <h3>Your devices</h3>
          {loading && <p>Loading…</p>}
          <div style={{ marginBottom: 12 }}>
            <input placeholder="New device name" value={newDeviceName} onChange={(e) => setNewDeviceName(e.target.value)} />{' '}
            <button onClick={createDevice}>Create Device</button>
          </div>
          <ul>
            {devices.map((d) => (
              <li key={d.id}>
                <a href={`/device/${d.id}`}>{d.name}</a>
                {onlineBadge(d.last_seen_ts)} — last seen: {d.last_seen_ts ?? '—'}
              </li>
            ))}
          </ul>
          {message && <p>{message}</p>}
        </section>
      )}
    </main>
  )
}
