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

Soil probe 6, weather sensor 7, water module 3, pump contact module 5 (if there is a pump to watch), all set before the kit leaves the office. 9600 baud, 8 data bits, no parity, 1 stop bit. Converter on port 502, in Modbus TCP to RTU gateway mode. A cellular router is the likelier case in a field.
:::
:::::

::: stop
**Greecon gives no irrigation advice until the grower's own "start irrigating below" value is entered.** That number depends on the soil, the crop and the probe's depth, and nobody can set it for the grower. After the first week of readings, ask the grower what reading means "time to water", and enter it as the limit (step 10 of the setup list). **Frost works the same way:** ask at what air temperature frost damages the crop, and in which weeks; enter it as **Frost alert at or below** on the air temperature (step 10). It opens an Act now alert, so agree who is woken. Map the air temperature as a signed number (int16), or a frosty morning reads as a hot afternoon.
:::

**The order of the work:** survey with the grower, buy, prepare at the office, install day, the platform's setup list, commissioning, handover. Then the morning check, and the day 1, 3 and 7 calls.

{{include:_shared/glance-rules.md}}

## What it measures

The template **{{kit.template}}** makes four devices. What each gives:

| Reading in Greecon | Comes from | Unit | Standard alert limits |
|------------|-------------------------|--------|-------------------------|
| **{{ui.reading_soil}}** | {{ui.device_soil}}: a soil moisture probe that speaks RS-485 Modbus, one for each zone, unit 6 (not an approved model: address and registers entered by hand) | % | None. **Start irrigating below** has no standard value: the grower's own is entered after the first week |
| **{{ui.reading_air_temp}}** and **{{ui.reading_humidity}}** | {{ui.device_weather}}: a temperature and humidity sensor that speaks RS-485 Modbus, unit 7 (not an approved model: address and registers entered by hand) | degrees Celsius, % | None |
| **{{ui.reading_tank}}** | {{ui.device_water_module}}, unit 3: the level transmitter's 4 to 20 mA | % | Critical below 15 % ({{ui.act_now}}); Low below 35 % ({{ui.check_today}}) |
| **{{ui.reading_pressure}}** | {{ui.device_water_module}}, unit 3: the pressure transmitter's 4 to 20 mA | bar | None |
| **{{ui.reading_flow}}** (if there is a pump to watch) | {{ui.device_water_module}}, unit 3: the flow meter's 4 to 20 mA | litres a minute | No flow at or below 0.2 litres a minute ({{ui.act_now}}, once it has held for 30 seconds, and only when the box reads both a flow and the pump's running state) |
| **{{ui.reading_pump}}** (if there is a pump to watch) | {{ui.device_pump_contact}}, unit 5: the pump starter's spare contact | on or off | None |

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

1. Who decides, and who gets called at night? Names, mobile numbers, emails: these become **{{ui.who_is_told}}**. Each alert message carries an *I have seen this* link, so nobody needs a login to acknowledge; the people who should also look at the screens get a login of their own, and a login needs an email address.
2. What went wrong in the last twelve months that cost money or a crop? Write it in their words. It is the reason they buy.
3. **Which crop, which soil, how deep are the roots, and where in the field is typical** (not the wettest or the driest spot)? The irrigation limit depends on them.
4. Where are the water tank, the pump and its starter? How tall is the tank? What is the pipe's pressure? Is there a pump to watch, and has its starter a spare "running" contact?
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
| Tank: height (m), water source; pump (kW); starter location; spare running contact on the starter; pipe pressure (bar) | {{cb}} No pump to watch |
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

Before the kit leaves the office, set the unit number of each soil probe (**6**) and of the weather sensor (**7**), with the USB-to-RS-485 adapter and the maker's instructions, and write them down: **set them before the probe is buried or the sensor is mounted.** Make every one different from the others and from the water module (3) and the pump contact module (5): a second probe, for a second zone, takes the next free number (8, then 9), written down.

## Install day {.newpage #install-day-f}

About four to six hours. The electrician and the project manager work at the same time, in this order, so that nobody waits. The left edge of each row is black for the electrician, green for the project manager and sand for the customer.

::: steps
| | # | Who | Do this |
|--|-|-----|--------------------------------------------|
| {{cb}} | 1 | {{who:e}} {{who:pm}} {{who:c}} | **Before anyone touches anything:** the signed order form and the data terms are in your hand, the electrician is there, and the customer's lock-out is agreed. **Walk the site together,** with the grower. Agree where each probe and the weather sensor go (typical of the zone, not the wettest or driest spot), and where the enclosure sits. Photograph everything before you start. |
| {{cb}} | 2 | {{who:c}} | Show the way to the pump house, the tank and the starter. Have a socket that stays on ready. |
| {{cb}} | 3 | {{who:e}} | **Apply the customer's lock-out** on the circuit that feeds the pump house. |
| {{cb}} | 4 | {{who:e}} | **Connect the mains to the 24 V DIN supply** in the enclosure, as its manual shows, with a fuse or small breaker as needed. |
| {{cb}} | 5 | {{who:e}} | **If there is a pump to watch:** connect the pump's run contact (a spare auxiliary contact of the starter, as a dry contact) to **input 1 of the pump contact module**, as the module's manual draws it (its DI COM left unconnected). Never to a control circuit, and never to the module's relay outputs: the contact only reports. |
| {{cb}} | 6 | {{who:e}} {{who:pm}} | **Fit the level and pressure transmitters** (and the flow meter, if there is one) with the customer's plumber for the wet parts, and **wire their 4 to 20 mA loops** with the 24 V supply in series, as the module's manual draws it: **level on input 1, pressure on input 2, flow meter on input 3.** The level transmitter hangs at the bottom of the tank and must be rated for drinking water. The pressure transmitter goes on the pipe through an isolating valve. Figure F-5. You check each is on its own input and number the wires at both ends. |
| {{cb}} | 7 | {{who:pm}} | **Mount the enclosure** and in it the converter, the water module, the pump contact module (if there is a pump to watch), the 24 V supply, the 4G router (and the box, if there is room, otherwise on a shelf beside it). Figure F-4. |
| {{cb}} | 8 | {{who:pm}} {{who:c}} | **Place the soil probe(s)** at the depth and in the place agreed with the grower, in good contact with the soil, as the maker says; mount the weather sensor. **Write down each probe's depth and where it is, and photograph it.** |
| {{cb}} | 9 | {{who:pm}} | **Run the RS-485 data cable** from the converter to the soil probe(s) and the weather sensor, and on to the water module and the pump contact module: one cable, a daisy chain, no branches. Shielded twisted pair, the shield joined to ground at one end only, away from power cables. Figure F-2. |
| {{cb}} | 10 | {{who:pm}} | **Check the labels:** the number on each device against the table under *Numbers, addresses and ranges* (soil probe 6, weather sensor 7, water module 3, pump contact module 5). They were set at the office: do not change them. Photograph each label. |
| {{cb}} | 11 | {{who:pm}} | **Check the converter's label** (gateway mode, 9600 baud, 8 data bits, no parity, 1 stop bit, port 502) and **connect the network:** put the SIM in the 4G router, check the signal where it sits, and plug the box and the converter into its sockets (or into the customer's router if the pump house has one). Ask for a fixed address for the converter if it is on the customer's router, and write it down. Figure F-3. |
| {{cb}} | 12 | {{who:e}} {{who:pm}} | **Photograph before closing:** the wiring, the converter's settings, each device's label. Then close the enclosure. |
| {{cb}} | 13 | {{who:e}} | **Remove the lock-out** only when you both agree the work is closed up. |
| {{cb}} | 14 | {{who:pm}} | **Power up** the 24 V supply, the converter, the router and the box. |
| {{cb}} | 15 | {{who:e}} | **Stay until commissioning is done.** |
| {{cb}} | 16 | {{who:pm}} | **Open the customer for setup again** on your laptop (the four hours are over by now) and go down the platform's setup list: **{{ui.find_equipment}}**, the probe and the sensor by hand, the ranges, and the electrician's name and licence number. |
:::

## Numbers, addresses and ranges

The numbers on the cable were set at the office. The box finds the water module and the pump contact module on the network. It cannot recognise a soil probe or a weather sensor, so those two are entered by hand, with their registers, from the makers' manuals. For the transmitters you give the range printed on each label.

### The numbers on the cable

All the devices are behind one converter: they share its address and port 502, and differ only by number. Check each label against this table on install day. **Do not change a number on site.**

::: {.form .short}
| Device in Greecon | Make and model | Number | Label checked | Address (the converter's) |
|--------------|-------------|----------|-----------------|-----------------|
| {{ui.device_soil}} (zone 1) | | 6 | {{cb}} | |
| {{ui.device_soil}} (zone 2, if any) | | 8 (the next free number) | {{cb}} | |
| {{ui.device_weather}} | | 7 | {{cb}} | |
| {{ui.device_water_module}} | Waveshare Modbus RTU Analog Input 8CH | 3 | {{cb}} | |
| {{ui.device_pump_contact}} | Waveshare Modbus RTU IO 8CH | 5 | {{cb}} | |
:::

For the soil probes and the weather sensor, under each device open **{{ui.enter_address_by_hand}}** and fill in its **{{ui.ip_address}}** (the converter's: the water module's line in the same step shows it, as *Reached at 192.168.1.50:502, unit 3*), its **{{ui.port}}** (502) and its **{{ui.unit_number}}**.

### Registers for the probe and the sensor: all of them from the makers' manuals

There is no ready-made profile for a probe or a sensor: each reading is mapped by hand from the maker's register table (step 5 of the setup list). Under each reading's name press **{{ui.choose_the_register}}**. The register kind is **{{ui.register_input}}** for a manual's 3xxxx and **{{ui.register_holding}}** for 4xxxx; the address is counted from zero (30053 is address 52). Write what you enter:

::: {.form .short}
| Reading | Register kind | Address | Kind of number | How it becomes the reading |
|-----------|--------|-------|-----------|--------------------|
| {{ui.reading_soil}} (zone 1) | | | | |
| {{ui.reading_air_temp}} | | | | |
| {{ui.reading_humidity}} | | | | |
:::

### The pump contact module and the ranges

If there is a pump to watch, the pump contact module needs nothing typed: the template fills in its reading (digital input 1). Check it by eye: with the pump running, **{{ui.reading_pump}}** reads 1; stopped, 0. Test it from the box: `greecon-edge modbus-test --host 192.168.1.50 --unit 5 --type discrete --address 0`. With no pump to watch, press **{{ui.site_does_not_have}}** under it in step 4.

For the water module, one form for each transmitter (step 5 of the setup list), in the label's own words. Read the range from the label on the transmitter and measure how tall the tank is inside, from the bottom to the top of the water when it is full.

::: {.form .short}
| Reading | Input | The form asks for | Range on the label | Tank height |
|-----------|-----|-----------------|--------|--------|
| {{ui.reading_tank}} | 1 | {{ui.range_level}}: the range on the label (m or bar) and how tall the tank is inside (m) | | |
| {{ui.reading_pressure}} | 2 | {{ui.range_pressure}}: the top of the range (bar) | | |
| {{ui.reading_flow}} | 3 | {{ui.range_flow}}: the top of the range (lpm, litres a minute) | | |
:::

Greecon works out the register and the scale: 4 mA is 0 and 20 mA is the range (for the tank, range ÷ tank height × 100: a 0 to 5 m transmitter in a tank 4 m tall gives 125, and a full tank, at 16.8 mA, reads 100). **A transmitter shorter than the tank is refused:** it cannot see the top of the water. Tick **{{ui.not_fitted}}** for the readings the site does not have (no flow meter): the reading is taken away and nothing waits for it.

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
- {{cb}} **Show the owner, in ten minutes, in this order:** the **{{ui.overview}}** (is everything all right, in one sentence); the site's own page under **{{ui.sites}}**, with the soil moisture, the air temperature and humidity, the tank level and the pressure; **{{ui.who_is_told}}** (under **{{ui.settings}}**) and a live test message arriving on their phone, and that each message carries an *I have seen this* link, so that nobody needs a login to acknowledge an alert; **{{ui.reports}}**, under **{{ui.downloads}}**.
- {{cb}} **Write the probe's depth and place** on the handover record, and say that soil readings are only as good as the contact between the probe and the soil.
- {{cb}} **Say that Greecon gives no irrigation advice yet,** and agree when you will ask what reading means "time to water" (after the first week).
- {{cb}} **Ask at what air temperature frost damages the crop, and in which weeks.** Enter it as the frost limit; say that the alert is an Act now message, possibly in the night, and agree who is woken.
{{include:_shared/handover-2.md}}

## Handover record {.newpage .formtitle #handover-record-f data-kit="Kit F · Farm or greenhouse with irrigation"}

::: {.form .pad}
| Field | Answer |
|---------------------|---------------------|
| Customer and site | |
| Date, and who was there | |
| {{ui.who_is_told}}, in order (name, mobile with country code, email) | |
| Papers: who signed for the customer, and the date | |
| Electrician: name and licence number (or: no electrical work was needed) | |
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
| **A probe or the weather sensor does not answer** | A wrong unit number (many are delivered as unit 1, the same as another device: that is why every number is set at the office, before the probe is buried), a number or an address entered by hand wrongly, a speed or parity that does not match the converter, A and B swapped, no power | Check each in that order. Test the register from the box (`greecon-edge modbus-test`) against the maker's table. A device whose number was set before burying is easy to check; one that was not must be dug up, so every number is set before the probe goes in the ground |
| **The soil reading looks wrong** (constant, or the same in air and in water) | A wrong register, the wrong register kind (Input or Holding), a wrong scale, or poor contact between the probe and the soil | Re-test the register against the maker's table; repeat the air, water and soil check; check the probe's depth and contact |
| **A frosty morning reads as a hot afternoon** | The air temperature was mapped as an unsigned number | Map it as int16 (signed), with the scale of the sensor's table |
| **No irrigation advice is shown** | "Start irrigating below" has no standard value | After the first week of readings, ask the grower what reading means "time to water" and enter it as the limit (setup step 10) |

More, by symptom, are in the Appendices of the Complete Deployment Guide (Appendix C) and in the Field Manual. A device that does not answer is, in this order: the converter's address changed (press **{{ui.find_equipment}}** again), the number on the device's label not the one on the install card, a wrong speed at the converter, A and B swapped on the data cable, the converter not in gateway mode.
