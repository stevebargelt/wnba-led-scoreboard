import { test, expect } from './fixtures'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

test('delete-device: Settings Danger Zone deletes device and redirects to dashboard', async ({
  page,
  seededDevice,
}) => {
  // 1. Navigate to the device page (defaults to Teams tab)
  await page.goto(`/device/${seededDevice.id}`)
  await page.waitForLoadState('networkidle')

  // Click the Settings tab to reveal Settings content
  await page.getByRole('tab', { name: 'Settings' }).click()

  // 2. Locate the Danger Zone and scroll to it
  const dangerZone = page.locator('[aria-label="Danger zone"]')
  await expect(dangerZone).toBeVisible({ timeout: 10_000 })
  await dangerZone.scrollIntoViewIfNeeded()

  // Click the trigger 'Delete this device' button to expand the confirm step
  await dangerZone.getByRole('button', { name: 'Delete this device' }).click()

  // Assert the confirm input appeared (trigger replaced by confirm step)
  const confirmInput = page.locator('#delete-confirm-input')
  await expect(confirmInput).toBeVisible({ timeout: 5_000 })

  // 3. Confirm Delete button is DISABLED initially
  const deleteBtn = dangerZone.getByRole('button', { name: 'Delete this device' })
  await expect(deleteBtn).toBeDisabled()

  // Type a WRONG/PARTIAL name — button stays disabled
  await confirmInput.fill(seededDevice.name.slice(0, -1))
  await expect(deleteBtn).toBeDisabled()

  // 4. Clear and type the EXACT device name — button becomes ENABLED
  await confirmInput.clear()
  await confirmInput.fill(seededDevice.name)
  await expect(deleteBtn).toBeEnabled()

  // 5. Click Delete and assert redirect to dashboard '/'
  await Promise.all([page.waitForURL(url => new URL(url).pathname === '/'), deleteBtn.click()])
  await page.waitForLoadState('networkidle')

  // Device name should no longer appear in the device list
  await expect(page.getByText(seededDevice.name)).not.toBeVisible()

  // 6. Assert the row is actually deleted in the database
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
    .eq('id', seededDevice.id)
    .maybeSingle()
  expect(data).toBeNull()
})
