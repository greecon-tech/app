# Edge runtime

The box at a site is a small computer that reads the site's meters and sensors and reports to the platform. What
runs on it today is described in [14 Edge hardware deployment](14-edge-hardware-deployment.md); how it reads a device is in
[16 Reading Modbus devices](16-modbus-driver.md). This page is the design intent, and says which parts exist.

## What exists

- **Read** the site's devices over Modbus TCP, from a configuration the platform gives the box.
- **Report** the readings to the platform in order, and keep them on disk for about three days (for a site of up to
  about thirteen devices; a site with more devices keeps fewer days) when the platform cannot be reached, sending them
  when it can.
- **Say how it is:** a heartbeat with its version, its clock, its queue and how each device answered.
- **Take fixes** from the platform, with a checksum, a trial run, and an automatic return to the previous version.
- **Stay read-only.** There is no write path to any device.

## What the design intended, and has not been built

The first design made the box a local control layer that could operate through an internet loss: a local broker,
local safety rules, local automation, a manual override with strict permissions. **None of that runs on the box today,
because nothing on a box can switch anything.** It stays here as the intent for the day control is added, and that day
is gated by the release gate in [23 Safety and security case](23-safety-and-security-case.md):

- Execute safety rules and approved automation locally, so that a lost internet connection never leaves equipment
  uncontrolled or unprotected.
- Keep the last good configuration (the box does this already, for reading).
- Required interlocks, when control exists: an emergency stop path, maximum run times, minimum rest times, dry-run
  detection (pump on and flow zero), an overpressure cut-off, sensor-quality gating, fail-safe command behaviour, a
  manual override that records a reason, an identity, a time and a duration, and no way for a remote user to
  bypass a hard rule.

In the meantime the **rules run in the cloud** (`packages/gaia-core`): they decide what is wrong, and the platform tells
people. A command is only ever **simulated**: its request, its safety checks and the person are recorded, and nothing is sent
(`adr/0004`).

## Messages

The platform's readings contract is `TelemetryMessage` (`packages/shared`). A box sends them in batches to
`POST /telemetry/ingest-batch` (the box sends up to a hundred messages and 400 KB at a time; the platform accepts up
to a hundred and 1 MB). The topic names from the first design remain the
convention for the optional local-broker bridge (`MQTT_URL`) and for `apps/edge-simulator`, used in development:

- `greecon/{tenantId}/{siteId}/telemetry/{deviceId}`
- `greecon/{tenantId}/{siteId}/health/{gatewayId}`
- `greecon/{tenantId}/{siteId}/commands/{deviceId}` and `.../ack`
- `greecon/{tenantId}/{siteId}/edge/{gatewayId}/sync`
- `greecon/{tenantId}/{siteId}/alerts`
