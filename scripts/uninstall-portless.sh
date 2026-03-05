#!/bin/bash
set -euo pipefail

# DevHub Portless Mode Uninstaller
# Removes the Caddy LaunchDaemon and Caddyfile.

CADDYFILE="/usr/local/etc/devhub-Caddyfile"
PLIST="/Library/LaunchDaemons/com.devhub.caddy.plist"

echo "=== DevHub Portless Mode Removal ==="

# Stop and unload
launchctl stop com.devhub.caddy 2>/dev/null || true
launchctl unload "${PLIST}" 2>/dev/null || true

# Remove files
rm -f "${PLIST}"
rm -f "${CADDYFILE}"

echo "Portless mode has been removed."
echo "DevHub is still accessible at http://localhost:<port>"
