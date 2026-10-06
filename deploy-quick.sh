#!/usr/bin/env bash
# Quick deploy for minor frontend/backend changes.
# Usage: ./deploy-quick.sh [branch]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BRANCH="${1:-main}"
APP_NAME="zettaz-api"

log() { printf '\n==> %s\n' "$*"; }

cd "$ROOT"

log "Pulling origin/${BRANCH}"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

log "Reloading backend"
pm2 reload "$APP_NAME" --update-env || pm2 restart "$APP_NAME" --update-env

log "Building frontend"
cd "$ROOT/frontend"
npm run build

log "Reloading nginx"
nginx -t && systemctl reload nginx

log "Quick deploy complete"
