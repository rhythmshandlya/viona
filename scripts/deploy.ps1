# Cllipify Railway Deployment Script (PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "🚀 Cllipify Railway Deployment Script" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Check if Railway CLI is installed
try {
    railway --version | Out-Null
} catch {
    Write-Host "❌ Railway CLI is not installed. Install it with: npm install -g @railway/cli" -ForegroundColor Red
    exit 1
}

# Check if logged in
try {
    railway whoami | Out-Null
} catch {
    Write-Host "❌ Not logged into Railway. Run: railway login" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Railway CLI ready" -ForegroundColor Green

# Link to project
$PROJECT_ID = "84a07d3b-cbeb-42ce-a189-bd3516d59879"
Write-Host "`n📎 Linking to cllipify project..." -ForegroundColor Yellow
railway link --project $PROJECT_ID --environment production 2>$null

# Run database migrations
# WARNING: Never hardcode credentials here — use `railway run` to inject env vars from Railway
Write-Host "`n🗄️  Running database migrations..." -ForegroundColor Yellow
railway run pnpm db:migrate
Write-Host "✅ Migrations complete" -ForegroundColor Green

# Deploy services
Write-Host "`n🚢 Deploying services..." -ForegroundColor Yellow

Write-Host "  → Deploying web..." -ForegroundColor White
railway up --service web --detach

Write-Host "  → Deploying api..." -ForegroundColor White
railway up --service api --detach

Write-Host "  → Deploying worker..." -ForegroundColor White
railway up --service worker --detach

Write-Host "`n✅ All services deployed!" -ForegroundColor Green
Write-Host ""
Write-Host "🔧 Sandbox Pipeline:" -ForegroundColor Cyan
Write-Host "   Sandbox services are created dynamically by the API." -ForegroundColor White
Write-Host "   Ensure these env vars are set on the API service:" -ForegroundColor White
Write-Host "     SANDBOX_PROVIDER=railway" -ForegroundColor Gray
Write-Host "     RAILWAY_API_TOKEN=<your-token>" -ForegroundColor Gray
Write-Host "     RAILWAY_ENVIRONMENT_ID=<env-id>" -ForegroundColor Gray
Write-Host "     ANTHROPIC_API_KEY=<your-key>" -ForegroundColor Gray
Write-Host ""
Write-Host "📊 Monitor deployments at:" -ForegroundColor Cyan
Write-Host "   https://railway.com/project/$PROJECT_ID"
Write-Host ""
Write-Host "🌐 Service URLs:" -ForegroundColor Cyan
Write-Host "   Web:    https://web-production-7b3a.up.railway.app"
Write-Host "   API:    https://api-production-18ab.up.railway.app"
