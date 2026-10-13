# Edge Hardware Deployment

How to install the Greecon edge stack on a real industrial PC at a site (the Advantech
UNO-2271G V3 or an equivalent — see the hardware notes at the end of this doc) and get real
telemetry flowing into the platform.

## What actually ships in this pass

- **`apps/edge-agent`** — a small bridge that subscribes to the site's local MQTT topics and
  forwards telemetry to the cloud API's `POST /telemetry/ingest`. Readings the API cannot take
  are kept on disk (`BUFFER_PATH`) and replayed in order when it returns; a reading the API
  permanently refuses is discarded and logged, never retried forever. This did not exist before: nothing in the stack
  previously connected the MQTT side (`docs/04-edge-runtime.md`) to the HTTP side (the API), so a
  gateway publishing telemetry locally had no way to reach the dashboard at all. This closes that
  gap.
- **`apps/edge-simulator`** — already existed; publishes synthetic sine-wave readings to the local
  broker. Useful for proving the pipeline end-to-end before real device drivers exist. It is not,
  and should not be mistaken for, a real Modbus/OPC-UA driver.
- `infra/edge/` — the install script, systemd units, and config templates this guide uses.

## What does not exist yet (read this before you order cable)

- **Modbus TCP is covered, nothing else yet.** `apps/edge-driver-modbus` (`docs/16-modbus-driver.md`)
  reads real Modbus TCP registers. OPC-UA, Modbus RTU (serial), and 4-20mA analog (via a Modbus
  I/O module) still aren't implemented — the same principle applies to each: publish
  `TelemetryMessage` JSON (see `packages/shared`) to
  `greecon/{tenantId}/{siteId}/telemetry/{deviceId}` on the local broker; the edge-agent bridge
  doesn't care which protocol produced it.
- **Local safety evaluation isn't running on the edge yet.** `packages/gaia-core`'s safety checks
  currently only run inside the cloud API. The edge box does not independently block an unsafe
  command if it loses connectivity — the "operate safely during internet loss" goal in
  `docs/04-edge-runtime.md` is architecture, not yet code. Don't treat this box as a substitute for
  hard-wired physical interlocks (float switches, pressure relief valves) on anything that
  actually matters.
- **No site/device provisioning UI.** Site, gateway, device, and point IDs are fixed seed data or
  whatever's been inserted directly into Postgres (`docs/13-pilot-readiness.md`). You'll need
  those UUIDs by hand for now.

## Before you start: can this box actually reach the API?

This is the part that's easy to miss. The API's RBAC used to fall back to trusting a self-asserted
role header on any request with no session token at all — safe only because the API was never
reachable from outside its own deployment. Now that a real edge box needs to reach it from a farm
site, that fallback is disabled outright on a production deployment (`docs/07-security-and-rbac.md`)
— there is no header an outside caller can send that grants anything, on any route.

**The current approach — a public API with a device-only credential.** The API's Railway (or GCP)
domain is made public, but the only thing an unauthenticated caller can ever do with it is
`POST /telemetry/ingest`, and only with the right per-gateway secret:

1. Give the API service a public domain (same step as the web service already has one) — needed
   once, not per gateway.
2. Create the site on the platform's Admin page first if it doesn't exist yet, then open that
   site's own page and use the **"Add gateway"** form (needs `device:manage` — owner/admin/operator).
   It generates a real secret and shows it exactly once — copy it now, it is never shown again.
3. Set `EDGE_TOKEN` in this box's `edge.env` to that secret, and `API_URL` to the API's public URL.

The edge agent sends that secret as `x-edge-device-token`; the API looks it up against every
registered gateway (one query, not a slow per-attempt comparison) and grants access scoped to
whichever tenant that specific gateway belongs to — everything else, on any other route, is
rejected the same as an unauthenticated request. Every gateway gets its own secret this way: a
compromised one can inject fake telemetry for its own tenant only, cannot read anything, issue
commands, or reach any other route, and revoking it just means creating a new one and updating this
one box. Onboarding a second, third, or hundredth client's gateway needs nothing beyond this — no
Railway configuration, no environment variables, ever, per client.

**Legacy alternative — a single shared token for one fixed tenant.** Before per-gateway credentials
existed, the only option was one `EDGE_INGEST_TOKEN`/`EDGE_INGEST_TENANT_ID` pair set as Railway
environment variables on the API service, shared by every gateway across that one tenant. Still
works if already configured (`docs/07-security-and-rbac.md`), but a new deployment should always
use the per-gateway form above instead — the shared token can't support more than one client's
tenant at all, since `EDGE_INGEST_TENANT_ID` is a single fixed value.

**Alternative — a private tunnel, no public domain on the API at all.** If a client's compliance
posture rules out the API ever having a public domain, put the edge box on the same private network
as the API via WireGuard or Tailscale instead of generating one. This changes *which network the
request travels over*, not *whether it needs a credential* — a production deployment
(`NODE_ENV=production`, set by both Dockerfiles) rejects an unauthenticated request unconditionally,
tunnel or not (`docs/07-security-and-rbac.md`), so `EDGE_TOKEN` is still required either way:

1. Deploy Tailscale (or WireGuard) on the machine/network where the API actually runs (a
   Tailscale subnet-router service alongside it on Railway, or your GCP VPC directly).
2. Install the same client on the edge box during provisioning (`apt install tailscale` on
   Ubuntu, then `tailscale up`, or the equivalent WireGuard peer config).
3. Generate a gateway secret the same way as the public approach above (Admin page → the site →
   "Add gateway"), and set `EDGE_TOKEN` to it.
4. Set `API_URL` in `edge.env` to the API's address **on that private network**, not a public
   hostname — the only thing this alternative actually changes.

If the edge box happens to be on the same LAN/VPC as the API already (e.g. a pilot running
everything in one building), you can skip the tunnel too and point `API_URL` straight at the API's
internal address — `EDGE_TOKEN` is still required, for the same reason.

## Step 1 — Flash the OS

Install Ubuntu Server 24.04 LTS (or whatever current LTS the vendor image supports) on the
industrial PC. Advantech ships UNO-series units with Ubuntu pre-validated — check the box's
support page for a vendor-provided image before doing a generic install, since it'll already have
the right kernel modules for the onboard serial/expansion hardware.

## Step 2 — Network

Configure the two NICs deliberately, don't leave both on DHCP from the same network:

- **NIC 1 (OT/field network):** static IP, on the same subnet as your Modbus/OPC-UA field devices
  once they exist. No internet route needed on this interface.
- **NIC 2 (uplink):** whatever gets this box onto the internet/VPN (site LAN, or the cellular
  module if this is a genuinely remote site). This is the interface the Tailscale/WireGuard tunnel
  above rides on.

## Step 3 — Get the software onto the box

From your workstation, add a read-only deploy key for this repo (GitHub → repo Settings → Deploy
keys → Add deploy key, do not check "Allow write access") and note the private key path — the
install script clones over SSH using whatever key is already configured for the `root` user
running it.

```sh
scp infra/edge/*.sh infra/edge/*.conf infra/edge/*.service infra/edge/*.example \
    you@edge-box:/tmp/greecon-edge/
ssh you@edge-box
cd /tmp/greecon-edge
sudo REPO_URL=git@github.com:greecon-tech/demo.git GIT_REF=main ./install.sh
```

`install.sh` (in `infra/edge/`) does the rest: installs Node.js 22 and Mosquitto, configures the
broker to listen on loopback only (`infra/edge/mosquitto-edge.conf` — this broker never needs to
be reachable from the network, only the local edge-agent and driver processes talk to it), clones
the repo into `/opt/greecon`, builds `edge-agent` and `edge-simulator`, and installs both as
systemd services (only `greecon-edge-agent` is enabled by default).

## Step 4 — Configure this site

```sh
sudo nano /etc/greecon/edge.env
```

Fill in the blanks from `infra/edge/edge.env.example`:

- `TENANT_ID`/`SITE_ID` — create the site on the platform's Admin page first if it doesn't exist
  yet, then copy its ID from there (no more reading it out of Postgres by hand).
- `GATEWAY_ID`/`EDGE_TOKEN` — both come from the same "Add gateway" form on that site's own page
  (the prerequisite step above): `GATEWAY_ID` is the created gateway's own ID, `EDGE_TOKEN` is the
  secret shown once on that same screen — copy both before leaving the page, there's no provisioning
  console command needed and no way to see the secret again afterward.
- `API_URL` — the API's public URL, or its private-network address if using the tunnel alternative
  — see the prerequisite step above for which one applies. `EDGE_TOKEN` is required either way; the
  tunnel only changes which network the request travels over, not whether it needs a credential.

## Step 5 — Start it

```sh
sudo systemctl start greecon-edge-agent
sudo systemctl status greecon-edge-agent
sudo journalctl -u greecon-edge-agent -f
```

You should see:

```
Greecon edge agent starting for <tenant>/<site>, gateway <gateway>.
Edge agent connected to mqtt://127.0.0.1:1883, bridging greecon/<tenant>/<site>/telemetry/+ -> <API_URL>/telemetry/ingest
```

## Step 6 — Prove the pipeline end-to-end before wiring real devices

With no real driver publishing yet, there's nothing on the telemetry topic. Temporarily run the
simulator to confirm the whole chain — broker → agent → API → dashboard — actually works:

```sh
sudo systemctl enable --now greecon-edge-simulator
```

Open the Overview or site detail page for this site in the web app; you should see live-updating
readings within about 10 seconds. Once confirmed:

```sh
sudo systemctl disable --now greecon-edge-simulator
```

Leave it disabled for a live pilot — it publishes fake numbers under the same site/device IDs your
real equipment will use, which would corrupt real readings if left running.

## Step 7 — Wiring in a real device

`apps/edge-driver-modbus` reads real Modbus TCP registers and publishes them to the same topic
the simulator uses — see `docs/16-modbus-driver.md` for the config format. `install.sh` already
builds and installs it as `greecon-edge-driver-modbus`, just not enabled by default (there's no
`/etc/greecon/modbus.json` yet — write one for this site's real registers, referencing the
device/point IDs from Sites/Assets/Devices/Points provisioning, then
`systemctl enable --now greecon-edge-driver-modbus`).

For anything other than Modbus TCP (OPC-UA, Modbus RTU over serial, an analog-to-Modbus I/O
module), the same principle applies: publish the same `TelemetryMessage` JSON shape (see
`apps/edge-simulator/src/index.ts` or `apps/edge-driver-modbus/src/index.ts` for the exact shape,
and `packages/shared`'s `canonicalPoints` for valid `canonicalName` values) to
`greecon/{tenantId}/{siteId}/telemetry/{deviceId}` on the local broker
(`mqtt://127.0.0.1:1883` from this box). `greecon-edge-agent` doesn't need to change at all — it
bridges whatever's on that topic.

## Troubleshooting

- **`journalctl` shows repeated "API unreachable, buffering reading" lines.** The agent can reach
  the local broker but not `API_URL`. Check the tunnel/VPN is actually up (`tailscale status` or
  `wg show`) and that `API_URL` resolves and is reachable with `curl $API_URL/health` from the
  edge box itself.
- **No readings show up at all, not even a buffering message.** Nothing is publishing to the
  telemetry topic. Confirm with `mosquitto_sub -h 127.0.0.1 -t 'greecon/#' -v` — if you see nothing
  there, the problem is upstream of the agent (simulator not running, or a real driver not
  publishing).
- **`systemctl status greecon-edge-agent` shows it repeatedly restarting.** Check
  `journalctl -u greecon-edge-agent -e` for the actual error — most likely `/etc/greecon/edge.env`
  is missing a required value, or Node.js failed to resolve `@greecon/shared` (re-run
  `npm run build:packages` in `/opt/greecon`).
- **Backlog keeps growing and never drains.** While the API is unreachable the agent keeps readings
  in `/var/lib/greecon-edge/buffer.jsonl` (set by the systemd unit; override with `BUFFER_PATH`), so
  a restart or power cut does not lose them, and replays them oldest-first once the API answers.
  The backlog is capped at `BUFFER_MAX_ITEMS` (default 50,000): beyond that the OLDEST readings are
  discarded, and the journal says how many ("Buffer full: discarded N oldest reading(s)"). Replay is
  rate-limited by the API (see "How much traffic a site sends" below), so a very large backlog drains
  over time rather than instantly. If it never shrinks, look for a line saying why: `status 401`/`403`
  means the gateway secret is wrong (fix `EDGE_TOKEN`; the readings are kept and will be sent), `429`
  means the API is rate-limiting this site.
- **`journalctl` shows "refused and discarded".** The API understood the reading and said it can
  never be accepted: an unknown device or point (provision it first), a reading timestamped in the
  future (the box's clock is wrong: fix NTP), or a malformed message. These are dropped on purpose so
  one bad message cannot block the queue; the log line says which reading and why.

## How much traffic a site sends

The agent makes one request per device per poll. At the example 5-second Modbus poll that is 12
requests a minute per device, so a site with 50 devices sends about 600 a minute. The API accepts
600 ingest requests a minute per source address (`apps/api/src/common/client-throttler.ts`,
`INGEST_THROTTLE`). If the API runs behind a proxy such as Railway's, set `TRUST_PROXY=1` on the API
service (see `docs/11-deployment-railway.md`) so each site is counted by its own address and not
all sites together. Past roughly 50 devices at one site, batching readings per request is the next
step; it is not built because no site is that large yet.

## Hardware reference

Recommended unit: **Advantech UNO-2271G V3** (Intel Atom x7211RE, 8GB LPDDR5, 64GB eMMC, dual GbE,
DIN-rail, 9–36V DC, with the RS-485/RS-232 and 4G/5G iDoor expansion modules for Modbus RTU field
devices and cellular backhaul). Cheaper alternative for a lean multi-site rollout: OnLogic CL260.
More headroom if edge-side AI/optimization is planned later: ASUS IoT PE1000U. None of these read
analog (4-20mA) sensors directly — pair with a Modbus remote I/O module (e.g. an Advantech
ADAM-4000 series unit) for those.
