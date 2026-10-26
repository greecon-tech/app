## At a glance

::::: {.facts}
::: fact
**Who it suits**

A hotel or guesthouse with a water tank and a pump, solar on the roof and a grid connection. The usual first site.
:::

::: fact
**What it measures**

The grid (import and export), the solar production, the tank, the line pressure, the pump's flow (with a flow meter) and whether the pump runs.
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

Unit numbers: grid meter 1, solar meter 2, water module 3. 9600 baud, 8 data bits, no parity, 1 stop bit. Converter on port 502, in Modbus TCP to RTU gateway mode.
:::
:::::

**The order of the work:** survey, buy, prepare at the office, install day, the platform's setup list, commissioning, handover. Then the morning check, and the day 1, 3 and 7 calls.

{{include:_shared/glance-rules.md}}

## What it measures

The template **{{kit.template}}** makes three devices. What each gives:

| Reading in Greecon | Comes from | Unit | Standard alert limits |
|------------|-------------------------|--------|-------------------------|
| **{{ui.reading_grid_import}}** and **{{ui.reading_grid_export}}** | {{ui.device_grid_meter}}: an Eastron SDM630 where the supply enters, unit 1. One meter gives both: positive power is energy coming in, negative is energy sent out | kW | None |
| **{{ui.reading_solar}}** | {{ui.device_solar_meter}}: an Eastron SDM630 on the inverter's AC output, unit 2 | kW | None |
| **{{ui.reading_tank}}** | {{ui.device_water_module}}, unit 3: the level transmitter's 4 to 20 mA | % | Critical below 15 % ({{ui.act_now}}); Low below 35 % ({{ui.check_today}}) |
| **{{ui.reading_pressure}}** | {{ui.device_water_module}}, unit 3: the pressure transmitter's 4 to 20 mA | bar | None |
| **{{ui.reading_flow}}** | {{ui.device_water_module}}, unit 3: the flow meter's 4 to 20 mA (optional) | litres a minute | No flow at or below 0.2 litres a minute ({{ui.act_now}}, once it has held for 30 seconds, and only when the box reads both a flow and the pump's running state) |
| **{{ui.reading_pump}}** | {{ui.device_water_module}}, unit 3: the pump starter's spare contact | on or off | None |

Without the flow meter, or without the pump's running contact, "the pump is running but no water is flowing" cannot be raised, and the handover should say so. Solar surplus has no standard limit: the platform says nothing about it rather than guess.

## What to buy and bring

{{bom}}

**{{kit.headline}}** Ask three suppliers for the quote on the specification, not the brand, and keep the quotes. Buy and bench-test one kit before buying five. The reasons for each part, its settings and the mistakes to avoid are in {{ref:hardware}}.

### The project manager brings

{{tools}}

**You do not need a tool for work inside a live board: that is the electrician's.** The spares kit (one for each project manager) goes in the car too.

## Survey

About one hour, with the electrician if the plan needs one. Bring this pack, a phone for photographs, a tape measure, a torch and a notebook. No tools are needed to survey, and nothing is opened.

### Ask, in this order

The answers decide what is measured and what it costs. Write them on the survey form that follows.

1. Who decides, and who gets called at night? Names, mobile numbers, emails: these become **{{ui.who_is_told}}**. Each alert message carries an *I have seen this* link, so nobody needs a login to acknowledge; the people who should also look at the screens get a login of their own, and a login needs an email address.
2. What went wrong in the last twelve months that cost money or a guest? Write it in their words. It is the reason they buy.
3. The last twelve electricity bills (price per kWh, kWh bought each month) and the water bills. The platform shows what solar kept on site at their price; without a price it shows kWh only.
4. Is there solar? What brand is the inverter, and where is its AC output? Is it allowed to send energy to the grid?
5. Where does the supply enter the building? Is it three-phase?
6. Where are the water tank, the pump and its starter? How tall is the tank? What is the pipe's pressure?
7. Is there a network socket in the plant room, or cellular signal? (Look at your phone there.)
8. Is there a power socket for the box, and is it on a circuit that stays on?
9. Who is the customer's electrician, and can they be there on install day?

### Look at, and photograph

- The supply entry and the main board (closed): where a meter could be fitted with the clamps around the incoming phases.
- The inverter and its AC output cable.
- The tank, the pump, the starter, and any existing level or pressure gauge and flow meter.
- The place for the box: dry, 30 cm free, no heat, within reach of a socket and a network cable.
- The route for the data cable from the board to the box (under 100 metres; note any crossing of power cable).

{{include:_shared/go-nogo.md}}

## Survey form {.newpage .formtitle #survey-form-h data-kit="Kit H · Hotel or guesthouse"}

::: {.form}
| Field | Answer |
|---------------------|---------------------|
| Customer, site name and address, date | |
| Contact: name, mobile, email (first, second, third to be told) | |
| What went wrong last year (their words) | |
| Prices from the bills: electricity per kWh; paid for energy sent to the grid; water per m³ | |
| Twelve electricity bills and the water bills collected | {{cb}} Yes  {{cb}} Later |
| Supply: single or three phase; main breaker size (A) | |
| Inverter: brand, size (kW), where its AC output cable is; allowed to send to the grid? | |
| Tank: height (m), water source; pump (kW); starter location; pipe pressure (bar) | |
| Meters needed: grid, solar (and where) | |
| Sensors needed: level, pressure, flow, pump running (and where) | |
| Network: customer's cable or cellular; router brand; who can give an address | |
| Power for the box: socket location | |
| Electrician: name, mobile, day | |
| Photographs taken (list) | |
| Go / no-go, and why | {{cb}} Go  {{cb}} No-go |
:::

## The drawings {.newpage}

Every drawing is for kit H and says so. They show how the parts connect, not terminal numbers: follow the maker's manual for terminal numbers. Mains work is inside the dashed red box and is the electrician's.

{{diagram:kit:system}}

{{diagram:kit:wiring}}

{{diagram:kit:network}}

{{diagram:kit:enclosure}}

The order on the rail is a recommendation, not a maker's drawing: the electrician may change it to suit the enclosure. Keep mains and low voltage apart, and label every wire at both ends.

{{diagram:kit:ct}}

{{diagram:kit:loop}}

{{diagram:kit:power}}

## At the office

{{include:_shared/office.md}}

## Install day {.newpage #install-day-h}

About four to six hours. The electrician and the project manager work at the same time, in this order, so that nobody waits. The left edge of each row is black for the electrician, green for the project manager and sand for the customer.

::: steps
| | # | Who | Do this |
|--|-|-----|--------------------------------------------|
| {{cb}} | 1 | {{who:e}} {{who:pm}} | **Walk the site together.** Agree where each meter and sensor goes. Photograph everything before you start. |
| {{cb}} | 2 | {{who:c}} | Show the way to the main board, the inverter, the tank room and the starter. Have the router and a socket that stays on ready, and the person who can give the converter a fixed address. |
| {{cb}} | 3 | {{who:e}} | **Apply the customer's lock-out** on the board to be worked on. |
| {{cb}} | 4 | {{who:e}} | **Fit the grid meter** at the supply entry: voltage taps with their small fuses or 2 A breakers as the meter's manual says, and the three current clamps around the incoming phases, **arrow towards the site**. Figure H-5. |
| {{cb}} | 5 | {{who:e}} | **Fit the solar meter** on the inverter's AC output, after the inverter and before the distribution board: the same, clamps with the arrow towards the site. |
| {{cb}} | 6 | {{who:e}} | **Connect the pump's run contact** (a spare auxiliary contact of the starter) to the digital input of the water module. Never to a control circuit: the contact only reports. |
| {{cb}} | 7 | {{who:e}} | **Fit the level and pressure transmitters** (and the flow meter, if there is one) with the customer's plumber for the wet parts. The level transmitter hangs at the bottom of the tank and must be rated for drinking water. The pressure transmitter goes on the pipe through an isolating valve. |
| {{cb}} | 8 | {{who:pm}} | **Mount the enclosure** and in it the converter, the water module, the 24 V supply and the UPS (the box too, if there is room, otherwise on a shelf beside it). Figure H-4. |
| {{cb}} | 9 | {{who:pm}} | **Run the RS-485 data cable** from the converter to the grid meter, on to the solar meter, then to the water module: one cable, a daisy chain, no branches. Shielded twisted pair, the shield joined to ground at one end only, away from power cables. The electrician connects its ends at the meters' A and B terminals inside the board. Figure H-2. |
| {{cb}} | 10 | {{who:pm}} | **Wire the 4 to 20 mA signals:** two wires from each transmitter to the water module, with the 24 V supply in series with the module's input, as the module's manual draws it. Figure H-6. |
| {{cb}} | 11 | {{who:pm}} | **Set the water module:** unit number 3, and every channel you use to 4 to 20 mA. |
| {{cb}} | 12 | {{who:pm}} | **Set the converter:** Modbus TCP to RTU gateway mode, 9600 baud, 8 data bits, no parity, 1 stop bit, TCP port 502, and a fixed address on the site's network. Write the address down and photograph the settings page. |
| {{cb}} | 13 | {{who:pm}} | **Connect the network:** plug the box and the converter into the customer's router, or into the sockets of the 4G router if the site has no usable internet. Figure H-3. |
| {{cb}} | 14 | {{who:e}} {{who:pm}} | **Photograph before closing:** every meter's label (model and serial number), the wiring, the converter's settings. Then close the board. |
| {{cb}} | 15 | {{who:e}} | **Remove the lock-out** only when you both agree the work is closed up. |
| {{cb}} | 16 | {{who:pm}} | **Set each meter at its own display:** unit number (grid 1, solar 2), speed 9600, parity none. Write them down and photograph each display. Do this before the box starts reading: meters are delivered as unit 1, and two on one cable would answer at once. |
| {{cb}} | 17 | {{who:pm}} | **Power up** the UPS, the 24 V supply, the converter and the box. |
| {{cb}} | 18 | {{who:e}} | **Stay until commissioning is done.** |
| {{cb}} | 19 | {{who:pm}} | **Open the customer for setup again** on your laptop (the four hours are over by now) and go down the platform's setup list. |
:::

## Addresses and registers

Meters behind one converter share its IP address and differ only by unit number. Write the numbers down here as you set them; you type them into the setup list in step 3.

::: {.form .short}
| Device in Greecon | Make and model | Unit number | IP address (the converter's) | Port |
|--------------|-------------|------|-----------------|-----|
| {{ui.device_grid_meter}} | Eastron SDM630 | 1 | | 502 |
| {{ui.device_solar_meter}} | Eastron SDM630 | 2 | | 502 |
| {{ui.device_water_module}} | | 3 | | 502 |
:::

### The Eastron meters

Their registers are already filled in by the template: total active power, input register 52 (a manual's 30053; counted from zero), a 32-bit floating point number with the high half first, in watts, multiplied by 0.001 to make kW. Check them against the meter's manual only if a reading looks wrong. Test one from the box:

```
greecon-edge modbus-test --host 192.168.1.50 --unit 1 --type input --address 52 --data-type float32
```

### The water module

One form for each of its four readings (step 4 of the setup list). The register kind is **{{ui.register_input}}** for a manual's 3xxxx and **{{ui.register_holding}}** for 4xxxx; the address is counted from zero. The module's own manual gives what the register holds at 4 and at 20 mA: check those two with a loop calibrator (send 4, 12 and 20 mA, read the register with `greecon-edge modbus-test`) and write what you read.

::: {.form .short}
| Reading | Register kind | Address | Conversion | Register at 4 mA | Register at 20 mA | Reading from bottom to top |
|-----------|--------|-------|-----------|--------|--------|--------------|
| {{ui.reading_tank}} | | | A straight line | | | 0 to 100 (rule below) |
| {{ui.reading_pressure}} | | | A straight line | | | 0 to the range, in bar |
| {{ui.reading_flow}} | | | A straight line | | | 0 to the range, in litres a minute |
| {{ui.reading_pump}} | | | Multiply and add | | | on or off |
:::

**When the transmitter's range is longer than the tank is high:** reading at the top = range ÷ tank height × 100. A 0 to 5 m transmitter in a tank 3 m high: 5 ÷ 3 × 100 = 166.7. At the tank's full height the reading is then 100. Delete the {{ui.reading_flow}} reading if there is no flow meter (open **{{ui.equipment_and_readings}}**, find it under **Readings** and press **{{ui.remove}}**): a reading with no register holds the setup list at step 4.

## The platform's setup list

{{include:_shared/platform.md}}

## Commissioning {.newpage #commissioning-h}

{{include:_shared/commissioning-intro.md}}

{{include:_shared/internet-cut.md}}

::: tests
| Check and how | Pass when | Greecon shows | Real | Result |
|----------------------|-----------------|--------|--------|--------|
| **{{ui.device_grid_meter}}'s display against Greecon.** Read the display (kW or W) and Greecon at the same time. | Within 5 percent, or 1 kW on a small load | | | {{pf}} |
| **{{ui.device_solar_meter}}'s display against Greecon.** The same, on the solar meter. | Within 5 percent, or 1 kW on a small load | | | {{pf}} |
| **Grid direction.** A known load on (a kettle or a heater), the sun down or the solar off. | Import rises; export does not | | | {{pf}} |
| **Solar at night.** | Zero, or a few watts | | | {{pf}} |
| **Solar at midday.** Against the inverter's own display. | Within about 5 percent | | | {{pf}} |
| **{{ui.reading_tank}}.** A dipstick or the sight gauge, at two levels. | Within 5 percentage points | | | {{pf}} |
| **Pressure.** Against the pressure gauge on the same line. | Within 0.2 bar | | | {{pf}} |
| **Flow** (if there is a flow meter). A bucket test (fill a measured volume, time it), or the flow meter's own display. | Within 10 percent | | | {{pf}} |
| **{{ui.reading_pump}}.** The owner starts the pump. | Greecon shows running within 30 seconds, and changes both ways | | | {{pf}} |
| **4 to 20 mA channels.** With a loop calibrator, send 4, 12 and 20 mA. | The reading at the bottom, the middle and the top | | | {{pf}} |
{{include:_shared/rows-common.md}}
:::

Signed off by: {{line}} Date: {{line:short}}

## Handover {.newpage}

{{include:_shared/handover-1.md}}
- {{cb}} **Show the owner, in ten minutes, in this order:** the **{{ui.overview}}** (is everything all right, in one sentence); **{{ui.energy_now}}**, the flow moving from the solar to the site and the grid; **{{ui.value}}**, what the solar kept on site this month and the prices it uses; the site's own page under **{{ui.sites}}**, with the tank level, the pressure and whether the pump runs; **{{ui.who_is_told}}** (under **{{ui.settings}}**) and a live test message arriving on their phone, and that each message carries an *I have seen this* link, so that nobody needs a login to acknowledge an alert; **{{ui.reports}}**, under **{{ui.downloads}}**.
{{include:_shared/handover-2.md}}

## Handover record {.newpage .formtitle #handover-record-h data-kit="Kit H · Hotel or guesthouse"}

::: {.form .pad}
| Field | Answer |
|-------------------|-------------------------------------|
| Customer and site | |
| Date, and who was there | |
| {{ui.who_is_told}}, in order (name, mobile with country code, email) | |
| Alert limits agreed (tank Critical below, Low below; no-flow level) | |
| Without a flow meter or the pump's run contact the no-flow alert cannot be raised: said to the owner | {{cb}} Said  {{cb}} Not applicable |
| Prices entered (electricity, export, water) and where they came from | |
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
| **The tank level is wrong** (above 100 percent, or does not move) | A wrong reading at the top for the tank's height, a blocked vented cable, or the transmitter not at the bottom of the tank | Re-enter the reading at the top (range ÷ tank height × 100). Check that the transmitter hangs at the bottom with its vented cable free and fixed. Send 4, 12 and 20 mA with the loop calibrator and compare |
| **The pump shows running when it is stopped** (and the no-flow alert, an {{ui.act_now}}, opens while the pump is stopped) | The pump's running contact is inverted | The electrician swaps the contact's normally-open and normally-closed wires, or uses the opposite contact. Until it is right the no-flow alert cannot be trusted |

More, by symptom, are in the Appendices of the Complete Deployment Guide (Appendix C) and in the Field Manual. A device that does not answer is, in this order: a wrong unit number (the commonest), a wrong speed or parity at the converter, A and B swapped on the data cable, the converter not in gateway mode, a wrong IP address.
