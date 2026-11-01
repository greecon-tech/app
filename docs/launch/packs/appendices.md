These pages are for printing and for looking things up. Appendix A has the blank forms for any site (each site pack has the same forms made for its kit). Appendix B explains the words. Appendix C is a way in by symptom. Appendix D has the shopping lists with room for three quotes. Appendix E is the contact sheet and a card of the numbers that never change.

## [A]{.num} Forms to print {.intoc #appendix-a}

Print the form, take it to the site, and file it in the customer's folder afterwards. The forms are general: cross out what the site does not have. Each form starts on a new page.

- {{cb}} A.1 Survey form
- {{cb}} A.2 Install-day checklist
- {{cb}} A.3 Commissioning record
- {{cb}} A.4 Handover record
- {{cb}} A.5 Rehearsal record

### [A.1]{.num} Survey form {.newpage .formtitle .intoc #form-survey data-kit="Any site"}

::: {.form .short}
| Field | Answer |
|---------------------|---------------------|
| Customer, site name and address, date | |
| Contact: name, mobile, email (first, second, third to be told) | |
| What went wrong last year (their words) | |
| Template | {{cb}} {{kit.H.template}}  {{cb}} {{kit.S.template}}  {{cb}} {{kit.F.template}}  {{cb}} {{kit.W.template}} |
| Prices from the bills: electricity per kWh; paid for energy sent to the grid; water per m³ | |
| Twelve electricity bills and the water bills collected | {{cb}} Yes  {{cb}} Later |
| Supply: single or three phase; main breaker size (A) | |
| Inverter: brand, size (kW), AC output cable location; allowed to send to the grid? | |
| Tank: height (m), water source; pump (kW); starter location; pipe pressure (bar) | |
| Meters needed (grid, solar, load, pump) and where | |
| Sensors needed (level, pressure, flow, pump running; soil, weather) and where | |
| Network: customer's cable or cellular; router brand; who can give an address | |
| Power for the box: socket location | |
| Electrician: name, mobile, day | |
| Photographs taken (list) | |
| Go / no-go, and why | {{cb}} Go  {{cb}} No-go |
:::

### [A.2]{.num} Install-day checklist {.newpage .formtitle .intoc #form-install data-kit="Any site"}

The electrician and the project manager work at the same time, in this order. Cross out the rows that do not apply to the kit.

::: steps
| | # | Who | Do this |
|--|-|-----|--------------------------------------------|
| {{cb}} | 1 | {{who:e}} {{who:pm}} | Before anyone touches anything: the signed order form and the data terms are in your hand, the electrician is there, and the lock-out is agreed. Walk the site together. Agree where each meter and sensor goes. Photograph everything before you start. |
| {{cb}} | 2 | {{who:e}} | Apply the customer's lock-out on the board to be worked on. |
| {{cb}} | 3 | {{who:e}} | Fit the meters (grid, solar, load or pump): voltage taps with their fuses or small breakers, current clamps with the arrow towards the site. |
| {{cb}} | 4 | {{who:e}} | Connect the pump's run contact (a spare auxiliary contact, as a dry contact) to input 1 of the pump contact module. Never to a control circuit, and never to the module's relay outputs. |
| {{cb}} | 5 | {{who:e}} | Fit the level, pressure and flow transmitters, with the customer's plumber for the wet parts, and wire their 4 to 20 mA loops with the 24 V supply in series, as the module's manual draws it: level on input 1, pressure on input 2, flow meter on input 3. |
| {{cb}} | 6 | {{who:pm}} | Mount the enclosure, the converter, the two modules, the 24 V supply, the UPS and the box. |
| {{cb}} | 7 | {{who:pm}} | Run the RS-485 data cable: one cable, a daisy chain, no branches. The electrician connects its ends at the meters inside the board. |
| {{cb}} | 8 | {{who:pm}} | Check the number on each device's label against the install card (grid meter 1, solar meter 2, 4 to 20 mA module 3, load or pump meter 4, pump contact module 5, soil probe 6, weather sensor 7). They were set at the office: do not change them. Photograph each label. |
| {{cb}} | 9 | {{who:pm}} | Check the converter's label: Modbus TCP to RTU gateway mode, 9600 baud, 8 data bits, no parity, 1 stop bit, port 502. Ask for a fixed address for it and write the address down. |
| {{cb}} | 10 | {{who:pm}} | Connect the network: the customer's router, or the 4G router with its SIM. |
| {{cb}} | 11 | {{who:e}} {{who:pm}} | Photograph before closing: every meter's label, the wiring, the converter's settings. Close the board. |
| {{cb}} | 12 | {{who:e}} | Remove the lock-out only when you both agree the work is closed up. |
| {{cb}} | 13 | {{who:pm}} | Power up: UPS, supply, converter, box. |
| {{cb}} | 14 | {{who:pm}} | Open the customer for setup and go down the setup list: press **{{ui.find_equipment}}**, give the ranges, and write down the electrician's name and licence number. |
| {{cb}} | 15 | {{who:e}} | Stay until commissioning is done. |
:::

### [A.3]{.num} Commissioning record {.newpage .formtitle .intoc #form-commissioning data-kit="Any site"}

Compare in this order and write the pair of numbers. Do not start, stop or open equipment yourself: the owner's own person does.

::: tests
| Check and how | Pass when | Greecon shows | Real | Result |
|----------------------|-----------------|--------|--------|--------|
| **Every meter's display against Greecon.** Read both at the same time. | Within 5 percent, or 1 kW on a small load | | | {{pf}} |
| **Grid direction.** A known load on, the sun down. | Import rises, export does not | | | {{pf}} |
| **Solar at night.** | Zero, or a few watts | | | {{pf}} |
| **Solar at midday.** Against the inverter's display. | Within about 5 percent | | | {{pf}} |
| **{{ui.reading_tank}}.** A dipstick or the sight gauge, at two levels. | Within 5 percentage points | | | {{pf}} |
| **Pressure.** Against the gauge on the same line. | Within 0.2 bar | | | {{pf}} |
| **Flow.** A bucket test, or the flow meter's display. | Within 10 percent | | | {{pf}} |
| **{{ui.reading_pump}}.** The owner starts the pump. | Shown within 30 seconds, changes both ways | | | {{pf}} |
| **{{ui.device_soil}}.** In the air, in a glass of water, in the soil. | Three different readings | | | {{pf}} |
| **4 to 20 mA channels.** With a loop calibrator, send 4, 12 and 20 mA. | Bottom, middle and top | | | {{pf}} |
{{include:_shared/rows-common.md}}
:::

Signed off by: {{line}} Date: {{line:short}} Site: {{line}}

### [A.4]{.num} Handover record {.newpage .formtitle .intoc #form-handover data-kit="Any site"}

::: {.form .pad}
| Field | Answer |
|---------------------|---------------------|
| Customer and site | |
| Date, and who was there | |
| {{ui.who_is_told}}, in order (name, mobile with country code, email) | |
| Alert limits agreed with the customer | |
| Papers: who signed for the customer, and the date | |
| Electrician: name and licence number (or: no electrical work was needed) | |
| Anything the site cannot raise (no flow meter, no pump contact), said to the owner | |
| Prices entered and where they came from | |
| {{ui.setup_list}}: every step Done and the site Commissioned | {{cb}} Yes |
| {{ui.handover_sheet_link}} printed and signed | {{cb}} Yes |
| Shown: {{ui.overview}}, {{ui.energy_now}} or the site's page, {{ui.value}}, {{ui.who_is_told}} with a live test message, {{ui.reports}} | {{cb}} Yes |
| Left: label on the box; card with `info@greecon.earth` and your phone | {{cb}} Yes |
| Photographs and survey form filed in the customer's folder | {{cb}} Yes |
:::

::: sign
<div>Project manager: name and signature</div>
<div>Owner: name and signature</div>
:::

### [A.5]{.num} Rehearsal record {.newpage .formtitle .intoc #form-rehearsal data-kit="On a desk"}

Once before the first real site, once more with the first real kit, and again when anything in the manual changes (section 3.11). An afternoon, a laptop, and the box. Date: {{line:short}} Done by: {{line}}

::: steps
| | # | Who | Step |
|--|-|-----|--------------------------------------------|
| {{cb}} | 1 | {{who:pm}} | Run the pretend kit on the laptop: `node scripts/pretend-meter.mjs --kit --port 5020`. It answers as unit 1 grid meter, 2 solar meter, 3 4 to 20 mA module (tank 12 mA, pressure 8.96 mA, flow 5.12 mA) and 5 pump contact module (closed). |
| {{cb}} | 2 | {{who:pm}} | On **{{ui.clients}}** press **{{ui.onboard_a_client}}** for a client named Rehearsal, with a second address of your own for the owner. Open it for setup and make a site from the **{{kit.H.template}}** template. Write that the papers are signed (**{{ui.papers_signed}}**). |
| {{cb}} | 3 | {{who:pm}} | Add the box, paste the line on the box, and watch **{{step:3}}** turn Done. |
| {{cb}} | 4 | {{who:pm}} | The pretend kit listens on port 5020, not 502, so the box does not find it by itself: open **{{ui.i_know_the_address}}**, type the laptop's address on the network (not 127.0.0.1) and port 5020, and press **{{ui.look_at_this_address}}**. The grid meter, the solar meter, the 4 to 20 mA module and the pump contact module are each **{{ui.found_set}}**. |
| {{cb}} | 5 | {{who:pm}} | Give the ranges: level transmitter 5 and tank 4, pressure transmitter 10, flow meter 200, then **{{ui.save_the_ranges}}**. Tank level reads 62.5 %, line pressure 3.1 bar, pump flow 14 litres a minute, and Pump running reads 1. |
| {{cb}} | 6 | {{who:pm}} | Watch every step turn Done. Add yourself under **{{ui.who_is_told}}**, send a test message, write "no electrical work was needed" for the electrician, and confirm the steps that need a person. Commission the rehearsal site. |
| {{cb}} | 7 | {{who:pm}} | Stop the pretend kit. After about five minutes **{{ui.today}}** says, under **{{ui.needs_a_look}}**, that the readings are out of date. Start it again, and raise the tank's limits above 62.5 (Low below 80, Critical below 70): the tank is critical, an **{{ui.act_now}}**. It arrives by email at once and by text ten minutes later unless you press **{{ui.acknowledge}}** or open the *I have seen this* link in the message. |
| {{cb}} | 8 | {{who:pm}} | Print the handover sheet. Download the readings from **{{ui.reports}}** (**{{ui.downloads}}**) and open the file in a spreadsheet. |
| {{cb}} | 9 | {{who:pm}} | Clean up: remove the rehearsal site's equipment and then the site, or suspend the client, so that it does not appear in the morning check. Keep it if you will use it for a sales demonstration. |
| {{cb}} | 10 | {{who:pm}} | With the first real kit: do steps 1 to 6 again with the real converter and devices on the desk in place of the pretend kit, and write down anything that differs from this book. |
:::

::: {.form .pad}
| What did not match the manual, and what I changed |
|---------------------------------|
| |
| |
| |
:::

## [B]{.num} Words {.intoc #appendix-b}

@@MANUAL 14@@

### [B.2]{.num} More words

| Word | Meaning |
|---------|----------------------------------------------------|
| **Unit number** | A number that tells the devices on one cable apart. Every device has its own, and in every kit it is the same: grid meter 1, solar meter 2, 4 to 20 mA module 3, load or pump meter 4, pump contact module 5, soil probe 6, weather sensor 7. They are set at the office; the meters and the two modules are delivered as 1 |
| **Gateway mode** | The converter's mode (Modbus TCP to RTU) in which it turns the box's requests into requests on the data cable. Not transparent, not raw TCP, not RTU over TCP |
| **Speed, parity** | The serial settings of the data cable. Greecon's standard is 9600 baud, 8 data bits, no parity, 1 stop bit, the same on every device and on the converter. They are set at the office |
| **RS-485, A and B** | The two-wire data cable the meters and modules share. A and B swapped is the commonest mistake |
| **Daisy chain** | One cable from device to device, with no branches |
| **Lock-out** | The customer's own procedure for switching a board off and keeping it off while the electrician works in it |
| **CT ratio** | On a meter with 5 A current transformers, the ratio set in the meter's menu (for example 250 for 250/5 A) so that it shows the real power |
| **Loop calibrator** | A hand-held that sends 4, 12 and 20 mA, to check a 4 to 20 mA channel and the range given for it |
| **Microamps** | How the 4 to 20 mA module reports a signal: 4 mA reads 4000, 12 mA reads 12000, 20 mA reads 20000. A wire that has come off reads 0 |
| **Dry contact** | A switch that only opens and closes and carries no voltage of its own, like the spare contact in a pump's starter. The pump contact module reads whether it is closed |
| **Fixed address, reservation** | A network address the router always gives the converter (a "DHCP reservation" on its MAC address), or one set in the converter itself |
| **Heartbeat** | The box reports every 30 seconds, so that Greecon knows it is alive |
| **Queue** | The readings the box keeps while the internet is down: about three days for a site of up to about thirteen devices |
| **Template** | The plan of a kind of site in the platform: the equipment it usually has, with the readings each gives |
| **{{ui.setup_list}}** | The platform's own list of up to twelve steps for a site. A step that does not apply is left out |
| **{{ui.handover_sheet_link}}** | One printable page per site: where everything is, who is told, who commissioned it and when |
| **Install line, code** | The line shown once on the setup page that installs the box. Its code works once, for seven days |
| **Owner, Administrator, Operator, Viewer, Auditor** | A person's role in the customer's account. An Owner, an Administrator or an Operator can press Acknowledge in the app; a Viewer or an Auditor cannot (anyone a message was sent to can use the link in it) |
| **Morning message** | The one email at 07:30 that says whether everything is all right |
| **Quiet hours** | 22:00 to 07:00: everything is held except {{ui.act_now}} |
| **Zero-export** | A plant that is not allowed to send energy to the grid. Tick the box in the prices |
| **Pretend kit** | A program for the laptop that answers like a whole kit (two meters, the 4 to 20 mA module and the pump contact module), for practice |

## [C]{.num} Symptoms {.intoc #appendix-c}

Start from what you see. Each table says what it probably is and what to do; the longer answers are in {{ref:runbooks}}.

@@MANUAL 12@@

### [C.2]{.num} A reading looks wrong

A value that is zero, never changes, is ten or a thousand times too big or small, is negative where it cannot be, or has import and export swapped.

@@RUNBOOK R3 TABLE@@

### [C.3]{.num} A device does not answer the box

The setup list shows the device as **Needs attention**, with *no answer from 192.168.1.50:502 (unit 2)*, and on the box `greecon-edge status` lists it as NOT OK. Look in this order:

1. **The converter's address has changed** (the router gave it a new one): press **{{ui.find_equipment}}** again. The box looks for the converter, and each device behind it says **{{ui.found_found}}** at the new address: press **{{ui.use_this_address}}**.
2. The **number on the device's label** is not the one on the install card, or two devices carry the same number (Find equipment says **{{ui.found_not_sure}}**).
3. A wrong **speed or parity** at the converter: it must match every device (9600 baud, 8 data bits, no parity, 1 stop bit).
4. **A and B swapped** on the data cable: swap the two wires at the converter.
5. The converter **not in gateway mode** (Modbus TCP to RTU).
6. The device has **no power**: a meter powered from the grid goes dark in a power cut, and returns with the power.

Nothing answers at all: the converter is off, or it is on another network than the box. Some readings work and others do not: a register address that is wrong for that device (on a probe or a battery mapped by hand), or, on a Waveshare module, a table in Greecon that differs from the real module (no real module has been tried yet, so write down what the box says and report it to Greecon). Test one register from the box:

```
greecon-edge modbus-test --host 192.168.1.50 --unit 1 --type input --address 52 --data-type float32
greecon-edge modbus-test --host 192.168.1.50 --unit 5 --type discrete --address 0
greecon-edge find
```

*Could not read: no answer* means the device or the cable. *Has no register at that address* means the register is wrong (the device answers). A value means the path works. `greecon-edge find` looks at the network and says what answers, as **{{ui.find_equipment}}** does.

## [D]{.num} Shopping lists {.intoc #appendix-d}

One list for each kit, with room for three quotes. Ask three suppliers for the quote on the specification, not the brand, and keep the quotes in the shared drive. The estimates are planning figures in EUR, excluding VAT and installation labour, from public shop prices seen in October 2026: they are not quotes. Buy and bench-test one kit before buying five. For each part keep the make and model, the supplier, the date, the serial number or the batch, and the invoice.

{{shopping:all}}

### The spares kit and the tools {.newpage .intoc #shopping-spares}

One spares kit for each project manager: one of each, so that a failed part is swapped on the day.

{{spares}}

The project manager's tools:

{{tools}}

## [E]{.num} Contacts and the numbers that never change {.intoc #appendix-e}

### [E.1]{.num} Contacts

Fill in, print, and keep a copy in the password manager.

::: {.form .pad}
| Who | Phone | Email |
|----------------|-----------|----------------|
| Founder | | eridon.manuka@greecon.earth |
| Project manager | | |
| Electrician (first call) | | |
| Electrician (second) | | |
| Railway support | | station.railway.com |
| The lawyer | | |
| The insurer | | |
| Each customer's first person | (on its handover sheet) | |
:::

| What | Address |
|-------------|--------------------------------|
| The web app (customers, staff, the project manager) | `https://app.greecon.earth` |
| The platform's own address, which every box reports to. **Never change it once a box exists** | `https://api.greecon.earth` |
| Where alert emails come from | `alerts@greecon.earth` (replies go to `info@greecon.earth`) |

### [E.2]{.num} The numbers that never change

| What | Value |
|----------------|--------------------------------------------|
| Unit numbers (set at the office) | Grid meter 1, solar meter 2, 4 to 20 mA water module 3, load meter or pump meter 4, pump contact module 5, soil probe 6, weather sensor 7. A battery is addressed by hand (for example 8) |
| The data cable and the converter | 9600 baud, 8 data bits, no parity, 1 stop bit; converter on port 502, in Modbus TCP to RTU gateway mode, at a fixed address. Set at the office |
| Eastron meters | Total active power: input register 52 on the SDM630, 12 on the SDM230; 32-bit floating point, high half first; watts to kW by 0.001 |
| A register counted from zero (equipment mapped by hand) | A manual's 30053 is address 52; 40001 is address 0 |
| The 4 to 20 mA module | Inputs 1, 2 and 3: level, pressure, flow. In its default 0 to 20 mA mode it reads microamps: 4 mA is 4000 and 20 mA is 20000; a wire that has come off reads 0 |
| A tank level from a transmitter longer than the tank | Greecon asks for the range on the label (in metres or bar) and how tall the tank is, and shows a percentage of the tank. 20 mA reads range ÷ tank height × 100 (a 0 to 5 m transmitter in a 4 m tank: 125); a full tank reads 100 |
| What Find equipment looks at | Private addresses on the site's own network, port 502 (or the one you give), unit numbers 1 to 10; reads only; about a minute at most |
| The box needs outside | Outgoing HTTPS (443) to `api.greecon.earth` (and `nodejs.org` at install) and a time service (UDP 123). Nothing needs to come in |
| The box keeps | About three days of readings, for a site of up to about thirteen devices. It reports every 30 seconds |
| The install code | Works once, for seven days |
| A setup session in a customer's account | Four hours |
| Test messages | Six an hour for the whole account |
| Standard limits | Tank Critical below 15 percent ({{ui.act_now}}), Low below 35 percent ({{ui.check_today}}); pump no flow at or below 0.2 litres a minute held for 30 seconds ({{ui.act_now}}); battery Low below 25 percent |
| How alerts reach people | {{ui.act_now}}: email at once, text after ten minutes if not acknowledged, the next person at 30 minutes. {{ui.check_today}}: one email, held until morning at night. Morning message 07:30. Quiet hours 22:00 to 07:00 hold everything except {{ui.act_now}}. Resolved after 15 minutes clear |
| After install | Day 1, 3 and 7 checks, then the morning check; day 30 call; day 60 decision meeting; day 90 convert or remove within 14 days |

```
greecon-edge status
journalctl -u greecon-edge -n 50 --no-pager
greecon-edge modbus-test --host 192.168.1.50 --unit 1 --type input --address 52 --data-type float32
greecon-edge find
sudo systemctl restart greecon-edge
sudo timedatectl set-ntp true
```
