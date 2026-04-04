#!/bin/bash
set -euo pipefail

SERVICE_NAME="wnba-led"
LOG_CHECK_LINES=50

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    log "ERROR: $*" >&2
}

log "Checking systemd service status"
if ! sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    error "Service $SERVICE_NAME is not active"
    sudo systemctl status "$SERVICE_NAME" --no-pager || true
    exit 1
fi

log "Service $SERVICE_NAME is active"

log "Checking process is running"
PID=$(sudo systemctl show -p MainPID --value "$SERVICE_NAME")
if [ -z "$PID" ] || [ "$PID" = "0" ]; then
    error "Service has no running process"
    exit 1
fi

log "Process running with PID: $PID"

log "Scanning last $LOG_CHECK_LINES lines of logs for critical errors"
ERROR_PATTERNS=(
    "Traceback"
    "CRITICAL"
    "FATAL"
    "Exception"
    "failed to start"
)

for pattern in "${ERROR_PATTERNS[@]}"; do
    if sudo journalctl -u "$SERVICE_NAME" -n "$LOG_CHECK_LINES" --no-pager | grep -i "$pattern" | grep -v "health-check"; then
        error "Found critical errors in logs matching pattern: $pattern"
        exit 1
    fi
done

log "No critical errors found in recent logs"

log "Health check passed!"
exit 0
