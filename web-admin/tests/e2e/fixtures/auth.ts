import { test as base } from '@playwright/test'
import { supabase } from '../../../src/lib/supabaseClient'

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await use(page)
  },
})
