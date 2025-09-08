import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const FN_MINT = process.env.NEXT_PUBLIC_FUNCTION_MINT_DEVICE_TOKEN!

export default function RegisterDevice() {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [token, setToken] = useState('')

  const submit = async () => {
    setMessage('')
    if (!name.trim()) { setMessage('Enter a device name'); return }
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { setMessage('Sign in first'); return }
    const { data, error } = await supabase.from('devices').insert({ name, owner_user_id: userData.user.id }).select('id').single()
    if (error) { setMessage(error.message); return }
    setDeviceId(data!.id)
    // Mint token
    const { data: sess } = await supabase.auth.getSession()
    const jwt = sess.session?.access_token
    if (!jwt) { setMessage('No session'); return }
    const resp = await fetch(FN_MINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ device_id: data!.id, ttl_days: 30 })
    })
    const body = await resp.json()
    if (resp.ok && body.token) {
      setToken(body.token)
      setMessage('Device created and token minted.')
    } else {
      setMessage(`Mint failed: ${body.error || 'Unknown error'}`)
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>Register New Device</h1>
      <div style={{ display: 'flex', gap: 8 }}>
        <input placeholder="Device name" value={name} onChange={(e) => setName(e.target.value)} />
        <button onClick={submit}>Create + Mint Token</button>
      </div>
      {message && <p>{message}</p>}
      {deviceId && (
        <section>
          <h3>Device Details</h3>
          <p><strong>DEVICE_ID:</strong> {deviceId}</p>
          {token && (
            <>
              <p><strong>DEVICE_TOKEN:</strong></p>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f6f6f6', padding: 8 }}>{token}</pre>
              <h4>Pi Env Snippet</h4>
              <pre style={{ background: '#f6f6f6', padding: 8 }}>
{`# /etc/wnba-led-agent.env
SUPABASE_URL=${process.env.NEXT_PUBLIC_SUPABASE_URL}
SUPABASE_ANON_KEY=${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
DEVICE_ID=${deviceId}
DEVICE_TOKEN=${token}
CONFIG_PATH=/home/pi/wnba-led-scoreboard/config/favorites.json
SCOREBOARD_SERVICE=wnba-led.service`}
              </pre>
              <p>Then restart agent: <code>sudo systemctl restart wnba-led-agent.service</code></p>
            </>
          )}
        </section>
      )}
      <p><a href="/">Back</a></p>
    </main>
  )
}

