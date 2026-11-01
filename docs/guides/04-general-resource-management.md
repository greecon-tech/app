# Guide: Any other site that manages water, energy or another resource

For a municipal pump station, a food-processing plant's utilities, a campus energy system and similar
sites that do not fit the other three guides. Read `00-overview.md` first.

## What the platform does for you today

The platform has sixteen kinds of reading: tank level, flow, pressure, pump status and command; solar
power, consumption, battery charge and power, grid import and export; soil moisture, air temperature,
humidity and an irrigation command; and gateway online. It shows them with their age, derives a small
set of states from them (tank critical or low, a pump running with no flow, battery low, readings out of
date, a sensor reporting bad data), raises an alert for each, and computes one answer for the site: Stable,
Attention needed, Action required or Unknown.

Limits that vary from site to site are yours to set, per reading, from the site's page: a tank's critical
and low levels, a battery's low charge, the flow at or below which a running pump raises the no-flow alert
(standard 0.2 litres a minute), how long a reading may go without renewal before it is shown as out of date,
and, for soil moisture and solar surplus, the value at which irrigation is due or a surplus is useful (with no
setting, the platform says nothing).

## What it does not do yet

- It does not know about readings outside those sixteen. A customer-defined reading kind is planned,
  and will be added when several sites ask for the same one.
- It does not control anything. Commands are simulations and the screen says so.
- It sends email, and text messages for Act now only (see `00-overview.md`). It does not phone anyone and does not use WhatsApp or Viber.
- It is not a safety system and does not replace hard-wired protection.
- It keeps no retention rule yet: readings are kept until the account is deleted on request. You can download,
  whenever you like (**Reports**), every reading for the last 31 days, hourly averages for up to a year, your
  alerts, your audit log and how your account is set up. If you stop, Greecon also gives you every reading it
  holds, as a file, on request, and you can ask in writing for the account and everything in it to be deleted.

## Setup

1. Your Greecon project manager onboards your account and a site for each physical location.
2. Add each device and the readings it reports.
3. The project manager installs and connects the box and the meters (`docs/launch/02-project-manager-manual.md`, `docs/launch/03-hardware-and-wiring.md`), then you say **who is told** and test it (each alert message carries an **I have seen this** link, so a person on the list needs no login to acknowledge it: see `00-overview.md`).
4. Set the limits that suit your equipment.
5. Use the Overview as your daily check, and Monitoring (under Sites) when you want every reading.

## If your needs are different

Say so to your Greecon contact. A feature is added when real sites need it and the need is written
down, and the way it works is decided with you: that is how the platform is meant to grow
(`docs/17-constitution.md`).

## Getting help

Questions about setup or what a reading means belong with your Greecon contact.
