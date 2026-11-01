# 02. Project manager manual

**For:** the project manager who surveys, installs, commissions and hands over each site, and then looks after it.
**Read with:** [03 Hardware and wiring](03-hardware-and-wiring.md) (what to buy and how it is connected) and
[05 Runbooks](05-runbooks.md) (when something is wrong).

You are not expected to be an electrician or a programmer. You are expected to be careful, to write things
down, and to say "I do not know yet" instead of guessing. Greecon is built so that nearly everything you do is
a form with a plain-words check beside it, and so that the platform tells you when something is not done.

For the equipment in Greecon's kit you type no IP address, no port, no unit number and no register: the kit is made of
approved models, their numbers are set at the office, and the box finds them on the network. What you give is what only a
person can know: the range printed on a label, who signed a paper, who the electrician was, who is told. Equipment Greecon
does not sell (a soil probe, a weather sensor, a battery) is still entered by hand, and section 7 says where.

---

## The rules that never bend

1. **Greecon only reads.** It measures; it never switches anything. Never connect a wire from Greecon's equipment
   to a pump starter, an inverter's control, a valve or any safety circuit. Nothing in this platform can command
   equipment, and nothing you install may be made able to.
2. **Anything inside a distribution board is the electrician's work.** Clamping current transformers around
   live conductors, taking voltage for a meter and connecting a pump's run contact are done by a qualified
   electrician, under the customer's lock-out procedure, with you watching and writing it down. You do the
   low-voltage part: the box, the network, the converter, the data cable (you run it to the board; the
   electrician connects its ends at the meters, because the meters' terminals are inside the board), the
   labels, and the 12 or 24 volt supply from a plug-in supply. The electrician wires the 4 to 20 mA loops, with the
   24 V supply that powers them, as the module's manual draws it.
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
| **Today** and **Clients** (the console) | **Today** is where you start: the sites that need a look, the requests waiting and the sites being set up. **Clients** is where you onboard a customer and open their account to set it up. **Requests** lists who has asked for Greecon, and **Team** the people at Greecon who can open a customer's account. |
| **Search** | **Ctrl+K** (**⌘K** on a Mac), or **/**, or the **Search** button at the top of the left bar (on a phone, the magnifier at the top right) opens one box. Type a few letters of a client's name to open it, of a request to see who asked, or of a page; inside a customer's account, of a site. **Enter** opens the first result, **Esc** closes. |
| **The setup list** | One page per site (`Set up <site name>`) that shows up to twelve steps (a step that does not apply to the site is left out), what is done, what is next, and what to do. Most steps turn **Done** by themselves when the platform sees them work. A few only a person can check, and some of those ask you to write who and when: the papers, who is told, the direction of the grid meter, the limits, the electrician and commissioning. |
| **The install card** | One page for each site, linked at the top of the setup list (**The install card**): what to ask the customer and look at before the day, what to bring, what each device is set to and its number on the cable, how it is wired, the converter's settings, the cable rules, what the customer's network is asked for, the visit in order, and three messages to copy to the customer. Print it for the visit. |
| **Approved equipment** | The meters and modules in a kit are approved models: Eastron SDM630 and SDM230 meters, a Waveshare Modbus RTU Analog Input 8CH for the 4 to 20 mA transmitters, and a Waveshare Modbus RTU IO 8CH for the pump's run contact. Greecon knows their registers and settings, so nobody types them. |
| **The box** | A small computer at the site. It reads the meters and sensors and reports to Greecon. One pasted line installs it. It is also what looks for the equipment on the network when you press **Find equipment**. |
| **The converter** | A small unit that puts the meters' cable (RS-485) on the network so that the box can reach them. Greecon sets it at the office. |
| **The handover sheet** | One printable page per site: where everything is, who is told, who signed the papers, who the electrician was, who commissioned it and when. |
| **The pretend kit** | A program for your laptop that pretends to be a whole kit (two meters, the 4 to 20 mA module and the pump contact module), for practice: [Rehearsal](#13-rehearsal-the-whole-job-on-a-desk). |

## 2. The whole path of a customer

| Stage | What happens | Who | Time |
|---|---|---|---|
| 1. First call | Discovery questions ([04](04-sales-kit.md)). Decide: worth a visit? | You | 20 min |
| 2. Survey visit | Look at the site, fill in the survey form, take photographs, agree what is measured | You (and the electrician if the plan needs one) | 1 hour |
| 3. Order form | The customer signs the pilot order form ([04](04-sales-kit.md)) and the data terms are agreed; the pilot fee is paid. Nothing goes into the customer's building before both papers are done | Founder or you | |
| 4. Prepare in Greecon | Onboard the customer, make the site from the template, write down that the papers are signed, add the box (section 4 below) | You, at the office | 30 min |
| 5. Prepare the kit | Install the software on the box at the office, set the unit numbers and the converter, test the kit on the desk, label it, pack it | You | 2 hours |
| 6. Install day | Mount, wire, connect, power up; check the labels; press **Find equipment** | You and the electrician | 4 to 6 hours |
| 7. Commission | Give the ranges, check every number against the real world; confirm the steps only a person can (the electrician's name and licence number among them); commission | You | 1 hour |
| 8. Handover | Print the sheet, show the owner the morning message and an alert, sign | You | 30 min |
| 9. Look after it | Day 1, 3 and 7 checks, then the morning check ([05](05-runbooks.md)) | You | 5 min a day |
| 10. Day 60 | Decision meeting with the owner, against the three written goals | Founder and you | 1 hour |
| 11. Day 90 | Convert (order hardware, start the monthly fee) or remove the kit | Founder | |

## 3. Survey visit

Bring: this manual, the survey form below, a phone for photographs, a tape measure, a torch, a notebook. No tools
are needed to survey; do not open anything.

**Ask, in this order** (the answers decide what is measured and what it costs):

1. Who decides, and who gets called at night? (Names, mobile numbers, emails: these become **Who is told**. Each alert message carries an *I have seen this* link, so nobody needs a login to acknowledge; the people who should also look at the screens get a login of their own, and a login needs an email address: see [7.8](#7-the-setup-list-step-by-step).)
2. What went wrong in the last twelve months that cost money or a guest? (Write it in their words. It is the reason they buy.)
3. The last twelve electricity bills (price per kWh, kWh bought each month) and the water bills. (The platform
   shows what solar kept on site at *their* price; without a price it shows kWh only.)
4. Is there solar? What brand is the inverter and where is its AC output? Is it allowed to send energy to the grid?
5. Where does the supply enter the building? Is it three-phase?
6. Where are the water tank, the pump and its starter? How tall is the tank? What is the pipe's pressure? Has the starter a spare "running" contact? (Without one there is no pump contact module, and "the pump is running but no water is flowing" cannot be raised.)
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
| Tank: height (m), water source, pump (kW), starter location, spare running contact on the starter | |
| Meters needed (grid, solar, load, pump) and where | |
| Sensors needed (level, pressure, flow, pump running) and where | |
| Network: customer's cable or cellular; router brand; who can give an address | |
| Power for the box: socket location | |
| Electrician: name, mobile, day | |
| Photographs taken (list) | |
| Go / no-go, and why | |

## 4. Prepare in Greecon (at the office)

You can do all of this before you set foot on site, and it makes the install day shorter.

1. **Sign in** with **Greecon team**. You land on **Today**.
2. **If the customer asked through the web page:** their request is waiting under **Requests waiting** on
   **Today**, and on the **Requests** page. Press **Onboard** (it opens **Clients** with the form filled in from
   their request). **Otherwise,** open **Clients** and press **Onboard a client** (top right): company name, owner's
   name, owner's email. Press **Onboard client**.
3. A box appears: **Client onboarded — save this password now.** That is the owner's temporary password. It is
   shown **once**. Write it on the handover page, or tell it to the owner by phone. Do not send it by email.
   The owner signs in at `https://app.greecon.earth/login` with **Client login**, and chooses a password of their
   own straight away.
   - If a message says someone already has an account with that email, the person is already a customer. Do not
     use a different address to get round it: add the new site to the customer they already have. (The rehearsal
     in [section 13](#13-rehearsal-the-whole-job-on-a-desk) is the one exception.)
4. In the customer's row on **Clients**, press **Open for setup** (on **Today** the same button is **Open account**
   for a site that needs a look and **Continue setup** for a site being set up). You land on the customer's
   **Sites** page. A banner appears at the top: *You are in <customer> as Greecon staff, setting it up.* Everything
   you do from now is recorded under your own name in their audit trail. You can see their people but cannot add
   people to their account or reset their passwords while inside; their owner does that.
   **The setup session lasts four hours.** After that the page sends you to the sign-in page: sign in again with
   **Greecon team** and press **Open for setup** again. What you saved is still there; only what you were in the
   middle of typing is lost. On install day, open it again when you start commissioning.
5. On **Sites**, press **Add a site** (top right; in the middle of the page while there is no site yet). The form,
   *New site from a template*, makes the site. Choose **What kind of site**:
   - **Hotel or guesthouse**: water tank and pump, solar, grid. The usual first site.
   - **Solar plant with grid connection**: solar and grid, with an optional battery and load meter.
   - **Farm or greenhouse with irrigation**: soil probe and weather, with the water supply behind it.
   - **Water tank and pump station**: tank, pump and the pump's electricity.
   - **Empty site**: nothing assumed. Use only when none of the above fits.

   The page lists what the template will contain. Enter **Site name** and **Where it is**, check **Currency of
   the bills** (it starts as ALL) and **The site's own clock** (Europe/Tirane), and click **Create the site and
   start setting it up**.
6. You land on **Set up <site>**. It says `0 of N steps done`, and highlights what comes next: **Order form signed and data terms agreed** ([7.1](#7-the-setup-list-step-by-step)). Do it now, with the signed papers in front of you: write who signed for the customer and on what date, and press **The papers are signed**. At the top of the page is **The install card**: open it and print it. It is your list for the visit (see install day, below).
7. Click **Add the box and get its install command**. A line appears, beginning `curl -fsSL https://api...`
   ending in a code like `GRC-XXXX-XXXX-XXXX`. **Copy it** (there is a copy button). It is shown once. The
   code works **once**, for **seven days**. Click **I have copied it**.
   - The code is the box's key. Anyone with the line can install a box as this site until it is used or expires.
     Treat it like a password: not in email or chat; paste it straight into the box.
   - Lost it, or the seven days passed? On the same step, press **Install a box, or replace this one**. It asks you to
     confirm, then shows a new line. A new code replaces the old one (the old line no longer works), and the box
     that uses the new line takes the place of the box now installed, which stops working at that moment.

## 5. Prepare the kit at the office

Do the install of the box's software, and set the kit's numbers and the converter, at the office, on your desk, so that
the site visit is only plugging in and checking labels.

**The box.** Installing the operating system and pasting the install line are still done in a terminal (a keyboard and
screen, or SSH); everything after that is done on the setup page.

1. Install the operating system on the box: **Debian 12, Ubuntu 22.04 or later, or Raspberry Pi OS 64-bit**, with
   the SSH server on (you will use it from your laptop on the site's network; nothing can reach it from the
   internet), one user, a strong password, and the time zone set to Europe/Tirane.
   ([03](03-hardware-and-wiring.md) says which box to buy.)
2. Connect the box to your office network and open a terminal on it (a keyboard and screen, or SSH).
3. Paste the install line from step 4.7. It begins with `curl` and ends with the code. **Paste it exactly.** It runs
   in seven numbered steps and tells you each one as it goes: checking the box (and that it can reach Greecon and
   agrees with it about the time), installing Node.js, making the places the software uses, fetching and checking
   the Greecon software, giving the box its own credential, starting the service, and waiting to hear that Greecon
   can see the box. It finishes with:

   ```
   Done. Greecon can see this box. On the site's setup page, give each device its address;
   ```

   (That last line is older than **Find equipment**: on the setup page, giving each device its address is now that
   button, in step 4 of the setup list.)
4. In Greecon, refresh the setup page. **Install the box** now says **Done**, with the box's name, its version and
   "Heard from N seconds ago". You did not click anything to make it so: the platform saw the box.
5. Label the box with the site name and the date, and pack it.
   - The box keeps its credential when it is moved. Unplug it, carry it to the site, plug it in: it reports from
     the new place without anything being typed again.

**If the line stops with `STOP:`** it says what to check and how. If it stopped before step 5, **Giving this box its
credential**, fix the cause and run the same line again: the code has not been used yet. From step 5 on the code is
used up (it works once), and the same line would stop with "Greecon did not give the software to this box". Then
run the line again **with no code at the end**: `curl -fsSL https://api.greecon.earth/edge/install.sh | sudo bash -s --`.
That repairs the box and keeps its credential. If it answers "This box has no code and has not been installed
before", the box never got its credential: press **Install a box, or replace this one** and use the new line.
The commonest stops are: the box cannot reach Greecon (no internet, a firewall that blocks outgoing HTTPS on port
443, or a clock so far out that secure connections fail), or a code already used or older than seven days. A clock
that is only minutes out does not stop the install: it prints a WARNING, and the setup page later says "its clock
is N minutes fast".

**The numbers and the converter**

Every kit is made of approved models, and every device has the same number on the cable in every kit. You set them
here, at the office. On site you only check the labels.

| Device | Make and model | Its number | How it is set |
|---|---|---|---|
| Grid meter | Eastron SDM630 | 1 | On its own display |
| Solar meter | Eastron SDM630 | 2 | On its own display |
| Water I/O module (the 4 to 20 mA module) | Waveshare Modbus RTU Analog Input 8CH | 3 | With the maker's setting tool |
| Load meter or pump meter, if the site has one | Eastron SDM630 or SDM230 | 4 | On its own display |
| Pump contact module, if the site has one | Waveshare Modbus RTU IO 8CH | 5 | With the maker's setting tool |
| Soil probe (kit F) | The maker's own | 6 | By the maker's instructions, before it is buried |
| Weather sensor (kit F) | The maker's own | 7 | By the maker's instructions, before it is mounted |

A battery is the customer's: it is addressed by hand (for example 8). Everything on one cable is set to the same
speed: **9600 baud, 8 data bits, no parity, 1 stop bit**.

- **The meters.** Set each meter's number on its own display, one meter at a time (a meter is delivered as unit 1, and
  two on one cable would answer over each other). The SDM630 is delivered at 9600 baud: check it. The SDM230 is
  delivered at a speed that depends on its version (the V1.6 manual says 2400): set it to 9600, on the Baud Rate page
  ([03](03-hardware-and-wiring.md), "Meter settings"). Powering a meter on a bench is mains work: the electrician makes
  up the office's bench lead, and you never wire mains yourself.
- **The two Waveshare modules.** Each is delivered as address 1, and its address is kept in a register: there is no
  switch. Set it with the maker's setting tool and a USB-to-RS-485 adapter, one module at a time: **3** on the 4 to
  20 mA module and **5** on the pump contact module. Use the version of the 4 to 20 mA module that reads current, not
  the one that reads voltage, and leave its inputs in their default **0 to 20 mA** mode, on purpose: a 4 to 20 mA
  transmitter then reads 4000 to 20000 microamps, and a wire that has come off reads 0, below the 4 mA of an empty
  tank, which Greecon can see and say.
- **The soil probe and the weather sensor** (kit F): 6 and 7, set with the USB-to-RS-485 adapter and the maker's
  instructions, before the probe is buried or the sensor mounted. A second probe takes the next free number.
- **The converter.** In its web page: mode **Modbus TCP to RTU (gateway)** (not "transparent", not "raw TCP", not
  "Modbus RTU over TCP"), serial 9600, 8 data bits, no parity, 1 stop bit, TCP port 502. Its address on the customer's
  network is arranged on site, as install day says: a fixed one is best, and Greecon finds the converter either way.
- **Label everything** with its number (the converter with its settings), and photograph the labels.

**Test the kit on the desk.** The registers of the two Waveshare modules are from the maker's published tables and
have not been tried on real hardware, so the first real kit is rehearsed on a desk before it is trusted
([section 13](#13-rehearsal-the-whole-job-on-a-desk), step 10). Anything that differs from this manual is written down
and reported to Greecon.

## 6. Install day

**Before the day.** Two or three days before, send the customer the first two messages on **The install card**: the
first to their contact, the second to whoever looks after their network. Each is in English, with an *Albanian draft*
folded under it: have someone who writes Albanian every day read the draft before you send it (the interface and
Greecon's own messages are English only). The day before, check the signed papers, the electrician's number and the
kit, packed from the install card's list.

**Before anyone touches anything:** the signed order form and the data terms are in your hand, the electrician is
there, and the customer's lock-out is agreed.

**Order of work.** The electrician and you work at the same time, in this order, so that nobody waits.

| | Electrician | You |
|---|---|---|
| 1 | Walk the site with you; agree where each meter and sensor goes; apply the lock-out | Walk with them; photograph before |
| 2 | Fit the grid meter and the solar meter in the board: voltage connections with their fuses as the meter's manual says, the current clamps around the incoming phases, **arrow towards the site** | Mount the box, the converter and the 12 or 24 V supply on a shelf or rail; run the data cable from the converter to the board (the electrician connects it at the meters) |
| 3 | Connect the pump's run contact to input 1 of the pump contact module (a dry contact, never the relay outputs); fit the level and pressure transmitters (a wet part: only the electrician or the customer's plumber) and wire their 4 to 20 mA loops with the 24 V supply in series, as the module's manual draws it: level on input 1, pressure on input 2, flow meter on input 3 | Check each device's number on its label against the install card (grid meter 1, solar meter 2, water module 3, load or pump meter 4, pump contact module 5) and photograph each label. They were set at the office: do not change them |
| 4 | Remove the lock-out only when you both agree the work is closed up | Check the converter's label (gateway mode, 9600 baud, 8 data bits, no parity, 1 stop bit, port 502); connect it and the box to the network; power up |
| 5 | Stay until commissioning is done | Open the customer for setup again and go down the setup list: press **Find equipment**, give the ranges, and write down the electrician's name and licence number |

**Numbers are set at the office, and only checked here.** The numbers and the speeds were set before the kit left
([section 5](#5-prepare-the-kit-at-the-office)). If a label is missing, or two devices of a kind carry the same number,
**Find equipment** says **Not sure which**: do not guess, and do not change a number on site. For what to do,
see [section 12](#12-when-something-is-wrong) and the runbook R15.

**Meter settings are read from the meter's own display, never assumed.** Different makers, and different
versions of the same meter, are delivered with different defaults (the Eastron SDM630 is 9600 baud, and the
SDM230 can be 2400). Greecon sets every meter to the same speed, and to its own number, at the office; on site you
read them again from the display, and photograph it.

**The network, whichever way it comes:**

| Situation | What you do |
|---|---|
| **The customer's cable and router (best)** | Plug the box and the converter into the router. Ask the customer's IT person (or the router's page) to give the converter a **fixed address** that the router will not change (a "DHCP reservation" on the converter's MAC address, or a fixed address outside the router's range). Write it down. You do not type it anywhere: **Find equipment** finds the converter, and finds it again if its address ever changes, but a fixed address does not change under it. The box can take any address. |
| **A fixed address you set yourself** | Set the converter's own address in its web page, on the same range as the router. |
| **No usable internet (cellular)** | Fit the cellular router from the kit with a SIM, plug the box and the converter into **its** sockets. Greecon supplies the SIM, charged at cost. Check the signal where it sits. |
| **A firewall** | The box needs only **outgoing HTTPS (port 443)** to `api.greecon.earth` and, when it is installed, to `nodejs.org`, plus the time service (port 123 UDP, or the box's own). Nothing needs to come in. When someone presses **Find equipment**, the box looks at the site's own network for about a minute: it tries port 502 (or the port the person gives) on the private addresses of that network, such as 192.168.x.x and 10.x.x.x, and only reads; it never writes to anything and never looks outside the site's network. If the customer's network administrator asks, the second message on **The install card** says it in their words. |

**Before leaving the board:** photograph the meter's label (model and serial number), its wiring, its display
showing the address and speed, and the converter's settings page.

## 7. The setup list, step by step

Open the site's setup page. Each step is a card. A step opens to show its detail, and stays as you leave it.
A step is **Done**, **To do**, **Waiting** for another step, or **Needs attention**; the banner at the top, **Do next: ...**,
names the step to do next. The platform works most of them out by itself; you only press buttons for what a person
must check or say. There are up to twelve steps, always in this order (a step that does not apply to the site is left
out): the papers, the prices, the box, finding the equipment, the ranges, the devices answering, the readings, who is
told, the direction of the grid meter, the limits, the electrician, and commissioning.

**7.1 Order form signed and data terms agreed** *(the first step: nothing goes into a customer's building without it)*

Greecon does not put equipment in a customer's building without a signed order form and agreed data terms (what
Greecon reads, who sees it and how long it is kept). Greecon keeps the two papers; the platform cannot see a
signature, so you write down that they exist. In the box above the button write **who signed for the customer and on
what date**, for example *Signed for the hotel by Besa Krasniqi on 19 October*. The box cannot be left empty. Press
**The papers are signed**. The step turns **Done**, *Signed and agreed.*, with your name, the time and what you wrote,
and the same goes on the handover sheet. If a paper turns out to be wrong, press **Reopen**: if the site was
commissioned, that is taken back too. Do it at the office, before anything else, and bring copies on install day.
Commissioning stays grey until this step is done.

**7.2 Prices from the customer's bills** *(optional, but it is what turns kWh into euros)*

In this step, open **Enter prices and baseline** (once something is entered it is called **Prices and baseline**; the
same form is on the site's page). Enter: currency; the electricity price
per kWh from the latest bill; what is paid for energy sent to the grid (blank if nothing); the water price per m³;
"a typical month before": the kWh bought and the m³ of water from last year's bills (this is what the platform
compares with; **without it no comparison is shown**, which is correct); where those numbers came from; whether
the site **cannot send energy to the grid** (tick it if the plant is zero-export); and the time zone
(`Europe/Tirane`). **Save.**

**7.3 Install the box.** Done by itself once the box reports ([step 5](#5-prepare-the-kit-at-the-office)).
If the box says **Late** or **Offline**, it is not reaching Greecon: see [section 12](#12-when-something-is-wrong).

**7.4 Where each device is on the network.**

Nobody types an IP address, a port or a unit number here. Press **Find equipment**. (The button is grey until the box
is online and the site has devices; while the box is looking, pressing it again does nothing.)

- The box looks at the site's own network: only private addresses (such as 192.168.x.x and 10.x.x.x), port 502, about
  a minute at most. It asks each unit number 1 to 10 a few read-only questions, and it never writes to anything.
  After you press, the page says *The box is looking at the network now.* and follows the box by itself, so you do not
  reload it. The box picks the request up within about half a minute.
- The platform recognises what answered and matches it to the devices the site is meant to have. It fills in at once
  only what cannot be a guess: a device with no address yet, found at the unit number the kit gives it, as the model
  planned. Everything else waits until you press **Use this address**.

Each device gets a line in plain words:

- **Set**: found, and its address is filled in. Where an SDM230 was planned and the meter also answers as a
  three-phase one, the line adds *It also answers the three-phase meter's total-power register, so it may be a
  three-phase SDM630: check the model on its label, and if it is one, remove this device and add the three-phase
  meter from "Add equipment Greecon already knows".*
- **Found**: found, and waiting for you to say yes: at an address other than the one it has, at a unit number other
  than the kit's, or a meter of the other model than the one planned. Press **Use this address** (or *Use these N
  addresses*, when there are several) when the line makes sense. The line says where and what, for example *Found at
  192.168.1.60, unit 3: a 4 to 20 mA input module, reading 12.0 mA, 9.0 mA, 5.1 mA.* At another number it adds *It is
  at unit 4, not 1: if it is this site's, use this address, and the install card gives 1 so that the next site looks
  like this one.* If a single-phase SDM230 is found where a three-phase SDM630 was planned, it adds *It is a
  single-phase SDM230, not the three-phase SDM630 planned. If you use this address, Greecon reads it as a
  single-phase SDM230.* The line then keeps saying *Greecon reads it as a single-phase SDM230; the site's plan had a
  three-phase SDM630.*
- **Not found**: *Nothing that looks like an Eastron meter answers at unit 2. Check the address set on it, the speed,
  and the A and B wires.* For an optional device the line adds *If the site does not have one, remove it from the
  list below.*
- **Not sure which**: two of one kind answer at the same number on different converters, or two of a kind answer at
  numbers that are not the kit's; or something answers but not clearly enough to tell the model (*Something answers at
  192.168.1.60, unit 1, but not clearly enough to tell whether it is the three-phase SDM630 planned. Look again; if it
  is the same, check the speed and the A and B wires.*); or every unit number answers with the same words (*Units 1, 2
  at 192.168.1.50 all answered with exactly the same words*), which means the converter is not in Modbus TCP to RTU
  (gateway) mode. Greecon refuses to guess, because a wrong guess could swap the grid meter and the solar meter, and
  every figure with it. Read the label on each device to see which is which, then use **Enter the address by hand**
  under each device, with the number on its label. Numbers are set at the office and are not changed on site: see
  [05 Runbooks, R15](05-runbooks.md#r15-find-equipment-cannot-find-a-device).
- **Enter by hand**: equipment Greecon cannot recognise on a network: the soil probe (6), the weather sensor (7) and
  a battery. Under the device open **Enter the address by hand**, fill in the **IP address** (the converter's, or the
  battery's own), the **Port** (502) and the **Unit number**, and press **Save**. (Once a device has an address the
  link reads **Change the address by hand**.)

When it worked, the step is **Done** (*Every device has an address.*), the panel says *Every device has the address it
was found at.*, and the button now reads **Look again**.

Also on this step:

- **A device the site does not have.** An optional one (the pump contact module, the load meter, the pump meter, a
  battery) shows **The site does not have this: remove it**. Press it and confirm: the device and its readings go. If
  you removed one by mistake, add it back with **Add equipment Greecon already knows**, at the bottom of the step
  (the meters and the two modules).
- **The converter is on another part of the network**, or uses another port, or the box is not on your network (a
  desk rehearsal): open **I know the converter's address**, type the converter's **IP address**, each part without a
  leading zero (192.168.1.50, not 192.168.001.050), and the **Port** only if it is not 502 (the field can stay empty),
  and press **Look at this address**. Only private addresses are accepted, and the box does not look at itself
  (127.0.0.1).
- **Anything else that answered** is listed under *Also answering, and not part of this site's equipment*. Ask what
  it is before you go on.
- **If the converter's address changes later** (the router gave it a new one) the readings stop. Press **Find
  equipment** again, then **Use this address**: [05 Runbooks, R17](05-runbooks.md#r17-the-converters-address-changed).
- On the box, `greecon-edge find` does the same looking and prints what answers: for a desk, and for support.
- Pressing **Find equipment**, and every change of a device's address or model (old and new), is written in the
  customer's audit trail under your name.

If it does not work: *No Modbus converter answered on this network. Check that the converter is switched on and
plugged into the same router as the box, then find the equipment again. If the converter is on a different part of the
network, give its address (I know the converter's address).* Or *A converter answers at 192.168.1.50, but
nothing answers behind it. Check each meter's address, the speed on the converter and the meters, and the A and B
wires.* Or *The box did not pick this up. Check that it shows as online in the step above, then press Find equipment
again.* The button stays grey while the box is not online (*The box has to be online first: it is the one that looks.*)
or the site has no devices yet.

**7.5 Which register holds which reading.**

- For equipment Greecon knows (the Eastron meters and the pump contact module), nothing is typed: the registers are
  already filled in. Check them against the maker's manual only if a reading looks wrong.
- For the 4 to 20 mA module (the **Water I/O module**) the page asks, for each transmitter, only for the range
  printed on its label, in the label's own words:
  - **Level transmitter** (input 1): the **Range on the label** (for a 0 to 5 m transmitter, 5), the **Unit on the
    label** (metres, or bar for a pressure sensor hung at the bottom of the tank; the page then says what depth it
    is, for example *0.5 bar holds up 5.0985 metres of water*) and **How tall the tank is inside** (say 4, always in
    metres): from the bottom to the top of the water when the tank is full. Greecon shows the level as a percentage
    of the tank, so a full tank reads 100.
  - **Pressure transmitter** (input 2): the **Top of the range** in bar (10 is usual).
  - **Flow meter** (input 3): the **Top of the range** in litres a minute (the form says lpm).
  - A comma works as a decimal point (2,5 is 2.5).
  - A transmitter the site does not have (no flow meter): tick **Not fitted at this site**. When you save, a box asks
    *Take away pump flow from this site? The reading and its history are removed. This cannot be undone.* Say yes only
    if the site really has no such transmitter; the reading is then gone, so that nothing waits for it.

  Press **Save the ranges**. It says *Saved. The box picks it up within a minute.*, and under each transmitter the
  form says what it set, for example *Set now: 4 mA is 0 % and 20 mA is 125 %.* (a 0 to 5 m transmitter in a tank 4 m
  tall: 5 ÷ 4 × 100 = 125, so that a full tank, at 16.8 mA, reads 100). A transmitter shorter than the tank is refused,
  in words: *The transmitter reads up to 3 m and the tank is 4 m tall: it cannot see the top of the water. Fit a
  transmitter with a longer range.* To change a range, give it again; the form does not show the level's answer back,
  so type both of its numbers.
- For equipment Greecon does not know (the soil probe, the weather sensor, a battery): one form per reading, from the
  maker's register table. Under the reading's name (for example **Soil moisture**) press **Choose the register**, and
  fill:
  - **Register kind**: **Input** for a manual's 3xxxx, **Holding** for 4xxxx (the form starts on Holding).
  - **Address**: counted from zero, so a manual's **30053 is address 52**, and 40001 is address 0.
  - **Kind of number** and, for two-register numbers, **which half comes first** (the usual is the high half first).
  - **How it becomes the reading**: **Multiply and add** (a meter that reports watts for a reading in kW: multiply by
    0.001), or **A straight line, such as 4-20 mA**, where **Signal at the bottom / top** are what the register holds
    at the two ends of the sensor's signal and **Reading at the bottom / top** are the reading's own values at those
    two ends (the maker's table says what).
  - **Which part of the value**: "Only when positive" and "Only when negative, as a positive number" split a
    meter that reports import as positive and export as negative into two readings (the templates do this
    for you).
  - **Save the register.**
- **Test any register before relying on it**, from the box:

  ```
  greecon-edge modbus-test --host 192.168.1.50 --unit 1 --type input --address 52 --data-type float32
  greecon-edge modbus-test --host 192.168.1.50 --unit 5 --type discrete --address 0
  ```

  The first reads a meter, the second the pump contact module (`--type discrete` reads a digital input). Each prints
  the raw numbers and the value. If it prints `Could not read`, the problem is the wiring or the settings, not
  Greecon.
- A reading the site does not have holds the list at this step: for a transmitter, tick **Not fitted at this site**;
  for an optional device, press **The site does not have this: remove it** in step 4 of the setup list.

**7.6 Every device answers the box.** Done by itself. Each device shows **Done** ("Answering (N readings)") or
**Needs attention** with the reason in words ("no answer from 192.168.1.50:502 (unit 2)"); on the box,
`greecon-edge status` lists each device as **ok** or **NOT OK**. Look in this order: the converter's address (the router
may have given it a new one: press **Find equipment** again, then **Use this address**), the number on the device's label against the install
card, the **speed** at the converter, **A and B swapped** on the data cable, the converter not in gateway mode.

**7.7 Readings arrive and look right.** Done by itself when each reading has arrived, in a believable range. A
reading that cannot be real says so, for example *-31.2 cannot be a tank level (0 to 100). Check the register address,
the scale or the sensor.* On a transmitter that is nearly always a wire that has come off (the module then reads 0,
below the 4 mA of an empty tank, so the reading comes out below zero), or a range or a tank height that was given
wrongly: [05 Runbooks, R18](05-runbooks.md#r18-a-reading-is-impossible-after-the-ranges-were-given). A tank level may
read up to 5 points over 100 or under 0 without being called impossible. **Pump running** reads 1 while the pump runs
and 0 while it is stopped.

**7.8 Someone is told when the site needs attention.** Open **Who is told** (the step has the link):

- **Add a person** for each name from the survey, **in the order they should be told.** Each needs an email, a
  mobile number **with its country code** (`+355 69 123 4567`), or both. The first person hears first.
- **Save the list.** Then, beside each person, **Send a test message.** It says what happened to the email and
  to the text ("Accepted for delivery to +355 ••• ••• 567. Ask Besa whether it arrived."). Tests are limited for the
  whole account: six an hour (a person with both an email and a number uses two of the twelve test messages
  allowed). If you reach the limit the page says "Test messages are limited to 6 an hour. Try again later."
- **Ask each person** whether it arrived: in the inbox, not in spam; on the phone.
- **Tell each person on the list how to say they have seen an alert.** Every alert message has an *I have seen this*
  link: one tap on the phone, then one button, no sign-in, good for 72 hours; it stops the chain of messages. Pressing
  **Acknowledge** on the **Alerts** page does the same, for a person who can sign in. Replying to an email or a text does
  not. So nobody needs a login for this; give a login of their own (the Operator role is enough) to the people who
  should also look at the screens: open **Settings**, then **People**, and look at who has a sign-in. If someone who
  should have one has none, the customer's owner adds them under **Add a person** with **Add person** (a Greecon support
  session can see the people but cannot add them), and the new person is given a temporary password, shown once. An Owner
  or an Administrator can press **Acknowledge** too; a Viewer or an Auditor cannot (the link in a message works for anyone it was sent to).
- **Give everyone an email address as well as a number.** The note that a colleague has acknowledged an alert, and the
  note that it has cleared, go by email only. A person who has only a phone number is texted the urgent alert and then
  hears nothing more: they may still set off for something that is already being dealt with.
- Back on the setup page, write what you saw if you like, and press **I checked this.** It is greyed out until the
  list has someone on it and a test has been sent, because a site nobody is told about must not be commissioned.

How alerts reach people, for the owner (say this at handover, in these words): **Act now** goes by email at once
and by text ten minutes later if nobody has acknowledged it; thirty minutes after the alert began, the next person
is told by email and text, and so on down the list. Saying you have seen it means pressing the *I have seen this* link in the message (no
sign-in, good for 72 hours) or **Acknowledge** on the **Alerts** page (for a person with a login). **Check today** is one
email, held until morning if it is night. Beyond those, three short notes only: one to the people who were told
when somebody **acknowledges** the alert (who took it), one when the problem has stayed clear for 15 minutes
(**Resolved**), and one **morning message** at 07:30 saying whether everything is all right. Quiet hours (22:00 to
07:00) hold everything except Act now.

**7.9 Grid meter direction checked** *(only on sites with a grid meter)*. Greecon cannot see which way
the meter's clamps point. A reversed clamp swaps what the site buys with what it sells, and every figure with it.
**With the sun down or the solar switched off, switch on a known load** (a kettle or a heater). **Grid import must
go up.** If **Grid export** goes up, the clamps are the wrong way round: the electrician turns them (with the lock-out
on), you check again. Then press **I checked this**, with a note of what you saw. If a clamp is left reversed, Greecon
notices on its own at night or in cloud (energy cannot go out of a plant that nothing is producing for): the energy
picture says so, and after five minutes a **Check today** alert, *The grid meter may be fitted the wrong way round*,
opens. At midday it cannot tell, which is why this check stays.

**7.10 Alert limits agreed with the customer.** The step lists each reading that has limits, with what applies. The
standard ones: tank **Critical below 15 percent** (an Act now alert), **Low below 35 percent** (a Check today
alert); pump **No flow at or below 0.2 litres a minute** (an Act now alert once it has held for 30 seconds, raised
only when the box reads both a flow and the pump's running state); battery **Low below 25 percent**. Irrigation
advice, **frost** and solar surplus have no standard value, and the platform says nothing about them rather than guess.
(Frost: an **Act now** alert opens when the air at the field reaches the grower's own **Frost alert at or below** value
and stays there for two minutes. Ask the grower at what temperature the crop is in danger and in which weeks; enter it
on the weather sensor's air temperature.)
**Go through them with the customer.** To change one, open the **Standard** drop-down beside the reading in this
step (it says **1 set**, **2 set** once changed), type the numbers, press **Save limits**, and when they are agreed
press **I checked this.** The same drop-down is in the **Limits** column under **Readings** on the site's
**Equipment and readings** page. If the pump's running contact reads the wrong way round, the no-flow alert opens while the pump is
stopped: the "Pump running" check in [section 9](#9-commissioning-checks-by-kind-of-site) finds that.
Agree numbers the customer would act on: an alert nobody acts on trains people to ignore the next.

**7.11 Electrical work done by a licensed electrician.** Fitting meters in a board and wiring transmitters and
contacts is the licensed electrician's work, under the customer's lock-out. It is not yours. When the electrician has
finished and the lock-out is removed, ask for their name and licence number, photograph the wiring, the labels and the
displays, and check that the lock-out has been removed. Then write in the box the electrician's **name and licence
number**, for example *Arben Hoxha, licence E-1234*, or that no electrical work was needed. The box cannot be left
empty. Press **The electrical work is done**. The step turns **Done**, *Done by a licensed electrician.*, with your name,
the time and what you wrote, and the same goes on the handover sheet. The platform does not check the licence: what
you write is the record. Do not press it while the work is open or the lock-out is still on. Commissioning stays grey
until it is done.

**7.12 Commissioned.** Greyed out until everything above is done (the prices are optional and do not hold it; the papers and the electrician's name and licence number do). Then it says: *On site, compare what Greecon
shows with what you can see: the meter's own display, the tank, the pressure gauge. When they agree, confirm
here.* Do the checks for the site's kind in [section 9](#9-commissioning-checks-by-kind-of-site). Press **Commission this site**,
with a note. The progress line then reads **Commissioned.**, and your name and the date are on the handover sheet.

## 8. The four kinds of site

### A. Hotel or guesthouse (the usual first site)

**What it is:** water tank and pump, solar on the roof, and the grid. **What is measured:** grid import and
export (one three-phase meter at the supply entry), solar production (one three-phase meter on the inverter's
AC output), tank level, line pressure, pump flow, pump running.

**Bring:** two Eastron SDM630 meters with current clamps, an RS-485 to Ethernet converter, a Waveshare 4 to 20 mA
module (Modbus RTU Analog Input 8CH) and a Waveshare pump contact module (Modbus RTU IO 8CH) with their 24 V supply,
a level transmitter and a pressure transmitter (and a flow meter if the owner wants dry-run protection), the box, a
small UPS, cable, DIN rail and enclosure ([03](03-hardware-and-wiring.md)). The numbers of the meters and the modules
were set at the office. **Ask the customer for:** twelve electricity bills, the water bills, the people to tell.

**Wiring in one picture:**

```
 supply entry            inverter AC output           tank & pump room
 ┌────────────┐          ┌────────────┐               level ──── 4-20 mA ─┐
 │ SDM630     │          │ SDM630     │               pressure ─ 4-20 mA ─┼─► 4-20 mA module ─┐
 │ GRID  (1)  │          │ SOLAR (2)  │                                         (3)             │
 └─────┬──────┘          └─────┬──────┘               pump run contact ──────► contact module ──┤
       │                       │                                                  (5)            │
       └───────── RS-485 (A, B, ground; daisy chain) ─────────────────────────────────────────────┤
                                                                                                  ▼
                                                  converter (RTU→TCP) ── network ── BOX ── internet
```

**Set up in Greecon:** template **Hotel or guesthouse** (four devices: the grid meter, the solar meter, the water I/O
module and the pump contact module, which is optional). Press **Find equipment**; the registers of all four are known.
Then give the ranges (7.5): the level transmitter's range and the tank's height, the pressure transmitter's range and,
if there is one, the flow meter's. The pump's running state comes from the pump contact module. Prices (7.2) so that
"your solar kept N kWh on site, worth about X at your price of Y" can be said.

**Agree with the owner:** the tank limits (the standard 15 and 35 percent are a start: a tank that feeds a
fifty-room hotel on a hot day should alert earlier), the no-flow level if the pump normally runs at a trickle (the
standard is 0.2 litres a minute), who is told for water and who for electricity, and what "Act now" at 02:00 means
for them.

**Typical problems:** the solar meter reading zero at midday (a closed clamp on the wrong cable, or the inverter
is zero-export limited); the level reading wrong (a vented cable blocked, the transmitter not at the tank's
bottom, or the range or the tank's height given wrongly); the pump-running contact inverted (reads running when
stopped), which also opens the no-flow alert, an Act now, while the pump is stopped
([7.10](#7-the-setup-list-step-by-step)).

### B. Solar plant with grid connection (with an optional battery)

**What is measured:** solar production (inverter AC output), grid import and export, optionally the site's own
consumption (a load meter) and a battery's charge and power. It works **with any inverter brand**, because it
measures at the AC cable with its own meter and not through the inverter maker's portal.

**Bring:** two or three SDM630 meters (grid, solar, optional load), converter, box, UPS. For a battery: the
maker's Modbus register table (without it the battery is left out; do not guess registers). The numbers of the
meters were set at the office; a battery is addressed by hand.

**Ask the customer:** the electricity price, **what is paid for energy sent to the grid, if anything**, and whether
the plant is **allowed to send energy to the grid** (if not, tick *This site cannot send energy to the grid*
in prices). Twelve bills.

**Set up:** template **Solar plant with grid connection**. Press **Find equipment**, and take off the battery and the
load meter if they are not fitted (7.4). To take one off, press **The site does not have this: remove it**. A battery
is not recognised on a network: its address and its two readings are entered by hand, from the maker's table. Do the
direction check with care: on a plant that exports at noon, do it at night or with the inverter off.

**Commissioning:** at midday, solar production in Greecon agrees with the inverter's own display within about 5
percent, and grid export is the difference between production and what the site is using.

### C. Farm or greenhouse with irrigation

**What is measured:** soil moisture (per zone) and air temperature and humidity at the field, and the water
supply behind it (tank, pressure, flow, pump).

**Bring:** a soil probe and a weather sensor that speak Modbus RS-485 and that document their registers
(without documented registers the sensor cannot be mapped), the 4 to 20 mA module for the tank and pressure and the
pump contact module if there is a pump to watch, the box, a cellular router if there is no network in the pump house.
The probe's number (6) and the sensor's (7) are set before the probe is buried and the sensor mounted. The box cannot
recognise a probe or a sensor, so their addresses and their readings are entered by hand (steps 4 and 5 of the setup
list), from the makers' manuals; the water side is as in the hotel.

**Ask the grower:** which crop, which soil, how deep the roots are, where in the field is typical (not the wettest
or driest spot). **Greecon gives no irrigation advice until the grower's own "start irrigating below" value is
entered,** because that number depends on the soil, the crop and the probe's depth and nobody can set it for
them. After the first week of readings, ask the grower what reading means "time to water" and enter it as the limit.
**Ask, too, at what air temperature frost damages the crop and in which weeks of the year.** Enter it as the **Frost
alert at or below** limit on the air temperature (the number depends on the crop and how far on it is, so Greecon has
none of its own, and says nothing about frost until it is set). A frost alert is an **Act now** message in the night:
agree who is woken. **Map the air temperature as a signed number** (int16): below zero, an unsigned register reads a
frosty morning as a hot afternoon.

**Write in the handover:** the probe's depth and where it is. Soil readings are only as good as the contact
between probe and soil.

### D. Water tank and pump station

**What is measured:** the tank's level, the line pressure, the pump's flow, whether it runs, and optionally the
pump's electricity use (a single-phase meter such as the SDM230).

**Ask:** what the pump does when the tank is low and when it is full, and who is told today. The pipe's pressure
range decides the pressure transmitter's range.

**Set up:** template **Water tank and pump station** (three devices: the water I/O module, the pump contact module
and the pump meter, the last two optional). Press **Find equipment**, give the ranges, and take off what the site does
not have (the pump meter, the pump contact module) with **The site does not have this: remove it**. This is the
simplest site and a good first rehearsal.

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
| **4 to 20 mA channels** | With a loop calibrator in place of the transmitter, send 4, 12 and 20 mA | The reading at the bottom, the middle and the top of the transmitter's range (for a 0 to 10 bar transmitter: 0, 5 and 10 bar) |
| **A test message** | Each person on the list | Arrived |
| **Power cut** | Unplug the box for 30 seconds, plug it in | Back reporting within 3 minutes, and the box says nothing about readings lost |
| **Internet cut** *(the first install, and any time the box or its software is new)* | Cut **only the site's internet** for ten minutes: unplug the router's uplink cable (the one that goes to the wall or the modem), or take the SIM out of the cellular router. **Leave the box and the converter plugged into the router**: if the box cannot reach the converter it reads nothing, and there is nothing to test. Then restore it | `greecon-edge status` shows a queue while it is out, and a few minutes after it returns the queue is empty and the readings from the gap are in the downloads. **Write the result down: it is the evidence for the statement that the box keeps its readings.** |

On the tank's channel the top of the range reads more than 100 when the transmitter is longer than the tank (a 0 to 5 m
transmitter in a tank 4 m tall reads 125 at 20 mA), and Greecon may call that impossible while you test: that is the
test, not a fault. A full tank reads 100 (16.8 mA in that example). The module itself must read 4000, 12000 and 20000 at 4, 12 and 20 mA:

```
greecon-edge modbus-test --host 192.168.1.50 --unit 3 --type input --address 0
```

(The address is 0 for input 1, 1 for input 2, 2 for input 3.) Put the transmitter back when you finish.

Do not **start, stop or open** any equipment yourself. The owner's own person does, because they know what else it affects.

## 10. Handover

1. On the setup page open **Open the handover sheet**. Check it, and print it (**Print or save as PDF**; the printed page leaves out the menus).
   It names the customer and site, says where each device is (address, unit number, registers), who is told and
   how to reach them, what was commissioned and by whom, who signed the papers and who the electrician was, and how
   to reach Greecon (`info@greecon.earth`).
2. Show the owner, in ten minutes, in this order: the **Overview** (is everything all right, in one sentence);
   **Energy now**, the flow moving from the solar to the site and the grid; **Value**, what the solar kept on site
   this month (and the prices it uses); **Who is told** (under **Settings**) and a live **test message** arriving
   on their phone (and that each message carries an *I have seen this* link, so that nobody needs a login to
   acknowledge an alert); **Reports**, under **Downloads**,
   where **their data is theirs**: every reading for the last 31 days, hourly averages for up to a year, the
   alerts, the audit log and how the account is set up can be downloaded whenever they want (and if they stop, they
   can ask Greecon for every reading it holds, as a file).
3. Say: *Greecon watches your equipment and tells you. The protection built into your equipment remains the
   safety layer. You will get one message each morning. If there is nothing to do, it says so.*
4. Leave: the printed sheet (signed), the box's label, a card with `info@greecon.earth` and your phone.
5. Photographs and the survey form go in the shared drive, in a folder named for the customer.
6. The same day, send the customer's contact the third message on **The install card** (its subject is *Greecon is now
   watching* and the site's name), with the handover sheet attached. It is in English, with an *Albanian draft* folded
   under it: someone who writes Albanian every day reads the draft before it is sent.
7. Press **Back to the Greecon console** (the banner's button) to leave the customer's account: it returns you to **Today**.

## 11. After install

| When | Do | Look for |
|---|---|---|
| **Day 1** | Open **Today**; phone the owner: did the morning message arrive? | Box online; readings current; the message reached them |
| **Day 3** | Same; look at one alert if one happened | No alert nobody understood |
| **Day 7** | Sit with the owner for 15 minutes: **was every alert useful? what would they change?** Adjust limits. | Alert count at most one a day; every one with a clear action |
| **Every morning** | The morning check email and **Today** ([05](05-runbooks.md)); each live site shows *Day N* | A silent box, or a site that needs a look |
| **Day 30** | Short call; ask what they have done because of Greecon | One thing, in their words, for the sales story |
| **Day 60** | The decision meeting, against the three written goals: data current at least 95 percent of the time; the owner says they read the morning message on at least 5 days in 7 (Greecon does not track opens: ask, and write the answer down); at least one real event caught | Convert, extend by up to 30 days once, or remove |
| **Day 90** | Convert (order hardware at the agreed price; the monthly fee starts at day 91) or take the kit away within 14 days | Data exported to the customer either way |

## 12. When something is wrong

Short answers; the longer ones are in [05 Runbooks](05-runbooks.md).

| What you see | Likely cause | What to do |
|---|---|---|
| **The install line stops with `STOP:`** | The sentence says: no internet (or a firewall, or a clock far out), code used or expired | Do what it says. Before step 5 run the same line again; after it, run the line with no code at the end ([section 5](#5-prepare-the-kit-at-the-office)) |
| **The box says Offline** | Power, network cable, or the site's internet is down | Is the box's light on? Is the router up? On the box: `greecon-edge status` and `journalctl -u greecon-edge -n 50 --no-pager` |
| **Find equipment finds nothing, or a device says Not found** | The converter is off, or on another network than the box; A and B swapped; the speed or the mode at the converter; a device with no power | Read the sentence on the screen. On the box, `greecon-edge find` says what answers. [05 Runbooks, R15](05-runbooks.md#r15-find-equipment-cannot-find-a-device) |
| **A device says Found, or Not sure which** | Found at another address than the one it has (the router gave the converter a new one), at a number that is not the kit's, or as the other model of meter; or two of a kind answer at one number, or every number answers alike | Read the line. Press **Use this address** only if it makes sense. Numbers are not changed on site. [05 Runbooks, R16](05-runbooks.md#r16-a-device-was-found-at-another-address) and [R17](05-runbooks.md#r17-the-converters-address-changed) |
| **A device needs attention** (on the box: NOT OK) | The converter's address changed, the number on the device's label, speed, A and B swapped, converter not in gateway mode | Press **Find equipment** again; then `greecon-edge modbus-test` against the device; check each in that order |
| **A reading is zero or constant** | A wrong register on equipment mapped by hand, the wrong register kind (input vs holding), a clamp on the wrong cable | `modbus-test` raw numbers against the manual's table |
| **A reading is ten or a thousand times too big or small** | A wrong scale (W against kW) on equipment mapped by hand, or a range or a tank's height given wrongly on a transmitter | By hand: re-enter the conversion. Transmitter: give the ranges again; check with the calibrator |
| **A reading cannot be real** (*cannot be a tank level*, below zero, or far above 100) | A wire that has come off (the module reads 0), the range or the tank's height given wrongly, a transmitter on the wrong input | [05 Runbooks, R18](05-runbooks.md#r18-a-reading-is-impossible-after-the-ranges-were-given) |
| **Import and export are swapped** | The clamps are the wrong way round | Electrician turns them; repeat 7.9 |
| **The clock is out** | The box has no time service | `timedatectl set-ntp true`; the setup page names it ("its clock is N minutes fast") |
| **The test message did not arrive** | A wrong address, spam, or the number without its country code | Check **What was sent** under **Who is told** (it shows what happened); try the other way |
| **The test email arrived in spam** | The sender is new to that mail provider | Mark it not spam; ask them to add `alerts@greecon.earth` to contacts |
| **A reading went Unknown after a while** | The meter or the converter lost power or the cable came loose, or the converter's address changed | The setup page says which device and why; press **Find equipment** |

## 13. Rehearsal: the whole job on a desk

Do this once before the first real site, once more with the first real kit, and again when anything in this manual
changes. It takes an afternoon and needs no hardware except the box (or a spare computer running Debian, Ubuntu or
Raspberry Pi OS) and your laptop.

1. **On your laptop** (Node.js 22 or newer): get the repository, then run:

   ```
   node scripts/pretend-meter.mjs --kit --port 5020
   ```

   It listens for any machine on the network and answers as a whole hotel kit: unit 1 the grid meter, unit 2 the solar
   meter, unit 3 the 4 to 20 mA module (the tank at 12 mA, the pressure at 8.96 mA, the flow at 5.12 mA) and unit 5 the
   pump contact module, with its input 1 closed. Leave it running: it prints each question it is asked, so that you can
   watch the box look.
2. In Greecon, onboard a client named **Rehearsal**, open it for setup, and make a site from the **Hotel or
   guesthouse** template. As the owner use **a second address of your own** (a plus-address such as
   `you+rehearsal@yourmail.example`, if your mail allows it): your own team address already has an account, an
   address can have only one, and Greecon refuses it. This is the one case where a different address is right.
3. On the setup list write that the papers are signed (for the rehearsal, *Rehearsal: signed by me today*) and press
   **The papers are signed**. Add the box, copy the line, and paste it on the box
   ([section 5](#5-prepare-the-kit-at-the-office)). Watch **Install the box** turn **Done**.
4. **Find the kit.** The kit listens on port 5020, not 502, so under **Where each device is on the network** open
   **I know the converter's address**, type **your laptop's address on the network** (the one the box can reach, such as
   192.168.1.60; not 127.0.0.1, which the box takes for itself) and the port **5020**, and press **Look at this
   address**. After a minute at most the grid meter, the solar meter, the water module and the pump contact module are
   each **Set**, with lines such as *Already set, and answering at 192.168.1.60, unit 1: an Eastron meter, reading
   1.80 kW at 231 V.* (your laptop's address in place of 192.168.1.60). The solar meter reads 5.20 kW; the water
   module is *a 4 to 20 mA input module, reading 12.0 mA, 9.0 mA, 5.1 mA*; the pump contact module is *a digital input
   module, reading input 1 is closed*. The step is **Done**. You typed no unit number and no register.
5. **Give the ranges.** Under **Which register holds which reading** type **Level transmitter** range 5 and tank 4,
   **Pressure transmitter** 10, **Flow meter** 200, and press **Save the ranges**. Within a minute the readings arrive:
   **Tank level 62.5 %**, **Line pressure 3.1 bar**, **Pump flow 14** litres a minute and **Pump running 1**, with
   **Grid import** 1.8 kW and **Solar production** 5.2 kW. They come from the kit's signals and your ranges: the kit's
   12 mA is the middle of the level transmitter's range, 2.5 m of 5 m, which in a tank 4 m tall is 62.5 percent of the
   tank ((12 − 4) ÷ 16 × 5 ÷ 4 × 100); 8.96 mA is 3.1 of 10 bar ((8.96 − 4) ÷ 16 × 10); 5.12 mA is 14 of 200 litres a
   minute ((5.12 − 4) ÷ 16 × 200). If a number differs, look at the ranges you typed.
6. Watch every step turn **Done**. Then add yourself under **Who is told**, send a test message, write for the
   electrician that no electrical work was needed (the box cannot be left empty), and confirm the steps that need a
   person. **Commission** the rehearsal site.
7. Stop the pretend kit. After about five minutes **Today** (under **Needs a look**) says the readings are out of date
   and the box says a device does not answer. Start it again. Then rehearse an alert: in the limits step open the
   tank's limits, give **Low below** 80 and **Critical below** 70 (both above the tank's 62.5 percent), and press **Save
   limits**: **Tank level is critical** is an **Act now**. It arrives by email at once and, if you added your number, by
   text ten minutes later unless you **Acknowledge** it on the **Alerts** page, which then tells the people who were
   told who took it.
8. Print the handover sheet. Download the readings from **Reports** (**Downloads**). Open the file in a spreadsheet.
9. When finished, remove the rehearsal site's equipment and then the site (on the site's **Equipment and readings**
   page: **Remove** beside each piece of equipment, then **The site itself**: a site that still has equipment cannot
   be deleted), or suspend the client from **Clients** (**More**, then **Suspend this client**, and confirm), so that it does not
   appear in the morning check. If you will use the Rehearsal client to show **Who is told** and **Reports** in a sales demonstration
   ([04, section 4](04-sales-kit.md#4-the-pitch-five-minutes-and-the-demo-ten)), keep it and its site until then, and
   start the pretend kit before the meeting: with it stopped the site shows as out of date.
10. **With the first real kit,** do steps 1 to 6 again with the real converter and devices on your desk in place of the
    pretend kit, and write down anything that differs from this manual (a number, a speed, a reading, a sentence on the
    screen). The registers of the two Waveshare modules have only been tried against a pretend module.
11. **To practise the by-hand form** (equipment Greecon does not sell), use the older pretend meter, which is still
    there:

    ```
    node scripts/pretend-meter.mjs --units 6,7 --port 5021
    node scripts/pretend-meter.mjs --units 6,7 --port 5021 --tank 12 --watts -1800
    ```

    It answers as units 6 and 7 with plain registers: a power at input registers 52 and 12, and at registers 0 to 3 the
    tank level in tenths of a percent, the pressure in hundredths of a bar, the flow in tenths of a litre a minute and 1
    or 0 for the pump running. The second line makes the tank read 12 percent and a plant export. On a second rehearsal
    site from the **Farm or greenhouse with irrigation** template, give the **Soil probe** your laptop's address, port
    5021 and unit 6 with **Enter the address by hand**, and map **Soil moisture** with **Choose the register**:
    **Input**, address 0, **Multiply and add**, multiply by 0.1. It reads 62 percent with the first line.

**If a step in this manual does not match what you see, fix the manual** (it is a file in `docs/launch/`), or
tell the founder. It is meant to be corrected by the person who uses it.

## 14. Words used here

| Word | Meaning |
|---|---|
| **Box** | The small computer at the site that reads devices and reports to Greecon |
| **Converter** | Puts the RS-485 cable on the network (a Modbus gateway: Modbus TCP to RTU). Set at the office |
| **Modbus** | The language most meters and modules speak. A device has a **unit number** and **registers** |
| **Register** | A numbered place in a device that holds one value. **Input** registers are read-only, **holding** can be written (Greecon never writes) |
| **Clamp / CT** | A ring that goes around a cable and tells the meter how much current flows |
| **4 to 20 mA** | A signal wire: 4 mA means the bottom of the transmitter's range, 20 mA the top. The Waveshare module reads it in microamps: 4000 to 20000. A wire that has come off reads 0 |
| **Range (of a transmitter)** | The two ends printed on a 4 to 20 mA transmitter's label, for example 0 to 5 m or 0 to 10 bar. Greecon asks for it, in the label's words, and works out the scale |
| **Approved equipment** | The models a kit is made of, and no others: the Eastron SDM630 and SDM230 meters, the Waveshare Modbus RTU Analog Input 8CH and the Waveshare Modbus RTU IO 8CH. Greecon knows their registers and settings |
| **Find equipment** | The button that makes the box look at the site's network and find where each device is. It fills in what is certain and asks you about the rest. It only reads |
| **Install card** | The page for each site with what to bring, what each device is set to, the converter's settings, the visit in order, and three messages for the customer |
| **Pump contact module** | The module that reads whether the pump is running, from a dry contact on its starter. It only reads |
| **Commissioning** | Checking that what the platform shows matches the real world, once, on site |
| **Act now / Check today** | The two kinds of alert that reach a person. Everything else is only shown |
