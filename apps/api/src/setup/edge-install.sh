#!/usr/bin/env bash
#
# Greecon box installer.
#
# On the box, as root, with the one-time code from the site's setup page:
#
#   curl -fsSL __GREECON_API_URL__/edge/install.sh | sudo bash -s -- GRC-XXXX-XXXX-XXXX
#
# It puts Node.js and the Greecon edge software on the box, gives the box its own credential, starts it,
# and waits to hear that Greecon can see it. Run it again with a new code to install a replacement box;
# run it again with no code to repair an installation. If a step fails it says what to check and stops.
# Before the box has its credential (step 5) the same line can simply be run again once the cause is fixed;
# after that the code is used up, so run it with no code at the end (it repairs the box and keeps its
# credential) or with a new code (it replaces the box).
#
# What it changes: /opt/greecon (software), /etc/greecon (the box's credential), /var/lib/greecon-edge
# (what the box keeps between restarts), one service called greecon-edge, one user called greecon, and
# one command, greecon-edge. Nothing else.
#
# Settings for testing the installer without a real box (never needed on a site):
#   GREECON_ROOT         install under this directory instead of /
#   GREECON_SKIP_SYSTEM  1 = do not create the user, touch systemd or the clock
#   GREECON_NODE         use this node program instead of downloading one
#   GREECON_API_URL      talk to this platform instead of the one this script came from

# Everything below is inside one function that is called on the very last line. A download that is cut
# short therefore does nothing at all, instead of running the first half of the installer.
main() {
  set -euo pipefail
  # The script itself may be arriving on standard input; nothing it runs may read from there.
  exec < /dev/null

  local API_URL="${GREECON_API_URL:-__GREECON_API_URL__}"
  local NODE_VERSION="22.11.0"
  local ROOT="${GREECON_ROOT:-}"
  local SKIP_SYSTEM="${GREECON_SKIP_SYSTEM:-0}"

  local OPT="$ROOT/opt/greecon"
  local EDGE="$OPT/edge"                 # the part the service itself may change: releases and which is current
  local ETC="$ROOT/etc/greecon"
  local STATE="$ROOT/var/lib/greecon-edge"
  local BIN="$ROOT/usr/local/bin/greecon-edge"
  local UNIT="$ROOT/etc/systemd/system/greecon-edge.service"
  local IDENTITY="$ETC/edge.json"
  local RELEASES="$EDGE/releases"

  local CODE=""
  local STEP=0
  # Set once this run has used its code to give the box its credential.
  local ENROLLED=0

  # ---- Saying things --------------------------------------------------------------------------------

  say() { printf '%s\n' "$*"; }
  step() { STEP=$((STEP + 1)); printf '\n[%s] %s\n' "$STEP" "$*"; }
  die() {
    printf '\nSTOP: %s\n' "$1" >&2
    if [ -n "${2:-}" ]; then printf '%s\n' "$2" >&2; fi
    if [ "$ENROLLED" = "1" ]; then
      printf '\nThe code has been used: this box now has its credential. Run the command again with no code at the end: it repairs the box and keeps the credential.\n' >&2
    else
      printf '\nRunning the same command again is safe once this is fixed.\n' >&2
    fi
    exit 1
  }

  # ---- What was typed -------------------------------------------------------------------------------

  while [ $# -gt 0 ]; do
    case "$1" in
      --code) CODE="${2:-}"; shift 2 ;;
      GRC-*|grc-*) CODE="$1"; shift ;;
      *) die "I do not know what '$1' means." "Usage: curl -fsSL $API_URL/edge/install.sh | sudo bash -s -- GRC-XXXX-XXXX-XXXX" ;;
    esac
  done

  # ---- Is this box ready? ---------------------------------------------------------------------------

  step "Checking the box"

  if [ "$SKIP_SYSTEM" != "1" ]; then
    [ "$(id -u)" -eq 0 ] || die "This must run as root." "Put 'sudo' in front of 'bash' in the command, as shown on the site's setup page."
    [ "$(uname -s)" = "Linux" ] || die "This is not a Linux box." "The Greecon box software runs on Linux: Debian, Ubuntu or Raspberry Pi OS."
    [ -d /run/systemd/system ] || die "This box does not use systemd." "Use Debian 12, Ubuntu 22.04 or later, or Raspberry Pi OS (64-bit)."
  fi

  local NODE_ARCH
  case "$(uname -m)" in
    x86_64|amd64) NODE_ARCH="x64" ;;
    aarch64|arm64) NODE_ARCH="arm64" ;;
    armv7l) NODE_ARCH="armv7l" ;;
    *) die "This kind of processor ($(uname -m)) is not supported." "Use a Raspberry Pi 4 or 5, or an ordinary x86 mini PC." ;;
  esac

  local tool
  for tool in curl tar sha256sum; do
    command -v "$tool" >/dev/null 2>&1 || die "'$tool' is not installed." "Install it with: apt-get install -y curl tar coreutils"
  done

  say "  Linux $(uname -m)."

  # Reaching Greecon, and agreeing with it about the time (a clock that is far out breaks secure connections
  # and stamps every reading wrongly).
  local HEADERS
  HEADERS="$(curl -fsS -D - -o /dev/null --max-time 20 "$API_URL/health" 2>&1)" || die "This box cannot reach Greecon at $API_URL." \
"Check, in this order:
  1. The network cable is in, or the router has a signal (cellular).
  2. This works:   ping -c 2 1.1.1.1
  3. This works:   curl -fsS $API_URL/health
If the site has a firewall it must allow outgoing HTTPS (port 443)."

  local SERVER_DATE SKEW
  SERVER_DATE="$(printf '%s' "$HEADERS" | tr -d '\r' | sed -n 's/^[Dd]ate: //p' | head -1)"
  if [ -n "$SERVER_DATE" ]; then
    SKEW=$(( $(date +%s) - $(date -d "$SERVER_DATE" +%s 2>/dev/null || date +%s) ))
    [ "$SKEW" -lt 0 ] && SKEW=$((-SKEW))
    if [ "$SKEW" -gt 300 ]; then
      if [ "$SKIP_SYSTEM" != "1" ] && command -v timedatectl >/dev/null 2>&1; then
        say "  The clock is $SKEW seconds out. Asking the box to set it from the network..."
        timedatectl set-ntp true >/dev/null 2>&1 || true
        sleep 15
        SKEW=$(( $(date +%s) - $(date -d "$SERVER_DATE" +%s 2>/dev/null || date +%s) ))
        [ "$SKEW" -lt 0 ] && SKEW=$((-SKEW))
      fi
      if [ "$SKEW" -gt 300 ]; then say "  WARNING: the clock is still about $((SKEW / 60)) minutes out. Set the time zone and time (timedatectl) before relying on the readings."; fi
    fi
  fi
  say "  Greecon is reachable."

  # ---- Node.js --------------------------------------------------------------------------------------

  step "Node.js $NODE_VERSION"

  local NODE
  if [ -n "${GREECON_NODE:-}" ]; then
    NODE="$GREECON_NODE"
    say "  Using $NODE."
  else
    NODE="$OPT/node/bin/node"
    if [ -x "$NODE" ] && [ "$("$NODE" -v 2>/dev/null)" = "v$NODE_VERSION" ]; then
      say "  Already installed."
    else
      mkdir -p "$OPT"
      local WORK TARBALL
      WORK="$(mktemp -d "$OPT/.download.XXXXXX")"
      trap 'rm -rf "$WORK"' EXIT
      TARBALL="node-v$NODE_VERSION-linux-$NODE_ARCH.tar.gz"
      say "  Downloading $TARBALL from nodejs.org..."
      curl -fsSL --max-time 600 -o "$WORK/$TARBALL" "https://nodejs.org/dist/v$NODE_VERSION/$TARBALL" \
        || die "Could not download Node.js from nodejs.org." "Check the box can reach https://nodejs.org (the same internet check as above)."
      curl -fsSL --max-time 60 -o "$WORK/SHASUMS256.txt" "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt" \
        || die "Could not download the checksum for Node.js." "Check the box can reach https://nodejs.org."
      (cd "$WORK" && grep " $TARBALL\$" SHASUMS256.txt | sha256sum -c - >/dev/null 2>&1) \
        || die "The Node.js download did not match its checksum, so it was not used." "Run the same command again. If it keeps failing the network is damaging downloads."
      tar -xzf "$WORK/$TARBALL" -C "$WORK"
      rm -rf "$OPT/node-v$NODE_VERSION"
      mv "$WORK/node-v$NODE_VERSION-linux-$NODE_ARCH" "$OPT/node-v$NODE_VERSION"
      ln -sfn "$OPT/node-v$NODE_VERSION" "$OPT/node"
      rm -rf "$WORK"
      trap - EXIT
      say "  Installed."
    fi
  fi

  # ---- A place to live ------------------------------------------------------------------------------

  step "Places for the software and its settings"

  if [ "$SKIP_SYSTEM" != "1" ]; then
    id -u greecon >/dev/null 2>&1 || useradd --system --home-dir /var/lib/greecon-edge --no-create-home --shell "$(command -v nologin || echo /usr/sbin/nologin)" greecon
  fi
  mkdir -p "$RELEASES" "$ETC" "$STATE"
  if [ "$SKIP_SYSTEM" != "1" ]; then
    chown root:greecon "$ETC" && chmod 750 "$ETC"
    chown -R greecon:greecon "$STATE" && chmod 750 "$STATE"
    # The service may change which version is current and fetch new ones, here and nowhere else in /opt.
    chown -R greecon:greecon "$EDGE"
  fi
  say "  Ready."

  # ---- The edge software ----------------------------------------------------------------------------

  step "The Greecon edge software"

  # The platform hands the software only to a box with a code that has not been used, or to a box that
  # already has a credential. The code is still unused here: it is spent in a later step.
  local AUTH_NAME AUTH_VALUE
  if [ -n "$CODE" ]; then
    AUTH_NAME="x-enrolment-code"
    AUTH_VALUE="$CODE"
  elif [ -f "$IDENTITY" ]; then
    AUTH_NAME="x-edge-device-token"
    AUTH_VALUE="$("$NODE" -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).secret)' "$IDENTITY")"
  else
    die "This box has no code and has not been installed before." "Make a new code on the site's setup page (Add the box) and run the command shown there."
  fi

  fetch() { curl -fsSL --max-time 300 -H "$AUTH_NAME: $AUTH_VALUE" "$@"; }

  local MANIFEST VERSION SHA256
  MANIFEST="$(fetch "$API_URL/edge/bundle.json" 2>/dev/null)" \
    || die "Greecon did not give the software to this box." "The code may have been used already, or may have expired (a code lasts seven days). Make a new one on the site's setup page. If this box was installed before, run the command again with no code at the end."
  VERSION="$(printf '%s' "$MANIFEST" | "$NODE" -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>process.stdout.write(String(JSON.parse(d).version)))')"
  SHA256="$(printf '%s' "$MANIFEST" | "$NODE" -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>process.stdout.write(String(JSON.parse(d).sha256)))')"
  [ -n "$VERSION" ] && [ -n "$SHA256" ] || die "Greecon's answer about the software was not what was expected." "Tell Greecon support; this is a fault at their end."
  case "$VERSION" in *[!0-9A-Za-z.+_-]*) die "Greecon's answer about the software was not what was expected." "Tell Greecon support; this is a fault at their end." ;; esac

  local RELEASE="$RELEASES/$VERSION"
  if [ -f "$RELEASE/greecon-edge.mjs" ] && [ "$(sha256sum "$RELEASE/greecon-edge.mjs" | cut -d' ' -f1)" = "$SHA256" ]; then
    say "  Version $VERSION is already here."
  else
    mkdir -p "$RELEASE"
    say "  Downloading version $VERSION..."
    fetch -o "$RELEASE/greecon-edge.mjs.partial" "$API_URL/edge/bundle" || die "The download of the software failed." "Run the same command again."
    if [ "$(sha256sum "$RELEASE/greecon-edge.mjs.partial" | cut -d' ' -f1)" != "$SHA256" ]; then
      rm -f "$RELEASE/greecon-edge.mjs.partial"
      die "The software did not match its checksum, so it was not used." "Run the same command again."
    fi
    mv "$RELEASE/greecon-edge.mjs.partial" "$RELEASE/greecon-edge.mjs"
    chmod 644 "$RELEASE/greecon-edge.mjs"
  fi
  [ "$("$NODE" "$RELEASE/greecon-edge.mjs" version 2>/dev/null)" = "$VERSION" ] || die "The software was downloaded but does not run on this box." "Tell Greecon support, with the output of: uname -a"

  local PREVIOUS
  PREVIOUS="$(readlink "$EDGE/current" 2>/dev/null || true)"
  if [ -n "$PREVIOUS" ] && [ "$PREVIOUS" != "$RELEASE" ]; then ln -sfn "$PREVIOUS" "$EDGE/previous"; fi
  ln -sfn "$RELEASE" "$EDGE/current"
  # Keep this version, the one before it and one more, so there is always something to go back to.
  local old kept=0
  for old in $(ls -1t "$RELEASES" 2>/dev/null); do
    if [ "$RELEASES/$old" = "$RELEASE" ] || [ "$RELEASES/$old" = "$PREVIOUS" ]; then continue; fi
    kept=$((kept + 1))
    if [ "$kept" -gt 1 ]; then rm -rf "${RELEASES:?}/$old"; fi
  done
  # The service, which runs as the user greecon, is the one that later switches versions and clears old ones
  # away, so everything under $EDGE must belong to it, the first release included. Otherwise the third update
  # could not remove the first, and would stop partway.
  if [ "$SKIP_SYSTEM" != "1" ]; then chown -R greecon:greecon "$EDGE"; fi
  say "  Version $VERSION is in place."

  # Two small programs: the one the service runs (which goes back to the previous version if a new one
  # keeps failing to start), and the one a person types. Both are owned by root, so the service cannot
  # change them.
  cat > "$OPT/run-edge" <<RUNEDGE
#!/bin/sh
# Starts the Greecon edge software. If a version that has just been updated to fails to start three times
# without ever reporting in, goes back to the version before it.
STATE="\${STATE_DIRECTORY:-$STATE}"
STATE="\${STATE%%:*}"
EDGE="$EDGE"
PROBATION="\$STATE/probation"
if [ -d "\$PROBATION" ]; then
  attempts=\$(cat "\$PROBATION/attempts" 2>/dev/null || echo 0)
  attempts=\$((attempts + 1))
  echo "\$attempts" > "\$PROBATION/attempts"
  if [ "\$attempts" -gt 3 ]; then
    previous=\$(cat "\$PROBATION/previous" 2>/dev/null || true)
    bad=\$(cat "\$PROBATION/version" 2>/dev/null || true)
    if [ -n "\$previous" ] && [ -d "\$EDGE/releases/\$previous" ]; then
      echo "Version \$bad did not start properly three times. Going back to \$previous."
      ln -sfn "\$EDGE/releases/\$previous" "\$EDGE/current"
      echo "\$bad" > "\$STATE/rejected-version"
    fi
    rm -rf "\$PROBATION"
  fi
fi
export STATE_DIRECTORY="\${STATE_DIRECTORY:-\$STATE}"
export GREECON_EDGE_CONFIG="\${GREECON_EDGE_CONFIG:-$IDENTITY}"
export GREECON_EDGE_HOME="\$EDGE"
exec "$NODE" "\$EDGE/current/greecon-edge.mjs" run
RUNEDGE
  chmod 755 "$OPT/run-edge"

  mkdir -p "$(dirname "$BIN")"
  cat > "$BIN" <<WRAPPER
#!/bin/sh
export STATE_DIRECTORY="\${STATE_DIRECTORY:-$STATE}"
export GREECON_EDGE_CONFIG="\${GREECON_EDGE_CONFIG:-$IDENTITY}"
exec "$NODE" "$EDGE/current/greecon-edge.mjs" "\$@"
WRAPPER
  chmod 755 "$BIN"

  # ---- Who this box is ------------------------------------------------------------------------------

  step "Giving this box its credential"

  if [ -n "$CODE" ]; then
    "$BIN" enrol --api "$API_URL" --code "$CODE" --identity "$IDENTITY" || die "The code was not accepted." "Make a new code on the site's setup page and run the command shown there."
    ENROLLED=1
  else
    say "  This box already has its credential."
  fi
  # Whether it was just written or was already there (an earlier run may have stopped before this line),
  # the service must be able to read it and nobody else may.
  if [ "$SKIP_SYSTEM" != "1" ] && [ -f "$IDENTITY" ]; then chown root:greecon "$IDENTITY" && chmod 640 "$IDENTITY"; fi

  # ---- Running it -----------------------------------------------------------------------------------

  if [ "$SKIP_SYSTEM" = "1" ]; then
    step "Skipping the service (testing)"
    say "  Start it with: $BIN run"
    return 0
  fi

  step "Starting the service"

  cat > "$UNIT" <<SERVICE
[Unit]
Description=Greecon edge: reads the site's devices and reports to Greecon
After=network-online.target time-sync.target
Wants=network-online.target

[Service]
Type=simple
User=greecon
Group=greecon
StateDirectory=greecon-edge
Environment=NODE_OPTIONS=--max-old-space-size=768
ExecStart=$OPT/run-edge
Restart=always
RestartSec=5
MemoryMax=1024M
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ProtectKernelTunables=true
ProtectControlGroups=true
ReadWritePaths=$STATE $EDGE

[Install]
WantedBy=multi-user.target
SERVICE
  if command -v timedatectl >/dev/null 2>&1; then timedatectl set-ntp true >/dev/null 2>&1 || true; fi
  # What the last run said about itself must not be mistaken for this one's.
  rm -f "$STATE/status.json"
  systemctl daemon-reload
  systemctl enable greecon-edge >/dev/null 2>&1
  systemctl restart greecon-edge
  say "  Started."

  # ---- Has Greecon heard from it? -------------------------------------------------------------------

  step "Waiting for Greecon to hear from this box"

  local HEARD=0 attempt
  for attempt in $(seq 1 24); do
    if "$BIN" status >/dev/null 2>&1; then HEARD=1; break; fi
    printf '.'
    sleep 5
  done
  printf '\n'
  "$BIN" status || true

  if [ "$HEARD" -eq 1 ]; then
    say ""
    say "Done. Greecon can see this box. On the site's setup page, give each device its address;"
    say "the box picks up each one within a minute. To look at this box any time:  greecon-edge status"
  else
    die "The software is installed and running, but Greecon has not heard from this box yet." \
"Look at what the box says:
  greecon-edge status
  journalctl -u greecon-edge -n 50 --no-pager
The most common cause is the box not reaching $API_URL: try 'curl -fsS $API_URL/health'."
  fi
}

main "$@"
