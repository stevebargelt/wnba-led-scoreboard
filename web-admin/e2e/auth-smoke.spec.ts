import { test, expect } from './fixtures'

test('authenticated shell shows signed-in user and seeded device', async ({
  page,
  seededDevice,
}) => {
  await page.goto('/')

  // Must NOT be on the login form
  await expect(page.locator('input[type="email"]')).not.toBeVisible()
  await expect(page.locator('input[type="password"]')).not.toBeVisible()

  // Sidebar shows the QA user email
  await expect(page.getByText('qa@bargelt.com')).toBeVisible()

  // Device list shows the seeded fixture device
  await expect(page.getByText(seededDevice.name)).toBeVisible()
})
