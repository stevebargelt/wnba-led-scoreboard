import { test as base, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

type AuthFixtures = {
  authenticatedPage: Page
  testDeviceId: string
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const testEmail = process.env.TEST_USER_EMAIL
    const testPassword = process.env.TEST_USER_PASSWORD

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured in environment')
    }

    if (!testEmail || !testPassword) {
      throw new Error('Test user credentials not configured in environment')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    })

    if (error || !data.session) {
      throw new Error(`Failed to authenticate test user: ${error?.message || 'No session'}`)
    }

    const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

    await page.goto('/')

    await page.evaluate(
      ({ key, session }) => {
        localStorage.setItem(key, JSON.stringify(session))
      },
      { key: storageKey, session: data.session }
    )

    await page.reload()

    await use(page)
  },

  testDeviceId: async ({ authenticatedPage }, use) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: devices } = await supabase.from('devices').select('id').limit(1).single()

    if (!devices) {
      throw new Error('No test device found in database')
    }

    await use(devices.id)
  },
})

export { expect } from '@playwright/test'
