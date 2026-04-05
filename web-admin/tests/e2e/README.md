# E2E Testing with Playwright

End-to-end testing infrastructure for the WNBA LED Scoreboard web admin interface.

## Running Tests Locally

### Run all tests

```bash
npm run test:e2e
```

### Run tests in UI mode (interactive)

```bash
npm run test:e2e:ui
```

### Run tests in debug mode

```bash
npm run test:e2e:debug
```

### Run specific test file

```bash
npx playwright test auth.spec.ts
```

### Run tests in headed mode (see browser)

```bash
npx playwright test --headed
```

## Prerequisites

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Install Playwright browsers:

   ```bash
   npx playwright install chromium
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Configure Supabase credentials
   - Set test user credentials (optional, defaults provided):
     ```bash
     TEST_USER_EMAIL=test@example.com
     TEST_USER_PASSWORD=testpassword123
     ```
   - The global setup will attempt to create this user automatically

## Project Structure

```
tests/e2e/
├── fixtures/           # Test fixtures and helpers
│   └── auth.ts        # Authentication helpers
├── auth.spec.ts       # Authentication flow tests
├── device-config.spec.ts  # Device configuration tests
├── teams.spec.ts      # Team management tests
├── preview.spec.ts    # Preview functionality tests
└── README.md          # This file
```

## Writing New Tests

### Basic test structure

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Expected Title/)
  })
})
```

### Using authenticated fixtures

```typescript
import { test } from './fixtures/auth'

test.describe('Authenticated Feature', () => {
  test('should access protected page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard')
    // Test authenticated functionality
  })
})
```

### Page Object Model

For complex pages, create page objects in `fixtures/`:

```typescript
export class DashboardPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/dashboard')
  }

  async clickAddDevice() {
    await this.page.click('[data-testid="add-device"]')
  }
}
```

## Debugging Tests

### Debug specific test

```bash
npx playwright test --debug auth.spec.ts
```

### Debug with specific browser

```bash
npx playwright test --debug --project=chromium
```

### View test traces

After a test failure with trace enabled:

```bash
npx playwright show-trace test-results/trace.zip
```

### Enable verbose logging

```bash
DEBUG=pw:api npx playwright test
```

## CI Integration

Tests run automatically in CI with:

- 2 retries on failure
- Single worker (no parallelization)
- Chromium only
- HTML reports uploaded as artifacts

### Environment Variables

Set in CI:

- `CI=true` - Enables CI mode
- `PLAYWRIGHT_BASE_URL` - Base URL for tests (optional)

## Best Practices

### Test Independence

Each test should:

- Set up its own data
- Clean up after itself
- Not depend on other tests

### Selectors

Prefer in order:

1. `data-testid` attributes
2. Role-based selectors (`getByRole`)
3. Text content (`getByText`)
4. CSS selectors (last resort)

Example:

```typescript
await page.getByRole('button', { name: 'Submit' }).click()
await page.getByTestId('device-name-input').fill('Test Device')
```

### Assertions

Use Playwright's auto-waiting assertions:

```typescript
await expect(page.getByText('Success')).toBeVisible()
await expect(page.locator('.error')).toHaveCount(0)
```

### Screenshots

Screenshots are automatically captured on failure. Manual capture:

```typescript
await page.screenshot({ path: 'screenshot.png' })
```

## Configuration

Edit `playwright.config.ts` to:

- Add more browsers/devices
- Adjust timeout values
- Change test directory
- Configure reporters
- Set global test options

## Troubleshooting

### Tests timing out

Increase timeout in test:

```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(60000) // 60 seconds
  // ...
})
```

### Browser not found

Reinstall browsers:

```bash
npx playwright install --force
```

### Port already in use

Change port in `playwright.config.ts`:

```typescript
webServer: {
  command: 'npm run dev -- -p 3001',
  url: 'http://localhost:3001',
}
```

### Flaky tests

- Add explicit waits: `await page.waitForLoadState('networkidle')`
- Use `toPass` for retrying assertions
- Check for race conditions

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [Test Fixtures](https://playwright.dev/docs/test-fixtures)
