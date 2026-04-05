# E2E CI Setup Guide

This document describes the manual configuration steps required to complete the E2E test CI integration.

## Prerequisites

- GitHub repository admin access
- Supabase project with test user created

## 1. Configure GitHub Secrets

Add the following secrets to the repository:

**Path:** Settings → Secrets and variables → Actions → New repository secret

### Required Secrets

| Secret Name | Description | Example Value |
|------------|-------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbG...` |
| `TEST_USER_EMAIL` | Test user email for E2E authentication | `test@example.com` |
| `TEST_USER_PASSWORD` | Test user password | `SecureTestPassword123!` |

### How to Add Secrets

1. Navigate to repository Settings
2. Click "Secrets and variables" → "Actions"
3. Click "New repository secret"
4. Enter secret name and value
5. Click "Add secret"
6. Repeat for all required secrets

## 2. Configure Branch Protection Rules

Ensure E2E tests are required for PRs to merge.

**Path:** Settings → Branches → Branch protection rules → main → Edit

### Required Settings

1. **Require status checks to pass before merging**: ✅ Enabled
2. **Require branches to be up to date before merging**: ✅ Enabled (recommended)
3. **Status checks that are required**:
   - Search for and select: `Playwright E2E Tests`
   - Also ensure existing checks remain selected (Test Suite, Build Application, etc.)

### How to Configure

1. Navigate to repository Settings
2. Click "Branches" in the left sidebar
3. Find the `main` branch protection rule
4. Click "Edit" (or "Add rule" if none exists)
5. Enable "Require status checks to pass before merging"
6. In the search box, type: `Playwright E2E Tests`
7. Click on the check to add it to required checks
8. Scroll down and click "Save changes"

## 3. Verify Setup

After completing the above steps, verify the integration:

1. Create a test PR with a small change to `web-admin/`
2. Observe that the "E2E Tests" workflow appears in the PR checks
3. Verify that the workflow runs successfully (once Playwright is fully set up)
4. Confirm that the PR cannot be merged if E2E tests fail

## Troubleshooting

### Workflow Not Running

- **Issue**: E2E workflow doesn't trigger on PRs
- **Check**: Verify the workflow file exists at `.github/workflows/e2e-tests.yml`
- **Check**: Ensure PR modifies files in `web-admin/` directory

### Missing Status Check

- **Issue**: "Playwright E2E Tests" not appearing in branch protection options
- **Solution**: The check only appears after the workflow runs at least once. Push to main or create a test PR to trigger it first.

### Authentication Failures

- **Issue**: E2E tests fail with auth errors
- **Check**: Verify `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` secrets are set correctly
- **Check**: Confirm test user exists in Supabase Auth
- **Check**: Verify Supabase URL and anon key are correct

### Playwright Installation Fails

- **Issue**: "npx playwright install" step fails
- **Check**: Ensure `@playwright/test` is in `web-admin/package.json` dependencies
- **Check**: Verify `package-lock.json` is committed and up to date

## Related Documentation

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [GitHub Actions - Workflow syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [GitHub Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

## Maintenance

### Updating Test User Credentials

If test credentials need to be rotated:

1. Create new test user in Supabase Auth
2. Update `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` secrets
3. Delete old test user (optional, but recommended for security)

### Adding Additional Secrets

If new E2E tests require additional configuration:

1. Add secrets to GitHub repository settings
2. Reference them in `.github/workflows/e2e-tests.yml` env section
3. Update this documentation with the new requirements
