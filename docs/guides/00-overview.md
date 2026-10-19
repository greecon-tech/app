# Guides

These are setup and operating guides for people who use the Greecon platform day to day. The files
in `docs/` above them describe how the platform is built. Each guide is written for one kind of site
and assumes no prior knowledge of Greecon's terms.

- `01-farmers.md`: irrigated fields, greenhouses and other agricultural sites.
- `02-pv-plant-operators.md`: solar generation sites, including agrivoltaic sites.
- `03-hotels-wastewater.md`: hotels and resorts running their own wastewater plant.
- `04-general-resource-management.md`: any other site that manages water, energy or another resource
  (a pump station, a food plant's utilities, a campus).

## What Greecon is, today

Greecon is an early platform. It watches readings from your equipment, shows you one answer to "is
everything all right, and what needs me?", and raises an alert when something needs attention. It does
not control your equipment: every command is a simulation, and nothing is sent to a pump, valve or
inverter. It is not a safety system. The protection built into your equipment stays in place and
remains the safety layer.

Where something is planned rather than built, these guides say so. Nothing here describes a feature
that is not running.

## How to read the screen

The Overview opens with one sentence and one word:

| You see | It means |
|---|---|
| **Stable** (steady circle) | Every site is sending current readings and nothing is open |
| **Attention needed** (triangle) | A warning is open that someone should plan for |
| **Action required** (diamond) | A critical alert is open. It stays until its cause clears, even after someone acknowledges it |
| **Unknown** (hollow circle, dashed outline) | Greecon cannot tell: a site has not sent readings yet, or its readings are out of date |

Under it, "Needs you" lists what is open, with the first thing to do. Every reading shows which site it
came from and how old it is. A reading marked **Out of date** is the last value received: do not treat
it as current. **Simulated** marks readings that are made up, as in the demo.

"How is this calculated?" on the Overview explains each answer. If you only remember one thing: Greecon
never counts silence as good news.

## The same steps for every site

1. Your Greecon contact creates your account and your first site. You receive a login and a temporary
   password; change it on first login (Account, then Settings).
2. Add each device and the readings it reports, from the site's page.
3. Connect the real hardware: `docs/14-edge-hardware-deployment.md`.
4. Set the limits that matter for your site (the **Limits** control on each reading point). Greecon
   has a standard for a tank's low and critical level and a battery's low charge, and none for irrigation
   or solar surplus: it says nothing about those until you set them.
5. Watch the Overview. Open **Sites** for each site's own page, with its readings, trends and equipment.

## What each alert means and what to do first

| Alert | What it means | First step |
|---|---|---|
| Tank level is critical | The level is below the critical limit (standard 15%, or your own) | Check the water supply and refill as soon as it is safe |
| Tank level is low | The level is below the low limit (standard 35%, or your own) | Plan a refill before it falls further |
| The pump is running but no water is flowing | The pump reports running and flow has been at or below your no-flow limit for 30 seconds | Stop the pump, then check the water source and the intake line before starting it again. Greecon does not stop the pump; your motor protection does |
| Battery charge is low | Charge is below the low limit (standard 25%, or your own) | Reduce non-essential load or check that the battery is charging |
| Readings from this site are out of date | One or more readings are older than their limit | Check the gateway's power and network connection. Until readings resume, the values shown are the last ones received |
| A sensor is reporting bad data | A reading's quality is marked bad | Inspect the sensor and its wiring. Commands that depend on it stay blocked until it recovers |

Alerts are shown by priority: **Act now** (needs a person within minutes), **Check today**, and **For
your information**. Today alerts appear in the app and are not yet sent to your phone, so someone has
to open it. Sending alerts by message is the next thing planned.

## Getting help

Questions about setup, wiring or what a reading means belong with your Greecon contact, currently
Eridon Manuka (eridon.manuka@greecon.earth).
