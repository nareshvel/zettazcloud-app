#!/usr/bin/env bash
# Full production deploy for Zettaz Cloud.
# Usage: ./deploy.sh [branch]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BRANCH="${1:-main}"
APP_NAME="zettaz-api"

log() { printf '\n==> %s\n' "$*"; }

cd "$ROOT"

log "Pulling origin/${BRANCH}"
git checkout "$BRANCH"
# The migration runner moves applied .sql files into database/migrations/applied/
# as untracked copies; when the same path gets committed upstream the next pull
# aborts with "untracked working tree files would be overwritten". applied/ is a
# pure archive — the runner never reads it — so dropping untracked copies is safe.
git clean -fd database/migrations/applied/
git pull --ff-only origin "$BRANCH"

log "Installing backend dependencies"
cd "$ROOT/backend"
npm ci

log "Applying database migrations"
node scripts/migrate.js --yes

log "Starting / restarting backend"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start server.js --name "$APP_NAME"
fi
pm2 save

log "Creating frontend/.env.production if missing"
if [ ! -f "$ROOT/frontend/.env.production" ]; then
  JWT_SECRET=$(grep -E '^JWT_SECRET=' "$ROOT/backend/.env" | cut -d= -f2-)
  cat > "$ROOT/frontend/.env.production" <<EOF
VITE_API_URL=https://api.zettaz.com
VITE_API_BASE_URL=https://api.zettaz.com
VITE_JWT_SECRET=$JWT_SECRET
EOF
fi

log "Installing and building frontend"
cd "$ROOT/frontend"
npm ci
npm run build

log "Reloading nginx"
nginx -t && systemctl reload nginx

log "Full deploy complete"
pm2 status
