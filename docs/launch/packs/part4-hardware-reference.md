This part describes every kind of hardware in a Greecon kit: what it is, what it must be, what it costs, how it is set up, how it is fitted, how to check it and what goes wrong. It is written from the hardware and wiring document (docs/launch/03) and is the place to look when a pack says "follow the maker's manual". The four site packs (Part 5 of the Complete Deployment Guide, and PDFs 04 to 07 on their own) use these parts in four combinations.

::: tip
**Where this part is silent, the maker's manual decides.** The drawings show how the parts connect, not terminal numbers: terminal numbers differ between makes and versions. Every drawing says so. Part numbers named here are examples of a kind of part; the specification is what matters. Prices are planning estimates from public shop prices seen in October 2026, not quotes: replace them with real quotes in the first week and keep the quotes in the shared drive.
:::

## [4.1]{.num} Rules of thumb

The aim is the cheapest way to run many sites for many years: the same few parts everywhere, bought by specification and not by brand, prepared at the office, installed in an afternoon, and replaceable by anyone because nothing about a box is special. Greecon's software puts no limit on which make you use. It speaks two standard languages, Modbus over the network and a wire signal of 4 to 20 mA read through a Modbus module, so a part can be swapped when a maker stops selling it.

1. **One of each first.** Buy one full kit and bench-test it (the rehearsal, {{ref:manual}}, section 3.11) before buying five. Change the specification, not the kit, when something fails.
2. **Read-only, always.** No relay output, no control wire, no write. Everything here only measures.
3. **Meters and sensors that publish their registers.** If the maker will not give the register table, do not buy it: it cannot be mapped honestly.
4. **Everything powered from one clean place,** on a UPS, in one enclosure, labelled.
5. **Pre-stage at the office:** the box has its software installed and tested before it leaves.
6. **Same settings everywhere:** unit numbers (grid 1, solar 2, water module 3, optional load or pump meter 4), speed 9600, no parity, the converter on port 502. A new site then looks like the last one.

::: stop
**Greecon only reads, and only an electrician works on mains.** Nothing in this part tells anyone to work on a live conductor. Everything inside a distribution board, every current clamp and voltage tap, and the pump's run contact are the electrician's work, done under the customer's lock-out procedure. The project manager does the low-voltage and software side. Greecon is not a safety system: the float switches, relief valves and trips already in the customer's equipment stay the safety layer.
:::

## [4.2]{.num} The standard kits

Four kits cover the four kinds of site. Costs are planning estimates in EUR, excluding VAT and installation labour. A part marked optional is not always fitted. The first table is every part once; the tables after it are the four kits, with quantities.

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
- **Every device its own unit number,** the same speed and parity. Meters are delivered with unit number 1: set each meter's number at its own display before it joins the cable, or two answer at once.
- A 120 ohm resistor across A and B at each end of the cable is only for runs longer than about 50 m, or if readings are unreliable at 9600 baud.

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

A battery is not bought from Greecon's list: it is whatever the customer has. Greecon can read it only if the maker publishes the battery's Modbus register table. The battery speaks Modbus itself, on the site's network or on its own RS-485 port. If the maker will not publish the table, leave the battery out: do not guess registers. Two readings are mapped by hand from the maker's table: {{ui.reading_battery_charge}} (percent) and {{ui.reading_battery_power}} (kW, positive while charging). If there is no battery, remove the template's battery device (the project manager's step in the pack for kit S).

### What Greecon reads

**Total active power:** register 52 on the SDM630 (address counted from zero, as a manual's 30053) and register 12 on the SDM230, 32-bit floating point, high half first, in watts; Greecon shows it in kW. Positive power is energy coming in, negative is energy sent out. That is why one grid meter gives both {{ui.reading_grid_import}} and {{ui.reading_grid_export}}, and why a clamp fitted the wrong way round swaps them (the direction check, setup step 8).

The Eastron meters in the templates already have their registers filled in. The unit scale applied is only watts to kilowatts. Greecon reads what the meter shows.

### Settings to read from the meter's display

These differ between makes and versions, so they are read from the meter, never assumed.

| Setting | Value |
|---|---|
| Unit number | A different one on each meter (grid 1, solar 2, optional load or pump meter 4) |
| Speed | SDM630: 9600 as delivered. SDM230: depends on the version (the V1.6 manual says 2400). Set both to 9600 |
| Parity and stop bits | None, and as the manual says (the converter uses 8 data bits, no parity, 1 stop bit) |
| CT ratio | On a meter with 5 A current transformers, set the ratio in the meter's menu (for example 250 for a 250/5 A transformer) so that the meter shows the real power. Greecon reads what the meter shows |

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

One analog input module reads the 4 to 20 mA signals and the pump's run contact; it connects to the same RS-485 cable as the meters (unit number 3).

### The analog input module {.hw}

{{part:analog}}

**Set each channel of the module to 4 to 20 mA.** Many default to 0 to 20 mA or to volts; it is done in the module's own software or with jumpers.

**What the register holds** at 4 mA and at 20 mA is in the module's manual (often milliamps times 1000, so 4000 and 20000). Check it with a loop calibrator, a hand-held that sends 4, 12 and 20 mA: send each, read the register with `greecon-edge modbus-test`, write the numbers down and enter them in the register form as the signal at the bottom and the signal at the top.

### A 4 to 20 mA loop

A two-wire transmitter takes its power from the loop, so the loop needs a 24 V supply in series with the module's input, as the module's manual draws it (some modules supply the loop, some do not).

{{diagram:ref-loop}}

### The pump run input {.hw}

{{part:pumpin}}

A spare auxiliary contact of the pump's starter, wired by the electrician to a digital input, never to a control circuit. The contact only reports. The template expects the pump's running state to be one of the four readings of the water module (unit 3), so a module that has both analog and digital inputs is the simplest buy. If a separate digital input module is used it needs its own unit number and its own device in the platform: ask the founder before doing that at a customer, because the launch documents do not describe it.

### The level transmitter {.hw}

{{part:level}}

- The transmitter hangs at the bottom of the tank, so that zero is empty, its vented cable fixed so that it cannot move.
- **Only a transmitter with wetted parts approved for drinking water goes into a drinking-water tank.** A cheap sensor of unknown material is not worth a contaminated tank. If unsure, use a non-contact ultrasonic sensor above the water instead.
- The electrician or the customer's plumber fits it. If the tank must be entered, the customer's own staff do that and the project manager does not: if the only place for the sensor is inside, say it is not possible and write why.
- **In Greecon** enter the reading at the top as transmitter range ÷ tank height × 100. A 0 to 5 m transmitter in a 3 m tank: 5 ÷ 3 × 100 = 166.7. At the tank's full height the reading is then 100.

### The pressure transmitter {.hw}

{{part:pressure}}

On the pipe through an isolating valve, so that it can be removed without draining. A plumber does the wet connection. The pipe's pressure range decides the transmitter's range.

### The flow meter {.hw}

{{part:flow}}

An electromagnetic or turbine meter in the pipe with a 4 to 20 mA output, installed with the straight run its manual asks for. Without it, or without the pump's running contact, "the pump is running but no water is flowing" cannot be raised, and the site should say so in its handover.

## [4.7]{.num} Farm sensors

A soil moisture probe and a temperature and humidity sensor that speak RS-485 Modbus RTU go on the same cable as everything else, each with its own unit number (set it before it is buried or mounted). The maker's register table decides the register, the kind of number and the scale.

### The soil moisture probe {.hw}

{{part:soil}}

**Write down the probe's depth and where it is.** Soil readings mean little without them, and they are only as good as the contact between the probe and the soil. Greecon gives no irrigation advice until the grower's value for "start irrigating below" is entered: after the first week of readings, ask the grower what reading means "time to water".

### The temperature and humidity sensor {.hw}

{{part:climate}}

## [4.8]{.num} The network

{{diagram:ref-network}}

| Situation | What to do |
|---|---|
| **The customer's network** | Box and converter on the router. Ask for a fixed address (a reservation) for the converter. The box needs only outgoing HTTPS (443) to `api.greecon.earth` (and to `nodejs.org` at install) and a time service (UDP 123). Nothing needs to come in. |
| **Cellular** | A 4G router with a data SIM; box and converter plug into its sockets. Plan for about 1.5 GB a month. That assumes a hotel-size site (three devices, seven readings) sending one request every ten seconds, about 5 KB each with its headers (about 1.3 GB), plus a heartbeat every 30 seconds (about 0.15 GB); a site with more devices sends more. It is an estimate: read the router's counter after a week and write the real figure down. Choose a plan of 5 GB or more. |
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

- One 24 V DIN supply feeds the input module, the loop transmitters and, through a small DC adapter if the box takes 12 V, the converter. The box takes 24 V directly if it accepts 9 to 36 V.
- A UPS keeps the box and the converter up through short cuts and long enough to say that the grid is down. **When the grid is down, a meter powered from the grid dies with it.** That is expected: the box is alive and says the devices do not answer, which is the honest picture ("we cannot tell"), not a fault in Greecon.
- Auto power-on in the BIOS (section 4.3) is what brings the box back after the UPS runs flat.

## [4.10]{.num} Enclosure and labelling

### The enclosure {.hw}

{{part:enclosure}}

One IP54 box (IP65 if outside) holds the converter, the input module, the supply, the fuses, the terminal blocks and, if there is room, the box. Label everything: unit numbers on the converter and on each device, the wire numbers at both ends, and the site name and the date on a sticker inside the lid. **Never write a code or a password on the box.** Photograph the inside before closing.

## [4.11]{.num} The project manager's tools

The project manager brings:

{{tools}}

**You do not need a tool for work inside a live board: that is the electrician's.**

## [4.12]{.num} Buying

1. Ask three suppliers for the quote on the specification, not the brand. Keep the quotes. ({{ref:appendices}} have a shopping list for each kit with room for three quotes.)
2. Buy one kit, bench-test it (the rehearsal), and fix the specification where it failed.
3. Then buy five. For each part keep: the make and model, the supplier, the date, the serial number or the batch, and the invoice. A spreadsheet is enough: the hardware register.
4. **Do not buy** a meter whose register table you have not seen, a transmitter not rated for the fluid, or anything with a wireless link to the board that you cannot inspect.

### Where the planning figures come from

Seen in October 2026, not quotes: Waveshare RS-485 to Ethernet converters, about EUR 25 to 60, and a look-alike at USD 45 (Electrokit, Botland); Eastron SDM630MCT V2 from about GBP 75 to 150 (Bimble Solar); a Waveshare 8-channel Modbus analog input module, about USD 25 to 36 (Waveshare); a Teltonika RUT241 4G router, about EUR 150 to 200 (Pricerunner); WIKA pressure transmitters, GBP 129 and up (RS); level transmitters from about USD 28 (unverified quality) to over GBP 900 (RS); fanless N100 mini PCs from about USD 112 in bulk to over USD 400 retail, with the real-time clock not stated by the listings: ask the vendor (Newegg). The Eastron register tables and defaults are in the maker's own manuals (the SDM630 Modbus protocol document and the SDM230 user manual V1.6): read the one that came with the meter before relying on this page, because versions differ.
