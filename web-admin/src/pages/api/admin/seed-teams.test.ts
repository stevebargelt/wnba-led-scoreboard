import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs/promises'

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const readdirMock = fs.readdir as jest.MockedFunction<typeof fs.readdir>
const readFileMock = fs.readFile as jest.MockedFunction<typeof fs.readFile>

const getUserMock = jest.fn()
const upsertMock = jest.fn()
const fromMock = jest.fn()

const ORIGINAL_ENV = process.env

beforeEach(() => {
  jest.clearAllMocks()

  getUserMock.mockReset()
  upsertMock.mockReset()
  fromMock.mockReset()

  getUserMock.mockResolvedValue({
    data: { user: { email: 'admin@example.com' } },
    error: null,
  })

  upsertMock.mockResolvedValue({ error: null })
  fromMock.mockImplementation(() => ({ upsert: upsertMock }))

  createClientMock.mockImplementation(
    () =>
      ({
        auth: { getUser: getUserMock },
        from: fromMock,
      }) as any
  )

  readdirMock.mockReset()
  readFileMock.mockReset()

  readdirMock.mockResolvedValue(['wnba_teams.json'] as any)
  readFileMock.mockResolvedValue(
    JSON.stringify([
      { id: '18', name: 'Seattle Storm', abbr: 'SEA' },
      { id: '22', name: 'Las Vegas Aces', abbr: 'LV' },
    ])
  )
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

function createRequest(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method: (overrides.method || 'POST') as any,
    headers: {
      authorization: 'Bearer user-token',
      ...(overrides.headers || {}),
    },
    body: overrides.body ?? {},
    query: (overrides as any).query || {},
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
  }
  return res
}

async function loadHandler(envOverrides: Record<string, string | undefined> = {}) {
  const nextEnv: NodeJS.ProcessEnv = {
    ...ORIGINAL_ENV,
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.test',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    ADMIN_EMAILS: 'admin@example.com',
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
    handler = (await import('./seed-teams')).default
  })

  if (!handler) {
    throw new Error('Failed to load handler')
  }

  return handler
}

describe('POST /api/admin/seed-teams', () => {
  it('rejects non-POST methods', async () => {
    const handler = await loadHandler()
    const req = createRequest({ method: 'GET' as any })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
    expect(res.headers['Allow']).toEqual(['POST'])
    expect(res.body).toEqual({ error: 'Method not allowed' })
  })

  it('returns 500 when service key is missing', async () => {
    const handler = await loadHandler({ SUPABASE_SERVICE_ROLE_KEY: undefined })
    const req = createRequest()
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' })
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('requires an authorization bearer token', async () => {
    const handler = await loadHandler()
    const req = createRequest({ headers: { authorization: '' } })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ error: 'Missing Authorization token' })
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('returns 401 for invalid auth tokens', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: new Error('bad token') })

    const handler = await loadHandler()
    const req = createRequest()
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ error: 'Invalid auth token' })
  })

  it('rejects callers not in ADMIN_EMAILS', async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { email: 'intruder@example.com' } },
      error: null,
    })

    const handler = await loadHandler({ ADMIN_EMAILS: 'admin@example.com' })
    const req = createRequest()
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({ error: 'Not authorized' })
    expect(readdirMock).not.toHaveBeenCalled()
  })

  it('fails when no team definition files are found', async () => {
    readdirMock.mockResolvedValueOnce([])

    const handler = await loadHandler()
    const req = createRequest()
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'No *_teams.json files found in assets/' })
    expect(readFileMock).not.toHaveBeenCalled()
  })

  it('upserts teams from asset files', async () => {
    const handler = await loadHandler()
    const req = createRequest()
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      ok: true,
      results: {
        wnba: {
          upserted: 2,
          skipped: 0,
        },
      },
    })

    expect(fromMock).toHaveBeenCalledWith('sport_teams')
    expect(upsertMock).toHaveBeenCalledTimes(1)
    expect(upsertMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          sport: 'wnba',
          external_id: '18',
          name: 'Seattle Storm',
          abbreviation: 'SEA',
        }),
        expect.objectContaining({
          sport: 'wnba',
          external_id: '22',
          name: 'Las Vegas Aces',
          abbreviation: 'LV',
        }),
      ],
      { onConflict: 'sport,external_id' }
    )
  })

  it('propagates upsert failures', async () => {
    upsertMock.mockResolvedValueOnce({ error: { message: 'boom' } })

    const handler = await loadHandler()
    const req = createRequest()
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Upsert failed for wnba: boom' })
  })
})
