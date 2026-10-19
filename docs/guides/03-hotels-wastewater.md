# Guide: Hotels with a wastewater treatment plant

For a hotel, guesthouse or resort that runs its own wastewater plant and wants to know, without
walking round, that the water, the pumps and the plant are all right. Read `00-overview.md` first.

## What the platform does for you today

- **Shows tank and pump readings**: tank level (for example the treated-water storage or a sump), flow,
  line pressure and pump status.
- **Raises alerts** for a tank that is low or critical, a pump that runs with no flow (it needs the
  pump's running status as a reading), a reading that has gone quiet, and a sensor reporting bad data.
- **Tells you how old every reading is**, and says Unknown when the plant has stopped sending, which
  matters most when the hotel is closed.
- **Lets you set each tank's own low and critical levels** (Limits, on the site's page).
- **Records who changed what**, in the audit log, and tells the people you choose when something needs them, by email and (for Act now) text.
- **Shows what your solar kept on site**, at your own electricity price, when you give the platform your bills' prices.

## What it does not do yet

- It does not record laboratory results, sampling dates, sludge collection or sensor calibration, which
  is the evidence an inspector may ask for. That register is designed (see `docs/19-domain-playbook.md`)
  and not built. Until it is, keep your own monitoring register and documents as the regulations
  require.
- It does not read effluent quality (pH, oxygen, turbidity) and does not know how your plant is
  performing biologically. Treat anything beyond tank, flow, pressure and pump status as planned.
- It never says your plant complies. Sensors are indicators, not proof, and compliance rests on the
  required samples and the regulator's rules.
- It does not start, stop or change anything. Blowers, valves, dosing and bypass gates are never
  something Greecon will control remotely.
- It sends email, and text messages for Act now only (see `00-overview.md`). It does not phone anyone and does not use WhatsApp or Viber.
- It is not a safety system. Float switches, overflow protection, motor protection and the plant's own
  alarms stay as they are.

## About the regulations

Normative Act no. 8 of 28 December 2023 covers hotels of six rooms or more, and similar accommodation,
in coastal, lake and river zones that were discharging untreated wastewater, and Law 9115/2003 sets
duties for registers, training and self-monitoring. Whether the Act has since become law, and what
applies to your site, is for your lawyer and the regulator: this guide is not legal advice.

## Setup

1. Your Greecon project manager onboards your account and a site for the plant (a separate site for each
   property).
2. Add each tank level sensor, flow meter, pressure gauge and pump controller, and the pump's
   running-status signal if you want the no-flow alert.
3. The project manager installs and connects the box and the meters (`docs/launch/02-project-manager-manual.md`, `docs/launch/03-hardware-and-wiring.md`), then you say **who is told** and test it.
4. Set each tank's low and critical level to what is right for that tank (the standards are 35% and
   15%). If the treated water is stored and collected by vacuum truck, the storage level is your main
   operating signal, so a "low" limit that is really "high" for a storage tank may need a different
   reading: ask your Greecon contact.
5. Open the Overview before leaving for the evening and when you arrive. In the off-season, "Unknown"
   is the one to act on.

## Day to day

The Overview word and sentence; **Needs you**; and any reading marked **Out of date**.

## Getting help

Questions about setup, metering or what the platform does not yet cover for wastewater belong with
your Greecon contact.
