# 30. Guided setup: a site set up by someone with no engineering skills

**Status:** decided and built on 31 October 2026 by Claude, acting for the founder, who asked for the setup of a site to be as simple
and as organised as it can be made: the hardware configured from the platform after the project manager has filled in what only a
person can know, so that a project manager needs no engineering skills, in every case. These are **decisions and engineering
judgement, not facts**. None has been read by a lawyer, an electrical engineer or a network administrator, and the register tables of
the two modules in section 3 have been tested against a pretend module and not yet against real hardware (section 8).

Read with [02 Project manager manual](launch/02-project-manager-manual.md), [03 Hardware and wiring](launch/03-hardware-and-wiring.md),
[27 Launch decisions](27-launch-decisions.md) (L20 to L23) and [18 Reality audit](18-reality-audit.md) (findings 97 to 102).

## 1. The problem

Before this change a project manager had to type, for each device, an IP address, a port and a unit number, and for the water module
a register kind, a register address, a kind of number and a 4 to 20 mA conversion read off a datasheet. Every one of those is a place
to be wrong, and the result of being wrong is silence that looks like a faulty device. A person without engineering skills cannot tell
a wrong unit number from a swapped wire. The founder's aim was that nobody has to.

The answer is not a smarter form. It is **fewer things to know**: the things that can be fixed in advance are fixed in advance, the things
the box can find out it finds out, and the few things only a person can see (a number on a label, a signature, a licence) are asked for
in the words of the thing itself.

## 2. The rule: what is fixed, what is found, what is asked

| Kind of thing | Who knows it | How it is handled |
|---|---|---|
| Which models are used, their registers, their serial settings | Greecon, before any site | **Approved equipment** ([L20](27-launch-decisions.md)): the kit is made only of these models, so their register tables are code, not typing |
| The number each device has on the cable, the speed, the converter's mode | Greecon, at the office | **The same in every kit** (grid 1, solar 2, 4 to 20 mA module 3, load or pump meter 4, pump contact 5, soil 6, weather 7; 9600, 8, none, 1) and **set at the office** before the kit leaves; the card for the site lists them and the project manager checks the labels |
| Where the converter is on the customer's network | The box, by looking | **Find equipment** ([L21](27-launch-decisions.md)) |
| Which device is which, and which model is there | The platform, from what answered | Recognised by what each unit positively said, matched to the devices the site is meant to have |
| The scale of a 4 to 20 mA reading | The label on the transmitter | **Asked in the label's own words**: the range, and for a tank how tall it is |
| Whether the papers are signed, who the electrician was | A person | **Two steps** ([L22](27-launch-decisions.md)) that must say who and when |
| What to say to the customer and their network administrator | Greecon | **Three messages**, the same for every site, with the site's name in them ([L23](27-launch-decisions.md)) |
| Equipment Greecon does not know (a soil probe, a weather sensor, a battery) | The maker's datasheet | Still typed by hand, with the form that was there before; the platform says so rather than pretend |

## 3. Approved equipment

Each profile (`packages/shared/src/device-profiles.ts`) carries: the maker and model as ordered, what it is for in a sentence a project manager
can say to a customer, the equipment family (for finding it), its default port, **the number it has in every kit**, **the serial settings it is
delivered with**, how it is wired and checked, and its readings.

- **Eastron SDM630 and SDM230** (grid, solar, load): total active power, input register 52 on the SDM630 and 12 on the SDM230, a float32 in
  watts, high word first. The three-phase meter is delivered at 9600 baud; the single-phase meter's speed depends on its version (the manual
  says 2400), and **Greecon sets it to 9600 at the office**.
- **Waveshare Modbus RTU Analog Input 8CH, current version** (the tank level, the line pressure, the pump's flow): input registers 0 to 7 hold
  channels 1 to 8 in microamps; a 4 to 20 mA transmitter reads 4000 to 20000. The module is left in its **default 0 to 20 mA mode on purpose**:
  a wire that has come off then reads 0, below the 4 mA of an empty tank, which the platform calls out ("cannot be a tank level"); in the
  module's 4 to 20 mA mode a broken wire might read as an empty tank. Its address (delivered as 1) is stored in holding register 0x4000, written
  with a command (there is no switch), so Greecon sets it to 3 at the office with the maker's tool. A two-wire transmitter needs a 24 V supply in
  series with its loop, wired by the electrician as the module's manual draws it (the maker's page does not say the module supplies it).
- **Waveshare Modbus RTU IO 8CH** (the pump's running contact): eight digital inputs read with function 02 at addresses 0 to 7; a dry contact
  with DI COM unconnected; its relay outputs are **never** used. Delivered as address 1, set to 5 at the office.

These facts are from the maker's published pages (read again on 31 October 2026); the page for the IO module warns that its example frames are
copied across sections and do not always match their labels. **No real module has been read by this software.** Section 8 says what that means.

## 4. Find equipment

### 4.1 What the box does

When a person presses **Find equipment** the platform asks the box, in its next heartbeat reply, to look. The box:

1. Works out which networks it is on, and keeps only **private** ones (10.x, 172.16 to 31, 192.168.x, link-local), never wider than 254 addresses,
   never its own address, never anything on a public address. Or, if a person gave one, that one address (private only) and optionally one port.
2. Tries to open a connection to **port 502** on each (64 at a time, 0.6 seconds each); about three seconds for a whole network.
3. Behind each address that answered, asks **unit numbers 1 to 10** up to six **read-only** questions: function 02 (digital inputs), 03 (one holding
   register) and 04 (input registers), never a write. The first three questions are one register that every unit of each family has ("presence"):
   a unit that answers none of them, not even with a refusal, is not there and is not asked the rest, because a converter waits out its serial timeout
   for every question to a unit that is absent. An exception from the converter itself (10, 11: "nothing answered me") is treated as silence;
   an exception from a device (illegal function, illegal address) means a device is there.
4. Gives up on its own after 90 seconds and says the answer may be incomplete. It runs once for each request, and sends the result again if the
   platform could not be reached; the heartbeat is every 10 seconds for five minutes after a request, so the person is not left waiting.

`greecon-edge find` does the same by hand at the box (`greecon-edge find --host 192.168.1.50 --port 502`), for a desk and for support.

### 4.2 How the platform decides what answered

Recognition rests on **what a unit positively said, never on what it failed to say**, because a device may answer a register it does not have with
zeros:

- A **Waveshare module** is a unit whose address register (0x4000) holds **the number it was asked at**. If its input channels read it is the 4 to
  20 mA module; if its inputs read it is the digital module.
- An **Eastron meter** is a unit whose first-phase voltage (input registers 0 and 1) is a **mains voltage** (80 to 300 V) and whose total-power register
  holds a number that can be a power. A meter at zero volts is not recognised, which is true to what a meter that is not powered would say anyway.
- Anything else that answers is listed as "something answers that Greecon does not recognise".

### 4.3 How it is matched, and when it refuses

The platform matches what was found to the devices the site is meant to have: first the unit at the number the kit gives it; then, where only one of a
kind is left and only one device wants it, that one at whatever number it was left at. It **refuses to guess** where a guess could be wrong:

- **Two meters of one kind at one number on two converters** cannot be told apart from the network, and a guess would swap the grid meter and the solar
  meter: every figure of the site would be wrong and look right. Each is marked "Not sure which", with what to do (give each its own number; or enter the
  address by hand). Nothing is changed for them.
- **Two of a kind at numbers that are not the kit's** are marked the same way.
- **A single-phase meter where a three-phase one was planned** (the SDM630's total-power register is refused, the SDM230's answers): the device is read as the
  single-phase meter, the register changes from 52 to 12, and the page says so. Where both registers answer, the **planned model is kept**: an SDM630 fitted
  where an SDM230 was planned reads phase one's power until the commissioning comparison with the meter's own display finds it, and the card says which
  model to fit (section 8).
- Addresses are filled in **at once, as the person who pressed the button** (it is in the audit trail under their name), **only for devices that have no
  address yet**. A device that already has a different address keeps it until the person presses **Use this address**.
- A device the site does not have is taken off the list with one press; the message for an optional device that was not found says so.

The result is kept in the platform's memory for the minutes it is useful (not in the database, so no migration): a restart in that minute loses it and the
person presses the button again. A request the box never picked up shows as "did not pick this up" after ten minutes.

### 4.4 Why it is safe to let the box look

The question a customer's network administrator will ask. The answers, which the card's second message gives in the same words:

- The box looks **only when a person presses the button**, for about a minute, and at **private addresses on its own network only**; a request for a
  public address is refused by the box itself, whoever asked.
- It tries **one port** (502, or the one a person gave) and **only reads**. It never writes to anything, so it cannot change a meter or a module.
- It sends **nothing about the customer's network to anyone but Greecon**, and only what answered on port 502 (an address, a unit number and the answers to
  the questions). It does not keep a list of the network's other machines.
- Nothing is opened inward: the box connects out, as before.

What it can do that is unwelcome: a converter that accepts only one connection at a time may drop the box's own reading connection while it looks, which
costs one round of readings. Looking is manual and normally happens before readings begin.

## 5. Ranges from the labels

A 4 to 20 mA transmitter is the same everywhere; only its range differs, and it is printed on its label. The page asks, in the label's words:

- **Level transmitter**: the range on the label (say 0 to 5 m) and **how tall the tank is inside**. The platform makes the level a **percentage of the
  tank**: 4 mA is empty, and a full 4 m tank in a 0 to 5 m transmitter is 16.8 mA, which reads 100. A transmitter shorter than the tank is refused in words
  ("it cannot see the top of the water. Fit a transmitter with a longer range").
- **Pressure** and **flow**: the top of the range.
- **Not fitted at this site**: the reading is taken away, so that nothing waits for it. (Without a flow meter, "the pump runs but no water flows" cannot be
  raised; the handover says so.)

The arithmetic is a straight line from 4000 to 20000 microamps to zero to the range (`sourceFromRange`), checked in the tests against the numbers a person
would calculate. A tank level may read up to five points over 100 or under 0 without being called impossible (a transmitter's tolerance, a tank measured a few
centimetres short); a value like -31 is called out as one that cannot be real.

## 6. The papers and the electrician

Two steps that the platform cannot see and that nothing may bypass. Both are confirmed by a person, **must say who and when** (an empty note is refused by the
page and by the platform, because the paper itself is somewhere else and this is the only record here), and both hold commissioning back.

- **Order form signed and data terms agreed** is the first step: nothing goes into a customer's building without them. It records who signed for the customer and
  the date. The documents themselves are drafts for a lawyer ([L19](27-launch-decisions.md), [22](22-legal-and-compliance-map.md)).
- **Electrical work done by a licensed electrician** comes before commissioning: fitting meters in a board and wiring transmitters and contacts is the electrician's
  work under the customer's lock-out ([02, rule 2](launch/02-project-manager-manual.md)). It records the electrician's name and licence number, or that no electrical
  work was needed. The platform does not verify a licence; it makes the project manager write it down, where the customer, an insurer or a lawyer can find it.

Both appear on the handover sheet.

## 7. The install card, and the messages

Every site has an install card (`/sites/<site>/install-card`, printable): what to ask the customer and look at before the day, what to bring, what each device is set to
and its number on the cable, how it is wired, the converter's settings, the cable rules, what the customer's network is asked for, the visit in order, and three messages
to copy: **before the installation day** (to the customer's contact), **for the customer's network administrator**, and **after the handover**. It is **worked out from the
site's own equipment** (`packages/shared/src/install-card.ts`), so it never lists a device the site does not have and never forgets one it does, and it is tested to carry no
code or password and to say, in every message that has to, that Greecon only reads and is not a safety system.

**Communication choices.** The messages are plain and short, name the site, put what only the sender knows in [square brackets], and say once each what Greecon does and does
not do. English is the interface language ([L12](27-launch-decisions.md)); an **Albanian draft** of each is provided because the customers speak Albanian, folded away and labelled
as a draft to be read by someone who writes Albanian every day before it is sent. Greecon sends nothing in Albanian by itself.

## 8. What this does not do, and what is not yet known

1. **No real module has been read.** The Waveshare registers (channels at input 0 to 7, the address at holding 0x4000, digital inputs by function 02 at 0 to 7) are from the maker's
   pages; the Eastron registers were already from the maker's tables. The whole of guided setup is tested against a pretend converter that answers as the makers' documentation says
   (`scripts/pretend-meter.mjs --kit`) and a real box on a real socket. **The first real kit must be rehearsed on a desk** ([02, section 13](launch/02-project-manager-manual.md)), and
   anything that differs from this page is reported to Greecon.
2. **Equipment Greecon does not know** (soil probes, weather sensors, a battery) is typed by hand. No soil probe is approved: the maker documentation seen was conflicting.
3. **The box's operating system and the one pasted install line** remain a terminal step. A zero-touch first boot is not built (an image to flash is waiting for ten sites, [27](27-launch-decisions.md)).
4. **Converters differ.** Some answer a request for a unit that is not there with an exception and some say nothing; the box handles both, and a single-connection converter may drop the
   reading connection for a moment while the box looks. No real converter has been looked at.
5. **An SDM630 fitted where an SDM230 was planned** reads only phase one's power until the commissioning comparison; the card lists the model to fit.
6. **The request and the answer are kept in memory** (section 4.3).
7. **The Albanian drafts are drafts.**
8. **The address of a converter can change** (the router gives it a new one). The setup page says to press Find equipment again, and the guides say to ask the customer for a reservation.

## 9. What was considered and not done

| Not done | Why | Trigger |
|---|---|---|
| The box scanning the network by itself, on a schedule | A customer's network is theirs; looking only when a person asks is easier to explain, to defend and to switch off | A site where converters move often and a customer who asks in writing |
| Discovery of equipment by broadcast (mDNS, Modbus broadcast) | Modbus has no discovery; broadcast writes are exactly what must never happen | None |
| Changing the module's address or the converter's settings from the platform | It would be a write. Read-only is a rule, not a preference ([L13](27-launch-decisions.md)); it is set at the office with the maker's tool | The release gate in [23](23-safety-and-security-case.md), and a reason |
| Checking a licence number against a register | No such register is known to be open to a program; the note is the record | A register that exists |
| Albanian in the interface | [L12](27-launch-decisions.md) | An owner who needs it; then a native editor |
| A flash-and-go box image | [27](27-launch-decisions.md) | Ten sites |

## 10. How it is tested

- `packages/shared`: recognition (what each kind of unit says, and what must not be taken for a meter), matching (every refusal to guess), the ranges' arithmetic, the card
  (no two devices on one number for any kind of site, no secrets in messages), the equipment profiles.
- `apps/edge-agent`: the box reads digital inputs; the search against a **real converter on a real socket** with a meter, the 4 to 20 mA module and the pump module, silent and
  excepting units, the box's heartbeat asking it, and the result sent again if the platform was down.
- `apps/api`: asking, answering, applying (as the person who asked, only where there is no address), the single-phase meter, the ranges, the two new steps, other accounts refused,
  and the approved model surviving a restart on PostgreSQL.
- `scripts/smoke-sites.mjs`: the **real installer and the real box** against the pretend kit for each kind of site, with typed addresses only for what Greecon does not know.
- `scripts/e2e/pm-e2e.cjs` and `scripts/e2e/guided-setup.cjs`: the project manager's whole job in a browser, once with the box played by calls and once with the real box finding the kit,
  a module that goes silent, and a device the site does not have.
