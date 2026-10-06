#!/bin/bash

set -e

echo "==> Starting Clean Zettaz Backend Deployment"
echo

REPO_DIR="/var/www/app-zettaz-cloud/repo"
APP_NAME="zettaz-api"

echo "==> Step 1: Stopping and deleting application"
pm2 delete "$APP_NAME" 2>/dev/null || echo "App not running or already deleted"
echo "[SUCCESS] Application deleted"
echo

echo "==> Step 2: Hard reset to latest main"
cd "$REPO_DIR"
git fetch origin
git reset --hard origin/main
echo "[SUCCESS] Code reset to latest main"
echo

echo "==> Step 3: Clearing Node.js caches"
rm -rf node_modules/.cache
rm -rf .cache
echo "[SUCCESS] Caches cleared"
echo

echo "==> Step 4: Installing dependencies"
npm ci --production
echo "[SUCCESS] Dependencies installed"
echo

echo "==> Step 5: Starting application fresh"
pm2 start backend/server.js --name "$APP_NAME"
echo "[SUCCESS] Application started"
echo

echo "==> Step 6: Waiting for initialization"
sleep 5
echo

echo "==> Step 7: Checking status"
pm2 status "$APP_NAME"
pm2 logs "$APP_NAME" --lines 20 --nostream
echo

echo "==> Deployment Complete"