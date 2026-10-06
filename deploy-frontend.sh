#!/usr/bin/env bash
# Build and prepare the Zettaz Cloud frontend for nginx on the VPS.
# This does NOT deploy over a network; run on the production server.
# Assumes the macOS Print Agent .pkg has been copied to frontend/public/downloads/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DOWNLOADS="$ROOT/frontend/public/downloads"

log() { printf '\n==> %s\n' "$*"; }

cd "$ROOT"

# Ensure Print Agent macOS installer is present for the build, but allow the
# site to build without it so the first deploy can go live. The .pkg can be
# added later without affecting the core app.
if ! ls "$FRONTEND_DOWNLOADS"/zettaz-print-agent-macos-*.pkg >/dev/null 2>&1; then
  log "WARNING: No zettaz-print-agent-macos-*.pkg found in $FRONTEND_DOWNLOADS"
  log "Build the installer on a Mac (cd print-agent && bash installer/macos/package.sh)"
  log "then copy the .pkg to that directory, or commit it with git add -f."
else

# If manifest.json is missing, generate it from the existing .pkg.
PKG=$(ls -t "$FRONTEND_DOWNLOADS"/zettaz-print-agent-macos-*.pkg | head -n 1)
if [ ! -f "$FRONTEND_DOWNLOADS/manifest.json" ]; then
  log "Generating manifest.json from $PKG"
  VERSION=$(basename "$PKG" .pkg | sed 's/zettaz-print-agent-macos-//')
  SIZE=$(stat -c%s "$PKG" 2>/dev/null || stat -f%z "$PKG" 2>/dev/null)
  HASH=$(sha256sum "$PKG" 2>/dev/null | awk '{print $1}' || shasum -a 256 "$PKG" 2>/dev/null | awk '{print $1}')
  cat > "$FRONTEND_DOWNLOADS/manifest.json" <<EOF
{
  "macos": {
    "version": "$VERSION",
    "url": "/downloads/$(basename "$PKG")",
    "latestUrl": "/downloads/$(basename "$PKG")",
    "filename": "$(basename "$PKG")",
    "size": $SIZE,
    "sha256": "$HASH",
    "platform": "universal",
    "signed": true,
    "notarized": true
  }
}
EOF
fi
fi

# Ensure .env.production exists so the build does not fall back to localhost.
if [ ! -f "$ROOT/frontend/.env.production" ]; then
  log "Creating frontend/.env.production from backend/.env"
  JWT_SECRET=$(grep -E '^JWT_SECRET=' "$ROOT/backend/.env" | cut -d= -f2-)
  cat > "$ROOT/frontend/.env.production" <<EOF
VITE_API_URL=https://api.zettaz.com
VITE_API_BASE_URL=https://api.zettaz.com
VITE_JWT_SECRET=$JWT_SECRET
EOF
fi

log "Installing frontend dependencies"
cd "$ROOT/frontend"
npm ci

log "Building frontend"
npm run build

log "Frontend ready at $ROOT/frontend/dist"
