import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>

const getUserMock = jest.fn()
const fromMock = jest.fn()

const ORIGINAL_ENV = process.env

beforeEach(() => {
  jest.clearAllMocks()

  getUserMock.mockResolvedValue({
    data: { user: { id: 'user-uuid', email: 'test@example.com' } },
    error: null,
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
    handler = (await import('./sports')).default
  })

  if (!handler) throw new Error('Failed to load handler')
  return handler
}

describe('GET /api/device/[id]/sports – active league filtering', () => {
  it('only returns sportConfigs for is_active=true leagues, excluding is_active=false', async () => {
    // device_leagues rows: one active (nhl), one inactive (nba)
    const leaguesData = [
      { enabled: true, priority: 1, league: { code: 'nhl', is_active: true } },
      { enabled: true, priority: 2, league: { code: 'nba', is_active: false } },
    ]

    const orderMock = jest.fn().mockResolvedValue({ data: leaguesData, error: null })
    const leaguesEqMock = jest.fn().mockReturnValue({ order: orderMock })
    const leaguesSelectMock = jest.fn().mockReturnValue({ eq: leaguesEqMock })

    const favsEqMock = jest.fn().mockResolvedValue({ data: [], error: null })
    const favsSelectMock = jest.fn().mockReturnValue({ eq: favsEqMock })

    const overrideLimitMock = jest.fn().mockReturnValue({
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })
    const overrideOrderMock = jest.fn().mockReturnValue({ limit: overrideLimitMock })
    const overrideGtMock = jest.fn().mockReturnValue({ order: overrideOrderMock })
    const overrideEqMock = jest.fn().mockReturnValue({ gt: overrideGtMock })
    const overrideSelectMock = jest.fn().mockReturnValue({ eq: overrideEqMock })

    const deviceMaybeSingleMock = jest.fn().mockResolvedValue({
      data: { id: 'device-uuid' },
      error: null,
    })
    const deviceEqMock = jest.fn().mockReturnValue({ maybeSingle: deviceMaybeSingleMock })
    const deviceSelectMock = jest.fn().mockReturnValue({ eq: deviceEqMock })

    fromMock.mockImplementation((table: string) => {
      if (table === 'devices') return { select: deviceSelectMock }
      if (table === 'device_leagues') return { select: leaguesSelectMock }
      if (table === 'device_favorite_teams') return { select: favsSelectMock }
      if (table === 'game_overrides') return { select: overrideSelectMock }
      return {}
    })

    const handler = await loadHandler()
    const req = createRequest({ method: 'GET' })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const { sportConfigs } = res.body
    expect(sportConfigs).toHaveLength(1)
    expect(sportConfigs[0].sport).toBe('nhl')
    expect(sportConfigs.find((c: any) => c.sport === 'nba')).toBeUndefined()
  })
})
