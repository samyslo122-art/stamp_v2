#!/bin/bash

echo "Stopping School Event Passport..."

# 1. Stop and remove PM2 processes
echo "Stopping PM2 processes..."
npm run stop
pm2 delete event-passport 2>/dev/null || true
pm2 delete cloudflare-tunnel 2>/dev/null || true

# 2. Stop and remove Docker containers
echo "Stopping database container..."
docker-compose down

echo "=================================================="
echo "School Event Passport successfully stopped."
echo "=================================================="
