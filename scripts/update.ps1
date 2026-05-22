param(
    [switch]$WithSchema
)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Updating School Event Passport..." -ForegroundColor Cyan
Write-Host "Tunnel will remain running — URL stays the same" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

Set-Location $PSScriptRoot/..

# 1. Pull latest code
Write-Host ""
Write-Host "[1/4] Pulling latest code from git..." -ForegroundColor Yellow
git pull
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git pull failed. Aborting." -ForegroundColor Red
    exit 1
}

# 2. Install dependencies
Write-Host ""
Write-Host "[2/4] Installing npm dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "npm install failed. Aborting." -ForegroundColor Red
    exit 1
}

# 3. (Optional) Run DB schema init
if ($WithSchema) {
    Write-Host ""
    Write-Host "[3/4] Initializing database schema..." -ForegroundColor Yellow
    node -e "require('./db').initSchema()"
}

# 4. Restart the app only (tunnel stays alive)
Write-Host ""
$step = $(if ($WithSchema) { '4' } else { '3' })
Write-Host "[$step/4] Restarting app (keeping tunnel alive)..." -ForegroundColor Yellow
pm2 restart event-passport

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Update complete!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan

# Show current tunnel URL
$tunnelUrl = (pm2 logs cloudflare-tunnel --lines 100 --nostream | Select-String "https://.*\.trycloudflare\.com" | Select-Object -Last 1).Matches.Value
if ($tunnelUrl) {
    Write-Host "Public URL (unchanged): $tunnelUrl" -ForegroundColor Green
}
