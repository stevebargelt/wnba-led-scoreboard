import { test, expect } from './fixtures/auth'

test.describe('Preview Generation E2E Tests', () => {
  test.beforeEach(async ({ authenticatedPage, testDeviceId }) => {
    await authenticatedPage.goto(`/device/${testDeviceId}`)
    await authenticatedPage.click('button[role="tab"]:has-text("Preview")')
  })

  test('live scene preview generates successfully', async ({ authenticatedPage }) => {
    await authenticatedPage.click('button:has-text("Live")')

    await authenticatedPage.waitForSelector('img[alt="LED Matrix Preview"]', { timeout: 10000 })
    const preview = authenticatedPage.locator('img[alt="LED Matrix Preview"]')
    await expect(preview).toBeVisible()

    const src = await preview.getAttribute('src')
    expect(src).toBeTruthy()
    expect(src).toMatch(/^blob:/)

    await expect(authenticatedPage.locator('text=Failed')).not.toBeVisible()
  })

  test('all scene types generate previews', async ({ authenticatedPage }) => {
    const scenes = [
      { button: 'Idle', name: 'idle' },
      { button: 'Pregame', name: 'pregame' },
      { button: 'Live', name: 'live' },
      { button: 'Big Logos', name: 'live_big' },
      { button: 'Final', name: 'final' },
    ]

    for (const scene of scenes) {
      await test.step(`${scene.name} scene generates`, async () => {
        await authenticatedPage.click(`button:has-text("${scene.button}")`)

        const preview = authenticatedPage.locator('img[alt="LED Matrix Preview"]')
        await expect(preview).toBeVisible({ timeout: 10000 })

        const src = await preview.getAttribute('src')
        expect(src).toBeTruthy()
        expect(src).toMatch(/^blob:/)

        await expect(authenticatedPage.locator('text=Failed')).not.toBeVisible()
      })
    }
  })

  test('preview refresh button regenerates image', async ({ authenticatedPage }) => {
    await authenticatedPage.click('button:has-text("Live")')

    await authenticatedPage.waitForSelector('img[alt="LED Matrix Preview"]')
    const initialSrc = await authenticatedPage
      .locator('img[alt="LED Matrix Preview"]')
      .getAttribute('src')

    await authenticatedPage.click('button:has-text("Refresh")')

    await authenticatedPage.waitForTimeout(1000)
    const newSrc = await authenticatedPage
      .locator('img[alt="LED Matrix Preview"]')
      .getAttribute('src')

    expect(newSrc).toBeTruthy()
    expect(newSrc).not.toBe(initialSrc)
  })

  test('shows loading state while generating preview', async ({ authenticatedPage }) => {
    await authenticatedPage.click('button:has-text("Live")')

    const loadingText = authenticatedPage.locator('text=Generating preview...')

    await authenticatedPage.waitForSelector('img[alt="LED Matrix Preview"]', { timeout: 10000 })

    await expect(loadingText).not.toBeVisible()
  })

  test('shows error message when preview generation fails', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/device/nonexistent-device-id')
    await authenticatedPage.click('button[role="tab"]:has-text("Preview")')

    await authenticatedPage.click('button:has-text("Live")')

    const errorBox = authenticatedPage.locator('.bg-red-50, .dark\\:bg-red-900\\/20')
    await expect(errorBox).toBeVisible({ timeout: 10000 })

    const preview = authenticatedPage.locator('img[alt="LED Matrix Preview"]')
    await expect(preview).not.toBeVisible()
  })

  test('scene buttons are disabled while loading', async ({ authenticatedPage }) => {
    await authenticatedPage.click('button:has-text("Live")')

    const idleButton = authenticatedPage.locator('button:has-text("Idle")')
    const pregameButton = authenticatedPage.locator('button:has-text("Pregame")')

    await expect(idleButton).toBeDisabled()
    await expect(pregameButton).toBeDisabled()

    await authenticatedPage.waitForSelector('img[alt="LED Matrix Preview"]', { timeout: 10000 })

    await expect(idleButton).not.toBeDisabled()
    await expect(pregameButton).not.toBeDisabled()
  })

  test('refresh button shows loading state', async ({ authenticatedPage }) => {
    await authenticatedPage.click('button:has-text("Live")')
    await authenticatedPage.waitForSelector('img[alt="LED Matrix Preview"]')

    await authenticatedPage.click('button:has-text("Refresh")')

    const refreshButton = authenticatedPage.locator('button:has-text("Refresh")')
    await expect(refreshButton).toBeDisabled()

    await authenticatedPage.waitForSelector('img[alt="LED Matrix Preview"]', { timeout: 10000 })

    await expect(refreshButton).not.toBeDisabled()
  })

  test('selected scene button has primary variant styling', async ({ authenticatedPage }) => {
    await authenticatedPage.click('button:has-text("Live")')
    await authenticatedPage.waitForSelector('img[alt="LED Matrix Preview"]')

    const liveButton = authenticatedPage.locator('button:has-text("Live")')
    const idleButton = authenticatedPage.locator('button:has-text("Idle")')

    await expect(liveButton).toHaveClass(/primary/)
    await expect(idleButton).not.toHaveClass(/primary/)

    await authenticatedPage.click('button:has-text("Idle")')
    await authenticatedPage.waitForSelector('img[alt="LED Matrix Preview"]')

    await expect(idleButton).toHaveClass(/primary/)
    await expect(liveButton).not.toHaveClass(/primary/)
  })
})
