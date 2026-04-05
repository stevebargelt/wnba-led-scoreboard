# Raspberry Pi Deployment Guide

This guide covers automated and manual deployment of the WNBA LED Scoreboard to a Raspberry Pi test device using Tailscale SSH.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Automated Deployment](#automated-deployment)
- [Manual Deployment](#manual-deployment)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

## Architecture Overview

```
┌─────────────────┐      ┌──────────────┐      ┌─────────────────┐
│ GitHub Actions  │─────▶│  Tailscale   │─────▶│  Raspberry Pi   │
│  (CI/CD)        │      │   Network    │      │  (Test Device)  │
└─────────────────┘      └──────────────┘      └─────────────────┘
        │                                              │
        │                                              │
        └─────────── SSH over Tailscale ───────────────┘
```

### Components

- **GitHub Actions**: CI/CD pipeline runner
- **Tailscale**: Secure mesh VPN for SSH access
- **Raspberry Pi**: Test deployment target on local network
- **Deployment Scripts**: Automated deploy, rollback, health-check

## Prerequisites

### On Raspberry Pi

1. **Tailscale installed and authenticated**
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```
   Note the Tailscale hostname (e.g., `raspberrypi.tailnet-name.ts.net`)

2. **SSH server running**
   ```bash
   sudo systemctl enable ssh
   sudo systemctl start ssh
   ```

3. **Deployment SSH key added**
   ```bash
   # On Pi, add the public key to authorized_keys
   mkdir -p ~/.ssh
   echo "ssh-ed25519 AAAA... deploy-key" >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```

4. **Application directory set up**
   ```bash
   cd ~
   git clone https://github.com/stevebargelt/wnba-led-scoreboard.git
   cd wnba-led-scoreboard
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

5. **Systemd service installed**
   ```bash
   sudo cp scripts/systemd/wnba-led.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable wnba-led
   sudo systemctl start wnba-led
   ```

6. **Environment file configured**
   ```bash
   sudo nano /etc/wnba-led.env
   # Add:
   # SUPABASE_URL=https://your-project.supabase.co
   # SUPABASE_ANON_KEY=your-anon-key
   # DEVICE_ID=your-device-uuid
   ```

### On GitHub

You'll need to configure GitHub Actions secrets after completing the initial setup steps below. The secrets are created during setup and then added to GitHub in Step 5.

## Initial Setup

### Step 1: Generate Deployment SSH Key

On your development machine:

```bash
ssh-keygen -t ed25519 -C "deploy-key" -f ~/.ssh/pi_deploy_key -N ""
```

This creates:
- `~/.ssh/pi_deploy_key` (private key - add to GitHub Secrets)
- `~/.ssh/pi_deploy_key.pub` (public key - add to Pi authorized_keys)

### Step 2: Add Public Key to Pi

Copy the public key to the Pi:

```bash
ssh-copy-id -i ~/.ssh/pi_deploy_key.pub pi@raspberrypi.local
```

Or manually:

```bash
cat ~/.ssh/pi_deploy_key.pub
# Copy the output, then on Pi:
echo "ssh-ed25519 AAAA... deploy-key" >> ~/.ssh/authorized_keys
```

### Step 3: Set Up Tailscale OAuth

1. Go to [Tailscale Admin Console](https://login.tailscale.com/admin/settings/oauth)
2. Create a new OAuth client with:
   - **Description**: GitHub Actions CI/CD
   - **Tags**: `tag:ci`

#### OAuth Scopes Required

When creating the OAuth client, select ONLY:
- ✅ **devices:write (core)** - Allows creating ephemeral devices

DO NOT select:
- ❌ devices:write:posture attributes (not needed)
- ❌ devices:write:routes (not needed)
- ❌ devices:write:device invites (not needed)

#### ACL Configuration Required

The OAuth client alone is insufficient - ACLs must also be configured.

Add the following to your Tailscale ACL configuration (Admin Console → Access Controls):

```json
{
  "tagOwners": {
    "tag:ci": ["autogroup:admin"]
  },
  "acls": [
    {
      "action": "accept",
      "src": ["tag:ci"],
      "dst": ["*:*"]
    }
  ]
}
```

This configuration:
- Allows admins to create devices with the `tag:ci` tag
- Grants devices with `tag:ci` access to all network resources

#### Verification Steps

After setting up the OAuth client and ACLs:

1. **Verify OAuth scopes**: Check that the OAuth client shows only `devices:write` scope in the Tailscale admin console
2. **Verify ACL configuration**: Confirm `tag:ci` appears in the ACL `tagOwners` section
3. **Test workflow**: Run a test deployment to ensure the workflow can create ephemeral devices

3. Copy the Client ID and Client Secret to GitHub Secrets

### Step 4: Test SSH Connection

From your development machine:

```bash
ssh -i ~/.ssh/pi_deploy_key pi@raspberrypi.tailnet-name.ts.net "echo 'Connection successful'"
```

If this works, GitHub Actions will work too.

### Step 5: Add Secrets to GitHub

Now that you have generated all the required values, add them to GitHub Actions secrets.

1. Go to repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each of the following secrets:

| Secret Name | Description | Where to Find |
|-------------|-------------|---------------|
| `PI_SSH_KEY` | Private SSH key for deployment | Contents of `~/.ssh/pi_deploy_key` (from Step 1) |
| `PI_SSH_USER` | SSH username on Pi | Your Pi username (typically `pi`) |
| `PI_TAILSCALE_HOST` | Tailscale hostname of Pi | From `sudo tailscale status` on Pi (e.g., `raspberrypi.tailnet-name.ts.net`) |
| `TAILSCALE_OAUTH_CLIENT_ID` | Tailscale OAuth client ID | From Tailscale OAuth client (Step 3) |
| `TAILSCALE_OAUTH_SECRET` | Tailscale OAuth secret | From Tailscale OAuth client (Step 3) |

**Adding the SSH private key:**

```bash
# Copy the entire private key including headers
cat ~/.ssh/pi_deploy_key
```

Copy the complete output (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`) and paste it as the value for `PI_SSH_KEY`.

## Automated Deployment

### Trigger: Push to `develop` Branch

Every push to the `develop` branch automatically triggers deployment:

```bash
git checkout develop
git merge feature/my-feature
git push origin develop
```

Watch the workflow:
```bash
# Or visit: https://github.com/stevebargelt/wnba-led-scoreboard/actions
```

### Trigger: Manual Dispatch

Deploy any branch manually via GitHub UI or CLI:

**Via GitHub UI:**
1. Go to Actions → Deploy to Raspberry Pi
2. Click "Run workflow"
3. Select branch to deploy
4. (Optional) Check "Skip tests" for emergency deploys

**Via GitHub CLI:**

```bash
# Deploy develop branch
gh workflow run deploy-pi.yml

# Deploy specific branch
gh workflow run deploy-pi.yml -f branch=main

# Skip tests (not recommended)
gh workflow run deploy-pi.yml -f branch=develop -f skip_tests=true
```

### What Happens During Deployment

1. **Test Phase** (skipped if `skip_tests=true`)
   - Checkout code
   - Install Python dependencies
   - Run unit tests
   - Check for syntax errors

2. **Deploy Phase**
   - Connect to Tailscale network
   - Set up SSH with deployment key
   - Test SSH connection to Pi
   - Run `scripts/deploy/deploy.sh` on Pi
   - Report deployment status

3. **Rollback Phase** (only if deploy fails)
   - Connect to Tailscale network
   - Set up SSH
   - Run `scripts/deploy/rollback.sh` on Pi
   - Report rollback status

### Deployment Script Behavior

The `deploy.sh` script:
1. Creates backup of current commit hash
2. Pulls latest code from `origin/main`
3. Checks if `requirements.txt` changed
4. Updates dependencies if needed (skipped if unchanged)
5. Reloads systemd daemon
6. Restarts `wnba-led` service
7. Runs health check
8. Rolls back automatically if health check fails

## Manual Deployment

### From Development Machine

If GitHub Actions is unavailable, deploy manually via Tailscale SSH:

```bash
# Connect to Tailscale (if not already connected)
tailscale up

# Deploy via SSH
ssh pi@raspberrypi.tailnet-name.ts.net "bash -s" < ./scripts/deploy/deploy.sh
```

### Directly on Pi

SSH into the Pi and run deployment locally:

```bash
ssh pi@raspberrypi.tailnet-name.ts.net
cd /home/pi/wnba-led-scoreboard
./scripts/deploy/deploy.sh
```

## Rollback Procedures

### Automatic Rollback

If deployment health check fails, rollback happens automatically. No action needed.

### Manual Rollback

If you need to manually rollback to the previous version:

**Via GitHub Actions:**

```bash
gh workflow run deploy-pi.yml -f branch=main -f skip_tests=true
```

Then immediately SSH and rollback:

```bash
ssh pi@raspberrypi.tailnet-name.ts.net \
  "/home/pi/wnba-led-scoreboard/scripts/deploy/rollback.sh"
```

**Directly on Pi:**

```bash
ssh pi@raspberrypi.tailnet-name.ts.net
cd /home/pi/wnba-led-scoreboard
./scripts/deploy/rollback.sh
```

### Rollback to Specific Commit

If you need to rollback to a specific commit (not just the previous one):

```bash
ssh pi@raspberrypi.tailnet-name.ts.net
cd /home/pi/wnba-led-scoreboard
git reset --hard <commit-hash>
sudo systemctl restart wnba-led
./scripts/deploy/health-check.sh
```

## Troubleshooting

### Deployment Fails: SSH Connection Timeout

**Symptom**: GitHub Actions can't connect to Pi

**Causes**:
- Tailscale OAuth credentials expired
- Pi is offline or Tailscale daemon stopped
- SSH server not running on Pi

**Solutions**:

1. Check Pi is online:
   ```bash
   tailscale status | grep raspberrypi
   ```

2. Verify Tailscale is running on Pi:
   ```bash
   ssh pi@raspberrypi.local "sudo systemctl status tailscaled"
   ```

3. Restart Tailscale on Pi:
   ```bash
   ssh pi@raspberrypi.local "sudo systemctl restart tailscaled"
   ```

4. Check SSH server:
   ```bash
   ssh pi@raspberrypi.local "sudo systemctl status ssh"
   ```

### Deployment Fails: Health Check Errors

**Symptom**: Deployment completes but health check fails, triggers rollback

**Causes**:
- Service failed to start (syntax error, missing dependencies)
- Configuration error (missing .env file)
- Hardware issues (LED matrix not connected in test mode)

**Solutions**:

1. Check service status:
   ```bash
   ssh pi@raspberrypi.tailnet-name.ts.net "sudo systemctl status wnba-led"
   ```

2. Check recent logs:
   ```bash
   ssh pi@raspberrypi.tailnet-name.ts.net "sudo journalctl -u wnba-led -n 50 --no-pager"
   ```

3. Run app manually to see errors:
   ```bash
   ssh pi@raspberrypi.tailnet-name.ts.net
   cd /home/pi/wnba-led-scoreboard
   source .venv/bin/activate
   python app.py --sim --once
   ```

### Deployment Fails: Dependency Installation

**Symptom**: `pip install` fails during deployment

**Causes**:
- Network issues
- Incompatible dependencies
- Disk space full

**Solutions**:

1. Check disk space:
   ```bash
   ssh pi@raspberrypi.tailnet-name.ts.net "df -h"
   ```

2. Clear pip cache:
   ```bash
   ssh pi@raspberrypi.tailnet-name.ts.net "pip cache purge"
   ```

3. Manually test dependency installation:
   ```bash
   ssh pi@raspberrypi.tailnet-name.ts.net
   cd /home/pi/wnba-led-scoreboard
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

### Manual Health Check

Run health check manually:

```bash
ssh pi@raspberrypi.tailnet-name.ts.net \
  "/home/pi/wnba-led-scoreboard/scripts/deploy/health-check.sh"
```

Expected output:
```
[2024-04-03 14:30:15] Checking systemd service status
[2024-04-03 14:30:15] Service wnba-led is active
[2024-04-03 14:30:15] Checking process is running
[2024-04-03 14:30:15] Process running with PID: 12345
[2024-04-03 14:30:15] Scanning last 50 lines of logs for critical errors
[2024-04-03 14:30:16] No critical errors found in recent logs
[2024-04-03 14:30:16] Health check passed!
```

## Maintenance

### View Deployment History

Backups are stored in `/home/pi/wnba-led-scoreboard-backups/`:

```bash
ssh pi@raspberrypi.tailnet-name.ts.net "ls -lht /home/pi/wnba-led-scoreboard-backups/"
```

Each backup file (`backup_YYYYMMDD_HHMMSS.commit`) contains the commit hash of that deployment.

### Clean Up Old Backups

Keep only the last 10 backups:

```bash
ssh pi@raspberrypi.tailnet-name.ts.net "
  cd /home/pi/wnba-led-scoreboard-backups && \
  ls -t *.commit | tail -n +11 | xargs rm -f
"
```

### Rotate Deployment SSH Keys

1. Generate new key pair (see Initial Setup)
2. Add new public key to Pi `authorized_keys`
3. Update `PI_SSH_KEY` secret in GitHub
4. Test deployment with new key
5. Remove old public key from Pi

### Update Tailscale OAuth Credentials

If OAuth credentials expire:

1. Go to [Tailscale Admin Console](https://login.tailscale.com/admin/settings/oauth)
2. Revoke old OAuth client
3. Create new OAuth client
4. Update `TAILSCALE_OAUTH_CLIENT_ID` and `TAILSCALE_OAUTH_SECRET` in GitHub Secrets

## Security Considerations

1. **SSH Key Security**
   - Use ed25519 keys (more secure than RSA)
   - Never reuse production keys for test deployments
   - Rotate keys every 90 days

2. **Tailscale Network**
   - Use OAuth with `tag:ci` to limit permissions
   - Never use personal Tailscale credentials in GitHub
   - Enable MFA on Tailscale admin account

3. **GitHub Secrets**
   - Never log secrets in workflow output
   - Rotate secrets every 90 days
   - Use environment protection rules for production

4. **Pi Security**
   - Keep SSH keys in `~/.ssh/authorized_keys` only
   - Disable password authentication (key-only)
   - Run `sudo apt update && sudo apt upgrade` regularly

## E2E Tests CI Setup

The project includes automated end-to-end tests using Playwright that run on every pull request and push to main.

### Overview

E2E tests verify the web admin interface works correctly by:
- Testing authentication flows
- Verifying device configuration pages
- Testing team management features
- Generating preview images
- Running smoke tests on critical paths

### Prerequisites

Before E2E tests can run in CI, you need:

1. **Supabase Project**: A Supabase project with the database schema set up
2. **Test User Account**: A test user created in Supabase Auth
3. **GitHub Secrets Configured**: Required secrets added to repository

### GitHub Secrets Setup

Add the following secrets to your GitHub repository (Settings → Secrets and variables → Actions → New repository secret):

| Secret Name | Description | Where to Find |
|-------------|-------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Supabase Project Settings → API → Project API keys → `anon` `public` |
| `TEST_USER_EMAIL` | Test user email | Email used to create test account (Step 1 below) |
| `TEST_USER_PASSWORD` | Test user password | Password used to create test account (Step 1 below) |

### Step 1: Create Test User Account

In your Supabase project:

1. Go to Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter test credentials:
   - Email: `test@example.com` (or your preferred test email)
   - Password: Generate a secure password (save this for GitHub Secrets)
   - Auto Confirm User: ✅ Enabled
4. Click "Create user"
5. Note the user's UUID (you may need it for test data setup)

**Important**: Use a dedicated test account, not a production user.

### Step 2: Create Test Device

The test user needs at least one device to configure during tests:

**Option A: Via Web Admin UI**
1. Log in to web admin as test user
2. Navigate to device management
3. Create a test device
4. Note the device ID

**Option B: Via Supabase SQL Editor**

```sql
-- Insert test device owned by test user
INSERT INTO devices (id, user_id, name, location)
VALUES (
  gen_random_uuid(),
  'test-user-uuid-from-step-1',
  'Test Device',
  'CI Environment'
);
```

### Step 3: Configure GitHub Secrets

Add each secret to GitHub:

```bash
# Example values (use your actual values)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=SecureTestPassword123!
```

### Step 4: Verify Workflow Runs

After adding secrets, test the workflow:

1. Create a test branch and make a small change to `web-admin/**`
2. Push the branch and create a pull request
3. GitHub Actions should automatically run the E2E tests
4. Check the workflow run in the Actions tab

Expected workflow behavior:
- ✅ Installs dependencies and Playwright browsers
- ✅ Starts Next.js dev server on port 3000
- ✅ Runs all E2E tests in chromium
- ✅ Uploads test results/screenshots on failure
- ✅ Completes in under 5 minutes

### Workflow Configuration

The E2E tests workflow (`.github/workflows/e2e-tests.yml`) includes several optimizations:

**Speed Optimizations:**
- Caches `node_modules` via `cache: 'npm'`
- Only installs chromium browser (not all 3)
- Runs tests in parallel via `fullyParallel: true` in playwright.config.ts
- Has 10-minute timeout to catch hanging tests
- Skips tests for non-web-admin changes

**Reliability Features:**
- Retries failed tests twice in CI (`retries: 2`)
- Captures screenshots on failure
- Captures videos on failure
- Uploads artifacts for 7 days
- Uses `forbidOnly: true` to prevent accidental `.only()` commits

### Supabase Test Database Options

You have two options for the Supabase database used in E2E tests:

**Option 1: Shared Test Project (Recommended)**
- Use the same Supabase project as development
- Tests use a dedicated test user account
- Simpler setup, no additional Supabase project needed
- Test data is isolated to test user via RLS policies
- **Caution**: Tests may create/modify data

**Option 2: Separate Test Project**
- Create a dedicated Supabase project for E2E tests
- Complete isolation from development data
- Requires maintaining duplicate schema migrations
- Higher cost (additional Supabase project)
- Better for production-level CI

For most use cases, **Option 1** is sufficient because:
- RLS policies isolate test user data
- Tests clean up after themselves
- No risk of affecting other users' data

### Branch Protection Rules

To require E2E tests to pass before merging:

1. Go to repository **Settings → Branches**
2. Click **Add branch protection rule**
3. Branch name pattern: `main`
4. Enable **"Require status checks to pass before merging"**
5. Search for and select: **"Playwright E2E Tests"**
6. Enable **"Require branches to be up to date before merging"** (recommended)
7. Click **Create** or **Save changes**

This ensures:
- All PRs must have passing E2E tests before merge
- No direct pushes to main bypass E2E tests
- Broken changes cannot be merged

### Troubleshooting

#### Tests Fail: Authentication Errors

**Symptom**: Tests fail with "Invalid login credentials" or auth errors

**Causes**:
- Test user not created in Supabase Auth
- Incorrect `TEST_USER_EMAIL` or `TEST_USER_PASSWORD` secrets
- Test user not confirmed (Auto Confirm User disabled)

**Solutions**:
1. Verify test user exists in Supabase Auth
2. Check secrets match the test user credentials
3. Ensure "Auto Confirm User" was enabled

#### Tests Fail: Supabase Connection Errors

**Symptom**: Tests fail with "Failed to fetch" or connection timeout

**Causes**:
- Incorrect `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Supabase project paused/disabled
- Network issues in GitHub Actions runner

**Solutions**:
1. Verify secrets match Supabase Project Settings → API
2. Check Supabase project is active (not paused)
3. Test the endpoint manually: `curl https://your-project.supabase.co/rest/v1/`

#### Tests Timeout or Hang

**Symptom**: Workflow times out at 10 minutes

**Causes**:
- Next.js dev server failed to start
- Tests waiting for elements that never appear
- Network requests hanging

**Solutions**:
1. Check workflow logs for dev server startup errors
2. Run tests locally: `cd web-admin && npm run test:e2e`
3. Increase `timeout` in individual test files if needed
4. Check for infinite loading states in UI

#### Workflow Not Triggering

**Symptom**: E2E tests workflow doesn't run on PR

**Causes**:
- Changes outside `web-admin/**` directory
- Workflow file path filter excludes the changes
- Workflow disabled in Actions settings

**Solutions**:
1. Check if PR changes affect `web-admin/**` or `.github/workflows/e2e-tests.yml`
2. Manually trigger workflow via Actions tab → E2E Tests → Run workflow
3. Verify workflow is enabled in Settings → Actions

### Cost Considerations

Running E2E tests in CI incurs minimal costs:

**GitHub Actions:**
- Free for public repositories
- 2,000 minutes/month free for private repos
- E2E tests run ~3-5 minutes per run
- Estimate: 400-600 test runs per month within free tier

**Supabase:**
- Free tier includes 500MB database, 50,000 monthly active users
- Test runs create minimal data (<1KB per run)
- Shared test project has no additional cost
- Separate test project: $25/month for Pro plan

**Recommendation**: Use shared Supabase project and GitHub's free tier unless you exceed limits.

## Additional Resources

- [Tailscale GitHub Action](https://github.com/tailscale/github-action)
- [Tailscale SSH Guide](https://tailscale.com/kb/1193/tailscale-ssh/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Systemd Service Management](https://www.freedesktop.org/software/systemd/man/systemctl.html)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright GitHub Actions Guide](https://playwright.dev/docs/ci-intro)
