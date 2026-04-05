import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import { Layout } from '../components/layout'
import { Card, CardHeader, CardTitle, Button, Input, StatusBadge } from '../components/ui'
import { PlusIcon, MagnifyingGlassIcon, TrashIcon } from '@heroicons/react/24/outline'

type Device = { id: string; name: string; last_seen_ts: string | null }

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [newDeviceName, setNewDeviceName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadDevices()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredDevices(devices)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredDevices(devices.filter(device => device.name.toLowerCase().includes(query)))
    }
  }, [searchQuery, devices])

  const loadDevices = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('devices')
      .select('id, name, last_seen_ts')
      .order('name')
    if (!error && data) {
      setDevices(data as Device[])
      setFilteredDevices(data as Device[])
    }
    setLoading(false)
  }

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
      .insert({ name: newDeviceName, user_id: userData.user.id })
      .select('id,name')
      .single()
    if (error) {
      setMessage(error.message)
    } else {
      const newDevice = { id: data!.id, name: data!.name, last_seen_ts: null }
      setDevices(prev => [...prev, newDevice])
      setNewDeviceName('')
      setMessage('Device created successfully. Click Configure to set it up.')
    }
  }

  const deleteDevice = async (deviceId: string, deviceName: string) => {
    if (!confirm(`Delete device "${deviceName}"? This cannot be undone.`)) {
      return
    }
    const { error } = await supabase.from('devices').delete().eq('id', deviceId)
    if (error) {
      setMessage(`Error deleting device: ${error.message}`)
    } else {
      setDevices(prev => prev.filter(d => d.id !== deviceId))
      setMessage(`Device "${deviceName}" deleted successfully`)
    }
  }

  const isDeviceOnline = (last_seen_ts: string | null): boolean => {
    if (!last_seen_ts) return false
    const last = new Date(last_seen_ts).getTime()
    const now = Date.now()
    return now - last < 90_000
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Devices</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage your LED scoreboard devices</p>
          </div>
          <Link href="/register">
            <Button leftIcon={<PlusIcon className="h-4 w-4" />}>Register New Device</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Device</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div className="flex space-x-3">
              <Input
                placeholder="Device name (e.g., Living Room Display)"
                value={newDeviceName}
                onChange={e => setNewDeviceName(e.target.value)}
                className="flex-1"
              />
              <Button onClick={createDevice} loading={loading}>
                Create
              </Button>
            </div>
            {message && <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Your Devices ({filteredDevices.length})</CardTitle>
              <div className="w-64">
                <Input
                  placeholder="Search devices..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
                />
              </div>
            </div>
          </CardHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              <span className="ml-2 text-gray-600 dark:text-gray-400">Loading devices...</span>
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery
                  ? 'No devices match your search.'
                  : 'No devices found. Create your first device above.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDevices.map(device => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div>
                      <Link href={`/device/${device.id}`}>
                        <span className="font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer">
                          {device.name}
                        </span>
                      </Link>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Last seen:{' '}
                        {device.last_seen_ts
                          ? new Date(device.last_seen_ts).toLocaleString()
                          : 'Never'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <StatusBadge online={isDeviceOnline(device.last_seen_ts)} />
                    <Link href={`/device/${device.id}`}>
                      <Button variant="secondary" size="sm">
                        Configure
                      </Button>
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => deleteDevice(device.id, device.name)}
                      leftIcon={<TrashIcon className="h-4 w-4" />}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  )
}
