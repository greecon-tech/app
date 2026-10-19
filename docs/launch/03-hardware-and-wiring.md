# 03. Hardware and wiring

**For:** the project manager (what to buy, how it fits together) and the electrician (what Greecon needs from them).
**Read with:** [02 Project manager manual](02-project-manager-manual.md).

The aim is the cheapest way to run **many** sites for **many** years: the same few parts everywhere, bought by
specification and not by brand, prepared at the office, installed in an afternoon, and replaceable by anyone
because nothing about a box is special. Greecon's software puts no limit on which make you use; it speaks
two standard languages (Modbus over the network, and a wire signal of 4 to 20 mA through a Modbus module), so
parts can be swapped when a maker stops selling one.

> **How far to trust the prices below.** They are planning figures from public shop prices seen in October 2026
> and from the vendors' own pages (listed at the end), not quotes. Replace them with real quotes in the first
> week, and keep the quotes in the shared drive. Part numbers are examples of a *kind* of part; the
> specification column is what matters.

---

## 1. Rules of thumb

1. **One of each first.** Buy one full kit and bench-test it ([02, Rehearsal](02-project-manager-manual.md#13-rehearsal-the-whole-job-on-a-desk))
   before buying five. Change the specification, not the kit, when something fails.
2. **Read-only, always.** No relay output, no control wire, no write. Everything here only measures.
3. **Meters and sensors that publish their registers.** If the maker will not give the register table, do not
   buy it: it cannot be mapped honestly.
4. **Everything powered from one clean place,** on a UPS, in one enclosure, labelled.
5. **Pre-stage at the office:** the box has its software installed and tested before it leaves.
6. **Same settings everywhere:** unit numbers (grid 1, solar 2, water module 3, optional load/pump meter 4), speed
   9600, no parity, the converter on port 502. A new site then looks like the last one.

## 2. The standard kits

Four kits cover the four kinds of site. **Optional** items are marked. Costs are **planning estimates** in EUR,
excluding VAT and installation labour.

### Kit H: hotel or guesthouse (water, solar, grid)

| | Item | Specification | Qty | Estimate |
|---|---|---|---|---|
| 1 | **Box** | Fanless x86 mini PC (see section 3), 8 GB, 128 GB or more SSD or eMMC, 12 to 24 V DC input | 1 | 180 to 300 |
| 2 | **Converter** | RS-485 to Ethernet, DIN rail, 9 to 36 V DC, *Modbus TCP to RTU gateway mode* (section 4) | 1 | 30 to 60 (basic) or 250 and up (industrial) |
| 3 | **Three-phase meter** | Eastron SDM630 Modbus (the "MCT" version comes with three clamp-on current sensors for up to 100 A a phase); for more than 100 A, the ordinary SDM630 with 5 A current transformers | 2 (grid, solar) | 90 to 180 each |
| 4 | **Analog input module** | Modbus RTU, at least 4 channels, 4 to 20 mA, 7 to 36 V DC | 1 | 30 to 60 (basic) or 150 to 250 (industrial) |
| 5 | **Pump run input** | A Modbus RTU digital input (dry contact) module, or one spare channel of a combined module | 1 | 30 to 60 |
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

One of each: converter, input module, meter, 24 V supply, transmitter (pressure), a spare box (pre-installed, with
no code, ready to take one), network cables, a loop calibrator, a multimeter, fuses, a spare SIM.

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

**What the box does by itself:** restarts if it fails; keeps up to about three days of readings if the internet
is down and sends them in order when it returns (a long outage keeps one reading a minute so that three days
fit); takes new versions of its software from the platform and **goes back to the version before** if a new one
fails to start three times; reports every 30 seconds so that Greecon knows it is alive.

**Commands the project manager uses:**

```
greecon-edge status                       how the box is: heard by Greecon? each device ok? the queue
journalctl -u greecon-edge -n 50 --no-pager   what it has been saying
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
| Serial: speed (baud) | 9600 (the same as every meter on the cable) |
| Serial: data bits, parity, stop bits | 8, none, 1 |
| TCP: port | 502 |
| Address | A **fixed** address on the site's network (a reservation in the router, or set in the converter) |

The box keeps **one** TCP connection per converter and asks one thing at a time, so any converter will do.

**Wiring RS-485:**

```
 converter           meter 1 (grid)       meter 2 (solar)      input module 3
  A (D+) ─────────── A ──────────────────── A ───────────────── A
  B (D−) ─────────── B ──────────────────── B ───────────────── B
  GND ────────────── GND (if present) ───── GND ─────────────── GND
  [120 Ω resistor across A and B at each END of the cable, only for runs longer than about 50 m or if
   readings are unreliable at 9600 baud]
```

- **One cable, daisy chain**, from the converter to the first device, on to the next, and so on. **No branches**
  ("stars" and "tees" cause the errors that look like random failures).
- Use **shielded twisted pair**, the shield joined to ground at **one** end only. Keep it away from power cables.
- **A and B swapped** is the commonest mistake: if nothing answers, swap the two wires at the converter.
- **Every device its own unit number**, the same speed and parity. Meters are delivered with unit number 1: set
  each meter's number at its own display before it joins the cable, or two answer at once.

## 5. The meters

**Eastron SDM630 (three-phase)** at the **grid connection** (where the supply enters) and on the **inverter's AC
output**. **SDM230 (single-phase)** for one pump or a small load.

What Greecon reads: **total active power** (register 52 on the SDM630, address counted from zero, as a manual's
30053; register 12 on the SDM230), 32-bit floating point, high half first, in **watts**; it is shown in kW.
Positive power is energy coming in, negative is energy sent out. That is why **one grid meter gives both Grid
import and Grid export**, and why a clamp fitted the wrong way round swaps them (the direction check, 7.8).

**Settings to read from the meter's display before it goes on the cable** (they differ between makes and versions):
**unit number** (set a different one on each meter), **speed** (SDM630: 9600 as delivered; SDM230: depends on the
version, the V1.6 manual says 2400; set both to **9600**), **parity** (none) and the **stop bits**. On a meter with
**5 A current transformers**, also set the **CT ratio** in the meter's menu (for example 250 for a 250/5 A
transformer), **so that the meter shows the real power**; Greecon reads what the meter shows and applies only
the unit scale (watts to kilowatts).

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

**One analog input module** reads the **4 to 20 mA** signals and the pump's run contact; it connects to the same
RS-485 cable as the meters (unit number 3).

**A 4 to 20 mA loop.** A two-wire transmitter takes its power from the loop, so the loop needs a **24 V supply in
series** with the module's input, as the module's manual draws it (some modules supply the loop, some do not):

```
 24 V DC +  ───►  transmitter (+)
 transmitter (−) ─► module input channel (+)
 module channel (−) ─► 24 V DC −
```

- **Set each channel of the module to 4 to 20 mA** (many default to 0 to 20 mA or to volts; it is done in the
  module's own software or with jumpers).
- **What the register holds** at 4 mA and at 20 mA is in the module's manual (often milliamps times 1000, so 4000
  and 20000). **Check it with a loop calibrator** (a hand-held that sends 4, 12 and 20 mA): send each, read the
  register with `greecon-edge modbus-test`, write the numbers down, and enter them in the register form as the
  *Signal at the bottom* and *at the top*.
- **Tank level:** the transmitter hangs at the **bottom** of the tank (so that zero is empty), its vented cable
  fixed so that it cannot move. **Only a transmitter with wetted parts approved for drinking water goes into a
  drinking-water tank.** A cheap sensor of unknown material is not worth a contaminated tank. If unsure, use a
  **non-contact ultrasonic sensor** above the water instead. In Greecon enter the reading at the top as
  **transmitter range ÷ tank height × 100** (a 0 to 5 m transmitter in a 3 m tank: 166.7).
- **Pressure:** on the pipe through an isolating valve, so that it can be removed without draining. A
  plumber does the wet connection.
- **Flow:** an electromagnetic or turbine meter in the pipe with a 4 to 20 mA output, installed straight-run as
  its manual says. Without it, "the pump is running but no water is flowing" cannot be raised, and the site
  should say so in its handover.
- **Pump running:** a **spare auxiliary contact** of the pump's starter, wired by the electrician to a digital input.
  Never to a control circuit. The contact **only reports**.

## 7. Farm sensors

A **soil moisture probe** and a **temperature and humidity sensor** that speak **RS-485 Modbus RTU** go on the
same cable as everything else, each with its own unit number (set it before it is buried or mounted). The maker's
register table decides the register, the kind of number and the scale. **Write down the probe's depth and where
it is.** Soil readings mean little without it. Greecon gives no irrigation advice until the grower's value for
"start irrigating below" is entered.

## 8. The network

| Situation | What to do |
|---|---|
| **The customer's network** | Box and converter on the router. Ask for a fixed address (a reservation) for the converter. The box needs only **outgoing HTTPS (443)** to `api.greecon.earth` (and to `nodejs.org` at install) and a time service (UDP 123). |
| **Cellular** | A 4G router with a data SIM; box and converter plug into its sockets. **Plan for about 2 GB a month** at the standard one reading in ten seconds (that is the estimate; read the router's counter after a week and write the real figure here). Choose a plan of 5 GB or more. |
| **No internet at all** | Not sold. The box keeps about three days, which is for outages, not for a site that is never connected. |

**Keep the box and the converter on separate addresses from the customer's own equipment where you can,** and
never on a guest network.

## 9. Power

- **One 24 V DIN supply** feeds the input module, the loop transmitters and (through a small DC adapter, if the
  box takes 12 V) the converter; the box takes 24 V directly if it accepts 9 to 36 V.
- **A UPS** keeps the box and the converter up through short cuts and long enough to say that the grid is down.
  **When the grid is down, a meter powered from the grid dies with it.** That is expected: the box is alive and
  says the devices do not answer, which is the honest picture ("we cannot tell"), not a fault in Greecon.
- **Auto power-on** in the BIOS (section 3) is what brings the box back after the UPS runs flat.

## 10. Enclosure and labelling

One IP54 box (IP65 if outside) holding the converter, the input module, the supply, the fuses, the terminal blocks
and, if there is room, the box. **Label** everything: unit numbers on the converter and each device, the wire
numbers at both ends, and the site name and the date on a sticker inside the lid. Never write a code or a
password on the box. **Photograph** the inside before closing.

## 11. The project manager's tools

A laptop; a USB-to-RS-485 adapter (to talk to a meter alone); a **loop calibrator** (or a 4 to 20 mA source); a
multimeter; screwdrivers (slotted and Phillips, small and medium); wire strippers and a ferrule crimper; a
network cable tester; cable ties and labels; a head torch; spare fuses and terminals; a phone for photographs.
**You do not need a tool for work inside a live board: that is the electrician's.**

## 12. Buying

1. Ask three suppliers for the quote on **the specification**, not the brand. Keep the quotes.
2. Buy **one kit**, bench-test it (rehearsal), and fix the specification where it failed.
3. Then buy five. For each part keep: the make and model, the supplier, the date, the serial number or the
   batch, and the invoice. A spreadsheet is enough: `hardware-register`.
4. **Do not buy** a meter whose register table you have not seen, a transmitter not rated for the fluid, or
   anything with a wireless link to the board that you cannot inspect.

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
because versions differ.
