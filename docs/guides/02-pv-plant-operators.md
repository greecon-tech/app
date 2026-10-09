# Guide: Companies With a PV Plant

For a company operating a solar (PV) generation site — a rooftop array, a ground-mounted plant, or
an agrivoltaic site combining solar with crops underneath.

## What the platform gives you

- **Generation and consumption readings**: solar power output, site consumption, grid import and
  export (`energy.solar.power.kw`, `energy.consumption.kw`, `energy.grid.import.kw`,
  `energy.grid.export.kw`).
- **Battery readings**, if the site has storage: state of charge and charge/discharge power
  (`energy.battery.soc.percent`, `energy.battery.power.kw`).
- **Derived operational state** — the platform computes whether the site currently has surplus
  generation available or the battery is constrained (`energy.surplus_available`,
  `energy.battery.constrained`), rather than leaving you to work that out from raw numbers.
- **Alerts** on generation drop-off, grid export anomalies, or battery state moving outside a range
  you set.
- **Automation rules** that can act on derived state — for example, routing surplus generation to a
  pump or irrigation system on an agrivoltaic site, logged with exactly when and why each rule fired.
- **Reports** for the production and performance evidence a plant operator typically needs to
  produce — see Reports in the app, and `docs/13-pilot-readiness.md` for what's covered today.

## Before you start

- A site name for each physical plant (one company with several plants should create one site per
  plant, not one site for all of them).
- An inventory of what each site actually meters: inverters, the grid-tie meter, battery system if
  present, and (for an agrivoltaic site) the agricultural equipment the panels sit above.
- If you'll be using an edge device, see `docs/14-edge-hardware-deployment.md`.

## Setup

1. **Your Greecon contact creates your account and your first site**, one per plant. You'll receive
   a login and a temporary password — change it on first login (Settings → Account Security).
2. **Add your devices and reading points** from the site's page: each inverter, meter, and (if
   present) battery controller, and the specific measurement each one reports.
3. **Connect the real hardware.** See `docs/14-edge-hardware-deployment.md` for wiring the on-site
   edge device that reads your meters and sends readings to Greecon.
4. **Set alert thresholds** for the readings that matter most — a generation drop-off during
   daylight hours is usually the first one worth catching, since it's often the earliest sign of an
   inverter fault or a soiled/shaded panel.
5. **Watch Monitoring and Analytics** for live and historical production once hardware is
   connected, and use Reports when you need a production record for a stakeholder or regulator.

## What to check day to day

- **Monitoring** for current generation, consumption, and grid exchange across every plant you
  operate.
- **Alerts** for anything needing attention, each one labeled in plain language with an icon — never
  color alone.
- **Analytics** for production trends — comparing a day's generation against the same period last
  week or last month is usually the fastest way to notice a real problem versus ordinary weather
  variation.

## Getting help

Questions about setup, metering, or inverter integration belong with your Greecon contact.
