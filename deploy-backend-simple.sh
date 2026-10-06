#!/bin/bash
# Zettaz Cloud - Simple Backend Deployment
# Usage: ./deploy-backend-simple.sh

set -e

APP_NAME="zettaz-api"
PORT=5172
export PORT
REPO_DIR="/var/www/app-zettaz-cloud/repo"
BACKEND_DIR="${REPO_DIR}/backend"

echo "=== Zettaz Backend Deployment ==="

# 1. Stop app
echo "[1/5] Stopping ${APP_NAME}..."
pm2 stop ${APP_NAME} 2>/dev/null || true

# 2. Free port
echo "[2/5] Freeing port ${PORT}..."
sudo lsof -ti:${PORT} | xargs sudo kill -9 2>/dev/null || true
sleep 2

# 3. Pull latest code
echo "[3/5] Pulling latest code..."
cd ${REPO_DIR}
git fetch --all
git checkout main
git pull --ff-only

# 4. Install dependencies
echo "[4/5] Installing dependencies..."
cd ${BACKEND_DIR}
npm ci --production

# 5. Start app
echo "[5/5] Starting ${APP_NAME}..."
sudo lsof -ti:${PORT} | xargs sudo kill -9 2>/dev/null || true
if pm2 list | grep -q "${APP_NAME}"; then
  pm2 restart ${APP_NAME} --update-env
else
  pm2 start server.js --name ${APP_NAME}
fi
pm2 save

# Verify
sleep 5
echo ""
echo "=== Deployment Complete ==="
pm2 logs ${APP_NAME} --lines 20 --nostream
echo ""
echo "Check status: pm2 status"
