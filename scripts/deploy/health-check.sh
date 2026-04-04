#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SERVICE_NAME="${SERVICE_NAME:-wnba-led}"
LOG_LINES="${LOG_LINES:-100}"
TIMEOUT="${TIMEOUT:-10}"

echo "==> Running health check for $SERVICE_NAME service..."

check_systemd_status() {
    echo "Checking systemd service status..."
    if ! systemctl is-active --quiet "$SERVICE_NAME"; then
        echo "ERROR: Service $SERVICE_NAME is not active"
        systemctl status "$SERVICE_NAME" --no-pager || true
        return 1
    fi
    echo "✓ Service is active"
}

check_process_running() {
    echo "Checking if process is running..."
    if ! pgrep -f "python.*app.py" > /dev/null; then
        echo "ERROR: No Python process found running app.py"
        return 1
    fi
    echo "✓ Process is running"
}

check_logs_for_errors() {
    echo "Scanning last $LOG_LINES lines of logs for critical errors..."

    local error_patterns=(
        'Traceback \(most recent call last\)'
        'Exception:.*Error'
        'CRITICAL:'
        'FATAL:'
        'Unhandled exception'
        'Failed to start'
    )

    local temp_log="/tmp/health-check-$$.log"
    journalctl -u "$SERVICE_NAME" -n "$LOG_LINES" --no-pager > "$temp_log"

    local found_errors=0
    for pattern in "${error_patterns[@]}"; do
        if grep -E -q "$pattern" "$temp_log"; then
            echo "ERROR: Found critical error pattern: $pattern"
            echo "Matched lines with context:"
            grep -E -B 2 -A 2 "$pattern" "$temp_log" || true
            found_errors=1
        fi
    done

    rm -f "$temp_log"

    if [ $found_errors -eq 1 ]; then
        return 1
    fi

    echo "✓ No critical errors found in logs"
}

check_startup_complete() {
    echo "Checking if startup completed successfully..."

    if journalctl -u "$SERVICE_NAME" -n "$LOG_LINES" --no-pager | \
       grep -E -q '(Started successfully|Initialization complete|Ready to process)'; then
        echo "✓ Startup completed successfully"
        return 0
    fi

    echo "WARNING: No startup completion message found (service may still be starting)"
    return 0
}

main() {
    local exit_code=0

    check_systemd_status || exit_code=1
    check_process_running || exit_code=1
    check_logs_for_errors || exit_code=1
    check_startup_complete || true

    if [ $exit_code -eq 0 ]; then
        echo "==> Health check PASSED"
    else
        echo "==> Health check FAILED"
    fi

    return $exit_code
}

main "$@"
