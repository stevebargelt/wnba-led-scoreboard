import { test as base, type Page } from '@playwright/test'
import { supabase } from '../../../src/lib/supabaseClient'

type AuthFixtures = {
  authenticatedPage: Page
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await use(page)
  },
})
