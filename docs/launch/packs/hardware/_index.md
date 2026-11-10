This catalogue is every kind of hardware that qualifies for a Greecon kit, with one sheet for each. A sheet says how the part qualifies, what it does at each of the four kinds of site, how it is set and by whom it is fitted, how to accept it, and what goes wrong. Each sheet is also a PDF of its own, so that the one sheet a job needs can be printed and taken to the supplier, to the desk or to the site.

::: stop
**Greecon only reads, and only an electrician works on mains.** No part in this catalogue switches, controls or protects anything. Everything inside a distribution board, every current clamp and voltage tap, and the pump's running contact are the electrician's work, done under the customer's lock-out. Greecon is not a safety system: the float switches, relief valves and trips already in the customer's equipment stay the safety layer.
:::

## How hardware qualifies

A part qualifies in one of three ways. The way decides what is bought, and what a person has to do in the platform.

@@CLASSES@@

A kit is made of approved models for what is read over the data cable, and of parts bought by specification for the rest. A soil probe, a weather sensor and a battery are the three that qualify by their maker's register table: if the maker will not give the table, the part is not bought, or not read.

## Every part at every kind of site

The four kinds of site are **H**, a hotel or guesthouse (water, solar and grid); **S**, a solar plant with a grid connection; **F**, a farm or greenhouse with irrigation; and **W**, a water tank and pump station. A number is how many the standard kit has. "0 or 1" is a part that is fitted only where the site calls for it. A dash is a part that kind of site does not use.

@@MATRIX@@

The planning figure for a whole kit, without VAT and without labour:

| Kind of site | Planning figure |
|--------------------------|------------------------------------------------------|
| **H** Hotel or guesthouse | {{kit.H.headline}} |
| **S** Solar plant with grid connection | {{kit.S.headline}} |
| **F** Farm or greenhouse with irrigation | {{kit.F.headline}} |
| **W** Water tank and pump station | {{kit.W.headline}} |

The four lists after this chapter read the same catalogue by kind of site: every part of that kit, what it does there, and its sheet.

## The numbers that never change

A new site looks like the last one, because the same settings are used everywhere. Every number is set at the office, before the kit leaves, and only checked on site.

@@UNITS@@

| Setting | Value |
|--------------------------|------------------------------------------------------|
| Speed of everything on the data cable | 9600 baud, 8 data bits, no parity, 1 stop bit |
| The converter | Modbus TCP to RTU gateway mode, port 502, a fixed address on the site's network |
| The transmitters | Level on input 1 of the 4 to 20 mA module, pressure on input 2, the flow meter on input 3 |
| The pump's running contact | Input 1 of the pump contact module |
| What the box looks for | Port 502 on the site's own network, and unit numbers 1 to 10 behind whatever answers |

## Before you buy

1. **One of each first.** Buy one whole kit and rehearse it on a desk before buying five. Change the specification, not the kit, when something fails.
2. **Three quotes.** For an approved model, the model named is the model bought: a look-alike is not the same part. For everything else it is the specification, not the brand. Keep the quotes. Every sheet ends with a buying record.
3. **Keep a hardware register:** for each part the make and model, the supplier, the date, the serial number or the batch, and the invoice. A spreadsheet is enough.
4. **Prepare at the office.** The box has its software installed and tested, every device has its number and its speed, and the converter is set, before the kit leaves.

::: stop
**Do not buy:** a meter or a module that is not an approved model; a probe, a sensor or a battery whose register table you have not seen; a transmitter that is not rated for the fluid; a box that starts from an SD card; or anything with a wireless link into a board that you cannot inspect.
:::

## How to read a sheet

Every sheet has the same parts, in the same order.

| Part of the sheet | What it tells you |
|--------------------------|------------------------------------------------------|
| At a glance | What the part does, how it qualifies, its number on the cable, who fits it, the planning estimate and which kits use it |
| How it qualifies | The list to tick before buying, and what not to buy |
| At each kind of site | Whether a hotel, a solar plant, a farm and a water station have it, how many, and what it does there |
| What Greecon reads from it | The readings, their units and the standard alerts |
| Settings, and where they are made | What is set, to what, and whether at the office or on site |
| Fitting | Who does what. Mains work is always the electrician's |
| In the platform | What a person presses and types, by the names on the screen |
| Acceptance test | What is checked at the office, and what is checked on the day |
| What goes wrong | What you see, the likely cause, and what to do |
| Not yet proven | What has not yet been shown on real hardware |
| Buying record | Three quotes, and what was bought |

Where a sheet is silent, the maker's manual decides. The drawings show how parts connect, not terminal numbers: those differ between makes and versions.

## What is not yet proven

This catalogue is written before the first real kit. It says so on every sheet, and here once for all of them.

- **This software has not yet read a real meter, module, probe, sensor or battery.** The registers of the Eastron meters and the Waveshare modules are from the makers' published documents, and everything is tested against pretend equipment that answers as those documents say.
- **The first real kit is rehearsed on a desk.** Anything that differs from a sheet is written down and reported to Greecon, and the sheet is corrected.
- **The prices are planning figures** from shop listings seen in October 2026, not quotes.
- **The electrical parts of every sheet are to be read by a licensed electrician before they are used.** A sheet says who does the work. It does not replace the electrician's own judgement, the maker's manual or the law.
