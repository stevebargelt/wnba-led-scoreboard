import { PreviewGenerator, SceneType } from '../../src/lib/canvas/preview-generator'
import { DeviceConfiguration } from '../../src/lib/canvas/types'
import * as fs from 'fs'
import * as path from 'path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const BASELINES_DIR = path.join(__dirname, '__baselines__')
const UPDATE_BASELINES = process.env.UPDATE_BASELINES === 'true'
const PIXEL_THRESHOLD = 0.1
const MAX_DIFF_PIXELS = 10

const defaultDeviceConfig: DeviceConfiguration = {
  device_id: 'test-device',
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

function loadPNG(buffer: Buffer): PNG {
  return PNG.sync.read(buffer)
}

function compareImages(
  actual: Buffer,
  baseline: Buffer,
  scene: SceneType
): { diffPixels: number; diffPercent: number; diffImage?: Buffer } {
  const actualPNG = loadPNG(actual)
  const baselinePNG = loadPNG(baseline)

  if (actualPNG.width !== baselinePNG.width || actualPNG.height !== baselinePNG.height) {
    throw new Error(
      `Image dimensions mismatch for ${scene}: ` +
        `actual ${actualPNG.width}x${actualPNG.height} vs baseline ${baselinePNG.width}x${baselinePNG.height}`
    )
  }

  const diff = new PNG({ width: actualPNG.width, height: actualPNG.height })
  const diffPixels = pixelmatch(
    actualPNG.data,
    baselinePNG.data,
    diff.data,
    actualPNG.width,
    actualPNG.height,
    { threshold: PIXEL_THRESHOLD }
  )

  const totalPixels = actualPNG.width * actualPNG.height
  const diffPercent = (diffPixels / totalPixels) * 100

  return {
    diffPixels,
    diffPercent,
    diffImage: PNG.sync.write(diff),
  }
}

function getBaselinePath(scene: SceneType): string {
  return path.join(BASELINES_DIR, `${scene}.png`)
}

async function testScene(scene: SceneType) {
  const generator = new PreviewGenerator(defaultDeviceConfig)
  const actualBuffer = await generator.generatePreview(scene)

  expect(actualBuffer).toBeInstanceOf(Buffer)
  expect(actualBuffer.length).toBeGreaterThan(0)

  const baselinePath = getBaselinePath(scene)

  if (UPDATE_BASELINES) {
    fs.mkdirSync(BASELINES_DIR, { recursive: true })
    fs.writeFileSync(baselinePath, actualBuffer)
    console.log(`✓ Updated baseline for ${scene} scene`)
    return
  }

  if (!fs.existsSync(baselinePath)) {
    throw new Error(
      `Baseline not found for ${scene} scene at ${baselinePath}. ` +
        `Run with UPDATE_BASELINES=true to create baselines.`
    )
  }

  const baselineBuffer = fs.readFileSync(baselinePath)
  const { diffPixels, diffPercent, diffImage } = compareImages(actualBuffer, baselineBuffer, scene)

  if (diffPixels > MAX_DIFF_PIXELS) {
    const diffPath = path.join(BASELINES_DIR, `${scene}.diff.png`)
    const actualPath = path.join(BASELINES_DIR, `${scene}.actual.png`)
    fs.writeFileSync(diffPath, diffImage!)
    fs.writeFileSync(actualPath, actualBuffer)

    throw new Error(
      `Visual regression detected for ${scene} scene:\n` +
        `  - Diff pixels: ${diffPixels} (${diffPercent.toFixed(2)}%)\n` +
        `  - Max allowed: ${MAX_DIFF_PIXELS} pixels\n` +
        `  - Diff image saved to: ${diffPath}\n` +
        `  - Actual image saved to: ${actualPath}\n` +
        `  - Baseline: ${baselinePath}`
    )
  }

  const actualPNG = loadPNG(actualBuffer)
  expect(actualPNG.width).toBe(64)
  expect(actualPNG.height).toBe(32)
}

describe('Preview Visual Regression Tests', () => {
  beforeAll(() => {
    if (!fs.existsSync(BASELINES_DIR)) {
      fs.mkdirSync(BASELINES_DIR, { recursive: true })
    }
  })

  it('idle scene matches baseline', async () => {
    await testScene('idle')
  })

  it('pregame scene matches baseline', async () => {
    await testScene('pregame')
  })

  it('live scene matches baseline', async () => {
    await testScene('live')
  })

  it('live_big scene matches baseline', async () => {
    await testScene('live_big')
  })

  it('final scene matches baseline', async () => {
    await testScene('final')
  })

  it('detects visual changes when rendering differs', async () => {
    const modifiedConfig: DeviceConfiguration = {
      ...defaultDeviceConfig,
      matrix_config: {
        ...defaultDeviceConfig.matrix_config,
        width: 128,
        height: 64,
      },
    }

    const generator = new PreviewGenerator(modifiedConfig)
    const actualBuffer = await generator.generatePreview('live')
    const actualPNG = loadPNG(actualBuffer)

    expect(actualPNG.width).toBe(128)
    expect(actualPNG.height).toBe(64)

    const baselinePath = getBaselinePath('live')
    if (fs.existsSync(baselinePath)) {
      const baselineBuffer = fs.readFileSync(baselinePath)
      const baselinePNG = loadPNG(baselineBuffer)

      expect(actualPNG.width).not.toBe(baselinePNG.width)
    }
  })
})
