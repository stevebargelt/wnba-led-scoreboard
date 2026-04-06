#!/bin/bash
# Unified deployment status checker - tries Vercel CLI first, falls back to GitHub

set -e

COMMIT_SHA=${1:-HEAD}

echo "Checking deployment status..."
echo ""

# Try Vercel CLI first (faster, more direct)
if command -v vercel &> /dev/null; then
    echo "Using Vercel CLI (primary method)..."
    if scripts/check-vercel-deployment.sh; then
        exit 0
    else
        EXIT_CODE=$?
        # If definitive failure (not just "building"), exit with that code
        if [ $EXIT_CODE -eq 1 ]; then
            exit 1
        fi
        # Otherwise fall through to GitHub check
        echo ""
        echo "Vercel CLI check inconclusive, trying GitHub status checks..."
    fi
else
    echo "Vercel CLI not available, using GitHub status checks (fallback)..."
fi

# Fall back to GitHub checks
scripts/check-github-deployment-status.sh "$COMMIT_SHA"
