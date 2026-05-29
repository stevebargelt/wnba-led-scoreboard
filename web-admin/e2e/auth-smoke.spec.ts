import { test, expect } from '@playwright/test'

test('authenticated shell shows signed-in user and device list', async ({ page }) => {
  await page.goto('/')

  // Must NOT be on the login form
  await expect(page.locator('input[type="email"]')).not.toBeVisible()
  await expect(page.locator('input[type="password"]')).not.toBeVisible()

  // Sidebar shows the signed-in user email
  await expect(page.getByText('steve@bargelt.com')).toBeVisible()

  // Device list shows 'steve-1'
  await expect(page.getByText('steve-1')).toBeVisible()
})
