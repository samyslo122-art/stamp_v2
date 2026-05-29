Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Cleaning up environment..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

Get-Process -Id (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
pm2 delete all 2>$null

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Starting School Event Passport..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

Write-Host "Ensuring database container is running..." -ForegroundColor Yellow
docker compose -f "$PSScriptRoot/../docker-compose.yml" up -d postgres

Write-Host "Waiting for PostgreSQL to accept connections..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "Starting PM2 processes..." -ForegroundColor Yellow
Set-Location $PSScriptRoot/..
pm2 start ecosystem.config.js

Write-Host "Waiting for Cloudflare Tunnel to establish..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "School Event Passport is now running!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan

$tunnelUrl = (pm2 logs cloudflare-tunnel --lines 100 --nostream | Select-String "https://.*\.trycloudflare\.com" | Select-Object -Last 1).Matches.Value

if ($tunnelUrl) {
    Write-Host "Public Tunnel URL: $tunnelUrl" -ForegroundColor Green
    Write-Host ""
    Write-Host "Developer Dashboard: $tunnelUrl/developer/login" -ForegroundColor White
    Write-Host "Admin Dashboard:     $tunnelUrl/admin/login" -ForegroundColor White
    Write-Host "Player Entry:        $tunnelUrl/register" -ForegroundColor White
} else {
    Write-Host "Could not extract tunnel URL. Check with: pm2 logs cloudflare-tunnel" -ForegroundColor Red
}