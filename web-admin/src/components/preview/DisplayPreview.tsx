import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Card, CardHeader, CardTitle, Button } from '../ui'
import { ClientPreviewGenerator } from '../../lib/client-preview'
import { DisplayConfig, DeviceConfiguration } from '../../lib/canvas/types'
import {
  createDemoPregameSnapshot,
  createDemoLiveSnapshot,
  createDemoFinalSnapshot,
} from '../../lib/canvas/demo-data'

type SceneType = 'idle' | 'pregame' | 'live' | 'live_big' | 'final'

interface DisplayPreviewProps {
  deviceId: string
}

export function DisplayPreview({ deviceId }: DisplayPreviewProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedScene, setSelectedScene] = useState<SceneType>('live')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [deviceConfig, setDeviceConfig] = useState<DeviceConfiguration | null>(null)

  useEffect(() => {
    async function loadDeviceConfig() {
      try {
        const { data: configData, error: configErr } = await supabase
          .from('device_config')
          .select('*')
          .eq('device_id', deviceId)
          .maybeSingle()

        if (configErr || !configData) {
          setError('Failed to load device configuration')
          return
        }

        const config: DeviceConfiguration = {
          device_id: deviceId,
          matrix_config: {
            width: configData.matrix_width || 64,
            height: configData.matrix_height || 32,
            brightness: configData.matrix_brightness || 75,
            pwm_bits: configData.matrix_pwm_bits || 11,
            hardware_mapping: configData.matrix_hardware_mapping || 'regular',
            chain_length: configData.matrix_chain_length || 1,
            parallel: configData.matrix_parallel || 1,
            gpio_slowdown: configData.matrix_gpio_slowdown || 1,
          },
          render_config: {
            logo_variant: configData.logo_variant || 'small',
            live_layout: configData.live_layout || 'stacked',
          },
        }

        setDeviceConfig(config)
      } catch (e: any) {
        setError(e.message)
      }
    }

    loadDeviceConfig()
  }, [deviceId])

  const generatePreview = useCallback(
    async (scene: SceneType) => {
      if (!deviceConfig || !canvasRef.current) {
        return
      }

      setLoading(true)
      setError(null)

      try {
        const displayConfig: DisplayConfig = {
          width: deviceConfig.matrix_config.width,
          height: deviceConfig.matrix_config.height,
          brightness: deviceConfig.matrix_config.brightness,
          logo_variant: deviceConfig.render_config.logo_variant,
          live_layout: deviceConfig.render_config.live_layout,
        }

        const generator = new ClientPreviewGenerator()

        let snapshot = null
        switch (scene) {
          case 'pregame':
            snapshot = createDemoPregameSnapshot()
            break
          case 'live':
          case 'live_big':
            snapshot = createDemoLiveSnapshot()
            if (scene === 'live_big') {
              displayConfig.live_layout = 'big-logos'
            }
            break
          case 'final':
            snapshot = createDemoFinalSnapshot()
            break
          case 'idle':
          default:
            snapshot = null
        }

        await generator.generatePreview(displayConfig, snapshot, canvasRef.current)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [deviceConfig]
  )

  useEffect(() => {
    if (deviceConfig) {
      generatePreview(selectedScene)
    }
  }, [selectedScene, deviceConfig, generatePreview])

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
            {!loading && deviceConfig && (
              <canvas
                ref={canvasRef}
                width={deviceConfig.matrix_config.width}
                height={deviceConfig.matrix_config.height}
                style={{
                  imageRendering: 'pixelated',
                  maxHeight: '400px',
                  width: 'auto',
                  height: 'auto',
                  maxWidth: '100%',
                }}
              />
            )}
            {!loading && !deviceConfig && !error && (
              <div className="text-gray-500 dark:text-gray-400">Loading configuration...</div>
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
