The flow meter says how much water is moving in the pipe, in litres a minute. By itself it gives a number and its trend. Together with the pump's running contact ([sheet HW09](#hw-pumpin)) it gives the alert a pump station most wants: the pump is running but no water is flowing. It is optional in every kit, and it is the dearest of the transmitters, so the survey decides whether the site gets one.

## At a glance

@@GLANCE@@

## How it qualifies

Any make qualifies that meets every line below. An electromagnetic meter and a turbine meter are the usual kinds.

**It qualifies if:**

- {{cb}} It suits the pipe and the water: the pipe's size and material, and clean or dirty water. On a drinking-water pipe, its wetted parts are approved for drinking water.
- {{cb}} **It has a 4 to 20 mA output.** A meter with only a pulse output does not qualify: the module reads current.
- {{cb}} Its manual says which flow 20 mA stands for (the top of its range), or lets that be set, and that flow is above the most the pump delivers.
- {{cb}} Its manual says whether its output powers the loop itself, or needs the loop's 24 V supply. The electrician needs to know which.
- {{cb}} The pipe has the straight run the manual asks for, before and after the meter. Look at the survey.

::: stop
**Do not buy** a flow meter that is not rated for the fluid, or one whose only output is pulses. Fitting it means cutting the pipe: that is a plumber's work, agreed with the customer, with the pump stopped by the customer's own person.
:::

## At each kind of site

@@SITES@@

**What is lost without it.** Without a flow meter, or without the pump's running contact, Greecon cannot say that the pump is running but no water is flowing. The site then ticks **{{ui.not_fitted}}**, and the handover says that this alert cannot be raised.

## What Greecon reads from it

One reading: **{{ui.reading_flow}}**, in litres a minute. 4 mA is no flow, and 20 mA is the top of the range.

| The top of the range | 4 mA | 12 mA | 20 mA |
|--------------------------|-----------|-----------|-----------|
| 100 litres a minute (6 cubic metres an hour) | 0 | 50 | 100 |
| 500 litres a minute (30 cubic metres an hour) | 0 | 250 | 500 |

Greecon asks for litres a minute. A range in cubic metres an hour is multiplied by 16.67, and one in litres a second by 60.

| Standard alert | Opens when | Kind |
|-------------------|---------------------------------------------|--------------|
| No flow | The pump is running ({{ui.reading_pump}} reads 1) and the flow has been at or below 0.2 litres a minute for 30 seconds | {{ui.act_now}} |

The alert needs the pump's running state to be read as well. With no pump contact module it is never raised. A flow below zero, or above 100,000 litres a minute, is called a reading that cannot be real.

## Settings, and where they are made

| What | Value | Where it comes from |
|-----------------|-------------------------------------|----------------------|
| The top of the range | The flow that 20 mA stands for, in litres a minute | The meter's label or its manual; on a meter with a menu, what is set there |
| Its input on the module | Input 3 | Wired by the electrician |
| The no-flow limit | 0.2 litres a minute as standard. See the check below | In the platform, with the owner |

::: check
**Read the flow with the pump stopped and the pipe full.** A meter at rest seldom sends exactly 4 mA. If Greecon then shows 0.4 litres a minute, a limit of 0.2 would never open the alert. Agree a limit a little above the resting number and far below the pump's ordinary flow, and write both numbers down.
:::

## Fitting

A plumber fits the meter in the pipe, and {{who:e}} wires its signal. {{who:pm}} watches, photographs and writes down.

- {{cb}} The meter sits in the pipe the pump feeds, with the **straight run** its manual asks for before and after it, and the arrow on its body pointing the way the water goes.
- {{cb}} Its signal is wired to **input 3** of the module, as the meter's manual and the module's manual draw it.
- {{cb}} **One supply in the loop, never two.** A meter whose output powers the loop is wired without the 24 V supply; one that needs the loop's supply has the 24 V supply in series, as for the other transmitters ([sheet HW08](#hw-analog)).
- {{cb}} A meter that needs mains power is connected by the electrician.
- {{cb}} The wires are numbered at both ends. The label and the terminals are photographed.

## In the platform

The flow meter is not a device in the platform. It is one reading of the **{{ui.device_water_module}}**, which the box finds in step 4, **{{step:4}}**.

- **Its range.** In step 5, **{{step:5}}**, under **{{ui.range_flow}}**, give the **{{ui.top_of_range}}** in litres a minute and press **{{ui.save_the_ranges}}**. Greecon works out the register and the scale: nobody types either.
- **No flow meter at this site:** tick **{{ui.not_fitted}}** under it. The page asks first, because the reading and its history are removed.
- **The limit.** In step 10, **{{step:10}}**, the limit is called *No flow at or below*. The standard is 0.2 litres a minute.

## Acceptance test

**At the office, before the kit leaves:**

- {{cb}} The label is photographed, and the top of its range, in litres a minute, is written on the install card.
- {{cb}} With a loop calibrator on input 3 in place of the meter, the module reads 4000, 12000 and 20000 ([sheet HW08](#hw-analog)).

```
greecon-edge modbus-test --host 192.168.1.50 --unit 3 --type input --address 2
```

**On the day, as part of commissioning:**

::: tests
| Check and how | Pass when | Greecon shows | Real | Result |
|----------------------|-----------------|--------|--------|--------|
| **Flow.** A bucket test (fill a measured volume and time it), or the flow meter's own display. | Within 10 percent | | | {{pf}} |
| **At rest.** The pump stopped by the owner's own person, the pipe full. | The flow is below the no-flow limit. Write the number down | | | {{pf}} |
:::

Do not start or stop the pump yourself: the owner's own person does, because they know what else it affects.

## What goes wrong

| What you see | Likely cause | What to do |
|-------------------|----------------------|------------------------------|
| **A flow far below zero** (*-125 cannot be a flow*) | No current in the loop: a wire has come off, the loop has no supply, or the meter has no power. The module reads 0 | Read input 3 from the box: 0 means no current. The electrician checks the loop |
| **A flow a little below zero while the pump is stopped** (*-0.2 cannot be a flow*) | The meter rests a hair under 4 mA. The box reads about 4000, not 0 | Check the reading with the pump running. Write the resting number down and report it to Greecon |
| **The no-flow alert does not open when the pump runs dry** | The meter's resting number is above the limit, or the pump's running state is not read | Set the limit above the resting number. Check that {{ui.reading_pump}} reads 1 while the pump runs ([sheet HW09](#hw-pumpin)) |
| **The no-flow alert opens while the pump is stopped** | The pump's contact is inverted | The electrician uses the starter's other contact ([sheet HW09](#hw-pumpin)) |
| **The flow is a steady share too high or too low** | The top of the range was given in the wrong unit (cubic metres an hour for litres a minute), or is not what the meter is set to | Read the meter's own setting, and give the range again |
| **A flow below zero at a site that has no flow meter** | The reading was left in place, and an empty input reads like a wire off | Tick **{{ui.not_fitted}}** under the flow meter |

More is in {{ref:runbooks}}: R3 (a reading looks wrong) and R18 (a reading is impossible after the ranges were given).

## Not yet proven

- This software has not yet read a flow meter through a real 4 to 20 mA module. The scale and the no-flow alert are tested against pretend equipment.
- **How a real meter rests is not known.** The module reads in small steps, and a meter at rest may sit a little above or below 4 mA. That is why the resting number is read and written down at commissioning, and why the limit is agreed after it.
- The prices are planning figures, not quotes.

@@BUYING@@
