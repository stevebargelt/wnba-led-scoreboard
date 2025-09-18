import { makeValidator } from './schema'

describe('configuration schema', () => {
  const validator = makeValidator()

  it('accepts a valid multi-sport config', () => {
    const validConfig = {
      timezone: 'America/Los_Angeles',
      matrix: { width: 64, height: 32 },
      refresh: { pregame_sec: 30, ingame_sec: 5, final_sec: 60 },
      render: { live_layout: 'stacked', logo_variant: 'mini' },
      sports: [
        {
          sport: 'wnba',
          enabled: true,
          priority: 1,
          favorites: [{ name: 'Seattle Storm', id: '18', abbr: 'SEA' }],
        },
      ],
    }

    expect(validator(validConfig)).toBe(true)
    expect(validator.errors).toBeNull()
  })

  it('rejects configs without sports entries', () => {
    const invalidConfig = {
      timezone: 'America/Chicago',
      matrix: { width: 64, height: 32 },
      refresh: { pregame_sec: 30, ingame_sec: 5, final_sec: 60 },
      render: { live_layout: 'stacked', logo_variant: 'mini' },
      sports: [],
    }

    expect(validator(invalidConfig)).toBe(false)
    expect(validator.errors?.[0]?.message).toBeDefined()
  })
})
