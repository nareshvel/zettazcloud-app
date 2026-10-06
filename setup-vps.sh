#!/bin/bash
set -euo pipefail

REPO="nareshvel/zettazcloud-app"
NEW_ROOT="/var/www/zettazcloud-app"
NGINX_CONF="/etc/nginx/sites-available/cloud.zettaz.com"
BACKUP_DIR=$(ls -d /var/www/app-zettaz-cloud-repo-backup-* 2>/dev/null | tail -1 || true)

log() { echo "==> $*"; }

# Check for backup
if [[ -z "${BACKUP_DIR:-}" || ! -d "$BACKUP_DIR" ]]; then
  echo "ERROR: No backup found at /var/www/app-zettaz-cloud-repo-backup-*"
  echo "Please scp backend/.env and backend/uploads/ from the Mac first."
  exit 1
fi

# Stop old process
log "Removing old PM2 app if any"
pm2 delete zettaz-api || true

# Remove old directory and clone
log "Cloning repo"
rm -rf "$NEW_ROOT"
mkdir -p /var/www
cd /var/www
git config --global credential.helper store
git clone "https://github.com/$REPO.git" zettazcloud-app

# Install backend
log "Installing backend dependencies"
cd "$NEW_ROOT/backend"
npm ci --omit=dev

# Restore runtime data
log "Restoring .env and uploads from backup"
cp -a "$BACKUP_DIR/backend/.env" "$NEW_ROOT/backend/.env"
cp -a "$BACKUP_DIR/backend/.env.production" "$NEW_ROOT/backend/.env.production" 2>/dev/null || true
cp -a "$BACKUP_DIR/backend/uploads" "$NEW_ROOT/backend/uploads" 2>/dev/null || true
mkdir -p "$NEW_ROOT/frontend/public/downloads"
cp -a "$BACKUP_DIR/frontend/public/downloads/"* "$NEW_ROOT/frontend/public/downloads/" 2>/dev/null || true

# Build frontend
log "Building frontend"
cd "$NEW_ROOT"
bash deploy-frontend.sh

# Configure nginx root path
if [[ -f "$NGINX_CONF" ]]; then
  sed -i "s|root .*frontend/dist;|root $NEW_ROOT/frontend/dist;|" "$NGINX_CONF"
else
  cp "$NEW_ROOT/deploy/nginx/cloud.zettaz.com.conf" "$NGINX_CONF"
  sed -i "s|root .*frontend/dist;|root $NEW_ROOT/frontend/dist;|" "$NGINX_CONF"
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/cloud.zettaz.com
fi

# Start backend
log "Starting PM2"
cd "$NEW_ROOT/backend"
pm2 start server.js --name zettaz-api
pm2 save

# Reload nginx
log "Reloading nginx"
nginx -t && systemctl reload nginx

log "Setup complete. Verifying..."
pm2 status
curl -I https://cloud.zettaz.com
curl -sS https://api.zettaz.com/api/health
