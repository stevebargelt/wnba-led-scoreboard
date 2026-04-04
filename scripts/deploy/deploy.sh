#!/bin/bash
set -euo pipefail

DEPLOY_DIR="/home/pi/wnba-led-scoreboard"
BACKUP_DIR="/home/pi/wnba-led-scoreboard-backups"
VENV_DIR="$DEPLOY_DIR/.venv"
SERVICE_NAME="wnba-led"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    log "ERROR: $*" >&2
}

cd "$DEPLOY_DIR" || exit 1

log "Starting deployment to Raspberry Pi"
log "Current directory: $(pwd)"
log "Current branch: $(git branch --show-current)"
log "Current commit: $(git rev-parse HEAD)"

log "Creating backup of current state"
TIMESTAMP=$(date +'%Y%m%d_%H%M%S')
BACKUP_PATH="$BACKUP_DIR/backup_$TIMESTAMP"
mkdir -p "$BACKUP_DIR"
CURRENT_COMMIT=$(git rev-parse HEAD)
echo "$CURRENT_COMMIT" > "$BACKUP_PATH.commit"
log "Backup created: $BACKUP_PATH.commit (commit: $CURRENT_COMMIT)"

log "Fetching latest changes from origin"
git fetch origin

log "Pulling latest code from main branch"
PREVIOUS_COMMIT=$(git rev-parse HEAD)
git pull origin main

NEW_COMMIT=$(git rev-parse HEAD)
if [ "$PREVIOUS_COMMIT" = "$NEW_COMMIT" ]; then
    log "No new commits to deploy"
else
    log "Updated from $PREVIOUS_COMMIT to $NEW_COMMIT"
fi

log "Checking for requirements.txt changes"
if git diff "$PREVIOUS_COMMIT" "$NEW_COMMIT" --name-only | grep -q "requirements.txt"; then
    log "requirements.txt changed, updating dependencies"

    if [ ! -d "$VENV_DIR" ]; then
        log "Virtual environment not found, creating new one"
        python3 -m venv "$VENV_DIR"
    fi

    log "Installing/updating Python dependencies"
    "$VENV_DIR/bin/pip" install --upgrade pip
    "$VENV_DIR/bin/pip" install -r requirements.txt
    log "Dependencies updated successfully"
else
    log "No dependency changes detected, skipping pip install"
fi

log "Reloading systemd daemon"
sudo systemctl daemon-reload

log "Restarting $SERVICE_NAME service"
sudo systemctl restart "$SERVICE_NAME"

log "Waiting 5 seconds for service to start"
sleep 5

log "Running health check"
if "$DEPLOY_DIR/scripts/deploy/health-check.sh"; then
    log "Deployment successful!"
    log "New commit: $NEW_COMMIT"
    exit 0
else
    error "Health check failed! Rolling back..."
    "$DEPLOY_DIR/scripts/deploy/rollback.sh"
    exit 1
fi
