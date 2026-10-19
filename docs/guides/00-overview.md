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

1. Your Greecon project manager onboards your account, makes your site from a template for your kind of
   site, and installs the box and the meters with an electrician. You receive a login and a temporary
   password; you choose your own the first time you sign in.
2. The project manager connects the devices and checks every reading against the real world, and hands
   over a printed sheet saying where everything is (`docs/launch/02-project-manager-manual.md`).
3. **Say who is told**, in the order they should hear, under **Who is told**, and send each person a test
   message. Ask each to confirm it arrived. Nothing is commissioned until this is done.
4. Agree the limits that matter for your site (the **Limits** control on each reading point). Greecon
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
your information**. They also reach people, by the rules you can read on **Who is told**:

- **Act now** is emailed to the first person on your list at once, texted ten minutes later if nobody has
  acknowledged it, and sent to the next person thirty minutes after that, and so on down the list.
  Acknowledging it in Greecon stops the chain and tells the others who took it.
- **Check today** is one email to the first person, held until morning if it comes in quiet hours
  (22:00 to 07:00 unless you change them).
- **For your information** is only shown, never sent.
- One message at 07:30 each day says whether everything is all right, and what needs a look if not.

You choose the people and their order, and see what was sent and what the email or text service said
about it. "Accepted for delivery" means the service took it; Greecon cannot know a person read it, which is
why every person is asked to confirm a test message. Texts go only for Act now. There are no phone calls,
WhatsApp or Viber messages yet.

**Your data is yours.** Under **Reports** you can download every reading (hourly averages for any period,
every single reading for up to 31 days), your alerts, and everything about how your account is set up, as
files a spreadsheet opens. Each download is recorded in your audit log.

## Getting help

Questions about setup, wiring or what a reading means belong with your Greecon project manager, or
`info@greecon.earth`. Greecon answers within four business hours, Monday to Saturday. There is no
round-the-clock line yet: at night, **Act now** reaches the people you chose, not Greecon.
