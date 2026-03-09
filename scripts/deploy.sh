#!/bin/bash
set -e

echo "🚀 Cllipify Railway Deployment Script"
echo "======================================"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed. Install it with: npm install -g @railway/cli"
    exit 1
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged into Railway. Run: railway login"
    exit 1
fi

echo "✅ Railway CLI ready"

# Link to project if not already linked
PROJECT_ID="84a07d3b-cbeb-42ce-a189-bd3516d59879"
echo "📎 Linking to cllipify project..."
railway link --project $PROJECT_ID --environment production 2>/dev/null || true

# Run database migrations
# WARNING: Never hardcode credentials here — use `railway run` to inject env vars from Railway
echo ""
echo "🗄️  Running database migrations..."
railway run pnpm db:migrate
echo "✅ Migrations complete"

# Deploy services
echo ""
echo "🚢 Deploying services..."

echo "  → Deploying web..."
railway up --service web --detach

echo "  → Deploying api..."
railway up --service api --detach

echo "  → Deploying worker..."
railway up --service worker --detach

echo ""
echo "✅ All services deployed!"
echo ""
echo "📊 Monitor deployments at:"
echo "   https://railway.com/project/$PROJECT_ID"
echo ""
echo "🌐 Service URLs:"
echo "   Web:    https://web-production-7b3a.up.railway.app"
echo "   API:    https://api-production-18ab.up.railway.app"
