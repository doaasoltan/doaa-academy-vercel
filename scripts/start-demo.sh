#!/usr/bin/env bash
# Auto-start (non-blocking) the demo server.
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  bash scripts/setup-demo-env.sh
fi
if pgrep -f "tsx server/_core/index.ts" > /dev/null 2>&1; then
  echo "[demo] server already running on :3000."
  exit 0
fi
nohup npx tsx server/_core/index.ts > /tmp/academy-demo.log 2>&1 &
echo "[demo] server starting on :3000 (log: /tmp/academy-demo.log)"
