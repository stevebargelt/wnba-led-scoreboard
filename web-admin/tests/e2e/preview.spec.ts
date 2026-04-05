import { test, expect } from '@playwright/test'

test.describe('Preview Generation E2E Tests', () => {
  const TEST_DEVICE_ID = 'test-device-id'

  test.beforeEach(async ({ page }) => {
    await page.goto(`/device/${TEST_DEVICE_ID}`)
    await page.click('button[role="tab"]:has-text("Preview")')
  })

  test('live scene preview generates successfully', async ({ page }) => {
    await page.click('button:has-text("Live")')

    await page.waitForSelector('img[alt="LED Matrix Preview"]', { timeout: 10000 })
    const preview = page.locator('img[alt="LED Matrix Preview"]')
    await expect(preview).toBeVisible()

    const src = await preview.getAttribute('src')
    expect(src).toBeTruthy()
    expect(src).toMatch(/^blob:/)

    await expect(page.locator('text=Failed')).not.toBeVisible()
  })

  test('all scene types generate previews', async ({ page }) => {
    const scenes = [
      { button: 'Idle', name: 'idle' },
      { button: 'Pregame', name: 'pregame' },
      { button: 'Live', name: 'live' },
      { button: 'Big Logos', name: 'live_big' },
      { button: 'Final', name: 'final' },
    ]

    for (const scene of scenes) {
      await test.step(`${scene.name} scene generates`, async () => {
        await page.click(`button:has-text("${scene.button}")`)

        const preview = page.locator('img[alt="LED Matrix Preview"]')
        await expect(preview).toBeVisible({ timeout: 10000 })

        const src = await preview.getAttribute('src')
        expect(src).toBeTruthy()
        expect(src).toMatch(/^blob:/)

        await expect(page.locator('text=Failed')).not.toBeVisible()
      })
    }
  })

  test('preview refresh button regenerates image', async ({ page }) => {
    await page.click('button:has-text("Live")')

    await page.waitForSelector('img[alt="LED Matrix Preview"]')
    const initialSrc = await page.locator('img[alt="LED Matrix Preview"]').getAttribute('src')

    await page.click('button:has-text("Refresh")')

    await page.waitForTimeout(1000)
    const newSrc = await page.locator('img[alt="LED Matrix Preview"]').getAttribute('src')

    expect(newSrc).toBeTruthy()
    expect(newSrc).not.toBe(initialSrc)
  })

  test('shows loading state while generating preview', async ({ page }) => {
    await page.click('button:has-text("Live")')

    const loadingText = page.locator('text=Generating preview...')

    await page.waitForSelector('img[alt="LED Matrix Preview"]', { timeout: 10000 })

    await expect(loadingText).not.toBeVisible()
  })

  test('shows error message when preview generation fails', async ({ page }) => {
    await page.goto('/device/nonexistent-device-id')
    await page.click('button[role="tab"]:has-text("Preview")')

    await page.click('button:has-text("Live")')

    const errorBox = page.locator('.bg-red-50, .dark\\:bg-red-900\\/20')
    await expect(errorBox).toBeVisible({ timeout: 10000 })

    const preview = page.locator('img[alt="LED Matrix Preview"]')
    await expect(preview).not.toBeVisible()
  })

  test('scene buttons are disabled while loading', async ({ page }) => {
    await page.click('button:has-text("Live")')

    const idleButton = page.locator('button:has-text("Idle")')
    const pregameButton = page.locator('button:has-text("Pregame")')

    await expect(idleButton).toBeDisabled()
    await expect(pregameButton).toBeDisabled()

    await page.waitForSelector('img[alt="LED Matrix Preview"]', { timeout: 10000 })

    await expect(idleButton).not.toBeDisabled()
    await expect(pregameButton).not.toBeDisabled()
  })

  test('refresh button shows loading state', async ({ page }) => {
    await page.click('button:has-text("Live")')
    await page.waitForSelector('img[alt="LED Matrix Preview"]')

    await page.click('button:has-text("Refresh")')

    const refreshButton = page.locator('button:has-text("Refresh")')
    await expect(refreshButton).toBeDisabled()

    await page.waitForSelector('img[alt="LED Matrix Preview"]', { timeout: 10000 })

    await expect(refreshButton).not.toBeDisabled()
  })

  test('selected scene button has primary variant styling', async ({ page }) => {
    await page.click('button:has-text("Live")')
    await page.waitForSelector('img[alt="LED Matrix Preview"]')

    const liveButton = page.locator('button:has-text("Live")')
    const idleButton = page.locator('button:has-text("Idle")')

    await expect(liveButton).toHaveClass(/primary/)
    await expect(idleButton).not.toHaveClass(/primary/)

    await page.click('button:has-text("Idle")')
    await page.waitForSelector('img[alt="LED Matrix Preview"]')

    await expect(idleButton).toHaveClass(/primary/)
    await expect(liveButton).not.toHaveClass(/primary/)
  })
})
