import { test as base, type Page } from '@playwright/test'

type AuthFixtures = {
  authenticatedPage: Page
}

const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123',
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/')

    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.password)
    await page.click('button:has-text("Sign In")')

    await page.waitForURL('/')
    await page.waitForSelector('text=Dashboard')

    await use(page)
  },
})

export { TEST_USER }
