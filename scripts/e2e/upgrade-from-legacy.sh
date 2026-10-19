#!/bin/bash
# Makes the database an old deployment would have: every migration up to 009 replayed the way the first runner did (no ledger),
# the founder's own password set by hand. Then it is yours to start the current API on, to see it come up and keep the data:
#
#   bash scripts/e2e/upgrade-from-legacy.sh
#   DATABASE_URL=postgres://.../greecon_legacy JWT_SECRET=... NODE_ENV=production node apps/api/dist/main.js
#
# The log must say it recorded 001 to 008 as already applied, applied 009 onwards, and "Database updated"; the founder's
# own password ('My-Own-Passw0rd!') must still sign in. Needs E2E_DATABASE_ADMIN_URL as in live-up.sh.
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ADMIN_URL="${E2E_DATABASE_ADMIN_URL:-postgres://greecon:greecon@127.0.0.1:5432/postgres}"
DB_URL="${ADMIN_URL%/*}/greecon_legacy"
cd "$ROOT" || exit 1
psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS greecon_legacy WITH (FORCE)" -c "CREATE DATABASE greecon_legacy" >/dev/null || exit 1
for f in 001_schema 002_seed_demo 003_auth 004_site_safety_limits 005_platform_admin 006_split_demo_and_real_tenant 007_dashboard_preferences 008_gateway_credentials 009_demo_data_expansion; do
  psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "apps/api/src/database/migrations/$f.sql" >/dev/null || { echo "legacy apply failed at $f"; exit 1; }
done
OWN=$(node -e 'console.log(require("bcryptjs").hashSync(process.argv[1],10))' 'My-Own-Passw0rd!')
psql "$DB_URL" -q -c "UPDATE users SET password_hash='$OWN' WHERE email='eridon.manuka@greecon.earth'" >/dev/null
echo "legacy database ready at $DB_URL; migration ledger present? $(psql "$DB_URL" -tAc "select to_regclass('public.schema_migrations')")"
