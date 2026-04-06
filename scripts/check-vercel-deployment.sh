#!/bin/bash
# Check the status of the latest Vercel deployment for web-admin

set -e

PROJECT_NAME="scoreboard-admin"  # Adjust to actual Vercel project name
TIMEOUT=${1:-300}  # Default 5 minute timeout

echo "Checking Vercel deployment status for $PROJECT_NAME..."

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "Error: vercel CLI not installed"
    echo "Install with: npm install -g vercel"
    exit 1
fi

# Get latest deployment
DEPLOYMENT=$(vercel deployments list --project="$PROJECT_NAME" --limit=1 --json 2>/dev/null)

if [ -z "$DEPLOYMENT" ] || [ "$DEPLOYMENT" == "[]" ]; then
    echo "Error: No deployments found for project $PROJECT_NAME"
    echo "Verify project name with: vercel projects list"
    exit 1
fi

# Extract deployment details
DEPLOYMENT_ID=$(echo "$DEPLOYMENT" | jq -r '.[0].uid')
DEPLOYMENT_URL=$(echo "$DEPLOYMENT" | jq -r '.[0].url')
DEPLOYMENT_STATE=$(echo "$DEPLOYMENT" | jq -r '.[0].state')
CREATED_AT=$(echo "$DEPLOYMENT" | jq -r '.[0].createdAt')

echo "Latest deployment:"
echo "  ID: $DEPLOYMENT_ID"
echo "  URL: https://$DEPLOYMENT_URL"
echo "  State: $DEPLOYMENT_STATE"
echo "  Created: $(date -r $((CREATED_AT / 1000)))"

# Check state
if [ "$DEPLOYMENT_STATE" == "READY" ]; then
    echo "✅ Deployment successful!"
    exit 0
elif [ "$DEPLOYMENT_STATE" == "ERROR" ] || [ "$DEPLOYMENT_STATE" == "CANCELED" ]; then
    echo "❌ Deployment failed with state: $DEPLOYMENT_STATE"
    echo ""
    echo "Get logs with: vercel logs $DEPLOYMENT_URL"
    exit 1
elif [ "$DEPLOYMENT_STATE" == "BUILDING" ] || [ "$DEPLOYMENT_STATE" == "QUEUED" ]; then
    echo "⏳ Deployment in progress (state: $DEPLOYMENT_STATE)"
    echo "Use: scripts/wait-for-vercel-deployment.sh to wait for completion"
    exit 2
else
    echo "⚠️  Unknown deployment state: $DEPLOYMENT_STATE"
    exit 3
fi
