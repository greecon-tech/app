# 02. Project manager manual

**For:** the project manager who surveys, installs, commissions and hands over each site, and then looks after it.
**Read with:** [03 Hardware and wiring](03-hardware-and-wiring.md) (what to buy and how it is connected) and
[05 Runbooks](05-runbooks.md) (when something is wrong).

You are not expected to be an electrician or a programmer. You are expected to be careful, to write things
down, and to say "I do not know yet" instead of guessing. Greecon is built so that nearly everything you do is
a form with a plain-words check beside it, and so that the platform tells you when something is not done.

---

## The rules that never bend

1. **Greecon only reads.** It measures; it never switches anything. Never connect a wire from Greecon's equipment
   to a pump starter, an inverter's control, a valve or any safety circuit. Nothing in this platform can command
   equipment, and nothing you install may be made able to.
2. **Anything inside a distribution board is the electrician's work.** Clamping current transformers around
   live conductors, taking voltage for a meter and connecting a pump's run contact are done by a qualified
   electrician, under the customer's lock-out procedure, with you watching and writing it down. You do the
   low-voltage part: the box, the network, the converter, the data cable between meters, the 4 to 20 mA
   signal wires, the 12 or 24 volt supply from a plug-in supply.
3. **Never touch the solar panels' wiring (DC), a tank you must climb into, wastewater, or chemicals.** The
   customer's own staff or installer does that. If the only place for a sensor is there, say it is not
   possible and write why.
4. **Greecon is not a safety system.** Say so every time, in the words in the sales kit. The protection already in
   the customer's equipment (float switches, relief valves, trips) stays the safety layer.
5. **Never promise a saving, a percentage or "AI".** Say what Greecon measures and shows. The product shows
   what the customer's own solar kept on site, at the customer's own prices, from real readings. That is the claim.
6. **Write everything down at the time.** Photographs of every meter's label and display, the wiring before you
   close the board, the converter's settings, the box's label.

---

## 1. What you work with

| Thing | What it is |
|---|---|
| **Your login** | Your own, from the founder. Sign in at `https://app.greecon.earth/login` and choose **Greecon team**. You are asked for a password of your own the first time. Never share it. |
| **Clients** (the console) | Where you see requests, onboard a customer, open their account to set it up, and see every site's state in **Sites across clients**. |
| **The setup list** | One page per site (`Set up <site name>`) that shows ten steps, what is done, what is next, and what to do. Most steps turn **Done** by themselves when the platform sees them work. A few only a person can check. |
| **The box** | A small computer at the site. It reads the meters and sensors and reports to Greecon. One pasted line installs it. |
| **The converter** | A small unit that puts the meters' cable (RS-485) on the network so that the box can reach them. |
| **The handover sheet** | One printable page per site: where everything is, who is told, who commissioned it and when. |
| **The pretend meter** | A program for your laptop that pretends to be meters, for practice: [Rehearsal](#13-rehearsal-the-whole-job-on-a-desk). |

## 2. The whole path of a customer

| Stage | What happens | Who | Time |
|---|---|---|---|
| 1. First call | Discovery questions ([04](04-sales-kit.md)). Decide: worth a visit? | You | 20 min |
| 2. Survey visit | Look at the site, fill in the survey form, take photographs, agree what is measured | You (and the electrician if the plan needs one) | 1 hour |
| 3. Order form | The customer signs the pilot order form ([04](04-sales-kit.md)); the pilot fee is paid | Founder or you | |
| 4. Prepare in Greecon | Onboard the customer, make the site from the template, add the box (steps 4 to 6 below) | You, at the office | 30 min |
| 5. Prepare the kit | Install the software on the box at the office, test it against the pretend meter, label it, pack it | You | 2 hours |
| 6. Install day | Mount, wire, connect, power up | You and the electrician | 4 to 6 hours |
| 7. Commission | Check every number against the real world; confirm the steps only a person can; commission | You | 1 hour |
| 8. Handover | Print the sheet, show the owner the morning message and an alert, sign | You | 30 min |
| 9. Look after it | Day 1, 3 and 7 checks, then the morning check ([05](05-runbooks.md)) | You | 5 min a day |
| 10. Day 60 | Decision meeting with the owner, against the three written goals | Founder and you | 1 hour |
| 11. Day 90 | Convert (order hardware, start the monthly fee) or remove the kit | Founder | |

## 3. Survey visit

Bring: this manual, the survey form below, a phone for photographs, a tape measure, a torch, a notebook. No tools
are needed to survey; do not open anything.

**Ask, in this order** (the answers decide what is measured and what it costs):

1. Who decides, and who gets called at night? (Names, mobile numbers, emails: these become **Who is told**.)
2. What went wrong in the last twelve months that cost money or a guest? (Write it in their words. It is the reason they buy.)
3. The last twelve electricity bills (price per kWh, kWh bought each month) and the water bills. (The platform
   shows what solar kept on site at *their* price; without a price it shows kWh only.)
4. Is there solar? What brand is the inverter and where is its AC output? Is it allowed to send energy to the grid?
5. Where does the supply enter the building? Is it three-phase?
6. Where are the water tank, the pump and its starter? How tall is the tank? What is the pipe's pressure?
7. Is there a network socket in the plant room, or cellular signal? (Look at your phone there.)
8. Is there a power socket for the box, and is it on a circuit that stays on?
9. Who is the customer's electrician, and can they be there on install day?

**Look at, and photograph:**

- The supply entry and the main board (closed): where a meter could be fitted with the clamps around the incoming phases
- The inverter and its AC output cable
- The tank, the pump, the starter, any existing level or pressure gauge and flow meter
- The place for the box: dry, 30 cm free, no heat, within reach of a socket and a network cable
- The route for the data cable from the board to the box (under 100 metres; note any crossing of power cable)

**Go or no-go.** Go if: there is a way to the internet (cable or cellular), a socket that stays on, a safe place for
each meter, an electrician for the board work, and a person who answers when called. **No-go, politely, and
write why,** if: the only place for a sensor is unsafe to reach, the customer wants something switched or
controlled, or there is no responsible person to receive alerts.

**Survey form (one per site; a page in the shared drive):**

| Field | Answer |
|---|---|
| Customer, site name and address, date | |
| Contact: name, mobile, email (first, second, third to be told) | |
| What went wrong last year (their words) | |
| Template: Hotel / Solar and grid / Farm / Water station | |
| Supply: single or three phase; main breaker size (A) | |
| Inverter brand, size (kW), AC output cable location | |
| Tank: height (m), water source, pump (kW), starter location | |
| Meters needed (grid, solar, load, pump) and where | |
| Sensors needed (level, pressure, flow, pump running) and where | |
| Network: customer's cable or cellular; router brand; who can give an address | |
| Power for the box: socket location | |
| Electrician: name, mobile, day | |
| Photographs taken (list) | |
| Go / no-go, and why | |

## 4. Prepare in Greecon (at the office)

You can do all of this before you set foot on site, and it makes the install day shorter.

1. **Sign in** with **Greecon team**. You land on **Clients**.
2. **If the customer asked through the web page:** their request is listed under **Requests**. Click **Onboard**
   (it fills in the form from their request). **Otherwise,** use **Onboard a new client** (below Requests):
   company name, owner's name, owner's email. Click **Onboard client**.
3. A box appears: **Client onboarded: save this password now.** That is the owner's temporary password. It is
   shown **once**. Write it on the handover page, or tell it to the owner by phone. Do not send it by email.
   The owner signs in at `https://app.greecon.earth/login` with **Client login**, and chooses a password of their
   own straight away.
   - If a message says someone already has an account with that email, the person is already a customer. Do not
     use a different address to get round it: add the new site to the customer they already have.
4. In the customer's row, click **Open for setup**. A banner appears at the top: *You are in <customer> as Greecon
   staff, setting it up.* Everything you do from now is recorded under your own name in their audit trail. You
   cannot add people to their account or reset their passwords while inside; their owner does that.
5. You land on **Admin**. Under **New site from a template** choose **What kind of site**:
   - **Hotel or guesthouse**: water tank and pump, solar, grid. The usual first site.
   - **Solar plant with grid connection**: solar and grid, with an optional battery and load meter.
   - **Farm or greenhouse with irrigation**: soil probe and weather, with the water supply behind it.
   - **Water tank and pump station**: tank, pump and the pump's electricity.
   - **Empty site**: nothing assumed. Use only when none of the above fits.

   The page lists what the template will contain. Enter **Site name** and **Where it is**, and click
   **Create the site and start setting it up**.
6. You land on **Set up <site>**. It says `0 of N steps done`, and highlights what comes next: **Install the box**.
7. Click **Add the box and get its install command**. A line appears, beginning `curl -fsSL https://api...`
   ending in a code like `GRC-XXXX-XXXX-XXXX`. **Copy it** (there is a copy button). It is shown once. The
   code works **once**, for **seven days**. Click **I have copied it**.
   - The code is the box's key. Anyone with the line can install a box as this site until it is used or expires.
     Treat it like a password: not in email or chat; paste it straight into the box.
   - Lost it, or the seven days passed? On the same step, press **Install a box, or replace this one**. It asks you to
     confirm, then shows a new line. A new code replaces the old one, and a box already installed with the old one
     stops working.

## 5. Prepare the kit at the office

Do the install of the box's software at the office, on your desk, so that the site visit is only plugging in.

1. Install the operating system on the box: **Debian 12, Ubuntu 22.04 or later, or Raspberry Pi OS 64-bit**, with
   the SSH server on (you will use it from your laptop on the site's network; nothing can reach it from the
   internet), one user, a strong password, and the time zone set to Europe/Tirane.
   ([03](03-hardware-and-wiring.md) says which box to buy.)
2. Connect the box to your office network and open a terminal on it (a keyboard and screen, or SSH).
3. Paste the install line from step 4.7. It begins with `curl` and ends with the code. **Paste it exactly.** It does
   about a dozen things and tells you each one as it goes: checks the box, checks it can reach Greecon, checks the
   clock, installs the software and gives the box its own credential. It finishes with:

   ```
   Done. Greecon can see this box. On the site's setup page, give each device its address;
   ```

4. In Greecon, refresh the setup page. **Install the box** now says **Done**, with the box's name, its version and
   "Heard from N seconds ago". You did not click anything to make it so: the platform saw the box.
5. Label the box with the site name and the date, and pack it.
   - The box keeps its credential when it is moved. Unplug it, carry it to the site, plug it in: it reports from
     the new place without anything being typed again.

**If the line stops with `STOP:`** it says what to check and how. Fix it and run the same line again: it is safe
to repeat. The commonest are: the box cannot reach Greecon (no internet, or a firewall that blocks outgoing
HTTPS on port 443), a clock that is wrong, or a code already used or older than seven days.

## 6. Install day

**Order of work.** The electrician and you work at the same time, in this order, so that nobody waits.

| | Electrician | You |
|---|---|---|
| 1 | Walk the site with you; agree where each meter and sensor goes; apply the lock-out | Walk with them; photograph before |
| 2 | Fit the grid meter and the solar meter in the board: voltage connections with their fuses as the meter's manual says, the current clamps around the incoming phases, **arrow towards the site** | Mount the box, the converter and the 12 or 24 V supply on a shelf or rail; run the data cable from the converter to the first meter |
| 3 | Connect the pump's run contact to the input module; fit the level and pressure transmitters (a wet part: only the electrician or the customer's plumber) | Connect the 4 to 20 mA signal wires to the input module; the module's 24 V supply |
| 4 | Remove the lock-out only when you both agree the work is closed up | Set each meter's address, speed and parity from its display ([03](03-hardware-and-wiring.md), "Meter settings") and write them down |
| 5 | Stay until commissioning is done | Set the converter to **Modbus RTU to TCP** mode with the same speed and parity; connect it and the box to the network; power up |

**Meter settings are read from the meter's own display, never assumed.** Different makers, and different
versions of the same meter, are delivered with different defaults (the Eastron SDM630 is 9600 baud, and the
SDM230 can be 2400). Every meter on one cable must use the **same speed and parity** and its **own unit number**.
Write the unit numbers on the converter's label: grid meter 1, solar meter 2, water module 3 is a good habit
(it is what the rehearsal uses).

**The network, whichever way it comes:**

| Situation | What you do |
|---|---|
| **The customer's cable and router (best)** | Plug the box and the converter into the router. Ask the customer's IT person (or the router's page) to give the converter a **fixed address** that the router will not change (a "DHCP reservation" on the converter's MAC address, or a fixed address outside the router's range). Write it down: you enter it in step 7.5. The box can take any address. |
| **A fixed address you set yourself** | Set the converter's own address in its web page, on the same range as the router. |
| **No usable internet (cellular)** | Fit the cellular router from the kit with a SIM, plug the box and the converter into **its** sockets. Greecon supplies the SIM, charged at cost. Check the signal where it sits. |
| **A firewall** | The box needs only **outgoing HTTPS (port 443)** to `api.greecon.earth` and, when it is installed, to `nodejs.org`, plus the time service (port 123 UDP, or the box's own). Nothing needs to come in. |

**Before leaving the board:** photograph the meter's label (model and serial number), its wiring, its display
showing the address and speed, and the converter's settings page.

## 7. The setup list, step by step

Open the site's setup page. Each step is a card. A step opens to show its detail, and stays as you leave it.
A step is **Done** (a tick and the word), **Next**, **Waiting** for another step, or needs **Attention**. The
platform works most of them out by itself; you only press buttons for what a person must check.

**7.1 Prices from the customer's bills** *(optional, but it is what turns kWh into euros)*

Open **Prices and baseline** on the site's page (the step has the link). Enter: currency; the electricity price
per kWh from the latest bill; what is paid for energy sent to the grid (blank if nothing); the water price per m³;
"a typical month before": the kWh bought and the m³ of water from last year's bills (this is what the platform
compares with; **without it no comparison is shown**, which is correct); where those numbers came from; whether
the site **cannot send energy to the grid** (tick it if the plant is zero-export); and the time zone
(`Europe/Tirane`). **Save.**

**7.2 Install the box.** Done by itself once the box reports ([step 5](#5-prepare-the-kit-at-the-office)).
If the box says **Late** or **Offline**, it is not reaching Greecon: see "The box does not report" below.

**7.3 Where each device is on the network.** One small form per device ("Address of Grid meter"): **IP address**
(the converter's address), **Port** (502 unless the converter's page says otherwise) and **Unit number** (the
number you gave the meter). Meters behind **one converter share its IP address and differ only by unit number.**
**Save.** A wrong address is refused in words (`The address must be an IP address such as 192.168.1.50`). The
box picks up a change **within a minute**.

**7.4 Which register holds which reading.**

- For equipment Greecon knows (the Eastron meters in the template), the registers are already filled in.
  Check them against the meter's manual only if the reading looks wrong.
- For anything else (the water input module, the soil probe, a battery): one form per reading ("Register for
  Tank level"). Open it and fill:
  - **Register kind**: **Input** for a manual's 3xxxx, **Holding** for 4xxxx.
  - **Address**: counted from zero, so a manual's **30053 is address 52**, and 40001 is address 0.
  - **Kind of number** and, for two-register numbers, **which half comes first** (the usual is the high half first).
  - **How it becomes the reading**: **Multiply and add** (a meter that reports watts for a reading in kW:
    multiply by 0.001), or **A straight line, such as 4-20 mA**:
    **Signal at the bottom / top** are what the module's register holds at 4 mA and at 20 mA (read them from
    its datasheet and **check them with a loop calibrator**, [03](03-hardware-and-wiring.md)); **Reading at the
    bottom / top** are the reading's own values at those signals.
  - **Which part of the value**: "Only when positive" and "Only when negative, as a positive number" split a
    meter that reports import as positive and export as negative into two readings (the templates do this
    for you).
  - **Save the register.**
- **Tank level in percent from a transmitter** whose range is longer than the tank is high (say 0 to 5 metres on
  a tank 3 metres high): reading at the top = **range ÷ tank height × 100 = 166.7**. At the tank's full height
  the reading is then 100.
- **Test any register before relying on it**, from the box:

  ```
  greecon-edge modbus-test --host 192.168.1.50 --unit 1 --type input --address 52 --data-type float32
  ```

  prints the raw numbers and the value. If it prints `Could not read`, the problem is the wiring or the
  settings, not Greecon.
- A reading the site does not have (a flow meter that was not fitted; a battery that does not exist): go to
  **Sites**, open the site, find it under **Devices** or **Readings**, and **Delete** it. A reading with no
  register holds the list at this step.

**7.5 Every device answers the box.** Done by itself. Each device shows **ok** or **not ok**, and for a failure
the reason in words ("no answer from 192.168.1.50:502 (unit 2)"). A wrong **unit number** is the commonest cause,
then a wrong **speed or parity** at the converter, then **A and B swapped** on the meter cable.

**7.6 Readings arrive and look right.** Done by itself when each reading has arrived, in a believable range. A
reading that cannot be real (a tank of 400 percent) says so, which is almost always a wrong scale, a wrong
register or a wiring fault.

**7.7 Someone is told when the site needs attention.** Open **Who is told** (the step has the link):

- **Add a person** for each name from the survey, **in the order they should be told.** Each needs an email, a
  mobile number **with its country code** (`+355 69 123 4567`), or both. The first person hears first.
- **Save the list.** Then, beside each person, **Send a test message.** It says what happened to the email and
  to the text ("Accepted for delivery to +355 ••• ••• 567. Ask Besa whether it arrived.").
- **Ask each person** whether it arrived: in the inbox, not in spam; on the phone.
- Back on the setup page, write what you saw if you like, and press **I checked this.** It is greyed out until the
  list has someone on it and a test has been sent, because a site nobody is told about must not be commissioned.

How alerts reach people, for the owner (say this at handover, in these words): **Act now** goes by email at once
and by text ten minutes later if nobody has acknowledged it, then to the next person after thirty minutes.
**Check today** is one email, held until morning if it is night. Nothing else is sent, apart from one morning
message (07:30) saying whether everything is all right. Quiet hours (22:00 to 07:00) hold everything except Act now.

**7.8 Grid meter direction checked** *(only on sites with a grid meter and solar)*. Greecon cannot see which way
the meter's clamps point. A reversed clamp swaps what the site buys with what it sells, and every figure with it.
**With the sun down or the solar switched off, switch on a known load** (a kettle or a heater). **Grid import must
go up.** If **Grid export** goes up, the clamps are the wrong way round: the electrician turns them (with the lock-out
on), you check again. Then press **I checked this**, with a note of what you saw.

**7.9 Alert limits agreed with the customer.** The step lists each reading that has limits, with what applies. The
standard ones: tank **Critical below 15 percent** (an Act now alert), **Low below 35 percent** (a Check today
alert); battery **Low below 25 percent**. Other limits have no standard value, and the platform then says
nothing rather than guess (irrigation advice, solar surplus, "no flow at or below"). **Go through them with the
customer.** Change any that do not suit the site on the site's page (**Alert limits**), then press **I checked this.**
Agree numbers the customer would act on: an alert nobody acts on trains people to ignore the next.

**7.10 Commissioned.** Greyed out until everything above is done. Then it says: *On site, compare what Greecon
shows with what you can see: the meter's own display, the tank, the pressure gauge. When they agree, confirm
here.* Do the checks for the site's kind in [section 9](#9-commissioning-checks-by-kind-of-site). Press **Commission this site**,
with a note. The progress line then reads **Commissioned.**, and your name and the date are on the handover sheet.

## 8. The four kinds of site

### A. Hotel or guesthouse (the usual first site)

**What it is:** water tank and pump, solar on the roof, and the grid. **What is measured:** grid import and
export (one three-phase meter at the supply entry), solar production (one three-phase meter on the inverter's
AC output), tank level, line pressure, pump flow, pump running.

**Bring:** two Eastron SDM630 meters with current clamps, an RS-485 to Ethernet converter, a Modbus input module
with its 24 V supply, a level transmitter and a pressure transmitter (and a flow meter if the owner wants
dry-run protection), the box, a small UPS, cable, DIN rail and enclosure ([03](03-hardware-and-wiring.md)).
**Ask the customer for:** twelve electricity bills, the water bills, the people to tell.

**Wiring in one picture:**

```
 supply entry            inverter AC output           tank & pump room
 ┌────────────┐          ┌────────────┐               level ── 4-20 mA ─┐
 │ SDM630     │          │ SDM630     │               pressure ─ 4-20 mA ┼─► I/O module ─┐
 │ GRID  (1)  │          │ SOLAR (2)  │               pump run contact ──┘     (3)       │
 └─────┬──────┘          └─────┬──────┘                                                   │
       └───────── RS-485 (A, B, ground; daisy chain) ──────────────────────────────────────┤
                                                                                           ▼
                                                  converter (RTU→TCP) ── network ── BOX ── internet
```

**Set up in Greecon:** template **Hotel or guesthouse**. The meters' registers are known. Map the water module's
four readings (7.4); tank level in percent with the range ÷ height rule; pressure with a straight line; pump
running from its input. Prices (7.1) so that "your solar kept N kWh on site, worth about X at your price of Y"
can be said.

**Agree with the owner:** the tank limits (the standard 15 and 35 percent are a start: a tank that feeds a
fifty-room hotel on a hot day should alert earlier), who is told for water and who for electricity, and what
"Act now" at 02:00 means for them.

**Typical problems:** the solar meter reading zero at midday (a closed clamp on the wrong cable, or the inverter
is zero-export limited); the level reading wrong (a vented cable blocked, or the transmitter not at the tank's
bottom); the pump-running contact inverted (reads running when stopped).

### B. Solar plant with grid connection (with an optional battery)

**What is measured:** solar production (inverter AC output), grid import and export, optionally the site's own
consumption (a load meter) and a battery's charge and power. It works **with any inverter brand**, because it
measures at the AC cable with its own meter and not through the inverter maker's portal.

**Bring:** two or three SDM630 meters (grid, solar, optional load), converter, box, UPS. For a battery: the
maker's Modbus register table (without it the battery is left out; do not guess registers).

**Ask the customer:** the electricity price, **what is paid for energy sent to the grid, if anything**, and whether
the plant is **allowed to send energy to the grid** (if not, tick *This site cannot send energy to the grid*
in prices). Twelve bills.

**Set up:** template **Solar plant with grid connection**; delete the battery and load meter if not fitted (7.4).
Do the direction check with care: on a plant that exports at noon, do it at night or with the inverter off.

**Commissioning:** at midday, solar production in Greecon agrees with the inverter's own display within about 5
percent, and grid export is the difference between production and what the site is using.

### C. Farm or greenhouse with irrigation

**What is measured:** soil moisture (per zone) and air temperature and humidity at the field, and the water
supply behind it (tank, pressure, flow, pump).

**Bring:** a soil probe and a weather sensor that speak Modbus RS-485 and that document their registers
(without documented registers the sensor cannot be mapped), the input module for the tank and pressure, the box,
a cellular router if there is no network in the pump house.

**Ask the grower:** which crop, which soil, how deep the roots are, where in the field is typical (not the wettest
or driest spot). **Greecon gives no irrigation advice until the grower's own "start irrigating below" value is
entered,** because that number depends on the soil, the crop and the probe's depth and nobody can set it for
them. After the first week of readings, ask the grower what reading means "time to water" and enter it as the limit.

**Write in the handover:** the probe's depth and where it is. Soil readings are only as good as the contact
between probe and soil.

### D. Water tank and pump station

**What is measured:** the tank's level, the line pressure, the pump's flow, whether it runs, and optionally the
pump's electricity use (a single-phase meter such as the SDM230).

**Ask:** what the pump does when the tank is low and when it is full, and who is told today. The pipe's pressure
range decides the pressure transmitter's range.

**Set up:** template **Water tank and pump station**. Delete the pump meter if not fitted. This is the simplest
site and a good first rehearsal.

## 9. Commissioning checks by kind of site

Compare, in this order, and write the pair of numbers on the handover.

| Check | How | Pass |
|---|---|---|
| **Every meter's display against Greecon** | Read the meter's display (kW or W) and Greecon at the same time | Within 5 percent, or 1 kW on a small load |
| **Grid direction** | A known load on, the sun down: grid import rises | Import up, export unchanged |
| **Solar at night** | Solar production | Zero, or a few watts |
| **Solar at midday** | Against the inverter's display | Within about 5 percent |
| **Tank level** | A dipstick or the sight gauge at two levels | Within 5 percentage points |
| **Pressure** | Against the pressure gauge on the same line | Within 0.2 bar |
| **Flow** | A bucket test (fill a measured volume, time it), or the flow meter's own display | Within 10 percent |
| **Pump running** | The owner starts the pump; Greecon shows running within 30 seconds | Changes both ways |
| **Soil probe** | In the air (low), in a glass of water (high), in the soil (plausible) | Three different readings |
| **4 to 20 mA channels** | With a loop calibrator, send 4, 12 and 20 mA | Reading at the bottom, the middle and the top |
| **A test message** | Each person on the list | Arrived |
| **Power cut** | Unplug the box for 30 seconds, plug it in | Back reporting within 3 minutes, and the box says nothing about readings lost |
| **Internet cut** *(the first install, and any time the box or its software is new)* | Pull the box's network cable for ten minutes, then plug it back | `greecon-edge status` shows a queue while it is out, and a few minutes after it returns the queue is empty and the readings from the gap are in the downloads. **Write the result down: it is the evidence for the statement that the box keeps its readings.** |

Do not **start, stop or open** any equipment yourself. The owner's own person does, because they know what else it affects.

## 10. Handover

1. On the setup page open **Open the handover sheet**. Check it, and print it (the **Print** button hides the menus).
   It names the customer and site, says where each device is (address, unit number, registers), who is told and
   how to reach them, what was commissioned and by whom, and how to reach Greecon (`info@greecon.earth`).
2. Show the owner, in ten minutes, in this order: the **Overview** (is everything all right, in one sentence);
   the **energy flow** moving from the solar to the site and the grid; **what the solar kept on site** this month
   (and the prices it uses); **Who is told** and a live **test message** arriving on their phone; **Reports**
   where **their data is theirs**: a file of every reading, the alerts and the account's setup can be downloaded
   whenever they want.
3. Say: *Greecon watches your equipment and tells you. The protection built into your equipment remains the
   safety layer. You will get one message each morning. If there is nothing to do, it says so.*
4. Leave: the printed sheet (signed), the box's label, a card with `info@greecon.earth` and your phone.
5. Photographs and the survey form go in the shared drive, in a folder named for the customer.
6. Press **Back to the Greecon console** (the banner's button) to leave the customer's account.

## 11. After install

| When | Do | Look for |
|---|---|---|
| **Day 1** | Open **Sites across clients**; phone the owner: did the morning message arrive? | Box online; readings current; the message reached them |
| **Day 3** | Same; look at one alert if one happened | No alert nobody understood |
| **Day 7** | Sit with the owner for 15 minutes: **was every alert useful? what would they change?** Adjust limits. | Alert count at most one a day; every one with a clear action |
| **Every morning** | The morning check email and the **Clients** page ([05](05-runbooks.md)) | A silent box, or a site that needs a look |
| **Day 30** | Short call; ask what they have done because of Greecon | One thing, in their words, for the sales story |
| **Day 60** | The decision meeting, against the three written goals: data current at least 95 percent of the time; the owner opened the morning message on at least 5 days in 7; at least one real event caught | Convert, extend by up to 30 days once, or remove |
| **Day 90** | Convert (order hardware at the agreed price; the monthly fee starts at day 91) or take the kit away within 14 days | Data exported to the customer either way |

## 12. When something is wrong

Short answers; the longer ones are in [05 Runbooks](05-runbooks.md).

| What you see | Likely cause | What to do |
|---|---|---|
| **The install line stops with `STOP:`** | The sentence says: no internet, wrong clock, code used or expired | Do what it says; run the same line again |
| **The box says Offline** | Power, network cable, or the site's internet is down | Is the box's light on? Is the router up? On the box: `greecon-edge status` and `journalctl -u greecon-edge -n 50 --no-pager` |
| **A device says not ok** | Unit number, speed/parity, A/B swapped, converter not in gateway mode, wrong IP | `greecon-edge modbus-test` against the device; check each in that order |
| **A reading is zero or constant** | A wrong register, the wrong register kind (input vs holding), a clamp on the wrong cable | `modbus-test` raw numbers against the manual's table |
| **A reading is ten or a thousand times too big or small** | A wrong scale (W against kW), or the 4 to 20 mA conversion's bottom or top | Re-enter the conversion; check with the calibrator |
| **Import and export are swapped** | The clamps are the wrong way round | Electrician turns them; repeat 7.8 |
| **The clock is out** | The box has no time service | `timedatectl set-ntp true`; the setup page names it ("its clock is N minutes fast") |
| **The test message did not arrive** | A wrong address, spam, or the number without its country code | Check the log under **Who is told** (it shows what happened); try the other way |
| **The test email arrived in spam** | The sender is new to that mail provider | Mark it not spam; ask them to add `alerts@greecon.earth` to contacts |
| **A reading went Unknown after a while** | The meter or the converter lost power or the cable came loose | The setup page says which device and why |

## 13. Rehearsal: the whole job on a desk

Do this once before the first real site, and again when anything in this manual changes. It takes an afternoon and
needs no hardware except the box (or a spare computer running Debian, Ubuntu or Raspberry Pi OS) and your laptop.

1. **On your laptop** (Node.js 22 or newer): get the repository, then
   `node scripts/pretend-meter.mjs`. It listens on port 5020 and answers as units 1, 2 and 3: a power in watts
   (input registers 52 and 12), and four water readings (registers 0 to 3). Leave it running.
   - To rehearse a plant that exports: `node scripts/pretend-meter.mjs --watts -1800`. To rehearse a low tank:
     `--tank 12`.
2. In Greecon, onboard a client named **Rehearsal** (use your own address as the owner), open it for setup, and
   make a site from the **Hotel or guesthouse** template.
3. Add the box, copy the line, and paste it on the box ([section 5](#5-prepare-the-kit-at-the-office)). Watch **Install the box**
   turn **Done**.
4. Give each device the **laptop's address**, **port 5020**, and **units 1, 2 and 3** (grid meter 1, solar meter 2,
   water module 3). The meters' registers are already filled in. Map the water module's four readings, **Input**
   registers 0 to 3, each **Multiply and add**: tank level multiply by **0.1**, pressure by **0.01**, flow by **0.1**,
   pump running by **1**. (The pretend meter holds tenths of a percent, hundredths of a bar, and so on, as a real
   module would hold a signal that must be converted.)
5. Watch every step turn **Done**. Then add yourself under **Who is told**, send a test message, and confirm
   the steps that need a person. **Commission** the rehearsal site.
6. Stop the pretend meter. After about five minutes **Sites across clients** says the readings are out of date and
   the box says a device does not answer. Start it again with `--tank 12`: **Tank level is critical** (12 percent is
   below the 15 percent limit) is an **Act now**. It arrives by email at once and, if you added your number, by text ten
   minutes later unless you **Acknowledge** it on the **Alerts** page, which then tells the people who were
   told who took it.
7. Print the handover sheet. Download the readings from **Reports**. Open the file in a spreadsheet.
8. Delete the rehearsal client's site when finished (or suspend the client from **Clients**) so that it does not
   appear in the morning check.

**If a step in this manual does not match what you see, fix the manual** (it is a file in `docs/launch/`), or
tell the founder. It is meant to be corrected by the person who uses it.

## 14. Words used here

| Word | Meaning |
|---|---|
| **Box** | The small computer at the site that reads devices and reports to Greecon |
| **Converter** | Puts the RS-485 cable on the network (Modbus RTU to TCP) |
| **Modbus** | The language most meters and modules speak. A device has a **unit number** and **registers** |
| **Register** | A numbered place in a device that holds one value. **Input** registers are read-only, **holding** can be written (Greecon never writes) |
| **Clamp / CT** | A ring that goes around a cable and tells the meter how much current flows |
| **4 to 20 mA** | A signal wire: 4 mA means the bottom of the sensor's range, 20 mA the top |
| **Commissioning** | Checking that what the platform shows matches the real world, once, on site |
| **Act now / Check today** | The two kinds of alert that reach a person. Everything else is only shown |
