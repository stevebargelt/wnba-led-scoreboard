#!/bin/bash
# Check Vercel deployment status via GitHub commit checks

set -e

COMMIT_SHA=${1:-HEAD}
REPO="stevebargelt/wnba-led-scoreboard"

echo "Checking GitHub deployment status for commit: $COMMIT_SHA"

# Resolve HEAD to actual SHA if needed
if [ "$COMMIT_SHA" == "HEAD" ]; then
    COMMIT_SHA=$(git rev-parse HEAD)
fi

echo "Resolved SHA: $COMMIT_SHA"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "Error: gh CLI not installed"
    exit 1
fi

# Get commit status
STATUS_JSON=$(gh api "repos/$REPO/commits/$COMMIT_SHA/status" 2>/dev/null)

if [ -z "$STATUS_JSON" ]; then
    echo "Error: Could not fetch commit status from GitHub"
    exit 1
fi

# Extract Vercel status checks
VERCEL_CHECKS=$(echo "$STATUS_JSON" | jq '[.statuses[] | select(.context | startswith("vercel"))]')
VERCEL_COUNT=$(echo "$VERCEL_CHECKS" | jq 'length')

if [ "$VERCEL_COUNT" -eq 0 ]; then
    echo "⚠️  No Vercel status checks found for this commit"
    echo "Either deployment hasn't started yet, or commit hasn't been pushed"
    exit 2
fi

echo "Found $VERCEL_COUNT Vercel status check(s):"
echo "$VERCEL_CHECKS" | jq -r '.[] | "  - \(.context): \(.state) - \(.description)"'

# Check if all Vercel checks passed
FAILED_CHECKS=$(echo "$VERCEL_CHECKS" | jq '[.[] | select(.state == "failure" or .state == "error")] | length')
PENDING_CHECKS=$(echo "$VERCEL_CHECKS" | jq '[.[] | select(.state == "pending")] | length')
SUCCESS_CHECKS=$(echo "$VERCEL_CHECKS" | jq '[.[] | select(.state == "success")] | length')

echo ""
echo "Status: ✅ $SUCCESS_CHECKS success, ⏳ $PENDING_CHECKS pending, ❌ $FAILED_CHECKS failed"

if [ "$FAILED_CHECKS" -gt 0 ]; then
    echo ""
    echo "❌ Deployment failed!"
    echo "Failed checks:"
    echo "$VERCEL_CHECKS" | jq -r '.[] | select(.state == "failure" or .state == "error") | "  - \(.context): \(.description)\n    URL: \(.target_url)"'
    exit 1
elif [ "$PENDING_CHECKS" -gt 0 ]; then
    echo ""
    echo "⏳ Deployment still in progress"
    exit 2
else
    echo ""
    echo "✅ All Vercel deployments successful!"

    # Show deployment URLs
    echo ""
    echo "Deployment URLs:"
    echo "$VERCEL_CHECKS" | jq -r '.[] | select(.state == "success") | "  - \(.target_url)"'
    exit 0
fi
