import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

jest.mock('../../../../lib/canvas', () => ({
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
    handler = (await import('./preview-ts')).default
  })

  if (!handler) {
    throw new Error('Failed to load handler')
  }

  return handler
}

describe('GET /api/device/[id]/preview-ts', () => {
  describe('Method Validation', () => {
    it('rejects non-GET methods', async () => {
      const handler = await loadHandler()
      const req = createRequest({ method: 'POST' as any })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(405)
      expect(res.body).toEqual({ error: 'Method not allowed' })
    })
  })

  describe('Authentication & Authorization', () => {
    it('rejects requests with missing device ID', async () => {
      const handler = await loadHandler()
      const req = createRequest()
      req.query = {}
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Device ID is required' })
    })

    it('rejects requests with non-string device ID', async () => {
      const handler = await loadHandler()
      const req = createRequest({ query: { id: ['array', 'value'] } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Device ID is required' })
    })

    it('requires an authorization bearer token', async () => {
      const handler = await loadHandler()
      const req = createRequest({ headers: { authorization: '' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(401)
      expect(res.body).toEqual({ error: 'Missing or invalid Authorization header' })
      expect(createClientMock).not.toHaveBeenCalled()
    })

    it('rejects malformed authorization headers', async () => {
      const handler = await loadHandler()
      const req = createRequest({ headers: { authorization: 'InvalidFormat token' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(401)
      expect(res.body).toEqual({ error: 'Missing or invalid Authorization header' })
    })

    it('returns 401 for invalid auth tokens', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: new Error('bad token') })

      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(401)
      expect(res.body).toEqual({ error: 'Unauthorized' })
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

    it('returns 500 when device lookup fails', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'devices') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'DB_ERROR', message: 'Database error' },
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
      expect(res.body).toEqual({ error: 'Database error' })
    })
  })

  describe('Scene Validation', () => {
    it('rejects invalid scene types', async () => {
      const handler = await loadHandler()
      const req = createRequest({ query: { id: 'device-123', scene: 'invalid-scene' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid scene type' })
    })

    it('defaults to "live" scene when scene is not specified', async () => {
      const handler = await loadHandler()
      const req = createRequest({ query: { id: 'device-123' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.headers['Content-Type']).toBe('image/png')
      expect(res.body).toEqual(Buffer.from('fake-png-data'))
    })
  })

  describe('Device Configuration Loading', () => {
    it('returns 500 when device config cannot be loaded', async () => {
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

  describe('Success Paths - All Scenes', () => {
    it('generates idle scene preview', async () => {
      const handler = await loadHandler()
      const req = createRequest({ query: { id: 'device-123', scene: 'idle' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.headers['Content-Type']).toBe('image/png')
      expect(res.headers['Cache-Control']).toBe('no-store, must-revalidate')
      expect(res.body).toEqual(Buffer.from('fake-png-data'))
    })

    it('generates pregame scene preview', async () => {
      const handler = await loadHandler()
      const req = createRequest({ query: { id: 'device-123', scene: 'pregame' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.headers['Content-Type']).toBe('image/png')
      expect(res.body).toEqual(Buffer.from('fake-png-data'))
    })

    it('generates live scene preview', async () => {
      const handler = await loadHandler()
      const req = createRequest({ query: { id: 'device-123', scene: 'live' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.headers['Content-Type']).toBe('image/png')
      expect(res.body).toEqual(Buffer.from('fake-png-data'))
    })

    it('generates live_big scene preview', async () => {
      const handler = await loadHandler()
      const req = createRequest({ query: { id: 'device-123', scene: 'live_big' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.headers['Content-Type']).toBe('image/png')
      expect(res.body).toEqual(Buffer.from('fake-png-data'))
    })

    it('generates final scene preview', async () => {
      const handler = await loadHandler()
      const req = createRequest({ query: { id: 'device-123', scene: 'final' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.headers['Content-Type']).toBe('image/png')
      expect(res.body).toEqual(Buffer.from('fake-png-data'))
    })
  })

  describe('Error Handling', () => {
    it('handles preview generation errors gracefully', async () => {
      const { PreviewGenerator } = jest.requireMock('../../../../lib/canvas')
      PreviewGenerator.mockImplementationOnce(() => ({
        generatePreview: jest.fn().mockRejectedValue(new Error('Generation failed')),
      }))

      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to generate preview',
        details: 'Generation failed',
      })
    })
  })
})
