#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Change to the project root directory
cd "$(dirname "$0")/.."

echo "=================================================="
echo "Cleaning up environment..."
echo "=================================================="
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
pm2 delete all 2>/dev/null || true
echo "PM2 cache cleared."

echo ""
echo "=================================================="
echo "Starting School Event Passport..."
echo "=================================================="

# 1. Start or restart the database
echo "Ensuring database container is running..."
docker-compose up -d

# Wait for PostgreSQL to be fully ready
echo "Waiting for PostgreSQL to accept connections..."
sleep 3
until docker exec event_passport_db pg_isready -U event_user -d school_event > /dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL is ready."

# 2. Initialize the database schema
echo "Initializing database schema..."
node -e "require('./db').initSchema()"

# 3. Auto-seed from config.js
echo "Auto-seeding from config.js..."
node helpers/seed.js

# 4. Start the app and Cloudflare Tunnel via PM2
echo "Starting PM2 processes..."
# We run npm start which uses ecosystem.config.js
npm start

# Wait a moment for the tunnel to establish and output its URL
echo "Waiting for Cloudflare Tunnel to establish (this may take up to 10 seconds)..."
sleep 10

# 5. Get the public URL
echo ""
echo "=================================================="
echo "School Event Passport is now running!"
echo "Retrieving Cloudflare Tunnel URL..."
echo "=================================================="
# Try multiple ways to get the URL from logs or log files
URL=$(pm2 logs cloudflare-tunnel --lines 100 --nostream 2>/dev/null | grep -om1 'https://[^[:space:]]*\.trycloudflare\.com')
if [ -z "$URL" ]; then
  URL=$(grep -om1 'https://[^[:space:]]*\.trycloudflare\.com' logs/tunnel-out.log 2>/dev/null)
fi

if [ -z "$URL" ]; then
    echo "Could not extract the URL automatically. Check manually with: pm2 logs cloudflare-tunnel"
else
    echo "Public Tunnel URL: $URL"
    echo ""
    echo "Developer Dashboard: $URL/developer/login"
    echo "Admin Dashboard:     $URL/admin/login"
    echo "Player Entry:        $URL/register"
fi

echo "=================================================="
echo "Configuration Applied Successfully:"
echo "- Database seeded from config.js"
echo "- NEW PINs from .env are now active"
echo "=================================================="
