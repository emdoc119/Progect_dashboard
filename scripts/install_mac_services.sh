#!/bin/bash
set -euo pipefail

PROJECT_ROOT="/Users/choo/.gemini/antigravity/scratch/Progect_dashboard"
LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"
UID_VALUE="$(id -u)"

mkdir -p "${LAUNCH_AGENTS_DIR}"

install_agent() {
  local label="$1"
  local source="$2"
  local destination="${LAUNCH_AGENTS_DIR}/${label}.plist"

  cp "${source}" "${destination}"
  plutil -lint "${destination}"
  launchctl bootout "gui/${UID_VALUE}/${label}" 2>/dev/null || true
  launchctl bootstrap "gui/${UID_VALUE}" "${destination}"
}

# Save the current PM2 process list before launchd resurrects it after login.
"${PROJECT_ROOT}/node_modules/.bin/pm2" save

install_agent \
  "com.emdoc.progect-dashboard-pm2" \
  "${PROJECT_ROOT}/ops/com.emdoc.progect-dashboard-pm2.plist"

if launchctl print "gui/${UID_VALUE}/com.choo.macro-dashboard" >/dev/null 2>&1; then
  echo "Existing assetstyle launchd agent com.choo.macro-dashboard is already loaded; leaving it unchanged."
else
  install_agent \
    "com.emdoc.assetstyle-stock-dashboard" \
    "${PROJECT_ROOT}/ops/com.emdoc.assetstyle-stock-dashboard.plist"
fi

echo "Installed launchd agents for Dashboard PM2 and assetstyle_stock_dashboard."
