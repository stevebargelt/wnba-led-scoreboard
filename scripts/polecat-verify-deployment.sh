#!/bin/bash
# Polecat deployment verification step
# Called after git push, before gt done

set -e

echo "========================================="
echo "DEPLOYMENT VERIFICATION"
echo "========================================="
echo ""

# Check if this push includes web-admin changes
WEB_ADMIN_CHANGED=$(git diff HEAD~1 HEAD --name-only | grep -c "^web-admin/" || true)

if [ "$WEB_ADMIN_CHANGED" -eq 0 ]; then
    echo "ℹ️  No web-admin changes detected, skipping Vercel deployment check"
    exit 0
fi

echo "✅ Web-admin changes detected ($WEB_ADMIN_CHANGED files)"
echo "Verifying Vercel deployment..."
echo ""

# Wait for deployment to complete (5 minute timeout)
if scripts/check-vercel-deployment.sh; then
    echo ""
    echo "========================================="
    echo "✅ DEPLOYMENT VERIFIED"
    echo "========================================="
    exit 0
else
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 2 ]; then
        # Deployment still in progress, wait for it
        echo ""
        echo "Deployment in progress, waiting for completion..."

        if scripts/wait-for-vercel-deployment.sh 300; then
            echo ""
            echo "========================================="
            echo "✅ DEPLOYMENT VERIFIED (after wait)"
            echo "========================================="
            exit 0
        else
            echo ""
            echo "========================================="
            echo "❌ DEPLOYMENT VERIFICATION FAILED"
            echo "========================================="
            exit 1
        fi
    else
        echo ""
        echo "========================================="
        echo "❌ DEPLOYMENT VERIFICATION FAILED"
        echo "========================================="
        exit 1
    fi
fi
