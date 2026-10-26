## At a glance

::::: {.facts}
::: fact
**Who it suits**

A solar plant with a grid connection, with or without a battery. It works with any inverter brand, because it measures at the AC cable with its own meter and not through the inverter maker's portal.
:::

::: fact
**What it measures**

How much the solar produces, the grid (import and export) and, if wanted, the site's own consumption (a load meter) and a battery's charge and power.
:::

::: fact
**Planning estimate**

{{kit.headline}}
:::

::: fact
**Time**

Survey about 1 hour. Install day 4 to 6 hours with the electrician. Commissioning about 1 hour. Handover 30 minutes.
:::

::: fact
**Template in the platform**

**{{kit.template}}**
:::

::: fact
**Standard settings**

Unit numbers: grid meter 1, solar meter 2, optional load meter 4. 9600 baud, 8 data bits, no parity, 1 stop bit. Converter on port 502, in Modbus TCP to RTU gateway mode.
:::
:::::

**The order of the work:** survey, buy, prepare at the office, install day, the platform's setup list, commissioning, handover. Then the morning check, and the day 1, 3 and 7 calls.

{{include:_shared/glance-rules.md}}

## What it measures

The template **{{kit.template}}** makes up to four devices. Delete what the site does not have (see the project manager's steps below). What each gives:

| Reading in Greecon | Comes from | Unit | Standard alert limits |
|------------|-------------------------|--------|-------------------------|
| **{{ui.reading_grid_import}}** and **{{ui.reading_grid_export}}** | {{ui.device_grid_meter}}: an Eastron SDM630 where the supply enters, unit 1. One meter gives both: positive power is energy coming in, negative is energy sent out | kW | None |
| **{{ui.reading_solar}}** | {{ui.device_solar_meter}}: an Eastron SDM630 on the inverter's AC output, unit 2. It reads the size of the power, so it works with any inverter brand | kW | None |
| **{{ui.reading_consumption}}** (optional) | {{ui.device_load_meter}}: an Eastron SDM630 on the feed to the loads, unit 4, if the owner wants the site's own consumption measured | kW | None |
| **{{ui.reading_battery_charge}}** (optional) | {{ui.device_battery}}: the battery's own Modbus, mapped by hand from the maker's register table | % | Low below 25 % |
| **{{ui.reading_battery_power}}** (optional) | The same device. Positive while charging | kW | None |

If the maker of the battery will not publish its Modbus register table, leave the battery out: do not guess registers. Solar surplus has no standard limit: the platform says nothing about it rather than guess.

## What to buy and bring

{{bom}}

**{{kit.headline}}** For a battery add nothing but the maker's Modbus register table. Ask three suppliers for the quote on the specification, not the brand, and keep the quotes. Buy and bench-test one kit before buying five. The reasons for each part, its settings and the mistakes to avoid are in {{ref:hardware}}.

### The project manager brings

{{tools}}

**You do not need a tool for work inside a live board: that is the electrician's.** The spares kit (one for each project manager) goes in the car too.

## Survey

About one hour, with the electrician if the plan needs one. Bring this pack, a phone for photographs, a tape measure, a torch and a notebook. No tools are needed to survey, and nothing is opened.

### Ask, in this order

The answers decide what is measured and what it costs. Write them on the survey form that follows.

1. Who decides, and who gets called at night? Names, mobile numbers, emails: these become **{{ui.who_is_told}}**. Each of them also needs a login of their own, so that they can acknowledge an alert, and a login needs an email address.
2. What went wrong in the last twelve months that cost money? Write it in their words. It is the reason they buy.
3. The electricity price per kWh, **what is paid for energy sent to the grid, if anything,** and the last twelve bills. The platform shows what solar kept on site at their price; without a price it shows kWh only.
4. What brand is the inverter, and where is its AC output? **Is the plant allowed to send energy to the grid?** If not, tick *{{ui.no_export}}* in the prices.
5. Where does the supply enter the building? Is it three-phase?
6. Is there a battery? Which maker and model, and does the maker publish the Modbus register table? Does it speak Modbus on the site's network, or on its own RS-485 port?
7. Does the owner want the site's own consumption measured (a third meter)?
8. Is there a network socket where the box will sit, or cellular signal? (Look at your phone there.)
9. Is there a power socket for the box, and is it on a circuit that stays on?
10. Who is the customer's electrician, and can they be there on install day?

### Look at, and photograph

- The supply entry and the main board (closed): where a meter could be fitted with the clamps around the incoming phases.
- The inverter and its AC output cable.
- The battery and its communication port, if there is one. Do not open it.
- The place for the box: dry, 30 cm free, no heat, within reach of a socket and a network cable.
- The route for the data cable from the board to the box (under 100 metres; note any crossing of power cable).

{{include:_shared/go-nogo.md}}

## Survey form {.newpage .formtitle #survey-form-s data-kit="Kit S · Solar plant with grid connection"}

::: {.form}
| Field | Answer |
|---------------------|---------------------|
| Customer, site name and address, date | |
| Contact: name, mobile, email (first, second, third to be told) | |
| What went wrong last year (their words) | |
| Prices from the bills: electricity per kWh; paid for energy sent to the grid | |
| Twelve electricity bills collected | {{cb}} Yes  {{cb}} Later |
| Allowed to send energy to the grid? | {{cb}} Yes  {{cb}} No (tick the box in the prices) |
| Supply: single or three phase; main breaker size (A) | |
| Inverter: brand, size (kW), where its AC output cable is | |
| Battery: maker and model; register table available; connection (network or RS-485) | {{cb}} No battery |
| Meters needed: grid, solar, load (and where) | |
| Network: customer's cable or cellular; router brand; who can give an address | |
| Power for the box: socket location | |
| Electrician: name, mobile, day | |
| Photographs taken (list) | |
| Go / no-go, and why | {{cb}} Go  {{cb}} No-go |
:::

## The drawings {.newpage}

Every drawing is for kit S and says so. They show how the parts connect, not terminal numbers: follow the maker's manual for terminal numbers. Mains work is inside the dashed red box and is the electrician's.

{{diagram:kit:system}}

{{diagram:kit:wiring}}

{{diagram:kit:network}}

{{diagram:kit:enclosure}}

The order on the rail is a recommendation, not a maker's drawing: the electrician may change it to suit the enclosure. Keep mains and low voltage apart, and label every wire at both ends.

{{diagram:kit:ct}}

{{diagram:kit:power}}

## At the office

{{include:_shared/office.md}}

## Install day {.newpage #install-day-s}

About four to six hours. The electrician and the project manager work at the same time, in this order, so that nobody waits. The left edge of each row is black for the electrician, green for the project manager and sand for the customer.

::: steps
| | # | Who | Do this |
|--|-|-----|--------------------------------------------|
| {{cb}} | 1 | {{who:e}} {{who:pm}} | **Walk the site together.** Agree where each meter goes. Photograph everything before you start. |
| {{cb}} | 2 | {{who:c}} | Show the way to the main board and the inverter. Have the router and a socket that stays on ready, and the person who can give the converter a fixed address. |
| {{cb}} | 3 | {{who:e}} | **Apply the customer's lock-out** on the board to be worked on. |
| {{cb}} | 4 | {{who:e}} | **Fit the grid meter** at the supply entry: voltage taps with their small fuses or 2 A breakers as the meter's manual says, and the three current clamps around the incoming phases, **arrow towards the site**. Figure S-5. |
| {{cb}} | 5 | {{who:e}} | **Fit the solar meter** on the inverter's AC output, after the inverter and before the distribution board: the same, clamps with the arrow towards the site. |
| {{cb}} | 6 | {{who:e}} | **Fit the load meter** (only if the owner wants the site's own consumption measured) on the feed to the loads, as its manual says. |
| {{cb}} | 7 | {{who:c}} | **Battery (if there is one):** the customer's installer, or the battery's maker, enables the battery's Modbus connection and gives you its address, unit number and register table. Nobody from Greecon opens the battery or touches its DC wiring. |
| {{cb}} | 8 | {{who:pm}} | **Mount the enclosure** and in it the converter, the 24 V supply and the UPS (the box too, if there is room, otherwise on a shelf beside it). Figure S-4. |
| {{cb}} | 9 | {{who:pm}} | **Run the RS-485 data cable** from the converter to the grid meter, on to the solar meter, and on to the load meter if there is one: one cable, a daisy chain, no branches. Shielded twisted pair, the shield joined to ground at one end only, away from power cables. The electrician connects its ends at the meters' A and B terminals inside the board. Figure S-2. |
| {{cb}} | 10 | {{who:pm}} | **Set the converter:** Modbus TCP to RTU gateway mode, 9600 baud, 8 data bits, no parity, 1 stop bit, TCP port 502, and a fixed address on the site's network. Write the address down and photograph the settings page. |
| {{cb}} | 11 | {{who:pm}} | **Connect the network:** plug the box and the converter into the customer's router, or into the sockets of the 4G router if the site has no usable internet. Figure S-3. |
| {{cb}} | 12 | {{who:e}} {{who:pm}} | **Photograph before closing:** every meter's label (model and serial number), the wiring, the converter's settings. Then close the board. |
| {{cb}} | 13 | {{who:e}} | **Remove the lock-out** only when you both agree the work is closed up. |
| {{cb}} | 14 | {{who:pm}} | **Set each meter at its own display:** unit number (grid 1, solar 2, load 4), speed 9600, parity none. Write them down and photograph each display. Do this before the box starts reading: meters are delivered as unit 1, and two on one cable would answer at once. |
| {{cb}} | 15 | {{who:pm}} | **Power up** the UPS, the 24 V supply, the converter and the box. |
| {{cb}} | 16 | {{who:e}} | **Stay until commissioning is done.** |
| {{cb}} | 17 | {{who:pm}} | **Open the customer for setup again** on your laptop (the four hours are over by now) and go down the platform's setup list. |
:::

## Addresses and registers

Meters behind one converter share its IP address and differ only by unit number. Write the numbers down here as you set them; you type them into the setup list in step 3.

::: {.form .short}
| Device in Greecon | Make and model | Unit number | IP address | Port |
|--------------|-------------|------|-----------------|-----|
| {{ui.device_grid_meter}} | Eastron SDM630 | 1 | (the converter's) | 502 |
| {{ui.device_solar_meter}} | Eastron SDM630 | 2 | (the converter's) | 502 |
| {{ui.device_load_meter}} | Eastron SDM630 | 4 | (the converter's) | 502 |
| {{ui.device_battery}} | | (from its manual) | (its own, or the converter's) | |
:::

### The Eastron meters

Their registers are already filled in by the template: total active power, input register 52 (a manual's 30053; counted from zero), a 32-bit floating point number with the high half first, in watts, multiplied by 0.001 to make kW. Check them against the meter's manual only if a reading looks wrong. Test one from the box:

```
greecon-edge modbus-test --host 192.168.1.50 --unit 1 --type input --address 52 --data-type float32
```

### The battery, if there is one

Two readings, mapped by hand from the maker's register table (step 4 of the setup list): press **{{ui.choose_the_register}}** under each reading's name. The register kind is **{{ui.register_input}}** for a manual's 3xxxx and **{{ui.register_holding}}** for 4xxxx; the address is counted from zero.

::: {.form .short}
| Reading | Register kind | Address | Kind of number | How it becomes the reading | Notes |
|-----------|--------|-------|-----------|-----------|-----------|
| {{ui.reading_battery_charge}} | | | | | percent |
| {{ui.reading_battery_power}} | | | | | kW, positive while charging |
:::

**Remove what the site does not have:** open **{{ui.equipment_and_readings}}**, find the battery (or the load meter) under **Equipment**, and press **{{ui.remove}}**. A reading with no register holds the setup list at step 4. If the plant is not allowed to send energy to the grid, tick *{{ui.no_export}}* in the prices (step 1).

## The platform's setup list

{{include:_shared/platform.md}}

## Commissioning {.newpage #commissioning-s}

{{include:_shared/commissioning-intro.md}}

{{include:_shared/internet-cut.md}}

::: tests
| Check and how | Pass when | Greecon shows | Real | Result |
|----------------------|-----------------|--------|--------|--------|
| **{{ui.device_grid_meter}}'s display against Greecon.** Read the display (kW or W) and Greecon at the same time. | Within 5 percent, or 1 kW on a small load | | | {{pf}} |
| **{{ui.device_solar_meter}}'s display against Greecon.** The same, on the solar meter. | Within 5 percent, or 1 kW on a small load | | | {{pf}} |
| **Load meter's display against Greecon** (if fitted). | Within 5 percent, or 1 kW on a small load | | | {{pf}} |
| **Grid direction.** A known load on (a kettle or a heater), the sun down or the solar off. On a plant that exports at noon, do it at night or with the inverter off. | Import rises; export does not | | | {{pf}} |
| **Solar at night.** | Zero, or a few watts | | | {{pf}} |
| **Solar at midday.** Against the inverter's own display. | Within about 5 percent; grid export is the difference between production and what the site is using | | | {{pf}} |
| **{{ui.reading_battery_charge}}** (if fitted). Against the battery's own display. | The two agree (write both numbers) | | | {{pf}} |
{{include:_shared/rows-common.md}}
:::

Signed off by: {{line}} Date: {{line:short}}

## Handover {.newpage}

{{include:_shared/handover-1.md}}
- {{cb}} **Show the owner, in ten minutes, in this order:** the **{{ui.overview}}** (is everything all right, in one sentence); **{{ui.energy_now}}**, the flow moving from the solar to the site and the grid; **{{ui.value}}**, what the solar kept on site this month and the prices it uses; **{{ui.who_is_told}}** (under **{{ui.settings}}**) and a live test message arriving on their phone, and that each person on the list has a login of their own, so that they can acknowledge an alert; **{{ui.reports}}**, under **{{ui.downloads}}**.
{{include:_shared/handover-2.md}}

## Handover record {.newpage .formtitle #handover-record-s data-kit="Kit S · Solar plant with grid connection"}

::: {.form .pad}
| Field | Answer |
|---------------------|---------------------|
| Customer and site | |
| Date, and who was there | |
| {{ui.who_is_told}}, in order (name, mobile with country code, email) | |
| Prices entered (electricity, export) and where they came from; zero-export box ticked if needed | |
| Battery: limits agreed (Low below), or no battery | |
| {{ui.setup_list}}: every step Done and the site Commissioned | {{cb}} Yes |
| {{ui.handover_sheet_link}} printed and signed | {{cb}} Yes |
| Shown: {{ui.overview}}, {{ui.energy_now}}, {{ui.value}}, {{ui.who_is_told}} with a live test message, {{ui.reports}} | {{cb}} Yes |
| Left: label on the box; card with `info@greecon.earth` and your phone | {{cb}} Yes |
| Photographs and survey form filed in the customer's folder | {{cb}} Yes |
:::

::: sign
<div>Project manager: name and signature</div>
<div>Owner: name and signature</div>
:::

## The three most likely problems {.newpage}

| What you see | Likely cause | What to do |
|----------------|--------------------|------------------------------|
| **The solar meter reads zero at midday** | A clamp closed on the wrong cable, a closed breaker upstream, or the inverter is limited to zero export | Compare with the meter's own display and test the register from the box (`greecon-edge modbus-test`). Ask the electrician to confirm that the clamps are on the inverter's output phases. If the plant is zero-export, midday solar can honestly be low: check the inverter's display |
| **Import and export are swapped** (export rises when a load is switched on) | The grid meter's clamps are the wrong way round | The electrician turns them, with the lock-out on; you repeat the direction check (step 8 of the setup list). A reversed clamp swaps what the site buys with what it sells, and every figure with it |
| **A reading is a thousand times too big** | Watts shown as kilowatts, typically on a hand-mapped battery reading | In the register form multiply by 0.001 (the Eastron meters already do) |

More, by symptom, are in the Appendices of the Complete Deployment Guide (Appendix C) and in the Field Manual. A device that does not answer is, in this order: a wrong unit number (the commonest), a wrong speed or parity at the converter, A and B swapped on the data cable, the converter not in gateway mode, a wrong IP address.
