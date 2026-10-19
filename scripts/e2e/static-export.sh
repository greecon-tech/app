#!/bin/bash
# Reproduces the GitHub Pages workflow locally: one static export per role against the seeded demo API. A route or page that
# works live can break this build (a Server Action, a dynamic route with no parameters), and the Pages workflow is the
# only automatic check, so run this before merging a change to the web app.
#
#   npm run build:packages && npm run build:api
#   bash scripts/e2e/static-export.sh        prints ok <role> for each, then STATIC-EXPORT-DONE
#
# Do not edit apps/web while it runs: the build swaps files in and out (apps/web/scripts/build-static.sh restores them).
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
E2E_DIR="${E2E_DIR:-${TMPDIR:-/tmp}/greecon-e2e}"
mkdir -p "$E2E_DIR"
cd "$ROOT" || exit 1
export PATH="$ROOT/node_modules/.bin:$PATH"
env -u DATABASE_URL setsid node apps/api/dist/main.js > "$E2E_DIR/api-static.log" 2>&1 < /dev/null &
API_PID=$!
trap 'kill -- -$API_PID 2>/dev/null; kill $API_PID 2>/dev/null; rm -rf apps/web/.next apps/web/out' EXIT
for i in $(seq 1 40); do curl -sf http://localhost:4000/health >/dev/null && break; sleep 1; done
export NEXT_OUTPUT_EXPORT=1 GREECON_API_URL=http://localhost:4000 GREECON_SITE_ROOT=/app
rm -rf "$E2E_DIR/static-publish"; mkdir -p "$E2E_DIR/static-publish"
for role in operator owner admin viewer auditor; do
  rm -rf apps/web/.next apps/web/out
  if [ "$role" = "operator" ]; then dest="$E2E_DIR/static-publish"; export NEXT_BASE_PATH="$GREECON_SITE_ROOT"
  else dest="$E2E_DIR/static-publish/$role"; export NEXT_BASE_PATH="$GREECON_SITE_ROOT/$role"; fi
  export GREECON_DEMO_ROLE="$role"
  if ! apps/web/scripts/build-static.sh > "$E2E_DIR/static-$role.log" 2>&1; then echo "FAIL $role"; tail -40 "$E2E_DIR/static-$role.log"; exit 1; fi
  mkdir -p "$dest"; cp -r apps/web/out/. "$dest/"
  echo "ok $role"
done
echo "STATIC-EXPORT-DONE (the five sites are in $E2E_DIR/static-publish)"
