## At a glance

::::: {.facts}
::: fact
**Who it suits**

A farm or a greenhouse with irrigation: soil moisture and weather at the field, with the water supply behind it (a tank, a pump, the pressure in the pipe).
:::

::: fact
**What it measures**

The moisture of the soil (one probe for each zone), the air temperature and humidity, the tank, the line pressure and, if there is a pump to watch, the pump's flow and whether it runs.
:::

::: fact
**Planning estimate**

{{kit.headline}}
:::

::: fact
**Time**

Survey about 1 hour, with the grower. Install day 4 to 6 hours. Commissioning about 1 hour. Handover 30 minutes.
:::

::: fact
**Template in the platform**

**{{kit.template}}**
:::

::: fact
**Standard settings**

Water module unit 3. 9600 baud, 8 data bits, no parity, 1 stop bit. Converter on port 502, in Modbus TCP to RTU gateway mode. A cellular router is the likelier case in a field.
:::
:::::

::: stop
**Greecon gives no irrigation advice until the grower's own "start irrigating below" value is entered.** That number depends on the soil, the crop and the probe's depth, and nobody can set it for the grower. After the first week of readings, ask the grower what reading means "time to water", and enter it as the limit (step 9 of the setup list).
:::

**The order of the work:** survey with the grower, buy, prepare at the office, install day, the platform's setup list, commissioning, handover. Then the morning check, and the day 1, 3 and 7 calls.

{{include:_shared/glance-rules.md}}

## What it measures

The template **{{kit.template}}** makes three devices. What each gives:

| Reading in Greecon | Comes from | Unit | Standard alert limits |
|------------|-------------------------|--------|-------------------------|
| **{{ui.reading_soil}}** | {{ui.device_soil}}: a soil moisture probe that speaks RS-485 Modbus, one for each zone, unit number chosen and written down | % | None. **Start irrigating below** has no standard value: the grower's own is entered after the first week |
| **{{ui.reading_air_temp}}** and **{{ui.reading_humidity}}** | {{ui.device_weather}}: a temperature and humidity sensor that speaks RS-485 Modbus, unit number chosen and written down | degrees Celsius, % | None |
| **{{ui.reading_tank}}** | {{ui.device_water_module}}, unit 3: the level transmitter's 4 to 20 mA | % | Critical below 15 % ({{ui.act_now}}); Low below 35 % ({{ui.check_today}}) |
| **{{ui.reading_pressure}}** | {{ui.device_water_module}}, unit 3: the pressure transmitter's 4 to 20 mA | bar | None |
| **{{ui.reading_flow}}** (if there is a pump to watch) | {{ui.device_water_module}}, unit 3: the flow meter's 4 to 20 mA | litres a minute | No flow at or below 0.2 litres a minute ({{ui.act_now}}, once it has held for 30 seconds, and only when the box reads both a flow and the pump's running state) |
| **{{ui.reading_pump}}** (if there is a pump to watch) | {{ui.device_water_module}}, unit 3: the pump starter's spare contact | on or off | None |

A sensor whose maker does not document its registers cannot be mapped, so it cannot be used. Soil readings are only as good as the contact between the probe and the soil: the handover records the probe's depth and where it is.

## What to buy and bring

{{bom}}

**{{kit.headline}}** One soil probe for each zone. Ask three suppliers for the quote on the specification, not the brand, and keep the quotes. Buy and bench-test one kit before buying five. The reasons for each part, its settings and the mistakes to avoid are in {{ref:hardware}}.

### The project manager brings

{{tools}}

**You do not need a tool for work inside a live board: that is the electrician's.** The USB-to-RS-485 adapter is how you set a probe's or a sensor's unit number before it is buried or mounted. The spares kit (one for each project manager) goes in the car too.

## Survey

About one hour, with the grower and, if the plan needs one, the electrician. Bring this pack, a phone for photographs, a tape measure, a torch and a notebook. No tools are needed to survey, and nothing is opened.

### Ask, in this order

The answers decide what is measured and what it costs. Write them on the survey form that follows.

1. Who decides, and who gets called at night? Names, mobile numbers, emails: these become **{{ui.who_is_told}}**. Each of them also needs a login of their own, so that they can acknowledge an alert, and a login needs an email address.
2. What went wrong in the last twelve months that cost money or a crop? Write it in their words. It is the reason they buy.
3. **Which crop, which soil, how deep are the roots, and where in the field is typical** (not the wettest or the driest spot)? The irrigation limit depends on them.
4. Where are the water tank, the pump and its starter? How tall is the tank? What is the pipe's pressure? Is there a pump to watch?
5. Is there a network socket in the pump house, or cellular signal? (Look at your phone there.)
6. Is there a power socket for the box, on a circuit that stays on?
7. How far is the probe's place from the box? The data cable is planned at under 100 metres. If it is further, a probe on a radio gateway that speaks Modbus is the alternative; the gateway's maker must publish its register table. Ask the founder before promising it.
8. Who is the customer's electrician, and can they be there on install day?

### Look at, and photograph

- The field: where each probe goes, and the weather sensor's place.
- The tank, the pump, the starter, and any existing level or pressure gauge and flow meter.
- The pump house: where the box and the cellular router would sit, dry, 30 cm free, no heat, within reach of a socket.
- The route for the data cable from the field to the box (note any crossing of power cable).

{{include:_shared/go-nogo.md}}

## Survey form {.newpage .formtitle #survey-form-f data-kit="Kit F · Farm or greenhouse with irrigation"}

::: {.form}
| Field | Answer |
|---------------------|---------------------|
| Customer, site name and address, date | |
| Contact: name, mobile, email (first, second, third to be told) | |
| What went wrong last year (their words) | |
| Crop; soil; root depth (cm) | |
| Zones: how many probes; where each goes (typical, not wettest or driest) | |
| Distance from the probe places to the box (m); wired or radio gateway | |
| Tank: height (m), water source; pump (kW); starter location; pipe pressure (bar) | {{cb}} No pump to watch |
| Sensors needed: level, pressure, flow, pump running (and where) | |
| Network: customer's cable or cellular; signal in the pump house | |
| Power for the box: socket location | |
| Electrician: name, mobile, day | |
| Photographs taken (list) | |
| Go / no-go, and why | {{cb}} Go  {{cb}} No-go |
:::

## The drawings {.newpage}

Every drawing is for kit F and says so. They show how the parts connect, not terminal numbers: follow the maker's manual for terminal numbers.

{{diagram:kit:system}}

{{diagram:kit:wiring}}

{{diagram:kit:network}}

{{diagram:kit:enclosure}}

The order on the rail is a recommendation, not a maker's drawing: the electrician may change it to suit the enclosure. Keep mains and low voltage apart, and label every wire at both ends.

{{diagram:kit:loop}}

{{diagram:kit:power}}

## At the office

{{include:_shared/office.md}}

Before the kit leaves the office, set the unit number of each soil probe and of the weather sensor, with the USB-to-RS-485 adapter and the maker's instructions, and write them down: **set them before the probe is buried or the sensor is mounted.** Make every one different from the others and from the water module (3).

## Install day {.newpage #install-day-f}

About four to six hours. The electrician and the project manager work at the same time, in this order, so that nobody waits. The left edge of each row is black for the electrician, green for the project manager and sand for the customer.

::: steps
| | # | Who | Do this |
|--|-|-----|--------------------------------------------|
| {{cb}} | 1 | {{who:e}} {{who:pm}} {{who:c}} | **Walk the site together,** with the grower. Agree where each probe and the weather sensor go (typical of the zone, not the wettest or driest spot), and where the enclosure sits. Photograph everything before you start. |
| {{cb}} | 2 | {{who:c}} | Show the way to the pump house, the tank and the starter. Have a socket that stays on ready. |
| {{cb}} | 3 | {{who:e}} | **Apply the customer's lock-out** on the circuit that feeds the pump house. |
| {{cb}} | 4 | {{who:e}} | **Connect the mains to the 24 V DIN supply** in the enclosure, as its manual shows, with a fuse or small breaker as needed. |
| {{cb}} | 5 | {{who:e}} | **If there is a pump to watch:** connect the pump's run contact (a spare auxiliary contact of the starter) to the digital input of the water module. Never to a control circuit: the contact only reports. |
| {{cb}} | 6 | {{who:e}} | **Fit the level and pressure transmitters** (and the flow meter, if there is one) with the customer's plumber for the wet parts. The level transmitter hangs at the bottom of the tank and must be rated for drinking water. The pressure transmitter goes on the pipe through an isolating valve. |
| {{cb}} | 7 | {{who:pm}} | **Mount the enclosure** and in it the converter, the water module, the 24 V supply, the 4G router (and the box, if there is room, otherwise on a shelf beside it). Figure F-4. |
| {{cb}} | 8 | {{who:pm}} {{who:c}} | **Place the soil probe(s)** at the depth and in the place agreed with the grower, in good contact with the soil, as the maker says; mount the weather sensor. **Write down each probe's depth and where it is, and photograph it.** |
| {{cb}} | 9 | {{who:pm}} | **Run the RS-485 data cable** from the converter to the soil probe(s) and the weather sensor, and on to the water module: one cable, a daisy chain, no branches. Shielded twisted pair, the shield joined to ground at one end only, away from power cables. Figure F-2. |
| {{cb}} | 10 | {{who:pm}} | **Wire the 4 to 20 mA signals:** two wires from each transmitter to the water module, with the 24 V supply in series with the module's input, as the module's manual draws it. Figure F-5. |
| {{cb}} | 11 | {{who:pm}} | **Set the water module:** unit number 3, and every channel you use to 4 to 20 mA. |
| {{cb}} | 12 | {{who:pm}} | **Set the converter:** Modbus TCP to RTU gateway mode, 9600 baud, 8 data bits, no parity, 1 stop bit, TCP port 502, and a fixed address on the site's network. Write the address down and photograph the settings page. |
| {{cb}} | 13 | {{who:pm}} | **Connect the network:** put the SIM in the 4G router, check the signal where it sits, and plug the box and the converter into its sockets (or into the customer's router if the pump house has one). Figure F-3. |
| {{cb}} | 14 | {{who:e}} {{who:pm}} | **Photograph before closing:** the wiring, the converter's settings, each device's label. Then close the enclosure. |
| {{cb}} | 15 | {{who:e}} | **Remove the lock-out** only when you both agree the work is closed up. |
| {{cb}} | 16 | {{who:pm}} | **Power up** the 24 V supply, the converter, the router and the box. |
| {{cb}} | 17 | {{who:e}} | **Stay until commissioning is done.** |
| {{cb}} | 18 | {{who:pm}} | **Open the customer for setup again** on your laptop (the four hours are over by now) and go down the platform's setup list. |
:::

## Addresses and registers

Devices behind one converter share its IP address and differ only by unit number. The launch documents fix only the unit numbers 1 to 4 (grid 1, solar 2, water module 3, optional load or pump meter 4); the probes and the weather sensor need their own, chosen and written down. A suggestion, if you have none: weather sensor 5, soil probes 6, 7 and so on. Write the numbers here as you set them; you type them into the setup list in step 3.

::: {.form .short}
| Device in Greecon | Make and model | Unit number | IP address (the converter's) | Port |
|--------------|-------------|------|-----------------|-----|
| {{ui.device_soil}} (zone 1) | | | | 502 |
| {{ui.device_soil}} (zone 2, if any) | | | | 502 |
| {{ui.device_weather}} | | | | 502 |
| {{ui.device_water_module}} | | 3 | | 502 |
:::

### Registers: all of them from the makers' manuals

There is no ready-made profile for a probe or a sensor: each reading is mapped by hand from the maker's register table (step 4 of the setup list). Under each reading's name press **{{ui.choose_the_register}}**. The register kind is **{{ui.register_input}}** for a manual's 3xxxx and **{{ui.register_holding}}** for 4xxxx; the address is counted from zero (30053 is address 52). Write what you enter:

::: {.form .short}
| Reading | Register kind | Address | Kind of number | How it becomes the reading |
|-----------|--------|-------|-----------|--------------------|
| {{ui.reading_soil}} (zone 1) | | | | |
| {{ui.reading_air_temp}} | | | | |
| {{ui.reading_humidity}} | | | | |
:::

For the water module's four readings (tank, pressure, flow and pump running), use the worksheet below. The module's own manual gives what the register holds at 4 and at 20 mA: check those two with a loop calibrator (send 4, 12 and 20 mA, read the register with `greecon-edge modbus-test`) and write what you read.

::: {.form .short}
| Reading | Register kind | Address | Conversion | Register at 4 mA | Register at 20 mA | Reading from bottom to top |
|-----------|--------|-------|-----------|--------|--------|--------------|
| {{ui.reading_tank}} | | | A straight line | | | 0 to 100 (rule below) |
| {{ui.reading_pressure}} | | | A straight line | | | 0 to the range, in bar |
| {{ui.reading_flow}} | | | A straight line | | | 0 to the range, in litres a minute |
| {{ui.reading_pump}} | | | Multiply and add | | | on or off |
:::

**When the transmitter's range is longer than the tank is high:** reading at the top = range ÷ tank height × 100. A 0 to 5 m transmitter in a tank 3 m high: 5 ÷ 3 × 100 = 166.7. Delete the readings the site does not have (no flow meter, no pump to watch): open **{{ui.equipment_and_readings}}**, find them under **Readings** and press **{{ui.remove}}**. A reading with no register holds the setup list at step 4.

## The platform's setup list

{{include:_shared/platform.md}}

## Commissioning {.newpage #commissioning-f}

{{include:_shared/commissioning-intro.md}}

{{include:_shared/internet-cut.md}}

::: tests
| Check and how | Pass when | Greecon shows | Real | Result |
|----------------------|-----------------|--------|--------|--------|
| **{{ui.device_soil}}.** In the air, then in a glass of water, then in the soil. | Three different readings: low in the air, high in the water, plausible in the soil | | | {{pf}} |
| **{{ui.device_weather}}.** Against a hand-held thermometer at the sensor. (This check is added by the pack: the launch documents give no tolerance, so write both numbers and judge.) | Plausible for the time of day | | | {{pf}} |
| **{{ui.reading_tank}}.** A dipstick or the sight gauge, at two levels. | Within 5 percentage points | | | {{pf}} |
| **Pressure.** Against the pressure gauge on the same line. | Within 0.2 bar | | | {{pf}} |
| **Flow** (if there is a flow meter). A bucket test (fill a measured volume, time it), or the flow meter's own display. | Within 10 percent | | | {{pf}} |
| **{{ui.reading_pump}}** (if there is a pump to watch). The owner starts the pump. | Greecon shows running within 30 seconds, and changes both ways | | | {{pf}} |
| **4 to 20 mA channels.** With a loop calibrator, send 4, 12 and 20 mA. | The reading at the bottom, the middle and the top | | | {{pf}} |
{{include:_shared/rows-common.md}}
:::

Signed off by: {{line}} Date: {{line:short}}

## Handover {.newpage}

{{include:_shared/handover-1.md}}
- {{cb}} **Show the owner, in ten minutes, in this order:** the **{{ui.overview}}** (is everything all right, in one sentence); the site's own page under **{{ui.sites}}**, with the soil moisture, the air temperature and humidity, the tank level and the pressure; **{{ui.who_is_told}}** (under **{{ui.settings}}**) and a live test message arriving on their phone, and that each person on the list has a login of their own, so that they can acknowledge an alert; **{{ui.reports}}**, under **{{ui.downloads}}**.
- {{cb}} **Write the probe's depth and place** on the handover record, and say that soil readings are only as good as the contact between the probe and the soil.
- {{cb}} **Say that Greecon gives no irrigation advice yet,** and agree when you will ask what reading means "time to water" (after the first week).
{{include:_shared/handover-2.md}}

## Handover record {.newpage .formtitle #handover-record-f data-kit="Kit F · Farm or greenhouse with irrigation"}

::: {.form .pad}
| Field | Answer |
|---------------------|---------------------|
| Customer and site | |
| Date, and who was there | |
| {{ui.who_is_told}}, in order (name, mobile with country code, email) | |
| Each probe: depth, and where it is | |
| Alert limits agreed (tank Critical below, Low below; no-flow level if a pump is watched) | |
| "Start irrigating below": not set yet; to be asked after the first week, on | |
| {{ui.setup_list}}: every step Done and the site Commissioned | {{cb}} Yes |
| {{ui.handover_sheet_link}} printed and signed | {{cb}} Yes |
| Shown: {{ui.overview}}, the site's page, {{ui.who_is_told}} with a live test message, {{ui.reports}} | {{cb}} Yes |
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
| **A probe or the weather sensor does not answer** | A wrong unit number (many are delivered as unit 1, the same as another device), a speed or parity that does not match the converter, A and B swapped, no power | Check each in that order. Test the register from the box (`greecon-edge modbus-test`) against the maker's table. A device whose number was changed before burying is easy to check; one that was not must be dug up, so set every number before the probe goes in the ground |
| **The soil reading looks wrong** (constant, or the same in air and in water) | A wrong register, the wrong register kind (Input or Holding), a wrong scale, or poor contact between the probe and the soil | Re-test the register against the maker's table; repeat the air, water and soil check; check the probe's depth and contact |
| **No irrigation advice is shown** | "Start irrigating below" has no standard value | After the first week of readings, ask the grower what reading means "time to water" and enter it as the limit (setup step 9) |

More, by symptom, are in the Appendices of the Complete Deployment Guide (Appendix C) and in the Field Manual. A device that does not answer is, in this order: a wrong unit number (the commonest), a wrong speed or parity at the converter, A and B swapped on the data cable, the converter not in gateway mode, a wrong IP address.
