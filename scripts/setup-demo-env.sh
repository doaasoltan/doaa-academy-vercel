#!/usr/bin/env bash
# Creates a demo .env (DEMO_MODE, no MySQL needed) if one does not exist.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  echo "[demo] .env already exists, keeping it."
  exit 0
fi
JWT=$(openssl rand -hex 32)
cat > .env <<EOF
NODE_ENV=development
PORT=3000
DEMO_MODE=true
JWT_SECRET=$JWT
ADMIN_EMAIL=admin@demo.test
ADMIN_PASSWORD=Admin1234
ADMIN_NAME=مديرة الأكاديمية
LOCAL_AUTH=false
EOF
echo "[demo] .env created."
echo "[demo] admin: admin@demo.test / Admin1234 | student: student@demo.test / Demo1234"
