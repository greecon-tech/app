The Eastron SDM630 is the three-phase meter of every kit that measures electricity. Fitted where the supply enters the site, it gives both what is bought from the grid and what is sent to it. Fitted on the inverter's output, it gives what the solar plant produces. Greecon knows its registers, so nobody types one, and the box recognises it on the network.

## At a glance

@@GLANCE@@

## How it qualifies

It is an approved model: the make and the model are named, and no other three-phase meter takes its place.

**It qualifies if:**

- {{cb}} It is an Eastron **SDM630** with Modbus (RS-485). The model on its label is the model on the quote.
- {{cb}} Its version suits the current. Up to 100 A a phase: the **MCT** version, which comes with three clamp-on current sensors. Above 100 A: the ordinary SDM630 with 5 A current transformers, bought to suit the supply.
- {{cb}} The maker's manual and Modbus protocol document came with it. Versions differ: read the one in its box.

::: stop
**Do not buy** another make of three-phase meter because it "also speaks Modbus". The box would not recognise it and the template's registers would not fit it. It could only be entered by hand, from its own register table, as equipment Greecon does not know.
:::

## At each kind of site

@@SITES@@

## What Greecon reads from it

One number: the **total active power**. It is input register 52 (counted from zero; the manual's 30053), a 32-bit floating-point number, high half first, in watts. Greecon shows it in kW. The template fills the register in: nobody types it.

| Fitted as | Reading in Greecon | How it is made from the power |
|-----------------|-----------------|------------------------------------|
| Grid meter (number 1) | **{{ui.reading_grid_import}}**, kW | The power while it is positive: energy coming in |
| | **{{ui.reading_grid_export}}**, kW | The power while it is negative, shown as a positive number: energy sent out |
| Solar meter (number 2) | **{{ui.reading_solar}}**, kW | The size of the power, whichever way the clamps point |
| Load meter (number 4) | **{{ui.reading_consumption}}**, kW | The size of the power |

That is why one grid meter gives both import and export, and why a clamp fitted the wrong way round swaps them. Greecon notices a reversed grid meter on its own at night or in cloud, because energy cannot leave a site that nothing is producing for: the energy picture says so at once, and after five minutes a **{{ui.check_today}}** alert opens, *The grid meter may be fitted the wrong way round*. At midday it cannot tell, which is why the direction check stays.

## Settings, and where they are made

They differ between versions, so they are read from the meter's own display and never assumed. Greecon sets them at the office; on site you only check them, and photograph the display.

| Setting | Value | Where |
|-----------------|-------------------------------------------|----------------|
| Unit number | 1 on the grid meter, 2 on the solar meter, 4 on the load meter. A meter is delivered as 1, so each is numbered alone, before it joins the cable | On its display, at the office |
| Speed | 9600 baud, which is how it is delivered: check it | On its display, at the office |
| Parity and stop bits | No parity, 1 stop bit | On its display, at the office |
| CT ratio | Only on a meter with 5 A current transformers: the ratio of the transformers fitted (for example 250 for a 250/5 A transformer), so that the meter shows the real power | In the meter's menu, on site, by the electrician |

A meter's display works only when its voltage terminals have power, and powering a meter on a bench is mains work. The electrician makes up the office's bench lead. The project manager never wires mains.

## Fitting

{{who:e}} Inside a distribution board, with the customer's lock-out on. The project manager watches, photographs and writes it down.

{{diagram:ref-ct}}

- {{cb}} **Clamps point towards the site.** On the grid meter this makes import positive. On the solar meter the clamps point away from the inverter, towards the board. Solar is read as the size of the power, so a reversed solar clamp does not read zero, but fit it the right way anyway.
- {{cb}} **Voltage taps** have small fuses or 2 A breakers on each tap, as the meter's manual says.
- {{cb}} **Never open the secondary of a 5 A current transformer while current flows:** it can produce a dangerous voltage. Short the secondary before disconnecting.
- {{cb}} The electrician connects the data cable at the meter, because its terminals are inside the board.
- {{cb}} **Photograph** the wiring, the label (model and serial number) and the display with its settings.

## In the platform

- **Finding it.** In step 4 of the setup list, **{{step:4}}**, press **{{ui.find_equipment}}**. The box recognises an Eastron meter by what it says: a first-phase voltage that is a mains voltage, and a power. Found at the number the kit gives it, its address is filled in and the line says **{{ui.found_set}}**, for example *unit 1: an Eastron meter, reading 1.80 kW at 231 V*.
- **Found, but waiting for you.** A meter at another number than the kit's, or at another address than the one it has, says **{{ui.found_found}}** and is set only when you press **{{ui.use_this_address}}**.
- **A single-phase meter where this one was planned.** The line says *It is a single-phase SDM230, not the three-phase SDM630 planned.* If that is what the site has, press **{{ui.use_this_address}}** and Greecon reads it as an SDM230 ([sheet HW06](#hw-sdm230)). If a three-phase meter was meant, do not press it: the electrician changes the meter.
- **The direction check** (step 9, **{{step:9}}**, at sites with a grid meter): with the sun down or the solar switched off, switch on a known load. Grid import must go up. Then press **{{ui.i_checked_this}}**.

## Acceptance test

**At the office:**

- {{cb}} The number and the speed are read from the meter's display, and photographed.
- {{cb}} On the desk, behind the converter, the box finds it at its number and reads its power:

```
greecon-edge find --host 192.168.1.50
greecon-edge modbus-test --host 192.168.1.50 --unit 1 --type input --address 52 --data-type float32
```

The second prints the raw registers and the value, in watts.

**On the day, as part of commissioning:**

::: tests
| Check and how | Pass when | Greecon shows | Real | Result |
|----------------------|-----------------|--------|--------|--------|
| **The meter's display against Greecon.** Read the display (kW or W) and Greecon at the same time. | Within 5 percent, or 1 kW on a small load | | | {{pf}} |
| **Grid direction.** A known load on (a kettle or a heater), the sun down or the solar off. | Import rises; export does not | | | {{pf}} |
| **Solar at night.** | Zero, or a few watts | | | {{pf}} |
| **Solar at midday.** Against the inverter's own display. | Within about 5 percent | | | {{pf}} |
:::

## What goes wrong

| What you see | Likely cause | What to do |
|-------------------|----------------------|------------------------------|
| **Import and export are swapped** (export rises when a load is switched on) | The grid meter's clamps are the wrong way round | The electrician turns them, with the lock-out on. Repeat the direction check |
| **The solar meter reads zero at midday** | A clamp closed on the wrong cable, a breaker open upstream, or an inverter limited to zero export | Compare with the meter's own display. Ask the electrician to confirm that the clamps are on the inverter's output phases. On a zero-export plant, midday solar can honestly be low: check the inverter's display |
| ***Nothing that looks like an Eastron meter answers at unit 2*** | No power at the meter, the number or the speed on its display is not the kit's, or its A and B wires | Read its display against the install card. Check its two data wires. A meter powered from the grid is dark in a power cut: that is expected |
| ***Something answers … but not clearly enough to tell whether it is the three-phase SDM630 planned*** | One of its answers was lost on the cable | Press **{{ui.look_again}}**. If it is the same, check the speed and the A and B wires |
| **The reading is far from the display** on a meter with current transformers | The CT ratio is not set in the meter | The electrician sets the ratio in the meter's menu. Greecon reads what the meter shows |

More is in {{ref:runbooks}}: R2 (a device does not answer), R3 (a reading looks wrong), R15 and R16 (Find equipment).

## Not yet proven

- This software has not yet read a real SDM630. The register is from the maker's Modbus protocol document, and everything is tested against a pretend meter that answers as that document says. The first real kit is rehearsed on a desk, and the first reading at a site is compared with the meter's own display.
- The prices are planning figures from shop listings seen in October 2026, not quotes.

@@BUYING@@
