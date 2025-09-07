import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

const FN_CONFIG = process.env.NEXT_PUBLIC_FUNCTION_ON_CONFIG_WRITE!
const FN_ACTION = process.env.NEXT_PUBLIC_FUNCTION_ON_ACTION!

export default function DevicePage() {
  const router = useRouter()
  const { id } = router.query
  const [configText, setConfigText] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

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
    })()
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

  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h2>Device {id}</h2>
      <div>
        <button onClick={() => sendAction('PING')} disabled={loading}>PING</button>{' '}
        <button onClick={() => sendAction('RESTART', { service: 'wnba-led.service' })} disabled={loading}>Restart App</button>{' '}
        <button onClick={() => sendAction('FETCH_ASSETS')} disabled={loading}>Fetch Assets</button>{' '}
        <button onClick={() => sendAction('SELF_TEST')} disabled={loading}>Self Test</button>
      </div>
      <h3>Config JSON</h3>
      <textarea value={configText} onChange={(e) => setConfigText(e.target.value)} rows={18} style={{ width: '100%' }} />
      <div>
        <button onClick={applyConfig} disabled={loading}>Apply Config</button>
      </div>
      {message && <p>{message}</p>}
      <p><a href="/">Back</a></p>
    </main>
  )
}

