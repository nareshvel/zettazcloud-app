#!/usr/bin/env bash
# Full production deploy for Zettaz Cloud on the VPS.
# Usage: ./deploy.sh [branch]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BRANCH="${1:-main}"
API_APP="${PM2_API_APP:-zettaz-api}"

log() { printf '\n==> %s\n' "$*"; }

cd "$ROOT"

# Remove local-only SQL dumps that can block git pull
log "Removing untracked SQL dump files"
rm -f database/dumps/*.sql database/dumps/*.zip

log "Pulling origin/${BRANCH}"
git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"

log "Installing backend dependencies"
cd "$ROOT/backend"
npm ci

log "Restarting backend"
pm2 restart "$API_APP" --update-env

log "Building frontend"
cd "$ROOT"
bash deploy-frontend.sh

log "Reloading nginx"
sudo nginx -t && sudo systemctl reload nginx

log "Full deploy complete"
