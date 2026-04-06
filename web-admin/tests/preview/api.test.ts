import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

jest.mock('../../src/lib/canvas', () => ({
  PreviewGenerator: jest.fn().mockImplementation(() => ({
    generatePreview: jest.fn().mockResolvedValue(Buffer.from('fake-png-data')),
  })),
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>

const getUserMock = jest.fn()
const selectMock = jest.fn()
const eqMock = jest.fn()
const maybeSingleMock = jest.fn()
const fromMock = jest.fn()

const ORIGINAL_ENV = process.env

const mockDeviceConfig = {
  device_id: 'device-123',
  matrix_width: 64,
  matrix_height: 32,
  matrix_brightness: 75,
  matrix_pwm_bits: 11,
  matrix_hardware_mapping: 'regular',
  matrix_chain_length: 1,
  matrix_parallel: 1,
  matrix_gpio_slowdown: 1,
  logo_variant: 'small',
  live_layout: 'stacked',
}

beforeEach(() => {
  jest.clearAllMocks()

  getUserMock.mockReset()
  selectMock.mockReset()
  eqMock.mockReset()
  maybeSingleMock.mockReset()
  fromMock.mockReset()

  getUserMock.mockResolvedValue({
    data: { user: { id: 'user-123', email: 'test@example.com' } },
    error: null,
  })

  maybeSingleMock.mockResolvedValue({
    data: mockDeviceConfig,
    error: null,
  })

  eqMock.mockReturnValue({ maybeSingle: maybeSingleMock })
  selectMock.mockReturnValue({ eq: eqMock })
  fromMock.mockImplementation((table: string) => {
    if (table === 'devices') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 'device-123', user_id: 'user-123' },
              error: null,
            }),
          }),
        }),
      }
    }
    if (table === 'device_config') {
      return { select: selectMock }
    }
    return { select: selectMock }
  })

  createClientMock.mockImplementation(
    () =>
      ({
        auth: { getUser: getUserMock },
        from: fromMock,
      }) as any
  )
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

function createRequest(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method: (overrides.method || 'GET') as any,
    headers: {
      authorization: 'Bearer user-token',
      ...(overrides.headers || {}),
    },
    query: {
      id: 'device-123',
      scene: 'live',
      ...((overrides as any).query || {}),
    },
    body: overrides.body ?? {},
    cookies: (overrides as any).cookies || {},
  } as NextApiRequest
}

function createResponse(): NextApiResponse & {
  statusCode: number
  headers: Record<string, any>
  body: any
} {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, any>,
    body: undefined,
    setHeader(name: string, value: any) {
      this.headers[name] = value
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: any) {
      this.body = payload
      return this
    },
    send(payload: any) {
      this.body = payload
      return this
    },
  }
  return res
}

async function loadHandler(envOverrides: Record<string, string | undefined> = {}) {
  const nextEnv: NodeJS.ProcessEnv = {
    ...ORIGINAL_ENV,
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.test',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  }

  for (const [key, value] of Object.entries(envOverrides)) {
    if (typeof value === 'undefined') {
      delete nextEnv[key]
    } else {
      nextEnv[key] = value
    }
  }

  process.env = nextEnv

  let handler: ((req: NextApiRequest, res: NextApiResponse) => Promise<void>) | undefined

  await jest.isolateModulesAsync(async () => {
    handler = (await import('../../src/pages/api/device/[id]/preview-ts')).default
  })

  if (!handler) {
    throw new Error('Failed to load handler')
  }

  return handler
}

describe('E2E API Tests: GET /api/device/[id]/preview-ts', () => {
  describe('All 5 Scenes - Complete Coverage', () => {
    const scenes = [
      { name: 'idle', description: 'Idle scene' },
      { name: 'pregame', description: 'Pregame scene' },
      { name: 'live', description: 'Live scene' },
      { name: 'live_big', description: 'Live big logos scene' },
      { name: 'final', description: 'Final scene' },
    ]

    scenes.forEach(scene => {
      it(`generates ${scene.description} successfully`, async () => {
        const handler = await loadHandler()
        const req = createRequest({ query: { id: 'device-123', scene: scene.name } })
        const res = createResponse()

        const startTime = Date.now()
        await handler(req, res)
        const duration = Date.now() - startTime

        expect(res.statusCode).toBe(200)
        expect(res.headers['Content-Type']).toBe('image/png')
        expect(res.headers['Cache-Control']).toBe('no-store, must-revalidate')
        expect(res.body).toEqual(Buffer.from('fake-png-data'))
        expect(duration).toBeLessThan(2000)
      })
    })

    it('tests all scenes in sequence', async () => {
      const handler = await loadHandler()

      for (const scene of scenes) {
        const req = createRequest({ query: { id: 'device-123', scene: scene.name } })
        const res = createResponse()

        const startTime = Date.now()
        await handler(req, res)
        const duration = Date.now() - startTime

        expect(res.statusCode).toBe(200)
        expect(duration).toBeLessThan(2000)
      }
    })
  })

  describe('Supabase Integration', () => {
    it('authenticates user via Supabase auth', async () => {
      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(createClientMock).toHaveBeenCalledWith('https://supabase.test', 'anon-key', {
        global: { headers: { Authorization: 'Bearer user-token' } },
        auth: { autoRefreshToken: false, persistSession: false },
      })
      expect(getUserMock).toHaveBeenCalledWith('user-token')
    })

    it('queries devices table with RLS', async () => {
      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(fromMock).toHaveBeenCalledWith('devices')
      expect(res.statusCode).toBe(200)
    })

    it('loads device_config from Supabase', async () => {
      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(fromMock).toHaveBeenCalledWith('device_config')
      expect(selectMock).toHaveBeenCalledWith('*')
      expect(eqMock).toHaveBeenCalledWith('device_id', 'device-123')
    })

    it('handles Supabase authentication failure', async () => {
      getUserMock.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('Invalid token'),
      })

      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(401)
      expect(res.body).toEqual({ error: 'Unauthorized' })
    })

    it('handles Supabase device lookup failure', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'devices') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'DB_ERROR', message: 'Database connection failed' },
                }),
              }),
            }),
          }
        }
        return { select: selectMock }
      })

      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({ error: 'Database connection failed' })
    })

    it('handles Supabase config loading failure', async () => {
      maybeSingleMock.mockResolvedValueOnce({
        data: null,
        error: { message: 'Config not found' },
      })

      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({ error: 'Failed to load device configuration' })
    })
  })

  describe('Error Paths', () => {
    it('rejects non-GET methods', async () => {
      const handler = await loadHandler()
      const req = createRequest({ method: 'POST' as any })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(405)
      expect(res.body).toEqual({ error: 'Method not allowed' })
    })

    it('requires device ID parameter', async () => {
      const handler = await loadHandler()
      const req = createRequest()
      req.query = {}
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Device ID is required' })
    })

    it('rejects array device ID', async () => {
      const handler = await loadHandler()
      const req = createRequest({ query: { id: ['array', 'value'] } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Device ID is required' })
    })

    it('requires authorization header', async () => {
      const handler = await loadHandler()
      const req = createRequest({ headers: { authorization: '' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(401)
      expect(res.body).toEqual({ error: 'Missing or invalid Authorization header' })
    })

    it('validates authorization header format', async () => {
      const handler = await loadHandler()
      const req = createRequest({ headers: { authorization: 'InvalidFormat token' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(401)
      expect(res.body).toEqual({ error: 'Missing or invalid Authorization header' })
    })

    it('validates scene type', async () => {
      const handler = await loadHandler()
      const req = createRequest({ query: { id: 'device-123', scene: 'invalid-scene' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid scene type' })
    })

    it('returns 403 when device does not exist', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'devices') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }
        }
        return { select: selectMock }
      })

      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(403)
      expect(res.body).toEqual({ error: 'Forbidden' })
    })

    it('handles preview generation errors', async () => {
      const { PreviewGenerator } = jest.requireMock('../../src/lib/canvas')
      PreviewGenerator.mockImplementationOnce(() => ({
        generatePreview: jest.fn().mockRejectedValue(new Error('Canvas rendering failed')),
      }))

      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to generate preview',
        details: 'Canvas rendering failed',
      })
    })
  })

  describe('Response Time Requirements', () => {
    it('completes within 2 seconds for single request', async () => {
      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      const startTime = Date.now()
      await handler(req, res)
      const duration = Date.now() - startTime

      expect(res.statusCode).toBe(200)
      expect(duration).toBeLessThan(2000)
    })

    it('maintains performance under sequential requests', async () => {
      const handler = await loadHandler()
      const durations: number[] = []

      for (let i = 0; i < 5; i++) {
        const req = createRequest()
        const res = createResponse()

        const startTime = Date.now()
        await handler(req, res)
        const duration = Date.now() - startTime

        durations.push(duration)
        expect(res.statusCode).toBe(200)
      }

      durations.forEach(duration => {
        expect(duration).toBeLessThan(2000)
      })

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
      expect(avgDuration).toBeLessThan(1000)
    })

    it('times out appropriately for each scene type', async () => {
      const handler = await loadHandler()
      const scenes = ['idle', 'pregame', 'live', 'live_big', 'final']

      for (const scene of scenes) {
        const req = createRequest({ query: { id: 'device-123', scene } })
        const res = createResponse()

        const startTime = Date.now()
        await handler(req, res)
        const duration = Date.now() - startTime

        expect(res.statusCode).toBe(200)
        expect(duration).toBeLessThan(2000)
      }
    })
  })

  describe('Configuration Integration', () => {
    it('applies matrix configuration from Supabase', async () => {
      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      const { PreviewGenerator } = jest.requireMock('../../src/lib/canvas')
      expect(PreviewGenerator).toHaveBeenCalledWith({
        device_id: 'device-123',
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
      })
    })

    it('applies default configuration values when missing', async () => {
      maybeSingleMock.mockResolvedValueOnce({
        data: { device_id: 'device-123' },
        error: null,
      })

      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      const { PreviewGenerator } = jest.requireMock('../../src/lib/canvas')
      expect(PreviewGenerator).toHaveBeenCalledWith({
        device_id: 'device-123',
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
      })
    })
  })
})
