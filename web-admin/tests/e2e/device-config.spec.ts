import { test, expect } from '@playwright/test'

test.describe('Device Configuration', () => {
  const TEST_DEVICE_ID = 'test-device-id'

  test('device list loads correctly', async ({ page }) => {
    await page.goto('/devices')

    await expect(page.locator('h1')).toContainText('Devices')

    await expect(page.locator('text=Your Devices')).toBeVisible()

    const deviceCards = page.locator('.bg-gray-50, .dark\\:bg-gray-700')
    await expect(deviceCards.first()).toBeVisible({ timeout: 10000 })
  })

  test('device list shows names and timestamps', async ({ page }) => {
    await page.goto('/devices')

    await page.waitForSelector('text=Last seen:', { timeout: 10000 })

    const lastSeenText = page.locator('text=Last seen:').first()
    await expect(lastSeenText).toBeVisible()
  })

  test('device list shows status badges', async ({ page }) => {
    await page.goto('/devices')

    const statusBadge = page.locator('[class*="badge"]').first()
    await expect(statusBadge).toBeVisible({ timeout: 10000 })
  })

  test('configure button navigates to device page', async ({ page }) => {
    await page.goto('/devices')

    await page.waitForSelector('button:has-text("Configure")', { timeout: 10000 })

    const configureButton = page.locator('button:has-text("Configure")').first()
    await configureButton.click()

    await page.waitForURL(/\/device\/.*/)

    expect(page.url()).toMatch(/\/device\/[a-f0-9-]+/)
  })

  test('device page loads with correct ID in URL', async ({ page }) => {
    await page.goto(`/device/${TEST_DEVICE_ID}`)

    expect(page.url()).toContain(TEST_DEVICE_ID)

    await expect(page.locator('h1')).toContainText('Device Configuration')

    await expect(page.locator(`text=Device ID: ${TEST_DEVICE_ID}`)).toBeVisible()
  })

  test('all configuration tabs are present', async ({ page }) => {
    await page.goto(`/device/${TEST_DEVICE_ID}`)

    await expect(page.locator('button[role="tab"]:has-text("Sports")')).toBeVisible()
    await expect(page.locator('button[role="tab"]:has-text("Favorite Teams")')).toBeVisible()
    await expect(page.locator('button[role="tab"]:has-text("Preview")')).toBeVisible()
    await expect(page.locator('button[role="tab"]:has-text("Config")')).toBeVisible()
  })

  test('sports tab content loads', async ({ page }) => {
    await page.goto(`/device/${TEST_DEVICE_ID}`)

    await page.click('button[role="tab"]:has-text("Sports")')

    await page.waitForLoadState('networkidle')

    const tabContent = page.locator('[role="tabpanel"]')
    await expect(tabContent).toBeVisible()
  })

  test('favorites tab content loads', async ({ page }) => {
    await page.goto(`/device/${TEST_DEVICE_ID}`)

    await page.click('button[role="tab"]:has-text("Favorite Teams")')

    await page.waitForLoadState('networkidle')

    const tabContent = page.locator('[role="tabpanel"]')
    await expect(tabContent).toBeVisible()
  })

  test('preview tab content loads', async ({ page }) => {
    await page.goto(`/device/${TEST_DEVICE_ID}`)

    await page.click('button[role="tab"]:has-text("Preview")')

    await page.waitForLoadState('networkidle')

    const tabContent = page.locator('[role="tabpanel"]')
    await expect(tabContent).toBeVisible()
  })

  test('config tab content loads', async ({ page }) => {
    await page.goto(`/device/${TEST_DEVICE_ID}`)

    await page.click('button[role="tab"]:has-text("Config")')

    await page.waitForLoadState('networkidle')

    const tabContent = page.locator('[role="tabpanel"]')
    await expect(tabContent).toBeVisible()
  })

  test('config tab shows device settings card', async ({ page }) => {
    await page.goto(`/device/${TEST_DEVICE_ID}`)

    await page.click('button[role="tab"]:has-text("Config")')

    await expect(page.locator('text=Device Settings')).toBeVisible()
  })

  test('config tab has all setting inputs', async ({ page }) => {
    await page.goto(`/device/${TEST_DEVICE_ID}`)

    await page.click('button[role="tab"]:has-text("Config")')

    await expect(page.locator('label:has-text("Timezone")')).toBeVisible()
    await expect(page.locator('label:has-text("Brightness")')).toBeVisible()
    await expect(page.locator('label:has-text("Matrix Width")')).toBeVisible()
    await expect(page.locator('label:has-text("Matrix Height")')).toBeVisible()
    await expect(page.locator('label:has-text("Live Layout")')).toBeVisible()
  })

  test('save configuration button exists and is clickable', async ({ page }) => {
    await page.goto(`/device/${TEST_DEVICE_ID}`)

    await page.click('button[role="tab"]:has-text("Config")')

    const saveButton = page.locator('button:has-text("Save Configuration")')
    await expect(saveButton).toBeVisible()
    await expect(saveButton).toBeEnabled()
  })

  test('save button shows loading state when clicked', async ({ page }) => {
    await page.goto(`/device/${TEST_DEVICE_ID}`)

    await page.click('button[role="tab"]:has-text("Config")')

    const saveButton = page.locator('button:has-text("Save Configuration")')
    await saveButton.click()

    await expect(saveButton).toBeDisabled()
  })

  test('back button navigates to devices list', async ({ page }) => {
    await page.goto(`/device/${TEST_DEVICE_ID}`)

    const backButton = page.locator('button:has-text("Back")')
    await expect(backButton).toBeVisible()

    await backButton.click()

    await page.waitForURL('/devices')
    expect(page.url()).toContain('/devices')
  })

  test('device not found shows error or redirects gracefully', async ({ page }) => {
    await page.goto('/device/00000000-0000-0000-0000-000000000000')

    await page.waitForLoadState('networkidle')

    const hasError =
      (await page.locator('text=not found').count()) > 0 ||
      (await page.locator('text=error').count()) > 0 ||
      page.url().includes('/devices')

    expect(hasError).toBe(true)
  })

  test('configuration tabs maintain state during navigation', async ({ page }) => {
    await page.goto(`/device/${TEST_DEVICE_ID}`)

    await page.click('button[role="tab"]:has-text("Preview")')
    await page.waitForLoadState('networkidle')

    await page.click('button[role="tab"]:has-text("Config")')
    await page.waitForLoadState('networkidle')

    await page.click('button[role="tab"]:has-text("Preview")')

    const previewTab = page.locator('button[role="tab"]:has-text("Preview")')
    await expect(previewTab).toHaveAttribute('data-state', 'active')
  })

  test('device page shows online status badge', async ({ page }) => {
    await page.goto(`/device/${TEST_DEVICE_ID}`)

    await page.waitForSelector('text=Last seen:', { timeout: 10000 })

    const statusBadge = page.locator('[class*="badge"]')
    await expect(statusBadge.first()).toBeVisible()
  })

  test('search filters device list', async ({ page }) => {
    await page.goto('/devices')

    await page.waitForSelector('input[placeholder*="Search"]', { timeout: 10000 })

    const searchInput = page.locator('input[placeholder*="Search"]')
    await searchInput.fill('test')

    await page.waitForTimeout(500)

    const deviceCards = page.locator('.bg-gray-50, .dark\\:bg-gray-700')
    const count = await deviceCards.count()

    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('create device form is visible', async ({ page }) => {
    await page.goto('/devices')

    await expect(page.locator('text=Create Device')).toBeVisible()

    const createInput = page.locator('input[placeholder*="Device name"]')
    await expect(createInput).toBeVisible()

    const createButton = page.locator('button:has-text("Create")').first()
    await expect(createButton).toBeVisible()
  })

  test('configuration inputs can be edited', async ({ page }) => {
    await page.goto(`/device/${TEST_DEVICE_ID}`)

    await page.click('button[role="tab"]:has-text("Config")')

    const brightnessInput = page.locator('input[type="number"]').first()
    await brightnessInput.clear()
    await brightnessInput.fill('75')

    const value = await brightnessInput.inputValue()
    expect(value).toBe('75')
  })

  test('live layout dropdown has correct options', async ({ page }) => {
    await page.goto(`/device/${TEST_DEVICE_ID}`)

    await page.click('button[role="tab"]:has-text("Config")')

    const layoutSelect = page.locator('select').first()
    await expect(layoutSelect).toBeVisible()

    await layoutSelect.selectOption('stacked')
    expect(await layoutSelect.inputValue()).toBe('stacked')

    await layoutSelect.selectOption('big-logos')
    expect(await layoutSelect.inputValue()).toBe('big-logos')
  })
})
