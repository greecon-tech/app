# Guide: Hotels With a Wastewater Treatment Plant

For a hotel or resort operating its own on-site wastewater treatment plant, where tank levels,
flow, and pump health need to be watched continuously — not just checked on a maintenance round.

## What the platform gives you today

- **Tank and flow readings**: tank level, flow rate, line pressure
  (`water.tank.level.percent`, `water.flow.lpm`, `water.pressure.bar`).
- **Pump readings and commands**: current pump status, and the ability to issue a pump command by
  hand or through an automation rule, always inside the safety limits set for that site
  (`water.pump.status`, `water.pump.command`).
- **Derived risk state** — the platform flags a tank approaching critical or low level, and a pump
  at risk of a dry run, computed automatically rather than left for someone to notice on a gauge
  (`water.tank.critical`, `water.tank.low`, `water.pump.dry_run_risk`).
- **Alerts** on any of the above crossing a threshold you set, each paired with a plain-language
  label and an icon, so a tank running low or a pump at dry-run risk gets flagged immediately rather
  than surfacing only on the next manual check.
- **Audit log and reports** for the operational evidence a hotel's own compliance or facilities
  team is typically asked to produce — see Audit and Reports in the app.

## What the platform does not yet cover

Water-quality parameters specific to treatment compliance — pH, turbidity, chemical oxygen demand,
and similar — are not yet modeled as canonical readings; today's water points cover tank level,
flow, pressure, and pump status/health, not effluent quality itself. If your plant's monitoring
depends on those readings, say so to your Greecon contact: treat anything beyond tank/flow/pump
monitoring as a planned extension to confirm before relying on it, not as already built.

## Before you start

- A site name for the plant (and a separate site per property, if you operate more than one hotel).
- An inventory of what the plant already meters: tanks, flow meters, pressure gauges, and pump
  controllers, plus their locations within the plant.
- If you'll be using an edge device, see `docs/14-edge-hardware-deployment.md`.

## Setup

1. **Your Greecon contact creates your account and your first site.** You'll receive a login and a
   temporary password — change it on first login (Settings → Account Security).
2. **Add your devices and reading points** from the site's page: each tank, flow meter, pressure
   gauge, and pump controller, and the specific measurement each one reports.
3. **Connect the real hardware.** See `docs/14-edge-hardware-deployment.md` for wiring the on-site
   edge device.
4. **Set tank and pump thresholds** before relying on any automated pump command — this is what
   keeps an automated response inside limits you've approved, and what the dry-run-risk and
   tank-critical flags are computed against.
5. **Watch Monitoring for current plant state**, and set up alerts for tank-critical and dry-run
   risk first — those are the two conditions most likely to cause real damage if missed.

## What to check day to day

- **Monitoring** for current tank levels, flow, and pump status across the plant.
- **Alerts** for anything needing attention — labeled in plain language with an icon, never color
  alone.
- **Audit** for a record of every manual override and automated action, when a compliance review
  needs it.

## Getting help

Questions about setup, metering, or what the platform does and doesn't yet cover for wastewater
quality belong with your Greecon contact.
