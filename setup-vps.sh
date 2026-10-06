#!/bin/bash
set -euo pipefail

REPO="nareshvel/zettazcloud-app"
NEW_ROOT="/var/www/zettazcloud-app"
NGINX_CONF="/etc/nginx/sites-available/cloud.zettaz.com"
BACKUP_DIR=$(ls -d /var/www/app-zettaz-cloud-repo-backup-* 2>/dev/null | tail -1 || true)

log() { echo "==> $*"; }

# If no backup, prepare staging files from Mac first:
#   scp /Users/nareshvelusamy/Herd/app-zettaz-cloud/backend/.env root@185.75.21.46:/var/www/zettazcloud-app.env
#   (optional) scp -r backend/uploads root@185.75.21.46:/var/www/zettazcloud-app-uploads/

RESTORE_SOURCE=""

if [[ -n "${BACKUP_DIR:-}" && -d "$BACKUP_DIR" ]]; then
  log "Using backup at $BACKUP_DIR"
  RESTORE_SOURCE="$BACKUP_DIR"
elif [[ -f "/var/www/zettazcloud-app.env" ]]; then
  log "No backup; using staging .env from /var/www/zettazcloud-app.env"
  RESTORE_SOURCE="/var/www/zettazcloud-app-staging"
  rm -rf "$RESTORE_SOURCE"
  mkdir -p "$RESTORE_SOURCE/backend"
  cp -a "/var/www/zettazcloud-app.env" "$RESTORE_SOURCE/backend/.env"
  if [[ -d "/var/www/zettazcloud-app-uploads" ]]; then
    cp -a "/var/www/zettazcloud-app-uploads" "$RESTORE_SOURCE/backend/uploads"
  fi
  if [[ -d "/var/www/zettazcloud-app-downloads" ]]; then
    cp -a "/var/www/zettazcloud-app-downloads" "$RESTORE_SOURCE/frontend/public/downloads"
  fi
else
  echo "ERROR: No backup found and no staging .env at /var/www/zettazcloud-app.env"
  echo "Run on the Mac:"
  echo "  scp /Users/nareshvelusamy/Herd/app-zettaz-cloud/backend/.env root@185.75.21.46:/var/www/zettazcloud-app.env"
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
log "Restoring .env and uploads"
cp -a "$RESTORE_SOURCE/backend/.env" "$NEW_ROOT/backend/.env"
cp -a "$RESTORE_SOURCE/backend/.env.production" "$NEW_ROOT/backend/.env.production" 2>/dev/null || true
cp -a "$RESTORE_SOURCE/backend/uploads" "$NEW_ROOT/backend/uploads" 2>/dev/null || true
mkdir -p "$NEW_ROOT/frontend/public/downloads"
cp -a "$RESTORE_SOURCE/frontend/public/downloads/"* "$NEW_ROOT/frontend/public/downloads/" 2>/dev/null || true
if [[ ! -d "$NEW_ROOT/backend/uploads" ]]; then
  mkdir -p "$NEW_ROOT/backend/uploads"
  echo "WARNING: backend/uploads/ was empty. You can re-upload logos later."
fi

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
