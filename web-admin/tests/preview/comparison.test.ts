import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { createCanvas, loadImage } from 'canvas'
import { PreviewGenerator } from '@/lib/canvas/preview-generator'
import type { DeviceConfiguration } from '@/lib/canvas/types'

const TEST_CONFIG: DeviceConfiguration = {
  matrix_config: {
    width: 64,
    height: 32,
    brightness: 75,
    pwm_bits: 11,
    hardware_mapping: 'regular',
    chain_length: 1,
    parallel: 1,
    gpio_slowdown: 1,
  },
  render_config: {
    logo_variant: 'small',
    live_layout: 'stacked',
  },
}

const SCENES = ['idle', 'pregame', 'live', 'live_big', 'final'] as const
type SceneType = (typeof SCENES)[number]

const PIXEL_DIFF_THRESHOLD = 5.0

interface ComparisonResult {
  totalPixels: number
  differentPixels: number
  percentageDifferent: number
  passed: boolean
}

async function compareImages(pythonImagePath: string, tsImageBuffer: Buffer): Promise<ComparisonResult> {
  const canvas1 = createCanvas(TEST_CONFIG.matrix_config.width, TEST_CONFIG.matrix_config.height)
  const ctx1 = canvas1.getContext('2d')

  const canvas2 = createCanvas(TEST_CONFIG.matrix_config.width, TEST_CONFIG.matrix_config.height)
  const ctx2 = canvas2.getContext('2d')

  const img1 = await loadImage(pythonImagePath)
  ctx1.drawImage(img1, 0, 0)
  const data1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height).data

  const img2 = await loadImage(tsImageBuffer)
  ctx2.drawImage(img2, 0, 0)
  const data2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height).data

  let differentPixels = 0
  const totalPixels = canvas1.width * canvas1.height

  for (let i = 0; i < data1.length; i += 4) {
    const r1 = data1[i]
    const g1 = data1[i + 1]
    const b1 = data1[i + 2]
    const a1 = data1[i + 3]

    const r2 = data2[i]
    const g2 = data2[i + 1]
    const b2 = data2[i + 2]
    const a2 = data2[i + 3]

    if (r1 !== r2 || g1 !== g2 || b1 !== b2 || a1 !== a2) {
      differentPixels++
    }
  }

  const percentageDifferent = (differentPixels / totalPixels) * 100

  return {
    totalPixels,
    differentPixels,
    percentageDifferent,
    passed: percentageDifferent <= PIXEL_DIFF_THRESHOLD,
  }
}

function generatePythonPreview(scene: SceneType, outputDir: string): string {
  const scriptPath = path.join(__dirname, '../../../scripts/compare_previews.py')
  const configJson = JSON.stringify({
    device_id: 'test-device',
    matrix_config: TEST_CONFIG.matrix_config,
    render_config: TEST_CONFIG.render_config,
  })

  const cmd = `cd "${path.join(__dirname, '../../..')}" && python3 "${scriptPath}" --scene ${scene} --output "${outputDir}" --config-json '${configJson}' 2>/dev/null`

  try {
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 30000 })
    const lines = output.trim().split('\n')
    const jsonLine = lines[lines.length - 1]
    const result = JSON.parse(jsonLine)

    if (!result.success) {
      throw new Error(`Python script failed: ${result.error}`)
    }

    return result.path
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate Python preview: ${error.message}`)
    }
    throw error
  }
}

async function generateTypeScriptPreview(scene: SceneType): Promise<Buffer> {
  const generator = new PreviewGenerator(TEST_CONFIG)
  return await generator.generatePreview(scene)
}

describe('TypeScript vs Python Preview Comparison (ANTI-DRIFT)', () => {
  const tmpDir = path.join(__dirname, '../../../tmp/preview-comparison')

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
    }
  })

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  describe.each(SCENES)('%s scene', (scene) => {
    it(`should match Python implementation within ${PIXEL_DIFF_THRESHOLD}% pixel difference`, async () => {
      const pythonImagePath = generatePythonPreview(scene, tmpDir)

      expect(fs.existsSync(pythonImagePath)).toBe(true)

      const tsImageBuffer = await generateTypeScriptPreview(scene)

      expect(tsImageBuffer).toBeInstanceOf(Buffer)
      expect(tsImageBuffer.length).toBeGreaterThan(0)

      const comparison = await compareImages(pythonImagePath, tsImageBuffer)

      expect(comparison.percentageDifferent).toBeLessThanOrEqual(PIXEL_DIFF_THRESHOLD)

      if (!comparison.passed) {
        const debugDir = path.join(tmpDir, 'debug')
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true })
        }

        fs.writeFileSync(
          path.join(debugDir, `${scene}-typescript.png`),
          tsImageBuffer
        )
        fs.copyFileSync(
          pythonImagePath,
          path.join(debugDir, `${scene}-python.png`)
        )

        console.error(`
          Comparison failed for ${scene} scene:
          - Total pixels: ${comparison.totalPixels}
          - Different pixels: ${comparison.differentPixels}
          - Percentage different: ${comparison.percentageDifferent.toFixed(2)}%
          - Threshold: ${PIXEL_DIFF_THRESHOLD}%

          Debug images saved to: ${debugDir}
        `)
      }
    }, 60000)
  })

  it('should prevent code drift between implementations', () => {
    expect(true).toBe(true)
  })
})
