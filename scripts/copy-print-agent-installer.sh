#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# Find the most recent build directory
PRINT_AGENT_BUILD_DIR="$PROJECT_DIR/print-agent/installer/macos"
PRINT_AGENT_BUILD=$(find "$PRINT_AGENT_BUILD_DIR" -type d -name "build-*" -maxdepth 1 | sort -r | head -n 1)

if [ -z "$PRINT_AGENT_BUILD" ]; then
  PRINT_AGENT_BUILD="$PRINT_AGENT_BUILD_DIR/build"
fi
FRONTEND_DOWNLOADS="$PROJECT_DIR/frontend/public/downloads"
MANIFEST="$FRONTEND_DOWNLOADS/manifest.json"

# Find the latest macOS pkg
PKG_PATH="$PRINT_AGENT_BUILD/zettaz-print-agent-macos.pkg"

if [ ! -f "$PKG_PATH" ]; then
  echo "Warning: macOS installer not found at $PKG_PATH"
  echo "Build the Print Agent first: cd print-agent && bash installer/macos/package.sh"
  exit 0
fi

# Extract version from the built app bundle (not package.sh default)
VERSION=$(defaults read "$PRINT_AGENT_BUILD/Zettaz Print Agent.app/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null || \
          defaults read "$PRINT_AGENT_BUILD/payload/Zettaz Print Agent.app/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null || \
          echo "2.0.0")

# Create versioned filename for the current build
VERSIONED_PKG="zettaz-print-agent-macos-$VERSION.pkg"
DEST_PATH="$FRONTEND_DOWNLOADS/$VERSIONED_PKG"
CHECKSUM=$(shasum -a 256 "$PKG_PATH" | awk '{print $1}')

# Clean up all old installers and the old "latest" copy; keep only the current versioned file
echo "Cleaning up old Print Agent installers..."
rm -f "$FRONTEND_DOWNLOADS"/zettaz-print-agent-macos-*.pkg
rm -f "$FRONTEND_DOWNLOADS"/zettaz-print-agent-macos-latest.pkg

# Copy the package with the versioned filename
echo "Copying macOS installer to frontend downloads..."
cp "$PKG_PATH" "$DEST_PATH"

# Update manifest to point at the versioned latest file
mkdir -p "$FRONTEND_DOWNLOADS"
cat > "$MANIFEST" <<EOF
{
  "macos": {
    "version": "$VERSION",
    "url": "/downloads/$VERSIONED_PKG",
    "latestUrl": "/downloads/$VERSIONED_PKG",
    "filename": "$VERSIONED_PKG",
    "size": $(stat -f%z "$PKG_PATH" 2>/dev/null || stat -c%s "$PKG_PATH" 2>/dev/null),
    "sha256": "$CHECKSUM",
    "platform": "universal",
    "signed": true,
    "notarized": true
  }
}
EOF

echo "Copied to: $DEST_PATH"
echo "Manifest updated: $MANIFEST"
