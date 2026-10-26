#!/bin/bash
# Starts a real stack for the browser journeys: a fresh database, the built API in production mode (with a stand-in for the
# email and text providers), and the built web app. Prints LIVE-UP when both answer. Stop it with live-down.sh.
#
#   npm run build            first (the API's dist and the web app's .next)
#   bash scripts/e2e/live-up.sh
#
# RESTART_GRACE_MINUTES=1: the platform's wait after its own start (default 10) is one minute here, so the journeys use the setting
# without waiting ten minutes for the morning message.
# Needs PostgreSQL 14 or newer and a role that may create databases:
#   E2E_DATABASE_ADMIN_URL   default postgres://greecon:greecon@127.0.0.1:5432/postgres
# Writes its logs and process ids to E2E_DIR (default $TMPDIR/greecon-e2e).
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
E2E_DIR="${E2E_DIR:-${TMPDIR:-/tmp}/greecon-e2e}"
ADMIN_URL="${E2E_DATABASE_ADMIN_URL:-postgres://greecon:greecon@127.0.0.1:5432/postgres}"
DB_URL="${ADMIN_URL%/*}/greecon_e2e"
mkdir -p "$E2E_DIR"
cd "$ROOT" || exit 1
psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS greecon_e2e WITH (FORCE)" -c "CREATE DATABASE greecon_e2e" >/dev/null || { echo "Cannot create the database. Set E2E_DATABASE_ADMIN_URL."; exit 1; }

setsid node scripts/e2e/fake-provider.cjs > "$E2E_DIR/provider.log" 2>&1 < /dev/null &
echo $! > "$E2E_DIR/provider.pid"
for i in $(seq 1 20); do curl -sf http://127.0.0.1:4100/recorded >/dev/null && break; sleep 0.5; done

setsid env PORT=4000 NODE_ENV=production RESEND_API_KEY=re_e2e RESEND_API_URL=http://127.0.0.1:4100 ALERT_FROM_EMAIL=alerts@e2e.example \
  TWILIO_ACCOUNT_SID=ACe2e TWILIO_AUTH_TOKEN=tok TWILIO_FROM=+15005550006 TWILIO_API_URL=http://127.0.0.1:4100 \
  PUBLIC_WEB_URL=http://localhost:3000 RESTART_GRACE_MINUTES=1 DATABASE_URL="$DB_URL" JWT_SECRET=e2e-secret-e2e-secret-e2e-secret-1234 TRUST_PROXY=1 \
  BOOTSTRAP_ADMIN_EMAIL=eridon.manuka@greecon.earth BOOTSTRAP_ADMIN_PASSWORD='E2E-Admin-Passw0rd!' \
  node apps/api/dist/main.js > "$E2E_DIR/api.log" 2>&1 < /dev/null &
echo $! > "$E2E_DIR/api.pid"
for i in $(seq 1 90); do curl -sf http://localhost:4000/health >/dev/null && break; sleep 1; done

(cd apps/web && GREECON_API_URL=http://localhost:4000 PORT=3000 setsid node ../../node_modules/next/dist/bin/next start -p 3000 > "$E2E_DIR/web.log" 2>&1 < /dev/null & echo $! > "$E2E_DIR/web.pid")
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:3000/login && break; sleep 1; done
curl -s -o /dev/null -w "api:%{http_code} " http://localhost:4000/health; curl -s -o /dev/null -w "web:%{http_code}\n" http://localhost:3000/login
echo LIVE-UP
