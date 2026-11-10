The level transmitter says how full the tank is. It hangs at the bottom of the tank, where the weight of the water above it becomes a current between 4 and 20 mA on two wires: 4 mA when the tank is empty, more as it fills. The 4 to 20 mA module ([sheet HW08](#hw-analog)) reads that current, and Greecon turns it into a percentage of the tank from two things a person gives: the range printed on the transmitter's label, and how tall the tank is inside.

## At a glance

@@GLANCE@@

## How it qualifies

Any make qualifies that meets every line below. The tank decides what is bought: how tall it is, what it holds, and how a cable gets out of it. All three are asked at the survey.

**It qualifies if:**

- {{cb}} It is a submersible level transmitter with a vented cable and a two-wire 4 to 20 mA output.
- {{cb}} **Its range is at least the tank's height.** A 0 to 5 m transmitter suits a tank up to 5 m tall. One shorter than the tank cannot see the top of the water, and Greecon refuses it.
- {{cb}} **Its wetted parts suit the water.** Into a drinking-water tank goes only a transmitter whose wetted parts are approved for drinking water, with the maker's document that says so.
- {{cb}} Its cable reaches a dry place above the water with no joint under water.
- {{cb}} Its label gives its range, in metres or in bar. Photograph the label before the transmitter goes into the tank: afterwards nobody can read it.

| Kind | When | What to know |
|-----------------|-------------------------|-------------------------------------|
| **Submersible transmitter,** hung at the bottom of the tank | The default | Greecon asks for the range on its label and for the tank's height |
| **Non-contact ultrasonic sensor,** above the water | Where nothing may hang in the water, or where no document shows that a submersible one is approved for drinking water | It must have a 4 to 20 mA output that is 4 mA when the tank is empty and rises as the tank fills. That is set in the sensor's own menu, from its manual. See *Not yet proven* |

::: stop
**Do not put a sensor of unknown material into a drinking-water tank.** A cheap sensor is not worth a contaminated tank. If the maker cannot show that the wetted parts are approved for drinking water, use a non-contact ultrasonic sensor above the water.
:::

## At each kind of site

@@SITES@@

## What Greecon reads from it

One reading: **{{ui.reading_tank}}**, as a percentage of the tank. 0 is empty and 100 is full.

- The module reads the loop's current on its input 1, in microamps: 4000 at 4 mA and 20000 at 20 mA.
- 4 mA is 0 percent. 20 mA is the top of the transmitter's range, as a share of the tank: the range ÷ the tank's height × 100.
- A label in bar is turned into metres of water: one bar holds up 10.197 m.

| The label says | The tank is | A full tank reads | Half full reads | 20 mA would read |
|-------------------|----------|------------------|------------------|-------------|
| 0 to 5 m | 4 m tall | 100 %, at 16.8 mA | 50 %, at 10.4 mA | 125 % |
| 0 to 5 m | 5 m tall | 100 %, at 20 mA | 50 %, at 12 mA | 100 % |
| 0 to 0.5 bar (5.1 m of water) | 4 m tall | 100 %, at 16.6 mA | 50 %, at 10.3 mA | 127 % |

| Standard alert | Opens when | Kind |
|-------------------|------------------------------|--------------|
| Critical | The level is below 15 % | {{ui.act_now}} |
| Low | The level is below 35 % | {{ui.check_today}}: plan a refill |

The two limits are the standard ones. The site's own are agreed with the owner. A level a little under 0 or over 100 (up to 5 points) is still taken as real: a transmitter has a tolerance, and a tank is measured a few centimetres short. Beyond that Greecon says that the number cannot be a tank level.

## Settings, and where they are made

Nothing is set on a submersible transmitter: its range is fixed when it is made. What Greecon needs is read and measured:

| What | Value | Where it comes from |
|-----------------|-------------------------------------|----------------------|
| The range on the label | For example 5, for a 0 to 5 m transmitter, and its unit: metres or bar | The label, read before the transmitter goes into the tank |
| How tall the tank is inside | In metres, from the bottom, where the transmitter hangs, to the top of the water when the tank is full | Measured at the survey. If the tank must be opened, the customer's own staff measure it |
| Its input on the module | Input 1 | Wired by the electrician |

## Fitting

{{who:e}} or the customer's plumber fits the transmitter, and the electrician wires its loop. {{who:pm}} stays outside the tank, photographs and writes down.

{{diagram:ref-loop}}

- {{cb}} The transmitter hangs **at the bottom of the tank,** so that zero is empty, and its cable is fixed so that it cannot move.
- {{cb}} The **vented cable** ends in a dry place. The small tube inside it must stay open to the air and must not take in water: it is not kinked, sealed or left where it can get wet.
- {{cb}} The loop is wired to **input 1** of the module, with the 24 V supply in series, as the module's manual draws it.
- {{cb}} The two wires are numbered at both ends, and the terminals are photographed.

::: stop
**Nobody from Greecon enters a tank.** If the tank must be entered, the customer's own staff do that. If the only place for the sensor is inside and nobody may go in, say that it is not possible, and write why.
:::

## In the platform

The transmitter is not a device in the platform. It is one reading of the **{{ui.device_water_module}}**, which the box finds in step 4, **{{step:4}}**.

- **Its range.** In step 5, **{{step:5}}**, under **{{ui.range_level}}**, give the **{{ui.range_on_label}}** (5), the **{{ui.unit_on_label}}** (metres or bar) and **{{ui.tank_height}}** (4), and press **{{ui.save_the_ranges}}**. The page says what it set: *Set now: 4 mA is 0 % and 20 mA is 125 %.* Greecon works out the register and the scale: nobody types either.
- **A number is read the way people write it:** "2,5" is 2.5.
- **A transmitter shorter than the tank is refused** when you save: *it cannot see the top of the water. Fit a transmitter with a longer range.*
- **To change the range later,** type both numbers again: the form does not show the old ones.
- **The limits.** In step 10, **{{step:10}}**, the standard ones are in place (critical below 15, low below 35). Agree the site's own with the owner.

## Acceptance test

**At the office, before the kit leaves:**

- {{cb}} The label is photographed, and its range and its unit are written on the install card.
- {{cb}} With a loop calibrator on input 1 in place of the transmitter, the module reads 4000, 12000 and 20000 ([sheet HW08](#hw-analog)).
- {{cb}} In its loop on the desk, in the air, the transmitter reads about 4000: 4 mA, an empty tank.

```
greecon-edge modbus-test --host 192.168.1.50 --unit 3 --type input --address 0
```

**On the day, as part of commissioning:**

::: tests
| Check and how | Pass when | Greecon shows | Real | Result |
|----------------------|-----------------|--------|--------|--------|
| **{{ui.reading_tank}}.** Against a dipstick or the sight gauge, at two levels. Take the second after the tank has been used or filled. | Within 5 percentage points, both times | | | {{pf}} |
:::

## What goes wrong

| What you see | Likely cause | What to do |
|-------------------|----------------------|------------------------------|
| **A level below zero** (*-31.2 cannot be a tank level*) | No current in the loop: a wire has come off, or the loop has lost its 24 V supply. The module reads 0 | Read input 1 from the box: 0 means no current. The electrician checks the loop and its supply |
| **A level far above 100** (*133 cannot be a tank level*) | The range given is bigger, or the tank's height smaller, than the real one. A tank 4 m tall given as 3 m, with a 0 to 5 m transmitter, reads 133 when it is full | Read the label again, measure the tank again, and give both numbers again |
| **A level about ten times too low** | A label in bar was entered as metres | Choose bar under **{{ui.unit_on_label}}**, and save the ranges again |
| **The level is steady, but off by more than 5 points** | The height was measured to the wrong place, or the transmitter does not hang at the bottom | Measure from where the transmitter hangs to the top of the water when the tank is full |
| **The level drifts with the weather** | The tube in the vented cable is blocked, kinked or wet, so the transmitter no longer compares with the open air | The electrician or the plumber frees the end of the cable and keeps it dry |
| **The level jumps about** | The transmitter swings in the water, near the inlet | Fix the cable so that the transmitter cannot move |

More is in {{ref:runbooks}}: R3 (a reading looks wrong) and R18 (a reading is impossible after the ranges were given).

## Not yet proven

- This software has not yet read a level transmitter through a real 4 to 20 mA module. The scale is tested against a pretend module. The first real one is checked against a dipstick at two levels, and both numbers are written down.
- **No ultrasonic sensor has been tried.** The form's words are written for a transmitter that hangs in the water. For a sensor above the water, set it in its own menu to send 4 mA when the tank is empty and 20 mA at a level you choose, and give that level as the range (20 mA at 4 m, in a tank 4 m tall: range 4, height 4). Report what you find to Greecon.
- The prices are planning figures from shop listings seen in October 2026, not quotes. Level transmitters were seen from about USD 28, of unverified quality, to over GBP 900.

@@BUYING@@
