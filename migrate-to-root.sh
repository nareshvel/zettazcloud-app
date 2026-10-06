#!/bin/bash
# Migrate Zettaz Cloud production files from the old repo subdir to a clean root.
# Run on the production server as root.
set -euo pipefail

OLD_ROOT="/var/www/app-zettaz-cloud/repo"
NEW_ROOT="/var/www/zettazcloud-app"
BACKUP_DIR="/var/www/app-zettaz-cloud-repo-backup-$(date +%Y%m%d%H%M%S)"
NGINX_CONF="/etc/nginx/sites-available/cloud.zettaz.com"

log() { printf '\n==> %s\n' "$*"; }

# Validate
if [ ! -d "$OLD_ROOT" ]; then
  echo "ERROR: Old root not found: $OLD_ROOT"
  exit 1
fi
if [ ! -d "$NEW_ROOT" ]; then
  echo "ERROR: New root not found: $NEW_ROOT"
  exit 1
fi

# Stop services
log "Stopping PM2 app"
pm2 stop zettaz-api || true
log "Deleting old PM2 app"
pm2 delete zettaz-api || true

# Backup the old repo before changing anything
log "Creating backup at $BACKUP_DIR"
cp -a "$OLD_ROOT" "$BACKUP_DIR"

# Copy everything except node_modules and uploaded data (recreated by npm ci / runtime)
log "Copying files from $OLD_ROOT to $NEW_ROOT"
cd "$OLD_ROOT"
tar --exclude='*/node_modules' -cf - . | (cd "$NEW_ROOT" && tar -xf -)

# Remove the old repo directory
log "Removing old repo directory"
mv "$OLD_ROOT" "$BACKUP_DIR"
# Optional: remove the now-empty parent if desired
rmdir "/var/www/app-zettaz-cloud" 2>/dev/null || true

# Update .gitignore before the first commit
log "Updating .gitignore for the clean root"
if ! grep -q "backend/uploads/" "$NEW_ROOT/.gitignore"; then
  cat >> "$NEW_ROOT/.gitignore" <<'EOF'

# Backend secrets, config, and uploads
backend/.env*
backend/.env.*
backend/ecosystem.config.js
backend/uploads/

# Generated Print Agent downloads
frontend/public/downloads/*.pkg
frontend/public/downloads/manifest.json
EOF
fi

# Update nginx root path in the installed site and the repo source
log "Updating nginx root paths"
if [ -f "$NGINX_CONF" ]; then
  sed -i "s|$OLD_ROOT/frontend/dist|$NEW_ROOT/frontend/dist|g" "$NGINX_CONF"
fi
sed -i "s|/var/www/app-zettaz-cloud/repo/frontend/dist|$NEW_ROOT/frontend/dist|g" "$NEW_ROOT/deploy/nginx/cloud.zettaz.com.conf" 2>/dev/null || true
sed -i "s|/var/www/zettazcloud-app/frontend/dist|$NEW_ROOT/frontend/dist|g" "$NEW_ROOT/deploy/nginx/cloud.zettaz.com.conf" 2>/dev/null || true

# Reinitialize git for a fresh repo
log "Reinitializing git"
cd "$NEW_ROOT"
OLD_NAME=$(git config --get user.name 2>/dev/null || echo "root")
OLD_EMAIL=$(git config --get user.email 2>/dev/null || echo "root@zettazcloud-app")
rm -rf .git
git init
git config user.name "$OLD_NAME"
git config user.email "$OLD_EMAIL"
git add .
git commit -m "Initial clean production setup at $NEW_ROOT"

# Install backend dependencies (node_modules were excluded)
log "Installing backend dependencies"
cd "$NEW_ROOT/backend"
npm ci

# Start the backend from the new path
log "Starting PM2 app from $NEW_ROOT/backend"
cd "$NEW_ROOT/backend"
pm2 start server.js --name zettaz-api
pm2 save

# Reload nginx
log "Reloading nginx"
nginx -t && systemctl reload nginx

log "Migration complete."
echo ""
echo "Next steps:"
echo "  1. Create the new GitHub repo (or use an existing one)."
echo "  2. cd $NEW_ROOT"
echo "     git remote add origin https://github.com/nareshvel/app-zettaz-cloud.git"
echo "     git branch -M main"
echo "     git push -u origin main"
echo "  3. Update DNS/SSL if needed (already done for cloud.zettaz.com)."
echo ""
echo "Backup of old root is at $BACKUP_DIR"
