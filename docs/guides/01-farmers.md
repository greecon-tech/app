# Guide: Farmers

For a farm with irrigated fields, a greenhouse, or both — anywhere soil moisture, weather, water
delivery, and power all need to be watched together instead of as separate systems.

## What the platform gives you

- **Soil and climate readings** per field or greenhouse: soil moisture, air temperature, humidity
  (`agri.soil.moisture.percent`, `agri.air.temperature.c`, `agri.humidity.percent`).
- **Water delivery readings** for the pump and tank feeding your irrigation: tank level, flow rate,
  line pressure (`water.tank.level.percent`, `water.flow.lpm`, `water.pressure.bar`).
- **Irrigation commands**, issued either by a person or by an automation rule
  (`agri.irrigation.command`), always inside the safety limits set for that field.
- **Solar and battery readings**, if the farm runs on-site solar or agrivoltaic panels
  (`energy.solar.power.kw`, `energy.battery.soc.percent`).
- **Alerts** when a reading moves outside the range you set — a tank running low, soil drying out
  faster than expected, a pump reporting a fault — instead of finding out on a field visit.
- **Automation rules** that act on your behalf within limits you approve — for example, starting
  irrigation when soil moisture drops below a threshold, with the rule's own log of exactly when it
  fired and why.

## Before you start

- A site name for each physical location (one farm can have several sites — a field and a
  greenhouse are usually two separate sites).
- A list of what you want to measure at each site, and the sensors or controllers already installed
  or planned for each one.
- If you'll be using an edge device (the small on-site computer that reads your sensors and talks to
  Greecon), see `docs/14-edge-hardware-deployment.md` for what it needs to run.

## Setup

1. **Your Greecon contact creates your account and your first site.** You'll receive a login and a
   temporary password, which you should change on first login (Settings → Account Security).
2. **Add your devices and reading points.** From your site's page, add each sensor or controller
   (a soil probe, a pump controller, an irrigation valve) and the specific measurement it reports.
   If you manage more than one site, repeat this for each one.
3. **Connect the real hardware.** An edge device on-site reads your sensors and sends readings to
   Greecon — see `docs/14-edge-hardware-deployment.md` for wiring it up. Until hardware is
   connected, you can still set everything up and see the platform with no live readings yet.
4. **Set safety limits and alert thresholds** for each field before relying on any automation —
   this is what keeps an automated irrigation rule from ever running outside what you've approved.
5. **Watch the Monitoring and Analytics pages** for live readings and trends once hardware is
   connected, and set up the alerts that matter most to your operation first (tank level and pump
   faults are usually the ones worth catching early).

## What to check day to day

- **Monitoring** for the current state of every field and greenhouse at a glance.
- **Alerts** for anything that needs attention — each one is paired with a plain-language label and
  an icon, never color alone.
- **Analytics** for trends over the last day, week, or month — useful for spotting a slow drift
  (a tank draining faster than usual) before it becomes an emergency.

## Getting help

Questions about setup, sensor wiring, or what a reading means belong with your Greecon contact.
