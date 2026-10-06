#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/../.."
BUILD_DIR="$SCRIPT_DIR/build-$(date +%s)"
APP_NAME="Zettaz Print Agent"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"
PKG="$BUILD_DIR/zettaz-print-agent-macos.pkg"
IDENTIFIER="com.zettaz.print-agent"
VERSION_FILE="$SCRIPT_DIR/VERSION"
if [ -n "${ZETTAZ_AGENT_VERSION:-}" ]; then
  VERSION="$ZETTAZ_AGENT_VERSION"
elif [ -f "$VERSION_FILE" ]; then
  LAST_VERSION=$(tr -d '[:space:]' < "$VERSION_FILE")
  VERSION=$(echo "$LAST_VERSION" | awk -F. '{print $1"."$2"."($3+1)}')
else
  VERSION="2.0.0"
fi
NOTARY_PROFILE="${NOTARY_KEYCHAIN_PROFILE:-zettaz-notary}"
APPLE_ID="${NOTARY_APPLE_ID:-${APPLE_ID:-}}"
APPLE_PASSWORD="${NOTARY_APP_SPECIFIC_PASSWORD:-}"
TEAM_ID="${NOTARY_TEAM_ID:-${APPLE_TEAM_ID:-7688G2MP45}}"
NO_NOTARIZE="${NO_NOTARIZE:-0}"

# Locate Developer ID certificates automatically if env vars are not set.
if [ -z "${MAC_APPLICATION_CERT:-}" ]; then
  MAC_APPLICATION_CERT="$(security find-identity -p basic -v 2>/dev/null | sed -nE '/Developer ID Application:/s/.*"([^"]+)".*/\1/p' | head -n 1)"
fi
if [ -z "${MAC_INSTALLER_CERT:-}" ]; then
  MAC_INSTALLER_CERT="$(security find-identity -p basic -v 2>/dev/null | sed -nE '/Developer ID Installer:/s/.*"([^"]+)".*/\1/p' | head -n 1)"
fi

if [ -z "$MAC_APPLICATION_CERT" ] || [ -z "$MAC_INSTALLER_CERT" ]; then
  echo "Error: Could not find Developer ID certificates." >&2
  echo "Set MAC_APPLICATION_CERT and MAC_INSTALLER_CERT, or check Keychain." >&2
  exit 1
fi

rm -rf "$BUILD_DIR"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

ARM_BIN="$BUILD_DIR/zettaz-print-agent-arm64"
AMD_BIN="$BUILD_DIR/zettaz-print-agent-amd64"
AGENT_BIN="$APP_BUNDLE/Contents/MacOS/zettaz-print-agent-service"
ARM_LAUNCHER="$BUILD_DIR/zettaz-print-agent-launcher-arm64"
AMD_LAUNCHER="$BUILD_DIR/zettaz-print-agent-launcher-amd64"
LAUNCHER_BIN="$APP_BUNDLE/Contents/MacOS/zettaz-print-agent"

(
  cd "$PROJECT_DIR"
  CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags "-X github.com/zettaz/print-agent/internal/agent.Version=$VERSION" -o "$ARM_BIN" ./cmd/zettaz-print-agent
  CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags "-X github.com/zettaz/print-agent/internal/agent.Version=$VERSION" -o "$AMD_BIN" ./cmd/zettaz-print-agent
)

lipo -create -output "$AGENT_BIN" "$ARM_BIN" "$AMD_BIN"
clang -fobjc-arc -arch arm64 -mmacosx-version-min=11.0 -framework Cocoa -framework ServiceManagement -framework UserNotifications "$SCRIPT_DIR/MenuBar.m" -o "$ARM_LAUNCHER"
clang -fobjc-arc -arch x86_64 -mmacosx-version-min=11.0 -framework Cocoa -framework ServiceManagement -framework UserNotifications "$SCRIPT_DIR/MenuBar.m" -o "$AMD_LAUNCHER"
lipo -create -output "$LAUNCHER_BIN" "$ARM_LAUNCHER" "$AMD_LAUNCHER"
rm -f "$ARM_BIN" "$AMD_BIN" "$ARM_LAUNCHER" "$AMD_LAUNCHER"
chmod +x "$AGENT_BIN" "$LAUNCHER_BIN"

cat > "$APP_BUNDLE/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>Zettaz Print Agent</string>
    <key>CFBundleIdentifier</key>
    <string>com.zettaz.print-agent</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>zettaz-print-agent</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>LSUIElement</key>
    <true/>
    <key>LSMultipleInstancesProhibited</key>
    <true/>
</dict>
</plist>
EOF

# Copy the icon to Resources
cp "$SCRIPT_DIR/AppIcon.icns" "$APP_BUNDLE/Contents/Resources/"

codesign --force \
  --sign "$MAC_APPLICATION_CERT" \
  --options runtime \
  --timestamp \
  "$AGENT_BIN"

codesign --force \
  --sign "$MAC_APPLICATION_CERT" \
  --options runtime \
  --timestamp \
  --identifier "$IDENTIFIER" \
  "$APP_BUNDLE"

# Prepare the installer payload.
mkdir -p "$BUILD_DIR/payload"
cp -R "$APP_BUNDLE" "$BUILD_DIR/payload/"

chmod +x "$SCRIPT_DIR/scripts/postinstall"

cat > "$BUILD_DIR/components.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<array>
  <dict>
    <key>BundleHasStrictIdentifier</key>
    <true/>
    <key>BundleIsRelocatable</key>
    <false/>
    <key>BundleIsVersionChecked</key>
    <true/>
    <key>BundleOverwriteAction</key>
    <string>upgrade</string>
    <key>RootRelativeBundlePath</key>
    <string>Zettaz Print Agent.app</string>
  </dict>
</array>
</plist>
EOF

pkgbuild \
  --root "$BUILD_DIR/payload" \
  --component-plist "$BUILD_DIR/components.plist" \
  --scripts "$SCRIPT_DIR/scripts" \
  --identifier "$IDENTIFIER" \
  --version "$VERSION" \
  --install-location /Applications \
  "$BUILD_DIR/unsigned.pkg"

productsign \
  --sign "$MAC_INSTALLER_CERT" \
  --timestamp \
  "$BUILD_DIR/unsigned.pkg" \
  "$PKG"

rm -f "$BUILD_DIR/unsigned.pkg"

if [ "$NO_NOTARIZE" = "1" ]; then
  echo "Created signed (but not notarized) package: $PKG"
  exit 0
fi

NOTARY_ARGS=()
if [ -n "$NOTARY_PROFILE" ]; then
  NOTARY_ARGS+=(--keychain-profile "$NOTARY_PROFILE")
elif [ -n "$APPLE_ID" ] && [ -n "$APPLE_PASSWORD" ]; then
  NOTARY_ARGS+=(--apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$TEAM_ID")
else
  echo "Error: Notarization credentials not found." >&2
  echo "Set NOTARY_KEYCHAIN_PROFILE, or NOTARY_APPLE_ID + NOTARY_APP_SPECIFIC_PASSWORD." >&2
  echo "To create a keychain profile, run:" >&2
  echo "  xcrun notarytool store-credentials --apple-id <you@example.com> --team-id $TEAM_ID zettaz-notary" >&2
  exit 1
fi

xcrun notarytool submit "$PKG" \
  "${NOTARY_ARGS[@]}" \
  --wait

xcrun stapler staple "$PKG"

# Copy to standard location for easy access
STANDARD_PKG="$SCRIPT_DIR/zettaz-print-agent-macos.pkg"
cp "$PKG" "$STANDARD_PKG"

# Clean up older build directories, keeping only the current one
for old_build in "$SCRIPT_DIR"/build-[0-9]*; do
  [ -d "$old_build" ] || continue
  [ "$old_build" = "$BUILD_DIR" ] && continue
  rm -rf "$old_build"
done

# Persist the built version and update documentation
if [ -n "${VERSION:-}" ]; then
  echo "$VERSION" > "$VERSION_FILE"
  if [ -f "$PROJECT_DIR/../AGENTS.md" ]; then
    sed -i '' -E "s/Current version: [0-9]+\.[0-9]+\.[0-9]+/Current version: $VERSION/" "$PROJECT_DIR/../AGENTS.md"
  fi
  if [ -f "$PROJECT_DIR/PROJECT_STATUS.md" ]; then
    sed -i '' -E "s/^\*\*Version:\*\* [0-9]+\.[0-9]+\.[0-9]+/**Version:** $VERSION/" "$PROJECT_DIR/PROJECT_STATUS.md"
  fi
fi

echo "Created signed, notarized, and stapled package: $PKG"
echo "Also copied to: $STANDARD_PKG"
