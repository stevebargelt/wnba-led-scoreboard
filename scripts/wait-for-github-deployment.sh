#!/bin/bash
# Wait for Vercel deployment to complete using GitHub status checks

set -e

COMMIT_SHA=${1:-HEAD}
TIMEOUT=${2:-300}  # Default 5 minutes
POLL_INTERVAL=10   # Check every 10 seconds

if [ "$COMMIT_SHA" == "HEAD" ]; then
    COMMIT_SHA=$(git rev-parse HEAD)
fi

echo "Waiting for deployment of commit $COMMIT_SHA (timeout: ${TIMEOUT}s)..."

START_TIME=$(date +%s)

while true; do
    ELAPSED=$(($(date +%s) - START_TIME))

    if [ $ELAPSED -ge $TIMEOUT ]; then
        echo "❌ Timeout after ${TIMEOUT}s"
        exit 1
    fi

    # Run check script
    if scripts/check-github-deployment-status.sh "$COMMIT_SHA"; then
        echo "✅ Deployment ready after ${ELAPSED}s"
        exit 0
    fi

    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 1 ]; then
        # Deployment failed
        echo "❌ Deployment failed"
        exit 1
    elif [ $EXIT_CODE -eq 2 ]; then
        # Still building or no checks yet, continue waiting
        echo "⏳ Still deploying... (${ELAPSED}s elapsed)"
        sleep $POLL_INTERVAL
    else
        # Unknown state
        echo "⚠️  Unknown state, continuing..."
        sleep $POLL_INTERVAL
    fi
done
