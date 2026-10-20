# Guide: Companies with a solar (PV) plant

For a company operating a rooftop array, a ground-mounted plant or an agrivoltaic site. Read
`00-overview.md` first.

## What the platform does for you today

- **Shows generation and consumption readings**: solar power, site consumption, grid import and export.
- **Shows battery readings**, if there is storage: charge and charge or discharge power, and a "battery
  charge is low" alert (standard 25%; set your own if your system keeps a larger reserve).
- **Tells you how old every reading is**, and says Unknown when the site has stopped sending. A short
  loss of connection does not alarm: a reading must be older than its limit first.
- **Reports solar surplus only when you say what a useful surplus is.** Spare solar power means something
  only against a load that could use it, so Greecon has no built-in number. On the site's page set
  **Smallest useful surplus** on the solar reading; until you do it makes no claim about surplus.

## What it does not do yet

- It does not compute energy from your meter's counters, specific yield, performance ratio or
  availability, and it does not check whether the plant made what it should. Those need meter-counter
  support and, for performance ratio, an irradiance sensor.
- It has no profiles for particular inverters beyond the generic Modbus reader, and it reads only: it
  never changes an inverter, a battery or an export limit.
- It does not detect faults by itself beyond the alerts listed in the overview.
- It does not replace your inverter's protection, your battery system's own protection, or your
  distribution operator's requirements. It is not a safety system.
- It sends email, and text messages for Act now only (see `00-overview.md`). It does not phone anyone and does not use WhatsApp or Viber.

## Setup

1. Your Greecon project manager onboards your account and one site for each plant.
2. Add each inverter, meter and battery controller and what it reports.
3. The project manager installs and connects the box and the meters (`docs/launch/02-project-manager-manual.md`, `docs/launch/03-hardware-and-wiring.md`), then you say **who is told** and test it (each person on the list should also have their own login with the Operator role, so that they can acknowledge an alert: see `00-overview.md`). Reading an inverter over Modbus is
   usually off by default and turning it on is your decision and your installer's: ask them first, and
   check what it does to your warranty.
4. Set the limits that suit the plant: the battery's low level, and the smallest useful surplus if you
   have a load to run from it.
5. Keep the bill and the distribution operator's meter as the legal record. Greecon's readings are your own
   view, not a billing meter.

## Day to day

Open the Overview. If a site says Unknown, check the data logger's power and network. A solar reading
marked **Out of date** is the last value received, not the present.

## About tariffs and net billing

Rules for self-producers in Albania are changing (a switch to net billing has been reported for 2027,
and the sources disagree on dates). Greecon holds no tariff or settlement rules and makes no claim about
what you will be paid. Ask your distribution operator.

## Getting help

Questions about setup, meters or what a reading means belong with your Greecon contact.
