The pressure transmitter says what the pressure in the pipe is. It is screwed into the pipe behind an isolating valve, so that it can be taken out without draining the pipe, and it sends a current between 4 and 20 mA on two wires: 4 mA at no pressure and 20 mA at the top of its range. The 4 to 20 mA module ([sheet HW08](#hw-analog)) reads that current on its input 2, and Greecon asks for one number: the top of the range on the transmitter's label.

## At a glance

@@GLANCE@@

## How it qualifies

Any make qualifies that meets every line below. The pipe decides what is bought: its pressure range is asked at the survey.

**It qualifies if:**

- {{cb}} It has a two-wire 4 to 20 mA output.
- {{cb}} **Its range suits the pipe.** The top of its range is above the highest pressure the pipe sees. 0 to 10 bar is the usual one.
- {{cb}} It measures gauge pressure: zero in the open air, like the pressure gauge on the line that it is checked against.
- {{cb}} Its wetted parts are stainless steel. On a drinking-water pipe, ask the plumber whether the transmitter and its fitting may be used there.
- {{cb}} Its thread is known before the visit, so that the plumber brings the right fitting and the isolating valve.
- {{cb}} Its label gives its range, in bar. Photograph the label.

::: stop
**Do not fit it without an isolating valve.** Without one the transmitter cannot be taken out, checked or changed without draining the pipe. And do not buy the kind with a voltage output (0 to 10 V): the module reads current.
:::

## At each kind of site

@@SITES@@

## What Greecon reads from it

One reading: **{{ui.reading_pressure}}**, in bar. 4 mA is 0 bar, and 20 mA is the top of the range.

| The label says | 4 mA | 12 mA | 20 mA | With a wire off, Greecon shows |
|-----------------|--------|--------|--------|--------------------------------|
| 0 to 10 bar | 0 bar | 5 bar | 10 bar | -2.5 bar, and says that it cannot be a line pressure |
| 0 to 6 bar | 0 bar | 3 bar | 6 bar | -1.5 bar, and says the same |
| 0 to 4 bar | 0 bar | 2 bar | 4 bar | -1.0 bar, which Greecon accepts as a pressure. See *What goes wrong* |

A pressure outside -1 to 40 bar is called a reading that cannot be real. There is **no standard alert** on the pressure: Greecon shows it and its trend.

## Settings, and where they are made

Nothing is set on the transmitter: its range is fixed when it is made.

| What | Value | Where it comes from |
|-----------------|-------------------------------------|----------------------|
| The top of the range | In bar: 10, for a 0 to 10 bar transmitter | The label |
| Its input on the module | Input 2 | Wired by the electrician |

## Fitting

A plumber makes the wet connection, and {{who:e}} wires the loop. {{who:pm}} watches, photographs and writes down. The pipe is the customer's: it is opened by the customer's plumber, or by one the customer agrees to.

{{diagram:ref-loop}}

- {{cb}} The transmitter goes on the pipe the pump feeds, **through an isolating valve.**
- {{cb}} Where there is a pressure gauge on the line already, the transmitter goes near it, so that the two can be compared.
- {{cb}} The loop is wired to **input 2** of the module, with the 24 V supply in series, as the module's manual draws it.
- {{cb}} The two wires are numbered at both ends. The label, the valve and the terminals are photographed.

## In the platform

The transmitter is not a device in the platform. It is one reading of the **{{ui.device_water_module}}**, which the box finds in step 4, **{{step:4}}**.

- **Its range.** In step 5, **{{step:5}}**, under **{{ui.range_pressure}}**, give the **{{ui.top_of_range}}** (10) and press **{{ui.save_the_ranges}}**. Greecon works out the register and the scale: nobody types either.
- **A number is read the way people write it:** "2,5" is 2.5.

## Acceptance test

**At the office, before the kit leaves:**

- {{cb}} The label is photographed, and the top of its range is written on the install card.
- {{cb}} With a loop calibrator on input 2 in place of the transmitter, the module reads 4000, 12000 and 20000 ([sheet HW08](#hw-analog)).
- {{cb}} In its loop on the desk, in the air, the transmitter reads about 4000: 4 mA, no pressure.

```
greecon-edge modbus-test --host 192.168.1.50 --unit 3 --type input --address 1
```

**On the day, as part of commissioning:**

::: tests
| Check and how | Pass when | Greecon shows | Real | Result |
|----------------------|-----------------|--------|--------|--------|
| **Pressure.** Against the pressure gauge on the same line. | Within 0.2 bar | | | {{pf}} |
:::

## What goes wrong

| What you see | Likely cause | What to do |
|-------------------|----------------------|------------------------------|
| **A pressure below zero that never moves** (-2.5 with a 0 to 10 bar transmitter) | No current in the loop: a wire has come off, or the loop has lost its 24 V supply. With a transmitter of 0 to 4 bar or less the number is between -1 and 0, and Greecon does not call it impossible | Read input 2 from the box: 0 means no current. The electrician checks the loop and its supply |
| **Greecon and the gauge agree at rest and differ under pressure** | The top of the range was given wrongly (a 0 to 16 bar transmitter given as 10) | Read the label again and give the range again |
| **Zero in Greecon while the gauge shows pressure** | The isolating valve is closed | The plumber, or the customer's own person, opens it |
| **The right number on the wrong reading** | The transmitter is on another input | Pressure is on input 2 |

More is in {{ref:runbooks}}: R3 (a reading looks wrong) and R18 (a reading is impossible after the ranges were given).

## Not yet proven

- This software has not yet read a pressure transmitter through a real 4 to 20 mA module. The scale is tested against a pretend module. The first real one is checked against the gauge on the line, and both numbers are written down.
- The prices are planning figures from shop listings seen in October 2026, not quotes. A known make of pressure transmitter was seen from GBP 129.

@@BUYING@@
