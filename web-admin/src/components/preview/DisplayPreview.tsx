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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedScene, setSelectedScene] = useState<SceneType>('live')

  const generatePreview = useCallback(
    async (scene: SceneType) => {
      setLoading(true)
      setError(null)

      try {
        const { data: sess } = await supabase.auth.getSession()
        const jwt = sess.session?.access_token

        if (!jwt) {
          setError('Not authenticated')
          setLoading(false)
          return
        }

        const resp = await fetch(`/api/device/${deviceId}/preview-ts?scene=${scene}`, {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        })

        if (!resp.ok) {
          const body = await resp.json()
          throw new Error(body.error || 'Failed to generate preview')
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
                  disabled={loading}
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
              disabled={loading}
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

          {error && (
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
