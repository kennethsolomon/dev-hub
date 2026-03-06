#!/bin/bash
set -euo pipefail

# DevHub LaunchAgent Installer
# Installs a LaunchAgent that auto-starts DevHub on login.
# Uses zsh -lc to ensure nvm/PATH are available.
#
# Usage: ./scripts/install-agent.sh
# Uninstall: ./scripts/uninstall-agent.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEVHUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLIST_SRC="$SCRIPT_DIR/devhub-launchagent.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.devhub.server.plist"
LABEL="com.devhub.server"

echo "=== DevHub LaunchAgent Installer ==="
echo ""
echo "DevHub root: $DEVHUB_ROOT"
echo "Plist destination: $PLIST_DST"
echo ""

# Ensure the source plist exists
if [ ! -f "$PLIST_SRC" ]; then
  echo "ERROR: Template plist not found at $PLIST_SRC"
  exit 1
fi

# Check that dependencies are installed
if [ ! -d "$DEVHUB_ROOT/node_modules" ]; then
  echo "ERROR: node_modules not found. Run 'npm install' first."
  exit 1
fi

# Check that a production build exists
if [ ! -d "$DEVHUB_ROOT/.next" ]; then
  echo "WARNING: No production build found. Run 'npm run build' first."
  echo ""
fi

# Unload existing agent if present
if launchctl list "$LABEL" &>/dev/null; then
  echo "Unloading existing agent..."
  launchctl unload "$PLIST_DST" 2>/dev/null || true
fi

# Create LaunchAgents directory if missing
mkdir -p "$HOME/Library/LaunchAgents"

# Copy plist with DEVHUB_ROOT substituted
sed "s|__DEVHUB_ROOT__|$DEVHUB_ROOT|g" "$PLIST_SRC" > "$PLIST_DST"

echo "Installed plist to $PLIST_DST"

# Load the agent
launchctl load "$PLIST_DST"

echo ""
echo "Done! DevHub will now start automatically on login."
echo "Logs: /tmp/devhub-stdout.log, /tmp/devhub-stderr.log"
echo "To uninstall: ./scripts/uninstall-agent.sh"
