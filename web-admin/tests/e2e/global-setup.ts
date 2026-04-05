import { chromium } from '@playwright/test'

const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123',
}

async function globalSetup() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000')

    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.password)
    await page.click('button:has-text("Sign Up")')

    await page.waitForTimeout(2000)

    console.log(`Test user ${TEST_USER.email} created or already exists`)
  } catch (error) {
    console.log('Test user setup completed (may already exist)')
  } finally {
    await browser.close()
  }
}

export default globalSetup
