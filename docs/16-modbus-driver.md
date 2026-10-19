# Reading Modbus devices

The box reads devices in `apps/edge-agent/src/modbus/` (the reader and the poller) from a configuration the platform
gives it. There is no separate driver process, no config file on the box, and no broker between the two. This page says what
a reading is made of and where the platform's description of it lives. The wiring and the converter are in
[launch/03](launch/03-hardware-and-wiring.md); how a project manager enters a register is in
[launch/02, step 7.4](launch/02-project-manager-manual.md).

## Where a register is described

A device has a **connection** (where the box reaches it) and each reading has a **source** (which register, and how to
turn it into the reading). Both are typed by a person on the site's setup page, validated by the shared contract
(`packages/shared/src/modbus.ts`) with a sentence for every mistake, kept by the platform, and handed to the box in
`GET /edge/config`.

```json
{
  "connection": { "kind": "modbus_tcp", "host": "192.168.1.50", "port": 502, "unitId": 1 },
  "source": { "kind": "modbus", "registerType": "input", "address": 52, "dataType": "float32", "wordOrder": "big", "scale": 0.001, "part": "positive" }
}
```

**Connection.** `host` is an IP address or a host name; `port` 1 to 65535 (502 usually); `unitId` 1 to 247. Meters behind one
converter share its host and port and differ only by unit ID.

**Source.**

| Field | Meaning |
|---|---|
| `registerType` | `input` (a manual's 3xxxx, function code 4) or `holding` (4xxxx, function code 3) |
| `address` | **Zero-based**, as on the wire: a manual's **30053 is address 52**, 40001 is address 0 |
| `dataType` | `uint16`, `int16`, `uint32`, `int32`, `float32` (the last three take two registers) |
| `wordOrder` | For two-register values: `big` (the high half first, the usual) or `little` |
| `scale`, `offset` | `reading = raw × scale + offset` (watts to kilowatts: scale 0.001) |
| `linear` (alternative) | A straight line between two points for a 4 to 20 mA signal: the register holds `rawLow` at the bottom and `rawHigh` at the top, which are the reading's `engLow` and `engHigh` |
| `part` | `positive`, `negative` (as a positive number) or `absolute`: one signed value feeding two readings (grid import and export from one meter) |

## What a round of reading does

`DevicePoller.pollAll` reads each device's readings, groups them by device, and returns one telemetry message per
device that gave something, plus how each device answered. Devices behind **one converter** are read one after another;
devices behind **different converters** are read at the same time. A reading that cannot be read gives **no** reading and a sentence
saying why; nothing invents a value, and a reading that stops arriving is itself the signal that the platform turns
into "out of date".

A failure is classified:

- **transport** (no connection, a timeout, the converter did not answer): nothing else is asked of that device this
  round; after three failed rounds in a row it is asked once a minute until it answers;
- **refused** (the device answered with an exception: "has no register at that address", "does not support this kind
  of register", "is busy", "could not be reached by its converter"): the device is alive, and its other readings are
  still read.

The sentences are what a person at the site can act on, and they appear on the setup page and in `greecon-edge status`.

## Testing a register from the box

```
greecon-edge modbus-test --host 192.168.1.50 --unit 1 --type input --address 52 --data-type float32
```

prints the raw register values and the value they decode to. It uses the same reader as the box. If it cannot read, the
problem is the wiring, the converter's mode, the speed or the unit number, not Greecon.

## Known profiles

`packages/shared/src/device-profiles.ts` holds the registers of the Eastron **SDM630** (three-phase) and **SDM230**
(single-phase) in three roles each (grid, solar, load): total active power, input register 52 on the SDM630 and 12 on the
SDM230 (documented 30053 and 30013), 32-bit float, high half first, in watts, shown in kW. Each profile says how it is
fitted and how to check the direction. Anything else is added by hand from its own datasheet.

**Not verified against a real meter.** The registers are from the makers' published tables, the protocol is exercised
against a Modbus TCP server and a pretend meter (`scripts/pretend-meter.mjs`), and a real meter has not been read by this
software. The SDM230's serial speed differs between versions; read it from the meter's display.

## What it does not do

- **It never writes.** There is no write path in the reader, so no command can reach a device through a box.
- **No serial port on the box.** Serial meters are reached through a converter in Modbus TCP to RTU gateway mode.
- **No OPC-UA, no BACnet, no vendor cloud.** Each would be another reader beside this one.
