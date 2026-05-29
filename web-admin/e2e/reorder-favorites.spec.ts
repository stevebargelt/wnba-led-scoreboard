import { test, expect } from './fixtures'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const LEAGUE = 'wnba'

// Tests that favorite-team drag-to-reorder persists through save/reload (migration 006).
// Attempts keyboard reorder first (dnd-kit KeyboardSensor, a11y); falls back to Playwright drag.
test('reorder-favorites: reorder persists via migration 006', async ({ page, seededDevice }) => {
  // Authenticated Supabase client for DB assertions (same pattern as other specs)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: process.env.E2E_SUPABASE_EMAIL!,
    password: process.env.E2E_SUPABASE_PASSWORD!,
  })
  expect(authErr, 'Supabase QA login for DB assertions').toBeNull()

  // ── Steps 1–2: navigate to device Teams tab, enable WNBA ─────────────────
  await page.goto(`/device/${seededDevice.id}`)
  await page.waitForLoadState('networkidle')

  const badge = LEAGUE.toUpperCase()
  const leagueCard = page.locator('[class*="rounded-card"]').filter({ hasText: badge }).first()
  await expect(leagueCard).toBeVisible({ timeout: 10_000 })

  // Enable the league by clicking its toggle (first button in the card header area)
  await leagueCard.locator('button').first().click()
  const addTeamInput = page.locator(`#add-team-${LEAGUE}`)
  await expect(addTeamInput).toBeVisible({ timeout: 5_000 })

  // ── Step 3: discover 3 team names from datalist, add each ─────────────────
  // Wait for datalist to populate (API round-trip for /api/sports)
  await page.waitForFunction(
    id => {
      const dl = document.getElementById(id as string)
      return dl !== null && dl.querySelectorAll('option').length >= 3
    },
    `teams-${LEAGUE}`,
    { timeout: 10_000 }
  )

  // Capture the first 3 team names BEFORE adding any (datalist shrinks as teams are added)
  const teamNames = await page.evaluate(id => {
    const dl = document.getElementById(id as string)
    return Array.from(dl?.querySelectorAll('option') ?? [])
      .slice(0, 3)
      .map(o => o.getAttribute('value') as string)
  }, `teams-${LEAGUE}`)

  expect(teamNames).toHaveLength(3)

  // Add T1, T2, T3 in order; wait for each pill's Remove button to appear
  for (let i = 0; i < 3; i++) {
    await addTeamInput.fill(teamNames[i])
    await expect(leagueCard.locator('button[aria-label^="Remove "]')).toHaveCount(i + 1, {
      timeout: 5_000,
    })
  }

  // ── Step 4: save, capture initial DB state, reload, confirm T1 T2 T3 ──────
  await page.getByRole('button', { name: /save teams/i }).click()
  await expect(page.getByText('Teams saved. Panel updates on its next poll.')).toBeVisible({
    timeout: 10_000,
  })

  // Resolve WNBA league_id (device_favorite_teams uses league_id FK, not league code)
  const { data: leagueRow, error: leagueErr } = await supabase
    .from('leagues')
    .select('id')
    .eq('code', LEAGUE)
    .single()
  expect(leagueErr, 'leagues lookup').toBeNull()
  const wnbaLeagueId: string = leagueRow!.id

  // DB: verify initial priorities are 1,2,3 and record team_id order for later comparison
  const { data: initialRows, error: initErr } = await supabase
    .from('device_favorite_teams')
    .select('team_id, priority')
    .eq('device_id', seededDevice.id)
    .eq('league_id', wnbaLeagueId)
    .order('priority')
  expect(initErr, 'initial DB query').toBeNull()
  expect(initialRows).toHaveLength(3)
  expect(
    initialRows!.map((r: { team_id: string; priority: number }) => r.priority),
    'initial priorities must be 1,2,3'
  ).toEqual([1, 2, 3])
  const initialTeamIds: string[] = initialRows!.map(
    (r: { team_id: string; priority: number }) => r.team_id
  )

  await page.reload()
  await page.waitForLoadState('networkidle')

  // Re-locate card after reload
  const card = page.locator('[class*="rounded-card"]').filter({ hasText: badge }).first()
  await expect(card).toBeVisible({ timeout: 10_000 })
  await expect(page.locator(`#add-team-${LEAGUE}`)).toBeVisible({ timeout: 10_000 })
  await expect(card.locator('button[aria-label^="Remove "]')).toHaveCount(3, { timeout: 10_000 })

  // Capture pill labels (abbreviations via Remove button aria-label) before reorder
  const labelsBefore: string[] = await card
    .locator('button[aria-label^="Remove "]')
    .evaluateAll(btns => btns.map(b => b.getAttribute('aria-label')?.replace('Remove ', '') ?? ''))
  expect(labelsBefore).toHaveLength(3)

  // ── Step 5: reorder — keyboard first, drag fallback ───────────────────────
  // dnd-kit KeyboardSensor: Space=pick-up, ArrowRight=move-right, Space=drop.
  // With 3 items, two ArrowRight presses move T1 from position 0 to end → [T2, T3, T1].
  const handles = card.locator('button[aria-label^="Drag to reorder "]')
  await expect(handles).toHaveCount(3, { timeout: 5_000 })

  let reorderMechanism: 'keyboard' | 'drag' = 'keyboard'

  // Keyboard attempt: press Space to pick up, ArrowRight×2, Space to drop
  await handles.nth(0).focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Space')

  // Give React state time to settle after the keyboard interaction
  await page.waitForTimeout(1_000)

  // Check if keyboard triggered a reorder (isDirty → "Unsaved changes" text visible)
  const keyboardWorked = await page.getByText('Unsaved changes').isVisible()

  if (!keyboardWorked) {
    // Keyboard did not trigger a reorder in headless mode; fall back to Playwright drag.
    // Cancel any in-progress keyboard drag first.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    reorderMechanism = 'drag'

    // Drag first drag handle to the position of the third drag handle.
    // PointerSensor activates on pointerdown and moves with pointermove events.
    await handles.nth(0).dragTo(handles.nth(2))
    await page.waitForTimeout(500)
  }

  // ── Step 6: assert UI order changed ──────────────────────────────────────
  // The "Unsaved changes" banner (role="alert" with class bg-amber-soft) confirms isDirty
  await expect(page.getByText('Unsaved changes')).toBeVisible({ timeout: 5_000 })

  const reorderedLabels: string[] = await card
    .locator('button[aria-label^="Remove "]')
    .evaluateAll(btns => btns.map(b => b.getAttribute('aria-label')?.replace('Remove ', '') ?? ''))
  expect(reorderedLabels).toHaveLength(3)
  expect(
    reorderedLabels,
    `pill order must differ from original after ${reorderMechanism} reorder`
  ).not.toEqual(labelsBefore)

  console.log(`Reorder mechanism: ${reorderMechanism}`)
  console.log(`Before: [${labelsBefore.join(', ')}]`)
  console.log(`After:  [${reorderedLabels.join(', ')}]`)

  // ── Step 7: save the reordered state ─────────────────────────────────────
  await page.getByRole('button', { name: /save teams/i }).click()
  await expect(page.getByText('Teams saved. Panel updates on its next poll.')).toBeVisible({
    timeout: 10_000,
  })

  // ── Step 8: reload, assert new order persists in UI ──────────────────────
  await page.reload()
  await page.waitForLoadState('networkidle')

  const cardFinal = page.locator('[class*="rounded-card"]').filter({ hasText: badge }).first()
  await expect(cardFinal).toBeVisible({ timeout: 10_000 })
  await expect(page.locator(`#add-team-${LEAGUE}`)).toBeVisible({ timeout: 10_000 })
  await expect(cardFinal.locator('button[aria-label^="Remove "]')).toHaveCount(3, {
    timeout: 10_000,
  })

  const persistedLabels: string[] = await cardFinal
    .locator('button[aria-label^="Remove "]')
    .evaluateAll(btns => btns.map(b => b.getAttribute('aria-label')?.replace('Remove ', '') ?? ''))
  // Persisted order must match the reordered order (not the original)
  expect(persistedLabels, 'reloaded UI must show the reordered pill order').toEqual(reorderedLabels)
  expect(persistedLabels, 'reloaded UI must differ from original order').not.toEqual(labelsBefore)

  // ── Step 9: DB assertion — migration 006 persisted contiguous priorities ──
  const { data: finalRows, error: finalErr } = await supabase
    .from('device_favorite_teams')
    .select('team_id, priority')
    .eq('device_id', seededDevice.id)
    .eq('league_id', wnbaLeagueId)
    .order('priority')
  expect(finalErr, 'final DB query').toBeNull()
  expect(finalRows).toHaveLength(3)

  // Priorities must be contiguous 1,2,3 — migration 006 guarantee
  expect(
    finalRows!.map((r: { team_id: string; priority: number }) => r.priority),
    'DB priorities must be 1,2,3 after reorder (migration 006)'
  ).toEqual([1, 2, 3])

  // Team ID sequence in DB must differ from the initial order (reorder was persisted, not just UI)
  const finalTeamIds: string[] = finalRows!.map(
    (r: { team_id: string; priority: number }) => r.team_id
  )
  expect(
    finalTeamIds,
    'DB team_id order must differ from initial (proves reorder persisted)'
  ).not.toEqual(initialTeamIds)

  // All original teams still present — no data loss
  expect(new Set(finalTeamIds), 'same 3 teams must be present in DB after reorder').toEqual(
    new Set(initialTeamIds)
  )
})
