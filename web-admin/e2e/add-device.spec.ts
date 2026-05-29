import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

test('add-device via UI creates device that appears in dashboard', async ({ page }) => {
  const deviceName = `e2e-add-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  let createdDeviceId: string | null = null

  try {
    // Navigate to dashboard. The home page is client-rendered auth: it paints the
    // login form first, then swaps to the dashboard once the session resolves —
    // wait for the network to settle so the Link is hydrated before clicking.
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Header always shows "Add Device"; the empty state adds a second one — use first.
    const addDeviceLink = page.getByRole('link', { name: /add device/i }).first()
    await expect(addDeviceLink).toBeVisible()

    // Click Add Device → navigates to /devices/new. Arm the URL wait before the
    // click so a slow client-router hand-off can't be missed.
    await Promise.all([page.waitForURL('**/devices/new'), addDeviceLink.click()])

    // Fill in the device name (Input component generates a label+id via useId)
    await page.getByLabel('Device name').fill(deviceName)

    // Submit
    await page.getByRole('button', { name: /create device/i }).click()

    // Wait for success state
    await expect(page.getByText('Device created!')).toBeVisible({ timeout: 10_000 })

    // Extract the created device ID from the "Configure Device" link href
    const configureLink = page.getByRole('link', { name: /configure device/i })
    const href = await configureLink.getAttribute('href')
    const match = href?.match(/\/device\/([^/]+)/)
    if (match?.[1]) {
      createdDeviceId = match[1]
    }

    // Fallback: query supabase if we couldn't extract the ID from the href
    if (!createdDeviceId) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      await supabase.auth.signInWithPassword({
        email: process.env.E2E_SUPABASE_EMAIL!,
        password: process.env.E2E_SUPABASE_PASSWORD!,
      })
      const { data } = await supabase
        .from('devices')
        .select('id')
        .eq('name', deviceName)
        .maybeSingle()
      createdDeviceId = data?.id ?? null
    }

    // Navigate back to dashboard and verify the device appears in the list.
    await Promise.all([
      page.waitForURL(url => new URL(url).pathname === '/'),
      page
        .getByRole('link', { name: /back to dashboard/i })
        .first()
        .click(),
    ])
    // Scope the assertion to THIS device by its id (collision-safe), not by name text.
    const deviceCardLink = createdDeviceId
      ? page.locator(`a[href="/device/${createdDeviceId}"]`).first()
      : page.getByRole('link', { name: deviceName }).first()
    await expect(deviceCardLink).toBeVisible({ timeout: 10_000 })
  } finally {
    // CRITICAL cleanup: the device was created via UI so the fixture cannot pre-own it.
    // We must delete it explicitly; the global-setup e2e-* sweep is the safety net.
    if (createdDeviceId) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      await supabase.auth.signInWithPassword({
        email: process.env.E2E_SUPABASE_EMAIL!,
        password: process.env.E2E_SUPABASE_PASSWORD!,
      })
      const { error } = await supabase.from('devices').delete().eq('id', createdDeviceId)
      if (error) {
        console.warn(`[add-device] Could not delete device ${createdDeviceId}: ${error.message}`)
      } else {
        console.log(
          `[add-device] Cleaned up UI-created device id=${createdDeviceId} name=${deviceName}`
        )
      }
    }
  }
})
