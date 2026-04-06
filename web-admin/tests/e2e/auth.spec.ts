import { test as base, expect } from '@playwright/test'
import { test, TEST_USER } from './fixtures/auth'

base.describe('Authentication', () => {
  base.describe('Login flow', () => {
    base('should successfully log in with valid credentials', async ({ page }) => {
      await page.goto('/')

      await expect(page.locator('text=WNBA LED Web Admin')).toBeVisible()

      await page.fill('input[type="email"]', TEST_USER.email)
      await page.fill('input[type="password"]', TEST_USER.password)

      await page.click('button:has-text("Sign In")')

      await page.waitForURL('/')
      await expect(page.locator('text=Dashboard')).toBeVisible()

      const sessionExists = await page.evaluate(async () => {
        const { supabase } = await import('../../src/lib/supabaseClient')
        const {
          data: { session },
        } = await supabase.auth.getSession()
        return session !== null
      })
      expect(sessionExists).toBe(true)
    })
  })

  base.describe('Logout flow', () => {
    test('should successfully log out from authenticated state', async ({ authenticatedPage }) => {
      await expect(authenticatedPage.locator('text=Dashboard')).toBeVisible()

      await authenticatedPage.click('button:has-text("Sign Out")')

      await expect(authenticatedPage.locator('text=WNBA LED Web Admin')).toBeVisible()
      await expect(authenticatedPage.locator('input[type="email"]')).toBeVisible()

      const sessionCleared = await authenticatedPage.evaluate(async () => {
        const { supabase } = await import('../../src/lib/supabaseClient')
        const {
          data: { session },
        } = await supabase.auth.getSession()
        return session === null
      })
      expect(sessionCleared).toBe(true)
    })
  })

  base.describe('Protected routes', () => {
    base('should redirect to login when accessing device page without auth', async ({ page }) => {
      await page.goto('/device/test-device-id')

      await expect(page.locator('text=WNBA LED Web Admin')).toBeVisible()
      await expect(page.locator('input[type="email"]')).toBeVisible()

      const sessionExists = await page.evaluate(async () => {
        const { supabase } = await import('../../src/lib/supabaseClient')
        const {
          data: { session },
        } = await supabase.auth.getSession()
        return session !== null
      })
      expect(sessionExists).toBe(false)
    })

    base('should redirect back to original URL after login', async ({ page }) => {
      await page.goto('/device/test-device-id')

      await expect(page.locator('input[type="email"]')).toBeVisible()

      await page.fill('input[type="email"]', TEST_USER.email)
      await page.fill('input[type="password"]', TEST_USER.password)
      await page.click('button:has-text("Sign In")')

      await page.waitForURL('/')
      await expect(page.locator('text=Dashboard')).toBeVisible()
    })
  })

  base.describe('Invalid credentials', () => {
    base('should display error message for wrong password', async ({ page }) => {
      await page.goto('/')

      await page.fill('input[type="email"]', TEST_USER.email)
      await page.fill('input[type="password"]', 'wrongpassword')

      await page.click('button:has-text("Sign In")')

      await expect(page.locator('text=Invalid login credentials')).toBeVisible()

      await expect(page.locator('text=WNBA LED Web Admin')).toBeVisible()

      const sessionCreated = await page.evaluate(async () => {
        const { supabase } = await import('../../src/lib/supabaseClient')
        const {
          data: { session },
        } = await supabase.auth.getSession()
        return session !== null
      })
      expect(sessionCreated).toBe(false)
    })
  })
})
