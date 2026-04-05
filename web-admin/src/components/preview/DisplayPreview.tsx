import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Card, CardHeader, CardTitle, Button } from '../ui'

type SceneType = 'idle' | 'pregame' | 'live' | 'live_big' | 'final'

interface DisplayPreviewProps {
  deviceId: string
}

export function DisplayPreview({ deviceId }: DisplayPreviewProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isServerless, setIsServerless] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedScene, setSelectedScene] = useState<SceneType>('live')

  const generatePreview = useCallback(
    async (scene: SceneType) => {
      setLoading(true)
      setError(null)
      setIsServerless(false)

      try {
        const { data: sess } = await supabase.auth.getSession()
        const jwt = sess.session?.access_token

        if (!jwt) {
          setError('Not authenticated')
          setLoading(false)
          return
        }

        const resp = await fetch(`/api/device/${deviceId}/preview?scene=${scene}`, {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        })

        if (!resp.ok) {
          const body = await resp.json()
          // Check if this is a serverless environment error
          if (body.reason === 'serverless') {
            setIsServerless(true)
            setError(body.details || body.error)
          } else {
            throw new Error(body.error || 'Failed to generate preview')
          }
          setLoading(false)
          return
        }

        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)

        if (previewUrl) {
          URL.revokeObjectURL(previewUrl)
        }

        setPreviewUrl(url)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [deviceId, previewUrl]
  )

  useEffect(() => {
    generatePreview(selectedScene)
  }, [selectedScene, generatePreview])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleSceneChange = (scene: SceneType) => {
    setSelectedScene(scene)
  }

  const handleRefresh = () => {
    generatePreview(selectedScene)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Display Preview</CardTitle>
        </CardHeader>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {(['idle', 'pregame', 'live', 'live_big', 'final'] as SceneType[]).map(scene => (
                <Button
                  key={scene}
                  size="sm"
                  variant={selectedScene === scene ? 'primary' : 'secondary'}
                  onClick={() => handleSceneChange(scene)}
                  disabled={loading || isServerless}
                >
                  {scene === 'live_big'
                    ? 'Big Logos'
                    : scene.charAt(0).toUpperCase() + scene.slice(1)}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              onClick={handleRefresh}
              disabled={loading || isServerless}
              loading={loading}
              leftIcon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              }
            >
              Refresh
            </Button>
          </div>

          {error && isServerless && (
            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-4 rounded-md">
              <div className="flex items-start gap-3">
                <svg
                  className="h-5 w-5 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold mb-2">
                    Preview Not Available (Serverless Deployment)
                  </p>
                  <p className="text-sm mb-3">{error}</p>
                  <p className="text-sm">
                    <strong>Alternative options:</strong>
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1 ml-2 mt-1">
                    <li>Deploy to Railway, Render, or any VM-based hosting</li>
                    <li>Run the web admin locally with Python 3.8+ installed</li>
                    <li>Use the scoreboard itself to preview changes</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {error && !isServerless && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-4 rounded-md">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="flex justify-center items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-8 min-h-[200px]">
            {loading && (
              <div className="text-gray-500 dark:text-gray-400">Generating preview...</div>
            )}
            {!loading && previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="LED Matrix Preview"
                className="max-w-full h-auto"
                style={{
                  imageRendering: 'pixelated',
                  maxHeight: '400px',
                }}
              />
            )}
            {!loading && !previewUrl && !error && (
              <div className="text-gray-500 dark:text-gray-400">No preview available</div>
            )}
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-2">
              <strong>Preview Info:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Shows how your scoreboard will look on the LED matrix</li>
              <li>Uses demo game data for preview scenes</li>
              <li>Preview updates may take a few seconds to generate</li>
              <li>Layout changes (stacked/big-logos) require refreshing the preview</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
