#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=================================================="
echo "Updating School Event Passport..."
echo "Tunnel will remain running — URL stays the same"
echo "=================================================="

# 1. Pull latest code
echo ""
echo "[1/4] Pulling latest code from git..."
git pull

# 2. Install dependencies
echo ""
echo "[2/4] Installing npm dependencies..."
npm install

# 3. (Optional) Run DB schema init
if [ "$1" = "--with-schema" ]; then
    echo ""
    echo "[3/4] Initializing database schema..."
    node -e "require('./db').initSchema()"
fi

# 4. Restart the app only (tunnel stays alive)
STEP="3"
if [ "$1" = "--with-schema" ]; then STEP="4"; fi
echo ""
echo "[$STEP/4] Restarting app (keeping tunnel alive)..."
pm2 restart event-passport

echo ""
echo "=================================================="
echo "Update complete!"
echo "=================================================="

# Show current tunnel URL
URL=$(pm2 logs cloudflare-tunnel --lines 100 --nostream | grep -o 'https://[^[:space:]]*\.trycloudflare\.com' | tail -1)
if [ -n "$URL" ]; then
    echo "Public URL (unchanged): $URL"
fi
