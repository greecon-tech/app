## At a glance

::::: {.facts}
::: fact
**Who it suits**

A water tank and pump station: a tank, a pump and the pipe it feeds, with the pump's electricity use if wanted. The simplest site, and a good first rehearsal.
:::

::: fact
**What it measures**

The level in the tank, the line pressure, the pump's flow (with a flow meter), whether it runs and, optionally, the pump's electricity use.
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

Unit numbers: water module 3, optional pump meter 4, pump contact module 5 (if the starter has a spare contact), all set at the office. 9600 baud, 8 data bits, no parity, 1 stop bit. Converter on port 502, in Modbus TCP to RTU gateway mode.
:::
:::::

**The order of the work:** survey, buy, prepare at the office, install day, the platform's setup list, commissioning, handover. Then the morning check, and the day 1, 3 and 7 calls.

{{include:_shared/glance-rules.md}}

## What it measures

The template **{{kit.template}}** makes three devices. What each gives:

| Reading in Greecon | Comes from | Unit | Standard alert limits |
|------------|-------------------------|--------|-------------------------|
| **{{ui.reading_tank}}** | {{ui.device_water_module}}, unit 3: the level transmitter's 4 to 20 mA | % | Critical below 15 % ({{ui.act_now}}); Low below 35 % ({{ui.check_today}}) |
| **{{ui.reading_pressure}}** | {{ui.device_water_module}}, unit 3: the pressure transmitter's 4 to 20 mA | bar | None |
| **{{ui.reading_flow}}** | {{ui.device_water_module}}, unit 3: the flow meter's 4 to 20 mA (optional) | litres a minute | No flow at or below 0.2 litres a minute ({{ui.act_now}}, once it has held for 30 seconds, and only when the box reads both a flow and the pump's running state) |
| **{{ui.reading_pump}}** | {{ui.device_pump_contact}}, unit 5: the pump starter's spare contact | on or off | None |
| **{{ui.reading_consumption}}** (optional) | {{ui.device_pump_meter}}: an Eastron SDM230 on the pump's feed, unit 4 | kW | None |

Without the flow meter, or without the pump's running contact, "the pump is running but no water is flowing" cannot be raised, and the handover should say so.

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
2. What went wrong in the last twelve months that cost money or water? Write it in their words. It is the reason they buy.
3. Where are the water tank, the pump and its starter? How tall is the tank? Has the starter a spare "running" contact?
4. **What is the pipe's pressure range?** It decides the pressure transmitter's range.
5. **What does the pump do when the tank is low, and when it is full?** And who is told today when something goes wrong?
6. Is there a network socket in the plant room, or cellular signal? (Look at your phone there.)
7. Is there a power socket for the box, and is it on a circuit that stays on?
8. Does the owner want the pump's own electricity measured (an optional single-phase meter on the pump's feed)?
9. Who is the customer's electrician, and can they be there on install day?

### Look at, and photograph

- The tank, the pump, the starter, and any existing level or pressure gauge and flow meter.
- Where the level and pressure transmitters can be fitted: the pressure transmitter on the pipe through an isolating valve; the level transmitter at the bottom of the tank.
- The place for the box: dry, 30 cm free, no heat, within reach of a socket and a network cable.
- The route for the data cable from the board to the box (under 100 metres; note any crossing of power cable).

{{include:_shared/go-nogo.md}}

## Survey form {.newpage .formtitle #survey-form-w data-kit="Kit W · Water tank and pump station"}

::: {.form}
| Field | Answer |
|---------------------|---------------------|
| Customer, site name and address, date | |
| Contact: name, mobile, email (first, second, third to be told) | |
| What went wrong last year (their words) | |
| Tank: height (m), water source; drinking water? | |
| Pump (kW); starter location; spare running contact on the starter; what it does when the tank is low and when it is full | |
| Pipe pressure range (bar), so the pressure transmitter's range | |
| Sensors needed: level, pressure, flow, pump running (and where) | |
| Pump meter wanted? | {{cb}} Yes  {{cb}} No |
| Network: customer's cable or cellular; router brand; who can give an address | |
| Power for the box: socket location | |
| Electrician: name, mobile, day | |
| Photographs taken (list) | |
| Go / no-go, and why | {{cb}} Go  {{cb}} No-go |
:::

## The drawings {.newpage}

Every drawing is for kit W and says so. They show how the parts connect, not terminal numbers: follow the maker's manual for terminal numbers. Mains work is inside the dashed red box and is the electrician's.

{{diagram:kit:system}}

{{diagram:kit:wiring}}

{{diagram:kit:network}}

{{diagram:kit:enclosure}}

The order on the rail is a recommendation, not a maker's drawing: the electrician may change it to suit the enclosure. Keep mains and low voltage apart, and label every wire at both ends.

{{diagram:kit:loop}}

{{diagram:kit:power}}

## At the office

{{include:_shared/office.md}}

## Install day {.newpage #install-day-w}

About four to six hours. The electrician and the project manager work at the same time, in this order, so that nobody waits. The left edge of each row is black for the electrician, green for the project manager and sand for the customer.

::: steps
| | # | Who | Do this |
|--|-|-----|--------------------------------------------|
| {{cb}} | 1 | {{who:e}} {{who:pm}} | **Before anyone touches anything:** the signed papers are in your hand, the electrician is there, and the lock-out is agreed. **Walk the site together.** Agree where each sensor goes. Photograph everything before you start. |
| {{cb}} | 2 | {{who:c}} | Show the way to the tank, the pump and the starter. Have the router and a socket that stays on ready, and the person who can give the converter a fixed address. |
| {{cb}} | 3 | {{who:e}} | **Apply the customer's lock-out** on the board to be worked on. |
| {{cb}} | 4 | {{who:e}} | **Connect the pump's run contact** (a spare auxiliary contact of the starter, as a dry contact) to **input 1 of the pump contact module**, as the module's manual draws it (its DI COM left unconnected). Never to a control circuit, and never to the module's relay outputs: the contact only reports. If the starter has no spare contact there is no module: it is taken off the list in setup step 4. |
| {{cb}} | 5 | {{who:e}} {{who:pm}} | **Fit the level and pressure transmitters** (and the flow meter, if there is one) with the customer's plumber for the wet parts, and **wire their 4 to 20 mA loops** with the 24 V supply in series, as the module's manual draws it: **level on input 1, pressure on input 2, flow meter on input 3.** The level transmitter hangs at the bottom of the tank and must be rated for drinking water. The pressure transmitter goes on the pipe through an isolating valve. Figure W-5. You check each is on its own input and number the wires at both ends. |
| {{cb}} | 6 | {{who:e}} | **Fit the pump meter** (only if wanted) on the pump's feed, as its maker's manual shows. |
| {{cb}} | 7 | {{who:pm}} | **Mount the enclosure** and in it the converter, the water module, the pump contact module, the 24 V supply and the UPS (the box too, if there is room, otherwise on a shelf beside it). Figure W-4. |
| {{cb}} | 8 | {{who:pm}} | **Run the RS-485 data cable** from the converter to the pump meter if there is one, and on to the water module and the pump contact module: one cable, a daisy chain, no branches. Shielded twisted pair, the shield joined to ground at one end only, away from power cables. The electrician connects its end at the pump meter's A and B terminals. Figure W-2. |
| {{cb}} | 9 | {{who:pm}} | **Check the labels:** the number on each device against the table under *Numbers, addresses and ranges* (water module 3, pump contact module 5, pump meter 4). They were set at the office: do not change them. The SDM230 is delivered at a speed that depends on its version (the V1.6 manual says 2400); Greecon set it to 9600 on its display at the office. Photograph each label and the pump meter's display. |
| {{cb}} | 10 | {{who:pm}} | **Check the converter's label** (gateway mode, 9600 baud, 8 data bits, no parity, 1 stop bit, port 502) and **connect the network:** plug the box and the converter into the customer's router, or into the sockets of the 4G router if the site has no usable internet. Ask for a fixed address for the converter and write it down. Figure W-3. |
| {{cb}} | 11 | {{who:e}} {{who:pm}} | **Photograph before closing:** the wiring, the converter's settings, each device's label. Then close the board. |
| {{cb}} | 12 | {{who:e}} | **Remove the lock-out** only when you both agree the work is closed up. |
| {{cb}} | 13 | {{who:pm}} | **Power up** the UPS, the 24 V supply, the converter and the box. |
| {{cb}} | 14 | {{who:e}} | **Stay until commissioning is done.** |
| {{cb}} | 15 | {{who:pm}} | **Open the customer for setup again** on your laptop (the four hours are over by now) and go down the platform's setup list: **{{ui.find_equipment}}**, the ranges, and the electrician's name and licence number. |
:::

## Numbers, addresses and ranges

The numbers on the cable were set at the office. The box finds where the converter is. You give the range printed on each transmitter's label. You type no IP address, no port and no register.

### The numbers on the cable

All the devices are behind one converter: they share its address and port 502, and differ only by number. Check each label against this table on install day. **Do not change a number on site.**

::: {.form .short}
| Device in Greecon | Make and model | Number | Label checked | Address found (the converter's) |
|--------------|-------------|----------|-----------------|-----------------|
| {{ui.device_water_module}} | Waveshare Modbus RTU Analog Input 8CH | 3 | {{cb}} | |
| {{ui.device_pump_contact}} | Waveshare Modbus RTU IO 8CH | 5 | {{cb}} | |
| {{ui.device_pump_meter}} | Eastron SDM230 | 4 | {{cb}} | |
:::

### The meters and the pump contact module

Nothing to type: the template fills in their registers. For the pump meter, if there is one, it is total active power, input register 12 on the SDM230 (a manual's 30013; counted from zero), a 32-bit floating point number with the high half first, in watts, multiplied by 0.001 to make kW; for the pump contact module it is digital input 1. Check the module by eye: with the pump running, **{{ui.reading_pump}}** reads 1; stopped, 0. Test from the box:

```
greecon-edge modbus-test --host 192.168.1.50 --unit 4 --type input --address 12 --data-type float32
greecon-edge modbus-test --host 192.168.1.50 --unit 5 --type discrete --address 0
```

### The ranges on the labels

One form for each transmitter (step 5 of the setup list), in the label's own words. Read the range from the label on the transmitter and measure how tall the tank is inside, from the bottom to the top of the water when it is full.

::: {.form .short}
| Reading | Input | The form asks for | Range on the label | Tank height |
|-----------|-----|-----------------|--------|--------|
| {{ui.reading_tank}} | 1 | {{ui.range_level}}: the range on the label (m or bar) and how tall the tank is inside (m) | | |
| {{ui.reading_pressure}} | 2 | {{ui.range_pressure}}: the top of the range (bar) | | |
| {{ui.reading_flow}} | 3 | {{ui.range_flow}}: the top of the range (lpm, litres a minute) | | |
:::

Greecon works out the register and the scale: 4 mA is 0 and 20 mA is the range (for the tank, range ÷ tank height × 100: a 0 to 5 m transmitter in a tank 4 m tall gives 125, and a full tank, at 16.8 mA, reads 100). **A transmitter shorter than the tank is refused:** it cannot see the top of the water. **No flow meter?** Tick **{{ui.not_fitted}}** under {{ui.range_flow}}: its reading is taken away, and the handover says that the no-flow alert cannot be raised. **No pump meter, or no spare contact for the pump?** Press **{{ui.site_does_not_have}}** under the device in step 4 (it asks you to confirm, because the device's readings go with it).

## The platform's setup list

{{include:_shared/platform.md}}

## Commissioning {.newpage #commissioning-w}

{{include:_shared/commissioning-intro.md}}

{{include:_shared/internet-cut.md}}

::: tests
| Check and how | Pass when | Greecon shows | Real | Result |
|----------------------|-----------------|--------|--------|--------|
| **{{ui.reading_tank}}.** A dipstick or the sight gauge, at two levels. | Within 5 percentage points | | | {{pf}} |
| **Pressure.** Against the pressure gauge on the same line. | Within 0.2 bar | | | {{pf}} |
| **Flow** (if there is a flow meter). A bucket test (fill a measured volume, time it), or the flow meter's own display. | Within 10 percent | | | {{pf}} |
| **{{ui.reading_pump}}.** The owner starts the pump. | Greecon shows running within 30 seconds, and changes both ways | | | {{pf}} |
| **4 to 20 mA channels.** With a loop calibrator, send 4, 12 and 20 mA. | The reading at the bottom, the middle and the top | | | {{pf}} |
| **Pump meter's display against Greecon** (if fitted). Read the display and Greecon at the same time. | Within 5 percent, or 1 kW on a small load | | | {{pf}} |
{{include:_shared/rows-common.md}}
:::

Signed off by: {{line}} Date: {{line:short}}

## Handover {.newpage}

{{include:_shared/handover-1.md}}
- {{cb}} **Show the owner, in ten minutes, in this order:** the **{{ui.overview}}** (is everything all right, in one sentence); the site's own page under **{{ui.sites}}**, with the tank level, the pressure and whether the pump runs; **{{ui.who_is_told}}** (under **{{ui.settings}}**) and a live test message arriving on their phone, and that each message carries an *I have seen this* link, so that nobody needs a login to acknowledge an alert; **{{ui.reports}}**, under **{{ui.downloads}}**.
{{include:_shared/handover-2.md}}

## Handover record {.newpage .formtitle #handover-record-w data-kit="Kit W · Water tank and pump station"}

::: {.form .pad}
| Field | Answer |
|---------------------|---------------------|
| Customer and site | |
| Date, and who was there | |
| {{ui.who_is_told}}, in order (name, mobile with country code, email) | |
| Papers: who signed for the customer, and the date | |
| Electrician: name and licence number (or: no electrical work was needed) | |
| Alert limits agreed (tank Critical below, Low below; no-flow level) | |
| Without a flow meter or the pump's run contact the no-flow alert cannot be raised: said to the owner | {{cb}} Said  {{cb}} Not applicable |
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
| **The pump shows running when it is stopped** (and the no-flow alert, an {{ui.act_now}}, opens while the pump is stopped) | The pump's running contact is inverted | The electrician swaps the contact's normally-open and normally-closed wires, or uses the opposite contact. Until it is right the no-flow alert cannot be trusted |
| **The tank level is wrong** (above 100 percent, below zero, or does not move) | The range or the tank's height was given wrongly; a wire has come off (the module reads 0 and the level reads below zero); a blocked vented cable; or the transmitter is not at the bottom of the tank or not on input 1 | Give the ranges again (**{{ui.save_the_ranges}}**). Check that the transmitter hangs at the bottom with its vented cable free and fixed. Send 4, 12 and 20 mA with the loop calibrator: the module must read 4000, 12000 and 20000 |
| **A device does not answer** (the pump meter, the water module or the pump contact module) | The converter's address changed; a number or a speed on the device that is not the one on the install card (an SDM230 can be delivered at 2400 baud, the V1.6 manual says, not the converter's 9600; the meters and the modules are delivered as number 1); A and B swapped; the converter not in gateway mode | Press **{{ui.find_equipment}}** again. Read the number on the device's label (and a meter's speed on its display) against the install card: if they differ, the part was not set at the office, so take it back there or fit the spare that was numbered there, and do not change it on site. Then check A and B and the converter's gateway mode |

More, by symptom, are in the Appendices of the Complete Deployment Guide (Appendix C) and in the Field Manual. A device that does not answer is, in this order: the converter's address changed (press **{{ui.find_equipment}}** again), the number on the device's label not the one on the install card, a wrong speed at the converter, A and B swapped on the data cable, the converter not in gateway mode.
