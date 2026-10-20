# Guide: Farmers

For a farm with irrigated fields, a greenhouse, or both. Read `00-overview.md` first for how to read
the screen and what each alert means.

## What the platform does for you today

- **Shows soil and climate readings** per site: soil moisture, air temperature and humidity.
- **Shows the water path**: tank level, flow and pressure for the pump and tank that feed irrigation,
  and a pump alert if it runs with no flow (the box must read the pump's running state as well).
- **Shows solar and battery readings**, if the farm has them.
- **Tells you how old every reading is**, and says Unknown when a site has stopped sending.
- **Tells you when irrigation is due, once you tell it what "due" means for each field.** The right
  soil-moisture value to start irrigating depends on the soil, the crop, how deep the sensor sits and the
  sensor itself: the same reading can be too wet in sandy soil and too dry in clay. Greecon therefore has
  no standard for it. On the site's page, under Reading points, set **Start irrigating below** for each
  soil sensor, in the sensor's own unit. Until you do, Greecon says nothing about irrigation, which is
  the honest answer.
- **Keeps a record** of who changed which limit and when.

## What it does not do yet

- It does not start or stop anything. Manual Control and rules are simulations: they record the request
  and the checks, and the screen says "Simulated only".
- It does not give an irrigation amount or duration, and it does not use weather forecasts or crop
  water-use calculations.
- It sends email, and text messages for Act now only (see `00-overview.md`). It does not phone anyone and does not use WhatsApp or Viber.
- It does not yet record irrigation events or water use per field for an agency or buyer. If you apply
  for investment support (such as IPARD), ask the agency what evidence of metering it accepts, and keep
  your own records meanwhile.
- It does not promise a saving. No saving has been measured.

## Setup

1. Your Greecon project manager onboards your account and a site for each physical location (a field and a
   greenhouse are usually two sites).
2. Add each sensor or controller and what it reports, from the site's page.
3. The project manager installs and connects the box and the meters (`docs/launch/02-project-manager-manual.md`, `docs/launch/03-hardware-and-wiring.md`), then you say **who is told** and test it (each person on the list should also have their own login with the Operator role, so that they can acknowledge an alert: see `00-overview.md`). Until hardware is connected you can
   set everything up and look at the screens with no live readings; the site reads **Unknown**.
4. Set **Start irrigating below** on each soil sensor, and the tank's low and critical levels if the
   standard (35% and 15%) does not suit your tank. A starting value is a starting value: check it by
   hand over the first season and change it.
5. Open the Overview each morning, and Monitoring (under Sites) when you want every reading and its age.

## What to check day to day

- The Overview sentence and word. If it says Unknown, a site has gone quiet: check the gateway's power
  and network first.
- **Needs you** for anything open.
- A soil reading marked **Out of date** is not the field's current state.

## Getting help

Questions about setup, sensor wiring or what a reading means belong with your Greecon contact.
