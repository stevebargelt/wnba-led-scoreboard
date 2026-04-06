import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { exec } from 'child_process'
import * as fs from 'fs/promises'

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

jest.mock('child_process', () => ({
  exec: jest.fn(),
}))

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const execMock = exec as jest.MockedFunction<typeof exec>
const readFileMock = fs.readFile as jest.MockedFunction<typeof fs.readFile>

const getUserMock = jest.fn()
const selectMock = jest.fn()
const eqMock = jest.fn()
const maybeSingleMock = jest.fn()
const fromMock = jest.fn()

const ORIGINAL_ENV = process.env

beforeEach(() => {
  jest.clearAllMocks()

  getUserMock.mockReset()
  selectMock.mockReset()
  eqMock.mockReset()
  maybeSingleMock.mockReset()
  fromMock.mockReset()
  execMock.mockReset()
  readFileMock.mockReset()

  getUserMock.mockResolvedValue({
    data: { user: { id: 'user-123', email: 'test@example.com' } },
    error: null,
  })

  maybeSingleMock.mockResolvedValue({
    data: { id: 'device-123', user_id: 'user-123' },
    error: null,
  })

  eqMock.mockReturnValue({ maybeSingle: maybeSingleMock })
  selectMock.mockReturnValue({ eq: eqMock })
  fromMock.mockReturnValue({ select: selectMock })

  createClientMock.mockImplementation(
    () =>
      ({
        auth: { getUser: getUserMock },
        from: fromMock,
      }) as any
  )

  execMock.mockImplementation((cmd: string, options: any, callback: any) => {
    const result = JSON.stringify({
      success: true,
      path: '/fake/path/preview.png',
      scene: 'live',
    })
    callback(null, { stdout: result, stderr: '' })
    return {} as any
  })

  readFileMock.mockResolvedValue(Buffer.from('fake-png-data'))
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
    handler = (await import('./preview')).default
  })

  if (!handler) {
    throw new Error('Failed to load handler')
  }

  return handler
}

describe('GET /api/device/[id]/preview', () => {
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
      maybeSingleMock.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(403)
      expect(res.body).toEqual({ error: 'Forbidden' })
      expect(execMock).not.toHaveBeenCalled()
    })

    it('returns 500 when device lookup fails', async () => {
      maybeSingleMock.mockResolvedValueOnce({
        data: null,
        error: { code: 'DB_ERROR', message: 'Database error' },
      })

      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({ error: 'Database error' })
    })
  })

  describe('Method Validation', () => {
    it('rejects non-GET methods', async () => {
      const handler = await loadHandler()
      const req = createRequest({ method: 'POST' as any })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(405)
      expect(res.body).toEqual({ error: 'Method not allowed' })
      expect(execMock).not.toHaveBeenCalled()
    })
  })

  describe('Serverless Environment Detection', () => {
    it('returns 503 on Vercel deployment', async () => {
      const handler = await loadHandler({ VERCEL: '1' })
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(503)
      expect(res.body).toMatchObject({
        error: 'Preview generation not available on serverless deployment',
        reason: 'serverless',
      })
      expect(execMock).not.toHaveBeenCalled()
    })

    it('returns 503 on Netlify deployment', async () => {
      const handler = await loadHandler({ NETLIFY: 'true' })
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(503)
      expect(res.body).toMatchObject({
        error: 'Preview generation not available on serverless deployment',
        reason: 'serverless',
      })
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
      expect(execMock).not.toHaveBeenCalled()
    })

    it('defaults to "live" scene when scene is not specified', async () => {
      const handler = await loadHandler()
      const req = createRequest({ query: { id: 'device-123' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(execMock).toHaveBeenCalled()
      const execCall = execMock.mock.calls[0][0] as string
      expect(execCall).toContain('--scene live')
    })
  })

  describe('Success Paths - All Scenes', () => {
    it('generates idle scene preview', async () => {
      execMock.mockImplementationOnce((cmd: string, options: any, callback: any) => {
        const result = JSON.stringify({
          success: true,
          path: '/fake/path/idle.png',
          scene: 'idle',
        })
        callback(null, { stdout: result, stderr: '' })
        return {} as any
      })

      const handler = await loadHandler()
      const req = createRequest({ query: { id: 'device-123', scene: 'idle' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.headers['Content-Type']).toBe('image/png')
      expect(res.headers['Cache-Control']).toBe('no-store, must-revalidate')
      expect(res.body).toEqual(Buffer.from('fake-png-data'))
      expect(execMock).toHaveBeenCalled()
      const execCall = execMock.mock.calls[0][0] as string
      expect(execCall).toContain('--scene idle')
      expect(readFileMock).toHaveBeenCalledWith('/fake/path/idle.png')
    })

    it('generates pregame scene preview', async () => {
      execMock.mockImplementationOnce((cmd: string, options: any, callback: any) => {
        const result = JSON.stringify({
          success: true,
          path: '/fake/path/pregame.png',
          scene: 'pregame',
        })
        callback(null, { stdout: result, stderr: '' })
        return {} as any
      })

      const handler = await loadHandler()
      const req = createRequest({ query: { id: 'device-123', scene: 'pregame' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.headers['Content-Type']).toBe('image/png')
      expect(res.body).toEqual(Buffer.from('fake-png-data'))
      expect(execMock).toHaveBeenCalled()
      const execCall = execMock.mock.calls[0][0] as string
      expect(execCall).toContain('--scene pregame')
    })

    it('generates live scene preview', async () => {
      execMock.mockImplementationOnce((cmd: string, options: any, callback: any) => {
        const result = JSON.stringify({
          success: true,
          path: '/fake/path/live.png',
          scene: 'live',
        })
        callback(null, { stdout: result, stderr: '' })
        return {} as any
      })

      const handler = await loadHandler()
      const req = createRequest({ query: { id: 'device-123', scene: 'live' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.headers['Content-Type']).toBe('image/png')
      expect(res.body).toEqual(Buffer.from('fake-png-data'))
      expect(execMock).toHaveBeenCalled()
      const execCall = execMock.mock.calls[0][0] as string
      expect(execCall).toContain('--scene live')
    })

    it('generates live_big scene preview', async () => {
      execMock.mockImplementationOnce((cmd: string, options: any, callback: any) => {
        const result = JSON.stringify({
          success: true,
          path: '/fake/path/live_big.png',
          scene: 'live_big',
        })
        callback(null, { stdout: result, stderr: '' })
        return {} as any
      })

      const handler = await loadHandler()
      const req = createRequest({ query: { id: 'device-123', scene: 'live_big' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.headers['Content-Type']).toBe('image/png')
      expect(res.body).toEqual(Buffer.from('fake-png-data'))
      expect(execMock).toHaveBeenCalled()
      const execCall = execMock.mock.calls[0][0] as string
      expect(execCall).toContain('--scene live_big')
    })

    it('generates final scene preview', async () => {
      execMock.mockImplementationOnce((cmd: string, options: any, callback: any) => {
        const result = JSON.stringify({
          success: true,
          path: '/fake/path/final.png',
          scene: 'final',
        })
        callback(null, { stdout: result, stderr: '' })
        return {} as any
      })

      const handler = await loadHandler()
      const req = createRequest({ query: { id: 'device-123', scene: 'final' } })
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.headers['Content-Type']).toBe('image/png')
      expect(res.body).toEqual(Buffer.from('fake-png-data'))
      expect(execMock).toHaveBeenCalled()
      const execCall = execMock.mock.calls[0][0] as string
      expect(execCall).toContain('--scene final')
    })
  })

  describe('Python Script Execution', () => {
    it('passes correct environment variables to Python script', async () => {
      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(execMock).toHaveBeenCalled()
      const options = execMock.mock.calls[0][1] as any
      expect(options.env).toHaveProperty('PYTHONPATH')
    })

    it('handles Python script stderr output', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      execMock.mockImplementationOnce((cmd: string, options: any, callback: any) => {
        const result = JSON.stringify({
          success: true,
          path: '/fake/path/preview.png',
          scene: 'live',
        })
        callback(null, { stdout: result, stderr: 'Warning: something happened' })
        return {} as any
      })

      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Preview generation stderr:',
        'Warning: something happened'
      )

      consoleErrorSpy.mockRestore()
    })

    it('returns 500 when Python script reports failure', async () => {
      execMock.mockImplementationOnce((cmd: string, options: any, callback: any) => {
        const result = JSON.stringify({
          success: false,
          error: 'Device configuration not found',
        })
        callback(null, { stdout: result, stderr: '' })
        return {} as any
      })

      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({ error: 'Device configuration not found' })
      expect(readFileMock).not.toHaveBeenCalled()
    })

    it('handles Python script execution errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      execMock.mockImplementationOnce((cmd: string, options: any, callback: any) => {
        callback(new Error('Python not found'))
        return {} as any
      })

      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(500)
      expect(res.body).toMatchObject({
        error: 'Failed to generate preview',
        details: 'Python not found',
      })

      consoleErrorSpy.mockRestore()
    })

    it('handles JSON parse errors from Python output', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      execMock.mockImplementationOnce((cmd: string, options: any, callback: any) => {
        callback(null, { stdout: 'invalid json', stderr: '' })
        return {} as any
      })

      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(500)
      expect(res.body).toHaveProperty('error', 'Failed to generate preview')
      expect(res.body).toHaveProperty('details')

      consoleErrorSpy.mockRestore()
    })
  })

  describe('File System Operations', () => {
    it('handles file read errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      readFileMock.mockRejectedValueOnce(new Error('File not found'))

      const handler = await loadHandler()
      const req = createRequest()
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(500)
      expect(res.body).toMatchObject({
        error: 'Failed to generate preview',
        details: 'File not found',
      })

      consoleErrorSpy.mockRestore()
    })
  })
})
