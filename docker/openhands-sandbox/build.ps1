# Build the OpenHands sandbox Docker image (Windows)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "Building clipify-openhands-sandbox image..." -ForegroundColor Cyan

docker build -t clipify-openhands-sandbox:latest .

Write-Host ""
Write-Host "Build complete!" -ForegroundColor Green
Write-Host "Image: clipify-openhands-sandbox:latest"
Write-Host ""
Write-Host "To test the image:"
Write-Host "  docker run --rm -it clipify-openhands-sandbox:latest python --version"
