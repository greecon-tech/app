# 03. Hardware and wiring

**For:** the project manager (what to buy, how it fits together) and the electrician (what Greecon needs from them).
**Read with:** [02 Project manager manual](02-project-manager-manual.md).

The aim is the cheapest way to run **many** sites for **many** years: the same few parts everywhere, prepared at the
office, installed in an afternoon, and replaceable by anyone because nothing about a box is special. The parts that
talk to the platform are **approved models**: the Eastron SDM630 and SDM230 meters and two Waveshare modules (the
Modbus RTU Analog Input 8CH and the Modbus RTU IO 8CH). Greecon knows their registers, their serial settings and how
to recognise them on a network, so nobody on site reads a datasheet or types a register. The rest of a kit (the box,
the converter, the supply, the transmitters, the enclosure) is bought by specification and not by brand. Greecon
speaks two standard languages (Modbus over the network, and a wire signal of 4 to 20 mA through a Modbus module), so a
part that is not an approved model can be swapped when a maker stops selling it.

> **How far to trust the prices below.** They are planning figures from public shop prices seen in October 2026
> and from the vendors' own pages (listed at the end), not quotes. Replace them with real quotes in the first
> week, and keep the quotes in the shared drive. For the approved models the model named is the
> model bought; for every other part the specification column is what matters.

---

## 1. Rules of thumb

1. **One of each first.** Buy one full kit and bench-test it ([02, Rehearsal](02-project-manager-manual.md#13-rehearsal-the-whole-job-on-a-desk))
   before buying five. Change the specification, not the kit, when something fails.
2. **Read-only, always.** No relay output, no control wire, no write. Everything here only measures. (The pump
   contact module has relay outputs: they are never used.)
3. **Approved models for what is read over the cable, a published register table for anything else.** A kit is made
   of the approved models and no others. A soil probe, a weather sensor or a battery is not an approved model and is
   mapped by hand: if the maker will not give the register table, do not buy it, because it cannot be mapped honestly.
4. **Everything powered from one clean place,** on a UPS, in one enclosure, labelled.
5. **Pre-stage at the office:** the box has its software installed and tested, every device has its number and its
   speed, and the converter is set, before the kit leaves.
6. **Same settings everywhere:** unit numbers (grid meter 1, solar meter 2, 4 to 20 mA water module 3, load or pump
   meter 4, pump contact module 5, soil probe 6, weather sensor 7), speed 9600, 8 data bits, no parity, 1 stop bit, the
   converter on port 502. A new site then looks like the last one.

## 2. The standard kits

Four kits cover the four kinds of site. **Optional** items are marked. Costs are **planning estimates** in EUR,
excluding VAT and installation labour. The meters and the two modules are approved models: the model named is the model
bought.

### Kit H: hotel or guesthouse (water, solar, grid)

| | Item | Specification | Qty | Estimate |
|---|---|---|---|---|
| 1 | **Box** | Fanless x86 mini PC (see section 3), 8 GB, 128 GB or more SSD or eMMC, 12 to 24 V DC input | 1 | 180 to 300 |
| 2 | **Converter** | RS-485 to Ethernet, DIN rail, 9 to 36 V DC, *Modbus TCP to RTU gateway mode* (section 4) | 1 | 30 to 60 (basic) or 250 and up (industrial) |
| 3 | **Three-phase meter** | **Eastron SDM630** Modbus (the "MCT" version comes with three clamp-on current sensors for up to 100 A a phase); for more than 100 A, the ordinary SDM630 with 5 A current transformers | 2 (grid, solar) | 90 to 180 each |
| 4 | **4 to 20 mA input module** | **Waveshare Modbus RTU Analog Input 8CH** (current version: the one that reads current, not the one that reads voltage), 8 inputs, 4 to 20 mA, 7 to 36 V DC | 1 | 30 to 60 |
| 5 | **Pump contact module** | **Waveshare Modbus RTU IO 8CH**: eight isolated digital inputs, a dry contact is enough. Its relay outputs are never used. If the pump's starter has no spare running contact, leave it out and say so at handover | 1 | 30 to 60 |
| 6 | **Level transmitter** | Submersible, vented cable, 4 to 20 mA, range at least the tank's height, **wetted parts approved for drinking water** (or a non-contact ultrasonic sensor above the tank) | 1 | 120 to 400 |
| 7 | **Pressure transmitter** | 4 to 20 mA, range to suit the pipe (0 to 10 bar is usual), stainless wetted parts | 1 | 40 to 150 |
| 8 | Flow meter *(optional)* | 4 to 20 mA output. Needed for "the pump is running but no water is flowing" | 0 or 1 | 150 to 500 |
| 9 | **24 V DIN power supply** | 30 to 60 W | 1 | 25 to 50 |
| 10 | **UPS** | A 12 V DC UPS for the box and converter, or a 600 VA line-interactive UPS | 1 | 60 to 150 |
| 11 | **Enclosure and fittings** | IP54 (IP65 outdoors), DIN rail, terminals, fuses or small breakers for the meters' voltage taps, glands | 1 | 80 to 150 |
| 12 | **Cable and labels** | Shielded twisted pair for the RS-485 line, network patch cords, ferrules, labels | | 40 to 80 |
| 13 | Cellular router *(only without usable internet)* | 4G, DIN rail, data SIM | 0 or 1 | 150 to 200 |

**About EUR 800 to 1,800; typically 1,100 to 1,300.** Add the electrician's time (half a day to a day) and yours.

### Kit S: solar plant with grid connection

Rows 1, 2, 3 (two meters, and a third if the owner wants the site's own consumption measured), 9, 10, 11, 12 above.
For a battery add nothing but the maker's Modbus register table (the battery speaks Modbus itself on the site's
network or its own RS-485 port; if the maker will not publish it, leave the battery out). **About EUR 600 to
1,200.**

### Kit F: farm or greenhouse with irrigation

Rows 1, 2, 4, 6, 7, 9, 11, 12, and 13 (a cellular router is the likelier case in a field). Add: a **soil moisture
probe** (RS-485 Modbus, with a published register table) for each zone, EUR 40 to 120; a **temperature and
humidity sensor** (RS-485 Modbus), EUR 20 to 80. Row 5 and the flow meter if there is a pump to watch. **About
EUR 700 to 1,500.**

### Kit W: water tank and pump station

Rows 1, 2, 4, 5, 6, 7, 9, 10, 11, 12, optionally 8 and 13, and *optionally* a single-phase **Eastron SDM230** on the
pump's feed (EUR 35 to 60) to measure its electricity. **About EUR 650 to 1,300.**

### Spares kit (one per project manager)

One of each: converter, 4 to 20 mA module, pump contact module, meter, 24 V supply, transmitter (pressure), a spare
box (pre-installed, with no code, ready to take one), network cables, a loop calibrator, a multimeter, fuses, a spare
SIM. The two modules in the spares kit are numbered 3 and 5 at the office before they go in the car; a spare meter is
numbered at the office, for the role it is to take, before it goes to a site. A part that is delivered as number 1 is
never fitted before it has been numbered.

## 3. The box

**Specification.** The box runs one small program and holds a queue of readings. It needs very little, and it
must survive power cuts, which is the hard part.

| Needs | Why |
|---|---|
| Linux on a processor of the **x86-64**, **64-bit ARM** or **32-bit ARM** kind (the installer checks) | The software is a Node.js program |
| **Debian 12, Ubuntu 22.04 or later, or Raspberry Pi OS (64-bit)** with systemd | What the installer supports |
| 4 GB of memory or more, 32 GB of storage or more | The program asks for about 400 MB; the queue is on disk |
| **A real disk (SSD or eMMC), not an SD card** | An SD card is the commonest reason these boxes fail: they corrupt on power cuts and wear out under constant writing |
| A **real-time clock with battery**, and a BIOS setting of **power on after power loss** (often "Restore on AC Power Loss: Power On") | After a cut the box must come back by itself, with the right time |
| **9 to 36 V DC input**, or a plain 12 V one | So that it can sit behind a DC UPS and share the 24 V supply |
| No fan, **0 to 50 °C** or better | A plant room is hot and dusty |
| One Ethernet port (two is nicer) | One to the converter's network, one spare |

**Options.**

| Option | When | Cost | Note |
|---|---|---|---|
| **Fanless x86 mini PC** (an Intel N100-class machine) | **The default.** Most sites. | 180 to 300 | Check the RTC battery and the power-on setting in the BIOS before buying many. |
| **Raspberry Pi 5** (4 or 8 GB) | A bench box, or a small site with a **proper SSD** on NVMe or USB 3 and an RTC battery. Never an SD card. | 120 to 200 with SSD and case | Starts by itself when power returns. |
| **Industrial PC** (Advantech UNO, OnLogic, Seeed reTerminal DM class) | Hot, dusty or vibrating sites; customers who insist on industrial parts | 450 to 900 | The same software runs on it. Not needed to begin. |

**Preparing the operating system (at the office, twenty minutes):**

1. Install **Debian 12** from the "netinst" image: only "SSH server" and "standard system utilities". No desktop.
2. One user with a **long password** (in the password manager, against the site's name). Host name `greecon-<site>`.
3. Time zone **Europe/Tirane**; **`timedatectl set-ntp true`**.
4. **Automatic security updates:** `apt-get install -y unattended-upgrades` and answer *yes* when it asks.
5. **BIOS:** power on after power loss; no sleep; boot from the disk only.
6. **Then paste the install line** ([02, section 5](02-project-manager-manual.md#5-prepare-the-kit-at-the-office)).

**What the installer changes** (so that nobody wonders): `/opt/greecon` (the software), `/etc/greecon` (the box's
credential, readable by the service only), `/var/lib/greecon-edge` (what it remembers), one service called
`greecon-edge`, one user called `greecon`, and one command, `greecon-edge`. Nothing else.

**What the box does by itself:** restarts if it fails; keeps about three days of readings if the internet is down,
for a site of up to about thirteen devices (a site with more devices keeps fewer days), and sends them in order
when it returns (a long outage keeps one reading a minute for each reading, so that three days fit); takes new versions of its software from the platform and **goes back to the version before** if a new one
fails to start three times; reports every 30 seconds so that Greecon knows it is alive.

**Commands the project manager uses:**

```
greecon-edge status                       how the box is: heard by Greecon? each device ok? the queue
journalctl -u greecon-edge -n 50 --no-pager   what it has been saying
greecon-edge find                         look at the network and say what answers (reads only)
greecon-edge modbus-test --host 192.168.1.50 --unit 1 --type input --address 52 --data-type float32
sudo systemctl restart greecon-edge       restart it
```

## 4. The converter and the meter cable

The meters and modules speak **Modbus RTU** on a two-wire cable (**RS-485**). The box speaks **Modbus TCP** on the
network. The converter sits between them.

**The setting that matters most:** the converter must be in **Modbus TCP to RTU gateway mode** (sometimes called
"Modbus gateway", "Modbus TCP server" or "protocol conversion"). **Not "transparent" or "raw TCP" mode, and not
"Modbus RTU over TCP":** in those, the box's requests arrive on the cable as garbage and nothing answers.

**The settings in the converter's web page:**

| Setting | Value |
|---|---|
| Mode | Modbus TCP to RTU (gateway) |
| Serial: speed (baud) | 9600 (the same as every device on the cable) |
| Serial: data bits, parity, stop bits | 8, none, 1 |
| TCP: port | 502 |
| Address | A **fixed** address on the site's network (a reservation in the router, or set in the converter) |

Greecon sets all of this at the office, before the kit leaves; it is here in case a converter ever has to be set
again. The box keeps **one** TCP connection per converter and asks one thing at a time, so any converter will do.

**Wiring RS-485:**

```
 converter           meter 1 (grid)       meter 2 (solar)      4-20 mA module 3     pump contact module 5
  A (D+) ─────────── A ──────────────────── A ───────────────── A ───────────────── A
  B (D−) ─────────── B ──────────────────── B ───────────────── B ───────────────── B
  GND ────────────── GND (if present) ───── GND ─────────────── GND ─────────────── GND
  [120 Ω resistor across A and B at each END of the cable, only for runs longer than about 50 m or if
   readings are unreliable at 9600 baud]
```

- **One cable, daisy chain**, from the converter to the first device, on to the next, and so on. **No branches**
  ("stars" and "tees" cause the errors that look like random failures).
- Use **shielded twisted pair**, the shield joined to ground at **one** end only. Keep it away from power cables.
- **A and B swapped** is the commonest mistake: if nothing answers, swap the two wires at the converter.
- **Every device its own unit number**, the same speed and parity. The meters and the Waveshare modules are
  delivered as number 1, so each is numbered at the office before it joins the cable: two with the same number
  would answer over each other.

**The number each device has on the cable** (the same in every kit; set at the office, checked on site, never
changed on site):

| Device | Number | How it is set |
|---|---|---|
| Grid meter (Eastron SDM630) | 1 | On its display |
| Solar meter (Eastron SDM630) | 2 | On its display |
| 4 to 20 mA module (Waveshare Modbus RTU Analog Input 8CH) | 3 | With the maker's setting tool |
| Load meter (SDM630) or pump meter (SDM230) | 4 | On its display |
| Pump contact module (Waveshare Modbus RTU IO 8CH) | 5 | With the maker's setting tool |
| Soil probe | 6 | The maker's way, before it is buried |
| Weather sensor | 7 | The maker's way, before it is mounted |
| A battery | By hand, for example 8 | From the battery maker's manual |

Every device on one cable has the same speed: 9600 baud, 8 data bits, no parity, 1 stop bit.

## 5. The meters

**Eastron SDM630 (three-phase)** at the **grid connection** (where the supply enters) and on the **inverter's AC
output**. **SDM230 (single-phase)** for one pump or a small load.

What Greecon reads: **total active power** (register 52 on the SDM630, address counted from zero, as a manual's
30053; register 12 on the SDM230), 32-bit floating point, high half first, in **watts**; it is shown in kW.
Positive power is energy coming in, negative is energy sent out. That is why **one grid meter gives both Grid
import and Grid export**, and why a clamp fitted the wrong way round swaps them (the direction check, setup step 9).

**Meter settings, made at the office** (they differ between makes and versions, so they are read from the meter's
own display and never assumed; Greecon sets them before the kit leaves, and on site you only check them): the
**unit number** (a different one on each meter: grid 1, solar 2, load or pump meter 4), the **speed** (SDM630: 9600 as
delivered, so check it; SDM230: depends on the version, the V1.6 manual says 2400; set it to **9600** on its display,
on the Baud Rate page), the **parity** (none) and the **stop bits**. On a meter with **5 A current transformers** (not
the MCT version), also set the **CT ratio** in the meter's menu (for example 250 for a 250/5 A transformer), **so that
the meter shows the real power**: it depends on the transformers fitted, so it is set on site. Greecon reads what the
meter shows and applies only the unit scale (watts to kilowatts).

A meter's display works only when its voltage terminals have power, and powering a meter on a bench is mains work: the
electrician makes up the office's bench lead, and the project manager never wires mains.

**Fit the model the install card lists.** Greecon reads an SDM630 by its register 52 and an SDM230 by its register 12.
If the box finds a single-phase SDM230 where a three-phase SDM630 was planned, **Find equipment** says so, and reads it
as an SDM230 once you press **Use this address**. An SDM630 fitted where an SDM230 was planned is read as an SDM230 and
shows one phase's power only: **Find equipment** says it may be a three-phase meter, and the commissioning comparison
with the meter's own display finds it too.

**Fitting (the electrician's work, inside the board, with the lock-out on):**

```
        mains (L1 L2 L3 N)              site loads
  ──────┬──┬──┬──┬────────────[main breaker]─────────────►
        │  │  │  │
   small fuses or 2 A breakers on each voltage tap (as the meter's manual says)
        │  │  │  │                 ╭──╮ ╭──╮ ╭──╮   current clamps on L1, L2, L3,
       ┌┴──┴──┴──┴┐                │CT│ │CT│ │CT│   the ARROW on each pointing
       │  SDM630  │◄───────────────┴──┴─┴──┴─┴──┴   TOWARDS THE SITE (the loads)
       └──────────┘
        RS-485 A B ► the data cable
```

- **Clamps point towards the site.** On the grid meter this makes import positive. On the solar meter, clamps
  point **away from the inverter, towards the board** (towards the site) so that production is read; the
  platform takes the *size* of the power for solar, so a reversed solar clamp does not read zero, but fit it the
  right way anyway.
- **Never open the secondary of a 5 A current transformer while current flows** (it can produce a dangerous
  voltage). Short the secondary before disconnecting. This is the electrician's rule, and it is repeated here
  because it is the one that hurts.
- **Photograph** the wiring, the label (model and serial number) and the display with its settings.

## 6. Water: tank, pressure, flow, pump

Two modules read the water side, both on the same RS-485 cable as the meters and both approved models: the
**4 to 20 mA module** (Waveshare Modbus RTU Analog Input 8CH, unit number 3) reads the level, pressure and flow
transmitters, and the **pump contact module** (Waveshare Modbus RTU IO 8CH, unit number 5) reads whether the pump
runs. Greecon sets their numbers at the office; on site you check the labels.

**A 4 to 20 mA loop.** A two-wire transmitter takes its power from the loop, so it needs a **24 V supply in series**
with the module's input; **the electrician wires it as the module's manual draws it**. The maker does not say that
this module supplies the loop, so the loop has a supply of its own:

```
 24 V DC +  ───►  transmitter (+)
 transmitter (−) ─► module input channel (+)
 module channel (−) ─► 24 V DC −
```

- **Each transmitter has its own input:** the level transmitter on **input 1**, the pressure transmitter on
  **input 2**, the flow meter on **input 3**.
- **Leave the module's inputs in their default 0 to 20 mA mode, on purpose.** A 4 to 20 mA transmitter then reads
  **4000 to 20000 microamps**, and a wire that has come off reads **0**, which is below the 4 mA of an empty tank, so
  Greecon can see it and say so ("cannot be a tank level"). In the module's own 4 to 20 mA mode a broken wire might
  read like an empty tank. Use the version of the module that reads current, not the one that reads voltage.
- **Ranges from the labels.** The range of each transmitter is printed on its label, and that is all the setup list
  asks for, in the label's own words. Greecon works out the register and the scale: nobody types a register or a
  conversion.
  - **Level transmitter:** the range on the label (a 0 to 5 m transmitter: 5), its unit (metres, or bar for a pressure
    sensor hung at the bottom of the tank: a bar holds up about 10.2 m of water) and how tall the tank is inside, from
    the bottom to the top of the water when it is full (say 4, in metres). Greecon shows the level as a percentage of the tank: 4 mA
    is empty (0), and a full tank is 100. A 0 to 5 m transmitter in a tank 4 m tall reads 100 at 16.8 mA, and 125 at
    the top of its range (5 ÷ 4 × 100). A transmitter shorter than the tank is refused: it cannot see the top of the
    water.
  - **Pressure transmitter:** the top of the range in bar (0 to 10 bar is usual).
  - **Flow meter:** the top of the range in litres a minute.
  - A transmitter the site does not have: tick **Not fitted at this site**. Greecon asks first: the reading and its
    history are removed.
- **Check the module with a loop calibrator** (a hand-held that sends 4, 12 and 20 mA in place of a transmitter): read
  the module from the box with `greecon-edge modbus-test --host 192.168.1.50 --unit 3 --type input --address 0` (the
  address is 0 for input 1, 1 for input 2, 2 for input 3). It must read 4000, 12000 and 20000, and Greecon then shows 0,
  half the range and the whole range. On the tank's input the whole range reads more
  than 100 when the transmitter is longer than the tank (125 in the example), and Greecon may call that impossible
  while you test: that is the test, not a fault.
- **Tank level:** the transmitter hangs at the **bottom** of the tank (so that zero is empty), its vented cable
  fixed so that it cannot move. **Only a transmitter with wetted parts approved for drinking water goes into a
  drinking-water tank.** A cheap sensor of unknown material is not worth a contaminated tank. If unsure, use a
  **non-contact ultrasonic sensor** above the water instead.
- **Pressure:** on the pipe through an isolating valve, so that it can be removed without draining. A
  plumber does the wet connection.
- **Flow:** an electromagnetic or turbine meter in the pipe with a 4 to 20 mA output, installed straight-run as
  its manual says. Without it, or without the pump's running contact (next point), "the pump is running but no
  water is flowing" cannot be raised, and the site should say so in its handover.
- **Pump running:** a **spare auxiliary contact** of the pump's starter, wired by the electrician to **input 1** of the
  pump contact module as a dry contact, as the module's manual draws it (the module's DI COM is left unconnected).
  Never to a control circuit, and **never to the module's relay outputs**: the contact **only reports**. Check it by
  eye: with the pump running, Pump running must read 1; stopped, 0. If it reads the other way round, the contact is
  inverted: the electrician uses the other contact of the starter. The module is optional: a pump whose starter has no
  spare running contact has none, and then the site removes it from the list.

## 7. Farm sensors

A **soil moisture probe** and a **temperature and humidity sensor** that speak **RS-485 Modbus RTU** go on the
same cable as everything else, each with its own unit number: **soil probe 6, weather sensor 7** (set it before the
probe is buried or the sensor mounted). They are not approved models: Greecon does not know their registers and the
box cannot recognise them on a network, so their address is entered by hand and each reading is mapped by hand, from
the maker's register table, which decides the register, the kind of number and the scale. **Write down the probe's depth and where
it is.** Soil readings mean little without it. Greecon gives no irrigation advice until the grower's value for
"start irrigating below" is entered.

## 8. The network

| Situation | What to do |
|---|---|
| **The customer's network** | Box and converter on the router. Ask for a fixed address (a reservation) for the converter. The box needs only **outgoing HTTPS (443)** to `api.greecon.earth` (and to `nodejs.org` at install) and a time service (UDP 123). When someone presses **Find equipment**, the box looks at the site's own network for about a minute: it tries port 502 (or the port the person gives) on the private addresses of that network, such as 192.168.x.x and 10.x.x.x, only reads, and never writes to anything or looks outside the site's network. The install card has the words for the customer's network administrator. |
| **Cellular** | A 4G router with a data SIM; box and converter plug into its sockets. **Plan for about 1.5 GB a month.** That assumes a hotel-size site (four devices, seven readings) sending one request every ten seconds, about 5 KB each with its headers (about 1.3 GB), plus a heartbeat every 30 seconds (about 0.15 GB); a site with more devices sends more. It is an estimate: read the router's counter after a week and write the real figure here. Choose a plan of 5 GB or more. |
| **No internet at all** | Not sold. The box keeps about three days (for a site of up to about thirteen devices), which is for outages, not for a site that is never connected. |

**Keep the box and the converter on separate addresses from the customer's own equipment where you can,** and
never on a guest network.

## 9. Power

- **One 24 V DIN supply** feeds the two modules, the loop transmitters and (through a small DC adapter, if the
  box takes 12 V) the converter; the box takes 24 V directly if it accepts 9 to 36 V.
- **A UPS** keeps the box and the converter up through short cuts and long enough to say that the grid is down.
  **When the grid is down, a meter powered from the grid dies with it.** That is expected: the box is alive and
  says the devices do not answer, which is the honest picture ("we cannot tell"), not a fault in Greecon.
- **Auto power-on** in the BIOS (section 3) is what brings the box back after the UPS runs flat.

## 10. Enclosure and labelling

One IP54 box (IP65 if outside) holding the converter, the two modules (the 4 to 20 mA module and, where there is one,
the pump contact module), the supply, the fuses, the terminal blocks and, if there is room, the box. **Label**
everything: the unit number on each device (set at the office) and the settings on the converter, the wire numbers at
both ends, and the site name and the date on a sticker inside the lid. Never write a code or a
password on the box. **Photograph** the inside before closing.

## 11. The project manager's tools

A laptop; a USB-to-RS-485 adapter (to number a module or a probe, and to talk to one device alone); a **loop calibrator** (or a 4 to 20 mA source); a
multimeter; screwdrivers (slotted and Phillips, small and medium); wire strippers and a ferrule crimper; a
network cable tester; cable ties and labels; a head torch; spare fuses and terminals; a phone for photographs.
**You do not need a tool for work inside a live board: that is the electrician's.**

## 12. Buying

1. Ask three suppliers for a quote. For the approved models (the two Eastron meters and the two Waveshare modules)
   the model is named, and a look-alike is not the same part; for everything else it is **the specification**, not the
   brand. Keep the quotes.
2. Buy **one kit**, bench-test it (rehearsal), and fix the specification where it failed.
3. Then buy five. For each part keep: the make and model, the supplier, the date, the serial number or the
   batch, and the invoice. A spreadsheet is enough: `hardware-register`.
4. **Do not buy** a meter or a module that is not an approved model, a probe or a sensor whose register table you
   have not seen, a transmitter not rated for the fluid, or anything with a wireless link to the board that you
   cannot inspect.

## Sources for the planning figures

Seen in October 2026, not quotes: Waveshare RS-485 to Ethernet converters, about EUR 25 to 60, and a
look-alike at USD 45 ([Electrokit](https://www.electrokit.com/en/rs-485-till-ethernet-din-skena), [Botland](https://botland.store/uart-rs232-rs485-converters/24478-rs485rj45-converter-tcpip-to-serial-port-waveshare-20978-5904422385866.html));
Eastron SDM630MCT V2 from about GBP 75 to 150 ([Bimble Solar](https://www.bimblesolar.com/EnergyMeter-3-phase-SDM630MCT));
Waveshare 8-channel Modbus analog input module, about USD 25 to 36 ([Waveshare](https://www.waveshare.com/product/iot-communication/modbus-rtu-analog-input-8ch.htm));
Teltonika RUT241 4G router, about EUR 150 to 200 ([Pricerunner](https://www.pricerunner.se/pl/168-3393853924/Routrar/Teltonika-RUT241-Industrial-LTE-Wireless-Router-priser));
WIKA pressure transmitters, GBP 129 and up ([RS](https://uk.rs-online.com/web/p/pressure-sensors/7255948)); level transmitters from about
USD 28 (unverified quality) to over GBP 900 ([RS](https://uk.rs-online.com/web/p/level-sensors/2689328));
fanless N100 mini PCs from about USD 112 in bulk to over USD 400 retail, with the real-time clock *not stated* by
the listings: ask the vendor ([Newegg](https://www.newegg.ca/p/1VK-02CN-00004)).
The Eastron register tables and defaults are in the maker's own manuals (the SDM630 Modbus protocol
document and the SDM230 user manual V1.6): read the one that came with the meter before relying on this page,
because versions differ. The planning figure for the pump contact module (30 to 60) is the earlier figure for a pump
run input: it has not been checked against a shop price for the Waveshare Modbus RTU IO 8CH. The registers of both
Waveshare modules are from the maker's published tables and have not been tried on real hardware, so the first real
kit is rehearsed on a desk and anything that differs is reported to Greecon.
