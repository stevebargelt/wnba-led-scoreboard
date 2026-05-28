import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>

const getUserMock = jest.fn()
const maybeSingleMock = jest.fn()
const eqMock = jest.fn()
const selectMock = jest.fn()
const upsertMock = jest.fn()
const fromMock = jest.fn()

const ORIGINAL_ENV = process.env

beforeEach(() => {
  jest.clearAllMocks()

  getUserMock.mockResolvedValue({
    data: { user: { id: 'user-uuid', email: 'test@example.com' } },
    error: null,
  })

  maybeSingleMock.mockResolvedValue({ data: { id: 'device-uuid' }, error: null })
  eqMock.mockReturnValue({ maybeSingle: maybeSingleMock })
  selectMock.mockReturnValue({ eq: eqMock })
  upsertMock.mockResolvedValue({ error: null })

  fromMock.mockImplementation((table: string) => {
    if (table === 'devices') return { select: selectMock }
    if (table === 'device_config') return { upsert: upsertMock }
    return {}
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
    method: (overrides.method || 'PUT') as any,
    headers: {
      authorization: 'Bearer user-token',
      ...(overrides.headers || {}),
    },
    body: overrides.body ?? {},
    query: (overrides as any).query || { id: 'device-uuid' },
    cookies: {},
  } as NextApiRequest
}

function createResponse() {
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
  return res as NextApiResponse & { statusCode: number; headers: Record<string, any>; body: any }
}

async function loadHandler() {
  process.env = {
    ...ORIGINAL_ENV,
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.test',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  }

  let handler: ((req: NextApiRequest, res: NextApiResponse) => Promise<void>) | undefined

  await jest.isolateModulesAsync(async () => {
    handler = (await import('./config')).default
  })

  if (!handler) throw new Error('Failed to load handler')
  return handler
}

const VALID_BODY = {
  brightness: 80,
  timezone: 'America/Los_Angeles',
  refresh_pregame_sec: 30,
  refresh_ingame_sec: 5,
  refresh_final_sec: 60,
}

describe('PUT /api/device/[id]/config – validation', () => {
  it('accepts valid input and returns 200', async () => {
    const handler = await loadHandler()
    const req = createRequest({ body: { ...VALID_BODY } })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(upsertMock).toHaveBeenCalledTimes(1)
  })

  it('rejects brightness below 1 (out-of-range low)', async () => {
    const handler = await loadHandler()
    const req = createRequest({ body: { ...VALID_BODY, brightness: 0 } })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/brightness/i)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('rejects brightness above 100 (out-of-range high)', async () => {
    const handler = await loadHandler()
    const req = createRequest({ body: { ...VALID_BODY, brightness: 101 } })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/brightness/i)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('rejects non-numeric brightness', async () => {
    const handler = await loadHandler()
    const req = createRequest({ body: { ...VALID_BODY, brightness: 'bright' } })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/brightness/i)
  })

  it('rejects refresh_pregame_sec of zero', async () => {
    const handler = await loadHandler()
    const req = createRequest({ body: { ...VALID_BODY, refresh_pregame_sec: 0 } })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/refresh_pregame_sec/i)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('rejects negative refresh_pregame_sec', async () => {
    const handler = await loadHandler()
    const req = createRequest({ body: { ...VALID_BODY, refresh_pregame_sec: -10 } })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/refresh_pregame_sec/i)
  })

  it('rejects refresh_ingame_sec of zero', async () => {
    const handler = await loadHandler()
    const req = createRequest({ body: { ...VALID_BODY, refresh_ingame_sec: 0 } })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/refresh_ingame_sec/i)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('rejects negative refresh_final_sec', async () => {
    const handler = await loadHandler()
    const req = createRequest({ body: { ...VALID_BODY, refresh_final_sec: -1 } })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/refresh_final_sec/i)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('rejects a timezone with spaces', async () => {
    const handler = await loadHandler()
    const req = createRequest({ body: { ...VALID_BODY, timezone: 'America Los Angeles' } })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/timezone/i)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('rejects an excessively long timezone string', async () => {
    const handler = await loadHandler()
    const req = createRequest({ body: { ...VALID_BODY, timezone: 'A'.repeat(70) } })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/timezone/i)
  })

  it('rejects a non-string timezone', async () => {
    const handler = await loadHandler()
    const req = createRequest({ body: { ...VALID_BODY, timezone: 99 } })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/timezone/i)
  })

  it('stores only the five functional fields in the upsert', async () => {
    const handler = await loadHandler()
    const req = createRequest({ body: { ...VALID_BODY, extra_field: 'should-be-ignored' } })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const upsertArg = upsertMock.mock.calls[0][0]
    expect(Object.keys(upsertArg)).toEqual(
      expect.arrayContaining([
        'device_id',
        'brightness',
        'timezone',
        'refresh_pregame_sec',
        'refresh_ingame_sec',
        'refresh_final_sec',
        'updated_at',
      ])
    )
    expect(upsertArg).not.toHaveProperty('extra_field')
  })
})
