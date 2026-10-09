#!/bin/bash
set -euo pipefail

LABEL="com.zettaz.print-agent"
DEFAULT_AGENT="/Applications/Zettaz Print Agent.app/Contents/MacOS/zettaz-print-agent"
AGENT="${AGENT_PATH:-$DEFAULT_AGENT}"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$HOME/Library/Logs/zettaz-print-agent"

usage() {
  echo "Usage: $0 {install|uninstall|start|stop|status}"
  echo "Override the agent binary with AGENT_PATH."
  exit 1
}

[ $# -eq 1 ] || usage

install_agent() {
  mkdir -p "$HOME/Library/LaunchAgents"
  mkdir -p "$LOG_DIR"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$AGENT</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/stdout.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/stderr.log</string>
</dict>
</plist>
EOF
  launchctl load "$PLIST" || true
}

uninstall_agent() {
  if [ -f "$PLIST" ]; then
    launchctl unload "$PLIST" || true
    rm -f "$PLIST"
  fi
}

case "$1" in
  install)
    install_agent
    ;;
  uninstall)
    uninstall_agent
    ;;
  start)
    launchctl start "$LABEL" || true
    ;;
  stop)
    launchctl stop "$LABEL" || true
    ;;
  status)
    launchctl list "$LABEL" || true
    ;;
  *)
    usage
    ;;
esac
