# Guide: Other Natural-Resource Operations

For any corporation managing water, energy, or agricultural resources that doesn't fit one of the
other three guides — a municipal pump station, a food-processing plant's utilities, a campus energy
system, a cooperative managing shared irrigation infrastructure, and similar. The platform's design
goal is the same regardless of sector: unify physical infrastructure that was previously monitored
(or not monitored at all) through separate, disconnected systems into one operational view.

## What the platform gives you

The same underlying building blocks described in the other three guides, assembled to fit your own
operation:

- **Energy readings**: solar generation, consumption, battery, and grid import/export.
- **Water readings**: tank level, flow, pressure, and pump status/command, with automatic
  tank-critical, tank-low, and pump-dry-run-risk flags.
- **Agriculture readings**: soil moisture, air temperature, humidity, and irrigation commands.
- **Alerts**, paired with plain-language labels and icons rather than color alone, on any reading
  crossing a threshold you set.
- **Automation rules** that act within safety limits you approve, each with its own log of exactly
  when and why it fired.
- **Multi-site oversight** if your operation spans more than one physical location — each site
  keeps its own devices, readings, and thresholds, visible together from one account.
- **Audit log and reports** for whatever operational evidence your own compliance or stakeholder
  reporting requires.

If your operation needs a reading category not listed above — anything beyond energy, water, and
agriculture — say so to your Greecon contact before assuming it's covered. The platform's current
reading set (`CanonicalPointName` in the shared contract) is fixed to what's listed here; extending
it to a new resource type is a real scoping conversation, not a settings change.

## Before you start

- A site name for each physical location you want monitored.
- An inventory of what each site already meters or controls, and where each sensor or controller
  sits physically.
- If you'll be using an edge device, see `docs/14-edge-hardware-deployment.md` for what it needs.

## Setup

1. **Your Greecon contact creates your account and your first site.** You'll receive a login and a
   temporary password — change it on first login (Settings → Account Security).
2. **Add your devices and reading points** from each site's page: every sensor and controller, and
   the specific measurement each one reports. Repeat per site if you operate more than one.
3. **Connect the real hardware.** See `docs/14-edge-hardware-deployment.md` for wiring the on-site
   edge device that reads your equipment and sends readings to Greecon.
4. **Set safety limits and alert thresholds** for each site before relying on any automation rule —
   this is what keeps automated action inside limits you've approved.
5. **Watch Monitoring and Analytics** once hardware is connected, and prioritize the alerts most
   likely to prevent real damage or downtime for your specific operation.

## What to check day to day

- **Monitoring** for the current state of every site at a glance.
- **Alerts** for anything needing attention.
- **Analytics** for trends across the time ranges available in the app.
- **Audit** and **Reports** for a record of manual overrides, automated actions, and exported
  evidence, whenever a stakeholder or regulator asks for one.

## Getting help

Questions about what the platform currently covers for your specific sector, or what to scope for
a future extension, belong with your Greecon contact.
