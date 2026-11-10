A solar plant with a grid connection, with or without a battery. Greecon measures what is bought from the grid and what is sent to it, and what the plant produces. Where the owner wants it, a third meter measures the site's own consumption; without it Greecon works the consumption out. A battery is the customer's own equipment, and is read only if its maker publishes its register table. This list is every part of the kit for that, with the sheet that says how each one qualifies.

## What is measured, and where

{{diagram:kit-s-system}}

## The kit, part by part

@@KIT@@

**{{kit.S.headline}}** The figures are planning estimates, not quotes. For a battery nothing is bought but the maker's register table.

@@UNUSED@@

## The numbers on the data cable

@@UNITS@@

A battery that joins the data cable takes a number of its own, entered by hand (for example 8). One that is on the site's network at an address of its own has no number on the cable. Everything on the cable is set to 9600 baud, 8 data bits, no parity, 1 stop bit, and the converter to port 502, in Modbus TCP to RTU gateway mode.

## What the survey decides

| Ask, or look | It decides |
|-------------------------------------|------------------------------------------------|
| Is the supply three-phase, and how many amps a phase? | The meters. Up to 100 A a phase: the SDM630 MCT, with clamps. Above that: the SDM630 with 5 A current transformers. A single-phase plant: the SDM230 (sheets HW05 and HW06) |
| Where are the supply entry and the inverter's AC output? | Where the grid meter and the solar meter go, and how far the data cable runs (sheet HW03) |
| Does the owner want the site's own consumption measured, and not worked out? | A third meter, number 4 (sheet HW05) |
| Is there a battery, and will its maker give the Modbus register table? | Whether the battery is read at all (sheet HW07) |
| May the plant send energy to the grid? | Nothing to buy. It is entered with the site's prices, and it explains a solar reading that is low at midday |
| Is there internet the box may use, where the enclosure will be? | The cellular router (sheet HW04) |

The whole job at this kind of site, from the survey to the handover, is in the site pack for a solar plant (PDF 05).
