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
| {{cb}} | 1 | {{who:e}} {{who:pm}} | Walk the site together. Agree where each meter and sensor goes. Photograph everything before you start. |
| {{cb}} | 2 | {{who:e}} | Apply the customer's lock-out on the board to be worked on. |
| {{cb}} | 3 | {{who:e}} | Fit the meters (grid, solar, load or pump): voltage taps with their fuses or small breakers, current clamps with the arrow towards the site. |
| {{cb}} | 4 | {{who:e}} | Connect the pump's run contact (a spare auxiliary contact) to the module's digital input. Never to a control circuit. |
| {{cb}} | 5 | {{who:e}} | Fit the level, pressure and flow transmitters, with the customer's plumber for the wet parts. |
| {{cb}} | 6 | {{who:pm}} | Mount the enclosure, the converter, the module, the 24 V supply, the UPS and the box. |
| {{cb}} | 7 | {{who:pm}} | Run the RS-485 data cable: one cable, a daisy chain, no branches. The electrician connects its ends at the meters inside the board. |
| {{cb}} | 8 | {{who:pm}} | Wire the 4 to 20 mA signals and the 24 V to the module. Set the module: unit 3, channels on 4 to 20 mA. |
| {{cb}} | 9 | {{who:pm}} | Set the converter: Modbus TCP to RTU gateway mode, 9600, 8 data bits, no parity, 1 stop bit, port 502, a fixed address. Write the address down. |
| {{cb}} | 10 | {{who:pm}} | Connect the network: the customer's router, or the 4G router with its SIM. |
| {{cb}} | 11 | {{who:e}} {{who:pm}} | Photograph before closing: every meter's label, the wiring, the converter's settings. Close the board. |
| {{cb}} | 12 | {{who:e}} | Remove the lock-out only when you both agree the work is closed up. |
| {{cb}} | 13 | {{who:pm}} | Set each meter at its own display: unit number (grid 1, solar 2, water module 3, load or pump meter 4), speed 9600, parity none. Write them down. |
| {{cb}} | 14 | {{who:pm}} | Power up: UPS, supply, converter, box. |
| {{cb}} | 15 | {{who:pm}} | Open the customer for setup and go down the setup list. |
| {{cb}} | 16 | {{who:e}} | Stay until commissioning is done. |
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
| **Tank level.** A dipstick or the sight gauge, at two levels. | Within 5 percentage points | | | {{pf}} |
| **Pressure.** Against the gauge on the same line. | Within 0.2 bar | | | {{pf}} |
| **Flow.** A bucket test, or the flow meter's display. | Within 10 percent | | | {{pf}} |
| **Pump running.** The owner starts the pump. | Shown within 30 seconds, changes both ways | | | {{pf}} |
| **Soil probe.** In the air, in a glass of water, in the soil. | Three different readings | | | {{pf}} |
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
| Who is told, in order (name, mobile with country code, email) | |
| Alert limits agreed with the customer | |
| Anything the site cannot raise (no flow meter, no pump contact), said to the owner | |
| Prices entered and where they came from | |
| Setup list: every step Done and the site Commissioned | {{cb}} Yes |
| Handover sheet printed and signed | {{cb}} Yes |
| Shown: {{ui.overview}}, {{ui.energy_now}} or the site's page, {{ui.value}}, {{ui.who_is_told}} with a live test message, {{ui.reports}} | {{cb}} Yes |
| Left: label on the box; card with `info@greecon.earth` and your phone | {{cb}} Yes |
| Photographs and survey form filed in the customer's folder | {{cb}} Yes |
:::

::: sign
<div>Project manager: name and signature</div>
<div>Owner: name and signature</div>
:::

### [A.5]{.num} Rehearsal record {.newpage .formtitle .intoc #form-rehearsal data-kit="On a desk"}

Once before the first real site, and again when anything in the manual changes (section 3.11). An afternoon, a laptop, and the box. Date: {{line:short}} Done by: {{line}}

::: steps
| | # | Who | Step |
|--|-|-----|--------------------------------------------|
| {{cb}} | 1 | {{who:pm}} | Run the pretend meter on the laptop: `node scripts/pretend-meter.mjs` (port 5020, units 1, 2 and 3). |
| {{cb}} | 2 | {{who:pm}} | Onboard a client named Rehearsal, with a second address of your own for the owner. Open it for setup and make a site from the **{{kit.H.template}}** template. |
| {{cb}} | 3 | {{who:pm}} | Add the box, paste the line on the box, and watch **{{step:2}}** turn Done. |
| {{cb}} | 4 | {{who:pm}} | Give each device the laptop's address, port 5020 and units 1, 2 and 3. Map the water module's four readings: Input registers 0 to 3, each Multiply and add: tank level by 0.1, pressure by 0.01, flow by 0.1, pump running by 1. |
| {{cb}} | 5 | {{who:pm}} | Watch every step turn Done. Add yourself under **{{ui.who_is_told}}**, send a test message, confirm the steps that need a person, and commission the rehearsal site. |
| {{cb}} | 6 | {{who:pm}} | Stop the pretend meter. After about five minutes **{{ui.today}}** says, under **{{ui.needs_a_look}}**, that the readings are out of date. Start it again with `--tank 12`: Tank level is critical is an Act now. It arrives by email at once and by text ten minutes later unless you press **{{ui.acknowledge}}**. |
| {{cb}} | 7 | {{who:pm}} | Print the handover sheet. Download the readings from **{{ui.reports}}** (**{{ui.downloads}}**) and open the file in a spreadsheet. |
| {{cb}} | 8 | {{who:pm}} | Clean up: remove the rehearsal site's equipment and then the site, or suspend the client, so that it does not appear in the morning check. Keep it if you will use it for a sales demonstration. |
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
| **Unit number** | A number, 0 to 247 in the platform's form, that tells the devices on one cable apart. Every device has its own. Meters are delivered as unit 1 |
| **Gateway mode** | The converter's mode (Modbus TCP to RTU) in which it turns the box's requests into requests on the data cable. Not transparent, not raw TCP, not RTU over TCP |
| **Speed, parity** | The serial settings of the data cable. Greecon's standard is 9600 baud, 8 data bits, no parity, 1 stop bit, the same on every device and on the converter |
| **RS-485, A and B** | The two-wire data cable the meters and modules share. A and B swapped is the commonest mistake |
| **Daisy chain** | One cable from device to device, with no branches |
| **Lock-out** | The customer's own procedure for switching a board off and keeping it off while the electrician works in it |
| **CT ratio** | On a meter with 5 A current transformers, the ratio set in the meter's menu (for example 250 for 250/5 A) so that it shows the real power |
| **Loop calibrator** | A hand-held that sends 4, 12 and 20 mA, to check a 4 to 20 mA channel and the numbers entered for it |
| **Fixed address, reservation** | A network address the router always gives the converter (a "DHCP reservation" on its MAC address), or one set in the converter itself |
| **Heartbeat** | The box reports every 30 seconds, so that Greecon knows it is alive |
| **Queue** | The readings the box keeps while the internet is down: about three days for a site of up to about thirteen devices |
| **Template** | The plan of a kind of site in the platform: the equipment it usually has, with the readings each gives |
| **Setup list** | The platform's own list of up to ten steps for a site. A step that does not apply is left out |
| **Handover sheet** | One printable page per site: where everything is, who is told, who commissioned it and when |
| **Install line, code** | The line shown once on the setup page that installs the box. Its code works once, for seven days |
| **Owner, Administrator, Operator, Viewer, Auditor** | A person's role in the customer's account. An Owner, an Administrator or an Operator can acknowledge an alert; a Viewer or an Auditor cannot |
| **Morning message** | The one email at 07:30 that says whether everything is all right |
| **Quiet hours** | 22:00 to 07:00: everything is held except Act now |
| **Zero-export** | A plant that is not allowed to send energy to the grid. Tick the box in the prices |
| **Pretend meter** | A program for the laptop that answers like meters, for practice |

## [C]{.num} Symptoms {.intoc #appendix-c}

Start from what you see. Each table says what it probably is and what to do; the runbooks (Part 7) have the longer answers.

@@MANUAL 12@@

### [C.2]{.num} A reading looks wrong

A value that is zero, never changes, is ten or a thousand times too big or small, is negative where it cannot be, or has import and export swapped.

@@RUNBOOK R3 TABLE@@

### [C.3]{.num} A device does not answer the box

The setup list shows the device as **Needs attention**, with *no answer from 192.168.1.50:502 (unit 2)*, and on the box `greecon-edge status` lists it as NOT OK. Look in this order:

1. A wrong **unit number** (the commonest): read it from the device's own display.
2. A wrong **speed or parity** at the converter: it must match every device.
3. **A and B swapped** on the data cable: swap the two wires at the converter.
4. The converter **not in gateway mode** (Modbus TCP to RTU).
5. A wrong **IP address**.

Nothing answers at all: the IP address or the port is wrong, the converter is off, or it is on another network than the box. Some readings work and others do not: a register address is wrong for that device. Test one register from the box:

```
greecon-edge modbus-test --host 192.168.1.50 --unit 1 --type input --address 52 --data-type float32
```

*Could not read: no answer* means the device or the cable. *Has no register at that address* means the register is wrong (the device answers). A value means the path works. A meter powered from the grid goes dark in a power cut: that is expected, and it returns with the power.

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
| Unit numbers | Grid meter 1, solar meter 2, water module 3, optional load or pump meter 4 |
| The data cable and the converter | 9600 baud, 8 data bits, no parity, 1 stop bit; converter on port 502, in Modbus TCP to RTU gateway mode, at a fixed address |
| Eastron meters | Total active power: input register 52 on the SDM630, 12 on the SDM230; 32-bit floating point, high half first; watts to kW by 0.001 |
| A register counted from zero | A manual's 30053 is address 52; 40001 is address 0 |
| Tank level from a transmitter longer than the tank | Reading at the top = range ÷ tank height × 100 |
| The box needs outside | Outgoing HTTPS (443) to `api.greecon.earth` (and `nodejs.org` at install) and a time service (UDP 123). Nothing needs to come in |
| The box keeps | About three days of readings, for a site of up to about thirteen devices. It reports every 30 seconds |
| The install code | Works once, for seven days |
| A setup session in a customer's account | Four hours |
| Test messages | Six an hour for the whole account |
| Standard limits | Tank Critical below 15 percent (Act now), Low below 35 percent (Check today); pump no flow at or below 0.2 litres a minute held for 30 seconds (Act now); battery Low below 25 percent |
| How alerts reach people | Act now: email at once, text after ten minutes if not acknowledged, the next person at 30 minutes. Check today: one email, held until morning at night. Morning message 07:30. Quiet hours 22:00 to 07:00 hold everything except Act now. Resolved after 15 minutes clear |
| After install | Day 1, 3 and 7 checks, then the morning check; day 30 call; day 60 decision meeting; day 90 convert or remove within 14 days |

```
greecon-edge status
journalctl -u greecon-edge -n 50 --no-pager
greecon-edge modbus-test --host 192.168.1.50 --unit 1 --type input --address 52 --data-type float32
sudo systemctl restart greecon-edge
sudo timedatectl set-ntp true
```
