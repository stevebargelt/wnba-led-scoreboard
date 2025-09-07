import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Device = { id: string; name: string; last_seen_ts: string | null }

export default function Home() {
  const [email, setEmail] = useState('')
  const [session, setSession] = useState<any>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(false)

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

  const sendMagicLink = async () => {
    if (!email) return
    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    alert('Check your email for the sign-in link')
  }

  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>WNBA LED Web Admin</h1>
      {!session ? (
        <section>
          <h3>Sign in</h3>
          <input placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button onClick={sendMagicLink}>Send magic link</button>
        </section>
      ) : (
        <section>
          <p>Signed in</p>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
          <h3>Your devices</h3>
          {loading && <p>Loading…</p>}
          <ul>
            {devices.map((d) => (
              <li key={d.id}>
                <a href={`/device/${d.id}`}>{d.name}</a> — last seen: {d.last_seen_ts ?? '—'}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

