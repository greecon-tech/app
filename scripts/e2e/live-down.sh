#!/bin/bash
# Stops the stack that live-up.sh started, including the child process "next start" leaves behind.
E2E_DIR="${E2E_DIR:-${TMPDIR:-/tmp}/greecon-e2e}"
for f in api web provider; do
  [ -f "$E2E_DIR/$f.pid" ] && { kill -- -"$(cat "$E2E_DIR/$f.pid")" 2>/dev/null; kill "$(cat "$E2E_DIR/$f.pid")" 2>/dev/null; rm -f "$E2E_DIR/$f.pid"; }
done
# The brackets keep these patterns from matching this very command line.
ps -eo pid,cmd | awk '/[n]ext-server|[d]ist\/main.js|[f]ake-provider.cjs/ {print $1}' | xargs -r kill 2>/dev/null
echo LIVE-DOWN
