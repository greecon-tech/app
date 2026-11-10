This part describes every kind of hardware in a Greecon kit: what it is, what it must be, what it costs, how it is set up, how it is fitted, how to check it and what goes wrong. It is written from the hardware and wiring document (docs/launch/03) and is the place to look when a pack says "follow the maker's manual". The four site packs ({{ref:packs}}) use these parts in four combinations.

::: tip
**Where this part is silent, the maker's manual decides.** The drawings show how the parts connect, not terminal numbers: terminal numbers differ between makes and versions. Every drawing says so. Part numbers named here are examples of a kind of part; the specification is what matters. Prices are planning estimates from public shop prices seen in October 2026, not quotes: replace them with real quotes in the first week and keep the quotes in the shared drive.
:::

**Each part also has a sheet of its own,** in {{ref:catalogue}} and as a PDF by itself (HW01 to HW17): how it qualifies, what it does at each of the four kinds of site, its acceptance test and a buying record.

## [4.1]{.num} Rules of thumb

The aim is the cheapest way to run many sites for many years: the same few parts everywhere, prepared at the office, installed in an afternoon, and replaceable by anyone because nothing about a box is special. The parts that talk to the platform are **approved models**: the two Eastron meters (SDM630 and SDM230) and the two Waveshare modules (Modbus RTU Analog Input 8CH and Modbus RTU IO 8CH). Greecon knows their registers, their serial settings and the way to recognise them on a network, so nobody on site reads a datasheet or types a register. The rest of a kit (the box, the converter, the supply, the transmitters, the enclosure) is bought by specification and not by brand. Greecon speaks two standard languages, Modbus over the network and a wire signal of 4 to 20 mA read through a Modbus module, so a part that is not an approved model can be swapped when a maker stops selling it.

1. **One of each first.** Buy one full kit and bench-test it (the rehearsal, {{ref:manual}}, section 3.11) before buying five. Change the specification, not the kit, when something fails.
2. **Read-only, always.** No relay output, no control wire, no write. Everything here only measures. (The pump contact module has relay outputs: they are never used.)
3. **Approved models for what is read over the cable, a published register table for anything else.** A kit is made of the approved models and no others. A soil probe, a weather sensor or a battery is not an approved model and is mapped by hand: if the maker will not give the register table, do not buy it, because it cannot be mapped honestly.
4. **Everything powered from one clean place,** on a UPS, in one enclosure, labelled.
5. **Pre-stage at the office:** the box has its software installed and tested, every device has its number and its speed, and the converter is set, before the kit leaves.
6. **Same settings everywhere:** unit numbers (grid meter 1, solar meter 2, 4 to 20 mA water module 3, load or pump meter 4, pump contact module 5, soil probe 6, weather sensor 7), speed 9600, 8 data bits, no parity, 1 stop bit, the converter on port 502. A new site then looks like the last one.

::: stop
**Greecon only reads, and only an electrician works on mains.** Nothing in this part tells anyone to work on a live conductor. Everything inside a distribution board, every current clamp and voltage tap, and the pump's run contact are the electrician's work, done under the customer's lock-out procedure. The project manager does the low-voltage and software side. Greecon is not a safety system: the float switches, relief valves and trips already in the customer's equipment stay the safety layer.
:::

## [4.2]{.num} The standard kits

Four kits cover the four kinds of site. Costs are planning estimates in EUR, excluding VAT and installation labour. A part marked optional is not always fitted. The meters and the two modules are approved models: the model named is the model bought. The first table is every part once; the tables after it are the four kits, with quantities.

### Every part, what it does and which kits use it

Kits in brackets use the part only sometimes.

{{parts}}

### Kit H: hotel or guesthouse (water, solar, grid)

{{bom:H}}

**{{kit.H.headline}}**

### Kit S: solar plant with grid connection

{{bom:S}}

For a battery add nothing but the maker's Modbus register table (the battery speaks Modbus itself on the site's network or on its own RS-485 port; if the maker will not publish the table, leave the battery out). **{{kit.S.headline}}**

### Kit F: farm or greenhouse with irrigation

{{bom:F}}

The standard list for this kit has no UPS row, although rule 4 in section 4.1 says everything is powered on a UPS: decide at the survey whether this site gets one, and write the decision down. A cellular router is the likelier case in a field. **{{kit.F.headline}}**

### Kit W: water tank and pump station

{{bom:W}}

**{{kit.W.headline}}**

### The spares kit (one for each project manager)

One of each, so that a failed part is swapped on the day:

{{spares}}

## [4.3]{.num} The box

The box runs one small program and holds a queue of readings. It needs very little, and it must survive power cuts, which is the hard part.

{{part:box}}

### What the box needs

| Needs | Why |
|---|---|
| Linux on a processor of the x86-64, 64-bit ARM or 32-bit ARM kind (the installer checks) | The software is a Node.js program |
| Debian 12, Ubuntu 22.04 or later, or Raspberry Pi OS (64-bit), with systemd | What the installer supports |
| 4 GB of memory or more, 32 GB of storage or more | The program asks for about 400 MB; the queue is on disk |
| A real disk (SSD or eMMC), not an SD card | An SD card is the commonest reason these boxes fail: they corrupt on power cuts and wear out under constant writing |
| A real-time clock with a battery, and a BIOS setting of "power on after power loss" (often "Restore on AC Power Loss: Power On") | After a cut the box must come back by itself, with the right time |
| 9 to 36 V DC input, or a plain 12 V one | So that it can sit behind a DC UPS and share the 24 V supply |
| No fan, 0 to 50 °C or better | A plant room is hot and dusty |
| One Ethernet port (two is nicer) | One to the converter's network, one spare |

The kit list buys 8 GB and 128 GB or more; this table is the least the software will run on.

### Options

| Option | When | Planning estimate (EUR) | Note |
|---|---|---|---|
| **Fanless x86 mini PC** (an Intel N100-class machine) | The default. Most sites. | 180 to 300 | Check the real-time-clock battery and the power-on setting in the BIOS before buying many. |
| **Raspberry Pi 5** (4 or 8 GB) | A bench box, or a small site with a proper SSD on NVMe or USB 3 and an RTC battery. Never an SD card. | 120 to 200 with SSD and case | Starts by itself when power returns. |
| **Industrial PC** (Advantech UNO, OnLogic, Seeed reTerminal DM class) | Hot, dusty or vibrating sites; customers who insist on industrial parts | 450 to 900 | The same software runs on it. Not needed to begin. |

### Preparing the operating system (at the office, twenty minutes)

1. Install Debian 12 from the "netinst" image: only "SSH server" and "standard system utilities". No desktop.
2. One user with a long password (in the password manager, against the site's name). Host name `greecon-<site>`.
3. Time zone Europe/Tirane; `timedatectl set-ntp true`.
4. Automatic security updates: `apt-get install -y unattended-upgrades` and answer yes when it asks.
5. BIOS: power on after power loss; no sleep; boot from the disk only.
6. Then paste the install line ({{ref:manual}}, section 3.6).

### What the installer changes

So that nobody wonders: `/opt/greecon` (the software), `/etc/greecon` (the box's credential, readable by the service only), `/var/lib/greecon-edge` (what it remembers), one service called `greecon-edge`, one user called `greecon`, and one command, `greecon-edge`. Nothing else.

### What the box does by itself

- It restarts if it fails.
- It keeps about three days of readings if the internet is down, for a site of up to about thirteen devices (a site with more devices keeps fewer days), and sends them in order when it returns. A long outage keeps one reading a minute for each reading, so that three days fit.
- It takes new versions of its software from the platform and goes back to the version before if a new one fails to start three times.
- It reports every 30 seconds so that Greecon knows it is alive.

### Commands the project manager uses

```
greecon-edge status                       how the box is: heard by Greecon? each device ok? the queue
journalctl -u greecon-edge -n 50 --no-pager   what it has been saying
greecon-edge find                         look at the network and say what answers (reads only)
greecon-edge modbus-test --host 192.168.1.50 --unit 1 --type input --address 52 --data-type float32
sudo systemctl restart greecon-edge       restart it
```

::: check
**Before the box leaves the office:** the install line has run to "Done. Greecon can see this box.", the setup page shows the install step done with the box's name and "Heard from N seconds ago", the box is labelled with the site name and the date, and the BIOS power-on setting has been tried by pulling the power and restoring it.
:::

## [4.4]{.num} The converter and the meter cable

The meters and modules speak Modbus RTU on a two-wire cable (RS-485). The box speaks Modbus TCP on the network. The converter sits between them.

{{part:converter}}

::: stop
**The setting that matters most:** the converter must be in **Modbus TCP to RTU gateway mode** (sometimes called "Modbus gateway", "Modbus TCP server" or "protocol conversion"). Not "transparent" or "raw TCP" mode, and not "Modbus RTU over TCP": in those, the box's requests arrive on the cable as garbage and nothing answers.
:::

### The settings in the converter's web page

Greecon sets them at the office, before the kit leaves. They are here in case the converter ever has to be set again.

| Setting | Value |
|---|---|
| Mode | Modbus TCP to RTU (gateway) |
| Serial: speed (baud) | 9600 (the same as every meter on the cable) |
| Serial: data bits, parity, stop bits | 8, none, 1 |
| TCP: port | 502 |
| Address | A fixed address on the site's network (a reservation in the router, or set in the converter) |

The box keeps one TCP connection per converter and asks one thing at a time, so any converter that does the above will do.

### Wiring RS-485

{{diagram:ref-rs485}}

- **One cable, daisy chain,** from the converter to the first device, on to the next, and so on. No branches: stars and tees cause the errors that look like random failures.
- Use **shielded twisted pair,** the shield joined to ground at one end only. Keep it away from power cables.
- **A and B swapped** is the commonest mistake. If nothing answers, swap the two wires at the converter.
- **Every device its own unit number,** the same speed and parity. The meters and the Waveshare modules are delivered as number 1, so each is numbered at the office before it joins the cable: two with the same number would answer over each other.
- A 120 ohm resistor across A and B at each end of the cable is only for runs longer than about 50 m, or if readings are unreliable at 9600 baud.

### The number each device has on the cable

| Device | Number | How it is set, and when |
|---|---|---|
| Grid meter (Eastron SDM630) | 1 | On its display, at the office |
| Solar meter (Eastron SDM630) | 2 | On its display, at the office |
| 4 to 20 mA module (Waveshare Modbus RTU Analog Input 8CH) | 3 | With the maker's setting tool, at the office |
| Load meter (SDM630) or pump meter (SDM230) | 4 | On its display, at the office |
| Pump contact module (Waveshare Modbus RTU IO 8CH) | 5 | With the maker's setting tool, at the office |
| Soil probe | 6 | The maker's way, before it is buried |
| Weather sensor | 7 | The maker's way, before it is mounted |
| A battery | By hand, for example 8 | From the battery maker's manual |

Every device on one cable has the same speed: 9600 baud, 8 data bits, no parity, 1 stop bit. On site you check the label on each device against the install card and do not change it.

### Cable and labels {.hw}

{{part:cable}}

Label the unit number on the converter and on every device, the wire number at both ends, and the site name and date on a sticker inside the lid of the enclosure.

## [4.5]{.num} The meters

Eastron SDM630 (three-phase) at the grid connection, where the supply enters, and on the inverter's AC output. Eastron SDM230 (single-phase) for one pump or a small load.

### Three-phase meter {.hw}

{{part:meter3}}

### Single-phase meter {.hw}

{{part:sdm230}}

### The battery (kit S, optional) {.hw}

A battery is not bought from Greecon's list: it is whatever the customer has, and it is not an approved model. Greecon can read it only if the maker publishes the battery's Modbus register table. The battery speaks Modbus itself, on the site's network (its own address) or on its own RS-485 port (then it joins the cable with a number of its own, by hand, for example 8). The box cannot recognise it on a network, so its address is entered by hand. If the maker will not publish the table, leave the battery out: do not guess registers. Two readings are mapped by hand from the maker's table: {{ui.reading_battery_charge}} (percent) and {{ui.reading_battery_power}} (kW, positive while charging). If there is no battery, remove the template's battery device (the project manager's step in the pack for kit S).

### What Greecon reads

**Total active power:** register 52 on the SDM630 (address counted from zero, as a manual's 30053) and register 12 on the SDM230, 32-bit floating point, high half first, in watts; Greecon shows it in kW. Positive power is energy coming in, negative is energy sent out. That is why one grid meter gives both {{ui.reading_grid_import}} and {{ui.reading_grid_export}}, and why a clamp fitted the wrong way round swaps them (the direction check, setup step 9).

The Eastron meters in the templates already have their registers filled in. The unit scale applied is only watts to kilowatts. Greecon reads what the meter shows.

### Settings made at the office

These differ between makes and versions, so they are read from the meter's own display, never assumed. Greecon sets them at the office, before the kit leaves; on site you only check them.

| Setting | Value |
|---|---|
| Unit number | A different one on each meter: grid meter 1, solar meter 2, load or pump meter 4. Set on the meter's display |
| Speed | SDM630: 9600 as delivered, so check it. SDM230: depends on the version (the V1.6 manual says 2400); set it to 9600 on the meter's display, on the Baud Rate page |
| Parity and stop bits | None, and as the manual says (the converter uses 8 data bits, no parity, 1 stop bit) |
| CT ratio | On a meter with 5 A current transformers, set the ratio in the meter's menu (for example 250 for a 250/5 A transformer) so that the meter shows the real power. It depends on the transformers fitted, so it is set on site. Greecon reads what the meter shows |

A meter's display works only when its voltage terminals have power, and powering a meter on a bench is mains work: the electrician makes up the office's bench lead, and the project manager never wires mains.

**Fit the model the install card lists.** Greecon reads an SDM630 by its register 52 and an SDM230 by its register 12. If the box finds a single-phase SDM230 where a three-phase SDM630 was planned, **{{ui.find_equipment}}** says so, and reads it as an SDM230 once you press **{{ui.use_this_address}}**. An SDM630 fitted where an SDM230 was planned is read as an SDM230 and shows one phase's power only: **{{ui.find_equipment}}** says it may be a three-phase meter, and the commissioning comparison with the meter's own display finds it too.

### Fitting: the electrician's work

{{diagram:ref-ct}}

::: stop
**Inside a distribution board is the electrician's work, with the lock-out on.** The project manager watches, photographs and writes it down.
:::

- **Clamps point towards the site.** On the grid meter this makes import positive. On the solar meter, the clamps point away from the inverter, towards the board (towards the site), so that production is read. The platform takes the size of the power for solar, so a reversed solar clamp does not read zero, but fit it the right way anyway.
- **Never open the secondary of a 5 A current transformer while current flows:** it can produce a dangerous voltage. Short the secondary before disconnecting. This is the electrician's rule; it is repeated here because it is the one that hurts.
- Voltage taps have small fuses or 2 A breakers on each tap, as the meter's manual says.
- **Photograph** the wiring, the label (model and serial number) and the display with its settings.

::: check
**Check on the day:** with the sun down, switch on a known load: grid import must go up. At night solar reads zero or a few watts. At midday the solar meter agrees with the inverter's own display within about 5 percent.
:::

## [4.6]{.num} Water: tank, pressure, flow, pump

Two modules read the water side, both on the same RS-485 cable as the meters, and both approved models: the **4 to 20 mA module** (unit number 3) reads the level, pressure and flow transmitters, and the **pump contact module** (unit number 5) reads whether the pump is running. Greecon sets their numbers at the office; on site you check the labels.

### The 4 to 20 mA module {.hw}

{{part:analog}}

**Its inputs are left in their default 0 to 20 mA mode, on purpose.** A 4 to 20 mA transmitter then reads **4000 to 20000 microamps**, and a wire that has come off reads **0**, which is below the 4 mA of an empty tank, so Greecon can see it and say so. (In the module's own 4 to 20 mA mode a broken wire might read like an empty tank.) Use the version that reads current, not the one that reads voltage.

**Each transmitter has its own input:** the level transmitter on **input 1**, the pressure transmitter on **input 2** and the flow meter on **input 3**. Greecon asks for the range printed on each label (below) and works out the register and the scale: nobody types a register or a conversion.

### A 4 to 20 mA loop

A two-wire transmitter takes its power from the loop, so the loop needs a 24 V supply in series with the module's input. The electrician wires it as the module's manual draws it. The maker does not say that this module supplies the loop, so the loop has a supply of its own.

{{diagram:ref-loop}}

### Ranges from the labels

The range of a transmitter is printed on its label, and the setup list asks for nothing else, in the label's own words:

- **Level transmitter:** the range on the label (a 0 to 5 m transmitter: 5), its unit (metres, or bar for a pressure sensor hung at the bottom of the tank: a bar holds up about 10.2 m of water) and how tall the tank is inside, from the bottom to the top of the water when it is full (say 4, in metres). Greecon shows a percentage of the tank: 0 when empty, 100 when full. A 0 to 5 m transmitter in a tank 4 m tall reads 100 at 16.8 mA and 125 at the top of its range (5 ÷ 4 × 100). One shorter than the tank is refused: it cannot see the top of the water.
- **Pressure transmitter:** the top of the range in bar (0 to 10 bar is usual).
- **Flow meter:** the top of the range in litres a minute.
- A transmitter the site does not have: tick **Not fitted at this site**. Greecon asks first: the reading and its history are removed.

**Check the module with a loop calibrator** (a hand-held that sends 4, 12 and 20 mA in place of a transmitter). Read the module from the box (address 0 is input 1, 1 is input 2, 2 is input 3):

```
greecon-edge modbus-test --host 192.168.1.50 --unit 3 --type input --address 0
```

It must read 4000, 12000 and 20000, and Greecon then shows 0, half the range and the whole range. On the tank's input the whole range reads more than 100 when the transmitter is longer than the tank (125 in the example), and Greecon may call that impossible while you test: that is the test, not a fault.

### The pump contact module {.hw}

{{part:pumpin}}

A spare auxiliary contact of the pump's starter is wired by the electrician to **input 1** as a dry contact, as the module's manual draws it (the module's DI COM is left unconnected). Never to a control circuit, and **never to the module's relay outputs**: Greecon only reads. **Check it by eye:** with the pump running, {{ui.reading_pump}} must read 1; stopped, 0. If it reads the other way round, the contact is inverted: the electrician uses the other contact of the starter. The module is optional: a pump whose starter has no spare running contact has none, the site then removes it from the list, and the handover says that "the pump is running but no water is flowing" cannot be raised.

### The level transmitter {.hw}

{{part:level}}

- The transmitter hangs at the bottom of the tank, so that zero is empty, its vented cable fixed so that it cannot move.
- **Only a transmitter with wetted parts approved for drinking water goes into a drinking-water tank.** A cheap sensor of unknown material is not worth a contaminated tank. If unsure, use a non-contact ultrasonic sensor above the water instead.
- The electrician or the customer's plumber fits it. If the tank must be entered, the customer's own staff do that and the project manager does not: if the only place for the sensor is inside, say it is not possible and write why.
- **In Greecon** give the range on the label and how tall the tank is inside (from the bottom, where the transmitter hangs, to the top of the water when it is full). Greecon works out the percentage: a 0 to 5 m transmitter in a tank 4 m tall reads 100 when the tank is full (16.8 mA), and 125 at the top of its range. Wired to input 1.

### The pressure transmitter {.hw}

{{part:pressure}}

On the pipe through an isolating valve, so that it can be removed without draining. A plumber does the wet connection. The pipe's pressure range decides the transmitter's range, and the top of that range, as the label says it, is what Greecon asks for. Wired to input 2.

### The flow meter {.hw}

{{part:flow}}

An electromagnetic or turbine meter in the pipe with a 4 to 20 mA output, installed with the straight run its manual asks for, and wired to input 3. Greecon asks for the top of its range, in litres a minute; where there is no flow meter the site ticks **Not fitted at this site**. Without it, or without the pump's running contact, "the pump is running but no water is flowing" cannot be raised, and the site should say so in its handover.

## [4.7]{.num} Farm sensors

A soil moisture probe and a temperature and humidity sensor that speak RS-485 Modbus RTU go on the same cable as everything else, each with its own unit number: soil probe 6, weather sensor 7 (set it before the probe is buried or the sensor mounted). They are not approved models: Greecon does not know their registers, and the box cannot recognise them on a network. So their address is entered by hand, and each reading is mapped by hand with **Choose the register**, from the maker's register table, which decides the register, the kind of number and the scale.

### The soil moisture probe {.hw}

{{part:soil}}

**Write down the probe's depth and where it is.** Soil readings mean little without them, and they are only as good as the contact between the probe and the soil. Greecon gives no irrigation advice until the grower's value for "start irrigating below" is entered: after the first week of readings, ask the grower what reading means "time to water".

### The temperature and humidity sensor {.hw}

{{part:climate}}

## [4.8]{.num} The network

{{diagram:ref-network}}

| Situation | What to do |
|---|---|
| **The customer's network** | Box and converter on the router. Ask for a fixed address (a reservation) for the converter. The box needs only outgoing HTTPS (443) to `api.greecon.earth` (and to `nodejs.org` at install) and a time service (UDP 123). Nothing needs to come in. When someone presses **Find equipment**, the box looks at the site's own network for about a minute: it tries port 502 (or the port the person gives) on the private addresses of that network, such as 192.168.x.x and 10.x.x.x, only reads, and never writes to anything or looks outside the site's network. The install card has the words for the customer's network administrator. |
| **Cellular** | A 4G router with a data SIM; box and converter plug into its sockets. Plan for about 1.5 GB a month. That assumes a hotel-size site (four devices, seven readings) sending one request every ten seconds, about 5 KB each with its headers (about 1.3 GB), plus a heartbeat every 30 seconds (about 0.15 GB); a site with more devices sends more. It is an estimate: read the router's counter after a week and write the real figure down. Choose a plan of 5 GB or more. |
| **No internet at all** | Not sold. The box keeps about three days (for a site of up to about thirteen devices), which is for outages, not for a site that is never connected. |

### The cellular router {.hw}

{{part:cell}}

Keep the box and the converter on separate addresses from the customer's own equipment where you can, and never on a guest network.

## [4.9]{.num} Power

{{diagram:ref-power}}

### The 24 V power supply {.hw}

{{part:psu}}

### The UPS {.hw}

{{part:ups}}

- One 24 V DIN supply feeds the two modules, the loop transmitters and, through a small DC adapter if the box takes 12 V, the converter. The box takes 24 V directly if it accepts 9 to 36 V.
- A UPS keeps the box and the converter up through short cuts and long enough to say that the grid is down. **When the grid is down, a meter powered from the grid dies with it.** That is expected: the box is alive and says the devices do not answer, which is the honest picture ("we cannot tell"), not a fault in Greecon.
- Auto power-on in the BIOS (section 4.3) is what brings the box back after the UPS runs flat.

## [4.10]{.num} Enclosure and labelling

### The enclosure {.hw}

{{part:enclosure}}

One IP54 box (IP65 if outside) holds the converter, the two modules (the 4 to 20 mA module and, where there is one, the pump contact module), the supply, the fuses, the terminal blocks and, if there is room, the box. Label everything: the unit number on each device (set at the office) and the settings on the converter, the wire numbers at both ends, and the site name and the date on a sticker inside the lid. **Never write a code or a password on the box.** Photograph the inside before closing.

## [4.11]{.num} The project manager's tools

The project manager brings:

{{tools}}

**You do not need a tool for work inside a live board: that is the electrician's.**

## [4.12]{.num} Buying

1. Ask three suppliers for a quote. For the approved models (the two Eastron meters and the two Waveshare modules) the model is named, and a look-alike is not the same part; for everything else it is the specification, not the brand. Keep the quotes. ({{ref:appendices}} have a shopping list for each kit with room for three quotes.)
2. Buy one kit, bench-test it (the rehearsal), and fix the specification where it failed.
3. Then buy five. For each part keep: the make and model, the supplier, the date, the serial number or the batch, and the invoice. A spreadsheet is enough: the hardware register.
4. **Do not buy** a meter or a module that is not an approved model, a probe or a sensor whose register table you have not seen, a transmitter not rated for the fluid, or anything with a wireless link to the board that you cannot inspect.

### Where the planning figures come from

Seen in October 2026, not quotes: Waveshare RS-485 to Ethernet converters, about EUR 25 to 60, and a look-alike at USD 45 (Electrokit, Botland); Eastron SDM630MCT V2 from about GBP 75 to 150 (Bimble Solar); a Waveshare 8-channel Modbus analog input module, about USD 25 to 36 (Waveshare); a Teltonika RUT241 4G router, about EUR 150 to 200 (Pricerunner); WIKA pressure transmitters, GBP 129 and up (RS); level transmitters from about USD 28 (unverified quality) to over GBP 900 (RS); fanless N100 mini PCs from about USD 112 in bulk to over USD 400 retail, with the real-time clock not stated by the listings: ask the vendor (Newegg). The Eastron register tables and defaults are in the maker's own manuals (the SDM630 Modbus protocol document and the SDM230 user manual V1.6): read the one that came with the meter before relying on this page, because versions differ. The planning figure for the pump contact module (30 to 60) is the earlier figure for a pump run input: it has not been checked against a shop price for the Waveshare Modbus RTU IO 8CH, and the registers of both Waveshare modules are from the maker's published tables and have not been tried on real hardware, so the first real kit is rehearsed on a desk and anything that differs is reported to Greecon.
