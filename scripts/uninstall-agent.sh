#!/bin/bash
set -euo pipefail

# DevHub LaunchAgent Uninstaller
# Removes the auto-start LaunchAgent for DevHub.
#
# Usage: ./scripts/uninstall-agent.sh

PLIST_DST="$HOME/Library/LaunchAgents/com.devhub.server.plist"
LABEL="com.devhub.server"

echo "=== DevHub LaunchAgent Uninstaller ==="
echo ""

# Unload if running
if launchctl list "$LABEL" &>/dev/null; then
  echo "Stopping DevHub agent..."
  launchctl unload "$PLIST_DST" 2>/dev/null || true
  echo "Agent unloaded."
else
  echo "Agent is not currently loaded."
fi

# Remove plist
if [ -f "$PLIST_DST" ]; then
  rm "$PLIST_DST"
  echo "Removed $PLIST_DST"
else
  echo "Plist not found at $PLIST_DST (already removed)."
fi

echo ""
echo "Done! DevHub will no longer start on login."
