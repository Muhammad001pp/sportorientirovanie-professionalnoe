#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
ACTION="${1:-restart}"

kill_by_ports() {
  local ports=(3210 3000 8081 8089)
  for p in "${ports[@]}"; do
    if lsof -i tcp:"$p" >/dev/null 2>&1; then
      echo "Killing processes on port $p..."
      lsof -t -i tcp:"$p" | xargs -r kill -9 || true
    fi
  done
}

kill_by_cmds() {
  # Be careful: kill only our dev servers
  pkill -f "convex dev" || true
  pkill -f "expo start" || true
  pkill -f "next dev" || true
  pkill -f "npm --prefix admin run dev" || true
  pkill -f "concurrently .*dev:all" || true
}

stop_all() {
  echo "Stopping Convex/Expo/Admin dev servers..."
  kill_by_ports
  kill_by_cmds
  echo "Stopped."
}

start_all() {
  echo "Starting Convex, Admin (Next.js), and Expo in separate Terminal windows..."
  if [ ! -f "$ROOT_DIR/admin/.env.local" ]; then
    echo "[hint] admin/.env.local не найден. Создайте файл со строкой: NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210"
  fi
  osascript <<APPLESCRIPT
tell application "Terminal"
  do script "cd $ROOT_DIR && npx convex dev"
  delay 0.7
  do script "cd $ROOT_DIR/admin && npm run dev"
  delay 0.7
  do script "cd $ROOT_DIR && npx expo start"
  activate
end tell
APPLESCRIPT
  echo "Launched. Check Terminal windows."
}

case "$ACTION" in
  stop)
    stop_all
    ;;
  start)
    start_all
    ;;
  restart|toggle|*)
    stop_all
    start_all
    ;;
esac
