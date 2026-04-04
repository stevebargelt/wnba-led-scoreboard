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

## Additional Resources

- [Tailscale GitHub Action](https://github.com/tailscale/github-action)
- [Tailscale SSH Guide](https://tailscale.com/kb/1193/tailscale-ssh/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Systemd Service Management](https://www.freedesktop.org/software/systemd/man/systemctl.html)
