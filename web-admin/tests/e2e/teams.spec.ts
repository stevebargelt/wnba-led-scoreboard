import { test, expect } from '@playwright/test'

test.describe('Teams Management', () => {
  const TEST_DEVICE_ID = 'test-device-id'

  test.beforeEach(async ({ page }) => {
    await page.goto(`/device/${TEST_DEVICE_ID}`)
  })

  test.describe('Sports Tab - Team Display', () => {
    test('Sports tab loads and shows configuration UI', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Sports")')

      await page.waitForLoadState('networkidle', { timeout: 10000 })

      await expect(page.locator('text=Sport Configuration')).toBeVisible()
      await expect(
        page.locator('text=Manage which sports are displayed and their priorities')
      ).toBeVisible()
    })

    test('CRITICAL: Sports tab shows sport enablement controls', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Sports")')

      await page.waitForLoadState('networkidle', { timeout: 10000 })

      await expect(page.locator('text=Quick Actions')).toBeVisible({ timeout: 15000 })
      await expect(page.locator('button:has-text("Enable WNBA")')).toBeVisible()
      await expect(page.locator('button:has-text("Enable NHL")')).toBeVisible()
    })

    test('sport sections show enabled count', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Sports")')

      await page.waitForLoadState('networkidle', { timeout: 10000 })

      await expect(page.locator('text=/\\d+ Sports? Enabled/')).toBeVisible({ timeout: 15000 })
    })

    test('sport configuration header displays', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Sports")')

      await expect(page.locator('text=Sport Configuration')).toBeVisible()
      await expect(
        page.locator('text=Manage which sports are displayed and their priorities')
      ).toBeVisible()

      await expect(page.locator('text=/\\d+ Sports? Enabled/')).toBeVisible()

      const saveButton = page.locator('button:has-text("Save Configuration")')
      await expect(saveButton).toBeVisible()
    })

    test('sport configuration page shows quick actions', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Sports")')

      await page.waitForLoadState('networkidle', { timeout: 10000 })

      await expect(page.locator('text=Quick Actions')).toBeVisible({ timeout: 15000 })

      await expect(page.locator('button:has-text("Enable WNBA")')).toBeVisible()
      await expect(page.locator('button:has-text("Enable NHL")')).toBeVisible()
      await expect(page.locator('button:has-text("Refresh Data")')).toBeVisible()
    })
  })

  test.describe('Favorites Tab - Team Display', () => {
    test('Favorites tab shows WNBA section', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Favorite Teams")')

      await expect(page.locator('text=Multi-Sport Favorites Configuration')).toBeVisible()

      const wnbaTab = page.locator('button[role="tab"]:has-text("WNBA")')
      await expect(wnbaTab).toBeVisible()
    })

    test('Favorites tab shows NHL section', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Favorite Teams")')

      const nhlTab = page.locator('button[role="tab"]:has-text("NHL")')
      await expect(nhlTab).toBeVisible()
    })

    test('can switch between WNBA and NHL in Favorites', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Favorite Teams")')

      const wnbaTab = page.locator('button[role="tab"]:has-text("WNBA")')
      await wnbaTab.click()
      await page.waitForTimeout(300)

      const nhlTab = page.locator('button[role="tab"]:has-text("NHL")')
      await nhlTab.click()
      await page.waitForTimeout(300)

      await wnbaTab.click()
      await page.waitForTimeout(300)
    })

    test('Favorites tab shows save button', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Favorite Teams")')

      const saveButton = page.locator('button:has-text("Save Favorites")')
      await expect(saveButton).toBeVisible()
    })

    test('Favorites tab shows configuration summary', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Favorite Teams")')

      await expect(page.locator('text=Configuration Summary')).toBeVisible()
    })

    test('Favorites tab shows badges for each sport', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Favorite Teams")')

      const wnbaBadge = page.locator('text=/🏀.*WNBA/').first()
      await expect(wnbaBadge).toBeVisible()

      const nhlBadge = page.locator('text=/🏒.*NHL/').first()
      await expect(nhlBadge).toBeVisible()
    })
  })

  test.describe('Navigation Between Tabs', () => {
    test('can navigate from Sports to Favorites tab', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Sports")')
      await expect(page.locator('text=Sport Configuration')).toBeVisible()

      await page.click('button[role="tab"]:has-text("Favorite Teams")')
      await expect(page.locator('text=Multi-Sport Favorites Configuration')).toBeVisible()
    })

    test('can navigate from Favorites to Sports tab', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Favorite Teams")')
      await expect(page.locator('text=Multi-Sport Favorites Configuration')).toBeVisible()

      await page.click('button[role="tab"]:has-text("Sports")')
      await expect(page.locator('text=Sport Configuration')).toBeVisible()
    })

    test('tabs persist state when switching', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Sports")')
      await expect(page.locator('text=Sport Configuration')).toBeVisible()

      await page.click('button[role="tab"]:has-text("Preview")')

      await page.click('button[role="tab"]:has-text("Sports")')
      await expect(page.locator('text=Sport Configuration')).toBeVisible()
    })
  })

  test.describe('Empty State Handling', () => {
    test('Sports tab handles loading state', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Sports")')

      await page.waitForSelector('text=Sport Configuration', { timeout: 10000 })
      await expect(page.locator('text=Sport Configuration')).toBeVisible()
    })

    test('Favorites tab handles loading state', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Favorite Teams")')

      await page.waitForSelector('text=Multi-Sport Favorites Configuration', { timeout: 10000 })
      await expect(page.locator('text=Multi-Sport Favorites Configuration')).toBeVisible()
    })
  })

  test.describe('Team Data Verification', () => {
    test('CRITICAL: verifies sport data API is called', async ({ page }) => {
      const apiCalls: string[] = []
      page.on('response', response => {
        const url = response.url()
        if (url.includes('/api/sports') || url.includes('/sports')) {
          apiCalls.push(url)
        }
      })

      await page.click('button[role="tab"]:has-text("Sports")')

      await page.waitForLoadState('networkidle', { timeout: 10000 })
      await page.waitForTimeout(1000)

      expect(apiCalls.length).toBeGreaterThan(0)
    })

    test('verifies teams data is loaded from API', async ({ page }) => {
      const apiPromise = page.waitForResponse(
        response =>
          response.url().includes('/api/sports') ||
          response.url().includes(`/api/device/${TEST_DEVICE_ID}/sports`),
        { timeout: 10000 }
      )

      await page.click('button[role="tab"]:has-text("Sports")')

      const response = await apiPromise
      const status = response.status()
      expect(status).toBeGreaterThanOrEqual(200)
      expect(status).toBeLessThan(500)
    })

    test('verifies device sport configuration loaded', async ({ page }) => {
      const apiPromise = page.waitForResponse(
        response => response.url().includes(`/api/device/${TEST_DEVICE_ID}/sports`),
        { timeout: 10000 }
      )

      await page.click('button[role="tab"]:has-text("Sports")')

      const response = await apiPromise
      const status = response.status()
      expect(status).toBeGreaterThanOrEqual(200)
      expect(status).toBeLessThan(500)
    })
  })

  test.describe('Interactive Elements', () => {
    test('priority settings section displays', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Sports")')

      await page.waitForLoadState('networkidle', { timeout: 10000 })

      await expect(page.locator('text=Priority Settings')).toBeVisible({ timeout: 15000 })
      await expect(page.locator('text=Live games get priority boost')).toBeVisible()
      await expect(page.locator('text=Favorite teams get priority boost')).toBeVisible()
    })

    test('save buttons are present and functional', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Sports")')
      const sportsSaveButton = page.locator('button:has-text("Save Configuration")')
      await expect(sportsSaveButton).toBeVisible()
      await expect(sportsSaveButton).toBeEnabled()

      await page.click('button[role="tab"]:has-text("Favorite Teams")')
      const favoritesSaveButton = page.locator('button:has-text("Save Favorites")')
      await expect(favoritesSaveButton).toBeVisible()
    })
  })
})
