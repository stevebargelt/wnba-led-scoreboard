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

LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.commit 2>/dev/null | head -n1)

if [ -z "$LATEST_BACKUP" ]; then
    error "No backup found to roll back to"
    exit 1
fi

ROLLBACK_COMMIT=$(cat "$LATEST_BACKUP")
log "Rolling back to commit: $ROLLBACK_COMMIT"
log "Backup file: $LATEST_BACKUP"

CURRENT_COMMIT=$(git rev-parse HEAD)
log "Current commit: $CURRENT_COMMIT"

if [ "$CURRENT_COMMIT" = "$ROLLBACK_COMMIT" ]; then
    log "Already at rollback commit, nothing to do"
    log "Restarting service anyway"
    sudo systemctl restart "$SERVICE_NAME"
    exit 0
fi

log "Performing git reset to previous commit"
git reset --hard "$ROLLBACK_COMMIT"

log "Checking for requirements.txt changes between commits"
if git diff "$ROLLBACK_COMMIT" "$CURRENT_COMMIT" --name-only | grep -q "requirements.txt"; then
    log "requirements.txt changed, restoring dependencies"

    if [ ! -d "$VENV_DIR" ]; then
        log "Virtual environment not found, creating new one"
        python3 -m venv "$VENV_DIR"
    fi

    log "Installing dependencies from rollback commit"
    "$VENV_DIR/bin/pip" install --upgrade pip
    "$VENV_DIR/bin/pip" install -r requirements.txt
    log "Dependencies restored"
else
    log "No dependency changes, skipping pip install"
fi

log "Reloading systemd daemon"
sudo systemctl daemon-reload

log "Restarting $SERVICE_NAME service"
sudo systemctl restart "$SERVICE_NAME"

log "Waiting 5 seconds for service to start"
sleep 5

log "Running health check"
if "$DEPLOY_DIR/scripts/deploy/health-check.sh"; then
    log "Rollback successful!"
    log "Rolled back to: $ROLLBACK_COMMIT"
    exit 0
else
    error "Rollback health check failed!"
    error "Manual intervention required"
    exit 1
fi
