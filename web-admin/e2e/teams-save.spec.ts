import { test, expect } from './fixtures'

// WNBA is a guaranteed is_active league (seed 003), and the initialize_device_leagues
// trigger seeds every new device with all leagues disabled — so a freshly-seeded
// device already renders a disabled WNBA card. No pre-seed needed.
const LEAGUE_CODE = 'wnba'

test('teams-save round-trip: enable league, add team, save, reload, verify persistence', async ({
  page,
  seededDevice,
}) => {
  await page.goto(`/device/${seededDevice.id}`)
  await page.waitForLoadState('networkidle')

  const badge = LEAGUE_CODE.toUpperCase()
  const leagueCard = page.locator('[class*="rounded-card"]').filter({ hasText: badge }).first()
  await expect(leagueCard).toBeVisible({ timeout: 10_000 })

  // Enable the league (seeded disabled); the "Add team…" input appears only when enabled.
  await leagueCard.locator('button').first().click()
  const addTeamInput = page.locator(`#add-team-${LEAGUE_CODE}`)
  await expect(addTeamInput).toBeVisible({ timeout: 5_000 })

  // Discover a real team from the datalist (no hardcoding).
  const datalistId = `teams-${LEAGUE_CODE}`
  await page.waitForFunction(
    id => {
      const dl = document.getElementById(id)
      return dl !== null && dl.querySelectorAll('option').length > 0
    },
    datalistId,
    { timeout: 10_000 }
  )
  const teamName = await page.evaluate(id => {
    const dl = document.getElementById(id)
    return dl?.querySelector('option')?.getAttribute('value') ?? null
  }, datalistId)
  expect(teamName, `datalist #${datalistId} should expose at least one team option`).not.toBeNull()

  // Add the favorite, then save.
  await addTeamInput.fill(teamName!)
  await expect(leagueCard.locator('button[aria-label^="Remove "]')).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: /save teams/i }).click()
  await expect(page.getByText('Teams saved. Panel updates on its next poll.')).toBeVisible({
    timeout: 10_000,
  })

  // Reload and verify it persisted (served from the DB, proving save_device_teams wrote it).
  await page.reload()
  await page.waitForLoadState('networkidle')
  const cardAfter = page.locator('[class*="rounded-card"]').filter({ hasText: badge }).first()
  await expect(cardAfter).toBeVisible({ timeout: 10_000 })
  // League still enabled (the input only renders when enabled):
  await expect(page.locator(`#add-team-${LEAGUE_CODE}`)).toBeVisible({ timeout: 10_000 })
  // Favorite chip still present:
  await expect(cardAfter.locator('button[aria-label^="Remove "]')).toBeVisible({ timeout: 10_000 })
  await expect(cardAfter.getByText(teamName!)).toBeVisible({ timeout: 5_000 })
})
