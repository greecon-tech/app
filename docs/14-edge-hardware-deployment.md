# Edge hardware deployment

How a box at a site is installed, what it does, and what keeps it alive. The step-by-step version for the
person doing the job is [launch/02 Project manager manual](launch/02-project-manager-manual.md); what to buy and how it is
wired is [launch/03 Hardware and wiring](launch/03-hardware-and-wiring.md). This page is the engineering reference.

## What the box is

One program, `apps/edge-agent`, built into **one file** (`greecon-edge.mjs`) and served by the platform at
`GET /edge/bundle`, so that a box is installed and updated from the platform it reports to. It does five things,
none of which can stop the others:

1. **Reads** the devices it has been told about: Modbus TCP, one connection per converter, one request at a time,
   several converters at once (`modbus/reader.ts`, `modbus/poller.ts`). It reads every ten seconds unless the
   platform says otherwise. A device that stays silent is asked less often so that it cannot slow the others.
2. **Sends** what it read, in order, one request per round (`outbox.ts`). While anything waits, new readings join the
   back of the queue: the platform counts energy by joining each reading to the one before, so order matters.
3. **Keeps** readings it cannot send, on disk, for **at least three days** (`offline-buffer.ts`). In a long outage it keeps
   one reading per point per minute, which is what the platform keeps in history anyway, so that three days fit for
   about thirteen devices in about 115 MB of memory when the queue is full and has been read back from disk. The
   queue is written and read in pieces so that a small box is never asked to hold all of it at once.
4. **Says how it is:** a heartbeat every 30 seconds (every 10 for the first 15 minutes, when someone is probably
   watching) carrying its version, its clock, the queue, and how each device answered, with a sentence for each
   failure ("no answer from 192.168.1.50:502 (unit 2)").
5. **Takes fixes:** after a heartbeat that says a newer version exists it fetches it, checks the checksum the
   platform gave, runs it once, switches and restarts. The version before stays on disk. If the new one fails to
   start three times without reporting in, the starting program (`run-edge`, written by the installer and not
   changeable by the software) goes back to the previous version by itself and remembers not to try that one again.
   `EDGE_AUTO_UPDATE=false` on the platform holds every box where it is.

**It is configured from the platform, not from files.** The box asks `GET /edge/config` for its devices, their
addresses and unit numbers, and each reading's register, kind of number, word order and scale. A change made on the site's
setup page reaches the box within a minute, with no one touching it. The box keeps the last configuration it was
given, so a restart during an outage still knows what to read.

**It writes nothing to any device.** The reader has no write path. A box cannot switch anything, whoever asks.

## What was dropped

The earlier design had a local MQTT broker, a separate Modbus driver process, a hand-written `edge.env`, and
an `install.sh` that cloned the repository onto the box. None of that remains: `apps/edge-driver-modbus`, `infra/edge/`
and the broker on the box are gone. `apps/edge-simulator` still publishes synthetic readings to a broker for local
development, and the box can still forward a local broker's topic if `MQTT_URL` is set (an optional bridge,
off by default); neither is used on a site.

## Installing

```
curl -fsSL https://api.greecon.earth/edge/install.sh | sudo bash -s -- GRC-XXXX-XXXX-XXXX
```

The code comes from the site's setup page (**Add the box and get its install command**), is good for one use and seven
days, and is stored by the platform only as a hash. The script (`apps/api/src/setup/edge-install.sh`, served with the
platform's own address filled in) is one function called on its last line, so a download cut short does nothing:

1. Checks the box: Linux with systemd (Debian 12, Ubuntu 22.04 or later, Raspberry Pi OS 64-bit), root, `curl`, `tar`,
   `sha256sum`, a processor it has software for (x86-64, 64-bit ARM, 32-bit ARM).
2. Checks it can reach the platform, and that the clock agrees with it to within five minutes (asks the box to sync
   from the network, and warns if it still does not: a wrong clock stamps every reading wrongly).
3. Installs Node.js 22.11.0 from nodejs.org, checked against its published checksum.
4. Creates the places it uses and the user `greecon`.
5. Fetches the edge software from the platform with the code, checks its checksum, checks that it runs, and puts
   it in place as the current release, keeping the previous releases.
6. **Enrols:** `greecon-edge enrol` exchanges the code for the box's own credential and saves it in
   `/etc/greecon/edge.json` (readable by the service only, never printed).
7. Writes the service (`greecon-edge`, restarting always, with a memory ceiling and the usual hardening),
   starts it, and waits up to two minutes to hear that the platform can see it.

If a step fails it says `STOP:`, what to check, and that running the same line again is safe. Run again **with no code**
to repair an installation (it keeps its credential); with a **new code** to replace the box.

**Everything it changes:** `/opt/greecon` (the software), `/etc/greecon` (the credential), `/var/lib/greecon-edge` (the
queue, the last configuration, a status file), one service called `greecon-edge`, one user called `greecon`, and one
command, `greecon-edge`.

## The command on the box

```
greecon-edge status        how the box is; exits 1 if the platform has not heard from it in three minutes
greecon-edge modbus-test --host H --unit N --type input|holding --address A --data-type T [--word-order big|little]
                           reads one register and prints the raw numbers and the value (address counted from zero)
greecon-edge enrol --api URL --code C    (the installer runs this)
greecon-edge version
journalctl -u greecon-edge -n 50 --no-pager     what it has been saying
```

## How much it sends

One request every ten seconds carrying one message per device that answered, about 5 KB with its headers: roughly
**1.3 GB a month** at the default, and a good deal less when idle devices are backed off. The platform accepts
100 messages per batch and 400 KB, and rate-limits a box per source address; behind Railway set `TRUST_PROXY=1` so that
each site is counted by its own address. A cellular site should have a data plan of 5 GB or more, and its real
figure is worth reading from the router after a week. A poll interval per site is not a setting yet; making one is
the first thing to do if cellular data becomes the larger cost.

## Hardware

Specified, not named, in [launch/03](launch/03-hardware-and-wiring.md): a fanless x86 mini PC with an SSD or eMMC and a real-time
clock and power-on after power loss; a Modbus TCP to RTU converter; Eastron SDM630 and SDM230 meters; a Modbus analog
input module for 4 to 20 mA; submersible level and pressure transmitters. Anything that publishes its Modbus
registers can be mapped on the setup page without a change to the software.

## What it does not do

- **No local safety logic.** The platform's rules run in the cloud. The box does not decide to stop anything,
  because it cannot switch anything. Greecon is not a safety system; the equipment's own protection is the
  safety layer (`23-safety-and-security-case.md`).
- **No Modbus RTU on the box itself.** A serial meter is reached through a converter in gateway mode. A serial port
  on the box would need the reader extended; the converter is the cheaper, standard answer.
- **No OPC-UA, no BACnet, no vendor cloud APIs.** Each would be a new reader beside the Modbus one.
- **No remote shell.** Nobody can log in to a box from outside; the platform cannot run a command on it. Its
  software changes only by the update path above (checksummed, with rollback).
