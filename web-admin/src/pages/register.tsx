import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { Layout } from '../components/layout'
import { Card, CardHeader, CardTitle, Button, Input } from '../components/ui'
import { ArrowLeftIcon, DocumentDuplicateIcon, CpuChipIcon } from '@heroicons/react/24/outline'

const FN_MINT = process.env.NEXT_PUBLIC_FUNCTION_MINT_DEVICE_TOKEN!

export default function RegisterDevice() {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [token, setToken] = useState('')
  const [copied, setCopied] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    setMessage('')
    if (!name.trim()) {
      setMessage('Enter a device name')
      setLoading(false)
      return
    }

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setMessage('Sign in first')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('devices')
        .insert({ name, owner_user_id: userData.user.id })
        .select('id')
        .single()

      if (error) {
        setMessage(error.message)
        setLoading(false)
        return
      }

      setDeviceId(data!.id)

      // Mint token
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      if (!jwt) {
        setMessage('No session')
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
        body: JSON.stringify({ device_id: data!.id, ttl_days: 30 }),
      })

      const body = await resp.json()
      if (resp.ok && body.token) {
        setToken(body.token)
        setMessage('Device created and token minted successfully!')
      } else {
        setMessage(`Mint failed: ${body.error || 'Unknown error'}`)
      }
    } catch (error) {
      setMessage('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const envSnippet =
    deviceId && token
      ? `# /etc/wnba-led-agent.env
SUPABASE_URL=${process.env.NEXT_PUBLIC_SUPABASE_URL}
SUPABASE_ANON_KEY=${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
DEVICE_ID=${deviceId}
DEVICE_TOKEN=${token}
CONFIG_PATH=/home/pi/wnba-led-scoreboard/config/favorites.json
SCOREBOARD_SERVICE=wnba-led.service`
      : ''

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(`${label} copied!`)
      setTimeout(() => setCopied(''), 2000)
    } catch (e) {
      setCopied(`Failed to copy ${label}`)
      setTimeout(() => setCopied(''), 2000)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link href="/">
            <Button variant="ghost" leftIcon={<ArrowLeftIcon className="h-4 w-4" />}>
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Register New Device
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Create a new LED scoreboard device and generate authentication tokens
            </p>
          </div>
        </div>

        {/* Device Registration Form */}
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center">
              <CpuChipIcon className="h-5 w-5 mr-2" />
              Device Information
            </CardTitle>
          </CardHeader>

          <div className="space-y-4">
            <Input
              label="Device Name"
              placeholder="e.g., Living Room Display, Kitchen Scoreboard"
              value={name}
              onChange={e => setName(e.target.value)}
              helperText="Choose a descriptive name to identify this device"
            />

            <Button onClick={submit} loading={loading} disabled={!name.trim()}>
              Create Device & Generate Token
            </Button>

            {message && (
              <div
                className={`p-3 rounded-md text-sm ${
                  message.includes('successfully')
                    ? 'bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : 'bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300'
                }`}
              >
                {message}
              </div>
            )}
          </div>
        </Card>

        {/* Device Details */}
        {deviceId && (
          <Card className="max-w-4xl">
            <CardHeader>
              <CardTitle>Device Configuration</CardTitle>
            </CardHeader>

            <div className="space-y-6">
              {/* Device ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Device ID
                </label>
                <div className="flex">
                  <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-sm rounded-l-md border border-gray-300 dark:border-gray-600">
                    {deviceId}
                  </code>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => copyText(deviceId, 'Device ID')}
                    className="rounded-l-none border-l-0"
                    leftIcon={<DocumentDuplicateIcon className="h-4 w-4" />}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              {/* Device Token */}
              {token && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Device Token
                    </label>
                    <div className="flex">
                      <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-sm rounded-l-md border border-gray-300 dark:border-gray-600 break-all">
                        {token}
                      </code>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => copyText(token, 'Device Token')}
                        className="rounded-l-none border-l-0"
                        leftIcon={<DocumentDuplicateIcon className="h-4 w-4" />}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  {/* Environment Configuration */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Raspberry Pi Environment File
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Save this configuration as{' '}
                      <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                        /etc/wnba-led-agent.env
                      </code>{' '}
                      on your Raspberry Pi
                    </p>
                    <div className="relative">
                      <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md text-sm overflow-x-auto border border-gray-300 dark:border-gray-600">
                        {envSnippet}
                      </pre>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => copyText(envSnippet, 'Environment configuration')}
                        className="absolute top-2 right-2"
                        leftIcon={<DocumentDuplicateIcon className="h-4 w-4" />}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  {/* Installation Instructions */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
                    <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
                      Next Steps
                    </h4>
                    <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                      <li>Copy the environment configuration to your Raspberry Pi</li>
                      <li>
                        Save it as{' '}
                        <code className="px-1 py-0.5 bg-blue-200 dark:bg-blue-800 rounded">
                          /etc/wnba-led-agent.env
                        </code>
                      </li>
                      <li>
                        Restart the agent service:{' '}
                        <code className="px-1 py-0.5 bg-blue-200 dark:bg-blue-800 rounded">
                          sudo systemctl restart wnba-led-agent.service
                        </code>
                      </li>
                      <li>
                        Your device should appear online in the dashboard within a few seconds
                      </li>
                    </ol>
                  </div>

                  {copied && (
                    <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                      ✓ {copied}
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        )}
      </div>
    </Layout>
  )
}
