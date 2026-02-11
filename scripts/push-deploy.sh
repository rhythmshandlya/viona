#!/bin/bash
set -e

# Push to main and deploy to Railway
# Usage: ./scripts/push-deploy.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Not on main branch. Current branch: $CURRENT_BRANCH"
    read -p "Merge to main and push? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git checkout main
        git merge "$CURRENT_BRANCH"
    else
        echo "Aborted."
        exit 1
    fi
fi

echo "📤 Pushing to main..."
git push origin main

echo ""
echo "🚀 Starting deployment..."
"$SCRIPT_DIR/deploy.sh"
