import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardHeader, CardTitle, Button } from '../ui'
import { PreviewGenerator, loadPreviewFonts, GameState } from '../../lib/preview'
import {
  createDemoPregameSnapshot,
  createDemoLiveSnapshot,
  createDemoFinalSnapshot,
  createNhlDemoPregameSnapshot,
  createNhlDemoLiveSnapshot,
  createNhlDemoFinalSnapshot,
} from '../../lib/preview'
import type { DisplayConfig } from '../../lib/preview'

type SceneType = 'idle' | 'pregame' | 'live' | 'live_big' | 'final'

interface DisplayPreviewProps {
  deviceId: string
  renderConfig?: { live_layout: string; logo_variant: string }
  matrixConfig?: { width: number; height: number; brightness: number }
}

type SportType = 'wnba' | 'nhl'

export function DisplayPreview({ deviceId: _deviceId, renderConfig, matrixConfig }: DisplayPreviewProps) {
  const [selectedScene, setSelectedScene] = useState<SceneType>('live')
  const [selectedSport, setSelectedSport] = useState<SportType>('wnba')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fontsReady, setFontsReady] = useState(false)
  const [fontLoading, setFontLoading] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const width = matrixConfig?.width ?? 64
  const height = matrixConfig?.height ?? 32

  useEffect(() => {
    loadPreviewFonts()
      .then(() => {
        setFontsReady(true)
        setFontLoading(false)
      })
      .catch(() => {
        setFontsReady(true)
        setFontLoading(false)
      })
  }, [])

  const generatePreview = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    setError(null)
    setGenerating(true)

    try {
      const config: DisplayConfig = {
        width: matrixConfig?.width ?? 64,
        height: matrixConfig?.height ?? 32,
        brightness: matrixConfig?.brightness ?? 75,
        logo_variant: renderConfig?.logo_variant ?? 'mini',
        live_layout: selectedScene === 'live_big' ? 'big-logos' : (renderConfig?.live_layout ?? 'stacked'),
      }

      let snapshot = null
      if (selectedSport === 'nhl') {
        switch (selectedScene) {
          case 'pregame':
            snapshot = createNhlDemoPregameSnapshot()
            break
          case 'live':
          case 'live_big':
            snapshot = createNhlDemoLiveSnapshot()
            break
          case 'final':
            snapshot = createNhlDemoFinalSnapshot()
            break
          // idle: snapshot remains null
        }
      } else {
        switch (selectedScene) {
          case 'pregame':
            snapshot = createDemoPregameSnapshot()
            break
          case 'live':
          case 'live_big':
            snapshot = createDemoLiveSnapshot()
            break
          case 'final':
            snapshot = createDemoFinalSnapshot()
            break
          // idle: snapshot remains null
        }
      }

      const generator = new PreviewGenerator()
      await generator.generatePreview(config, snapshot, canvas)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }, [selectedScene, selectedSport, renderConfig, matrixConfig])

  useEffect(() => {
    if (!fontsReady) return
    generatePreview()
  }, [fontsReady, generatePreview])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Display Preview</CardTitle>
        </CardHeader>
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            {(['wnba', 'nhl'] as SportType[]).map(sport => (
              <Button
                key={sport}
                size="sm"
                variant={selectedSport === sport ? 'primary' : 'secondary'}
                onClick={() => setSelectedSport(sport)}
                disabled={generating}
              >
                {sport.toUpperCase()}
              </Button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {(['idle', 'pregame', 'live', 'live_big', 'final'] as SceneType[]).map(scene => (
                <Button
                  key={scene}
                  size="sm"
                  variant={selectedScene === scene ? 'primary' : 'secondary'}
                  onClick={() => setSelectedScene(scene)}
                  disabled={generating}
                >
                  {scene === 'live_big'
                    ? 'Big Logos'
                    : scene.charAt(0).toUpperCase() + scene.slice(1)}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              onClick={generatePreview}
              disabled={generating}
              loading={generating}
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
            {fontLoading ? (
              <div className="text-gray-500 dark:text-gray-400">Loading fonts...</div>
            ) : (
              <canvas
                ref={canvasRef}
                width={width}
                height={height}
                style={{
                  width: width * 8,
                  height: height * 8,
                  imageRendering: 'pixelated',
                }}
              />
            )}
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-2">
              <strong>Preview Info:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Shows how your scoreboard will look on the LED matrix</li>
              <li>Uses demo game data for preview scenes</li>
              <li>Rendered client-side — no server request needed</li>
              <li>Layout changes (stacked/big-logos) apply immediately</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
