The level, pressure and flow transmitters each send a current between 4 and 20 mA down two wires. This module reads those currents and answers the box with numbers, on the same data cable as the meters. The platform calls it the **{{ui.device_water_module}}**. It is an approved model, so the box finds it, and the only thing a person is asked for is the range printed on each transmitter's label.

## At a glance

@@GLANCE@@

## How it qualifies

It is an approved model: the make and the model are named.

**It qualifies if:**

- {{cb}} It is the Waveshare **Modbus RTU Analog Input 8CH**, in its current version: eight inputs, on RS-485, powered from 7 to 36 V DC.
- {{cb}} It is the version that **reads current**. The version that reads voltage is a different part, and does not qualify.
- {{cb}} The maker's setting tool for it is on the office laptop, with a USB-to-RS-485 adapter: its number is set by a command, not by a switch.

::: stop
**Do not buy** another make of analog input module, or the voltage version of this one. The box recognises this module by a register that holds its own number, and reads its inputs as microamps: another module answers differently, or not at all.
:::

## At each kind of site

@@SITES@@

## What Greecon reads from it

Each input is one input register that holds the current in microamps: input 1 is register 0, input 2 is register 1, input 3 is register 2. A 4 to 20 mA transmitter reads 4000 to 20000. Greecon turns that into the reading from the range on the transmitter's label.

| Input | Transmitter | Reading in Greecon | The label gives | Standard alert |
|--------|-------------|-------------|----------------------|--------------------|
| 1 | Level ([sheet HW10](#hw-level)) | **{{ui.reading_tank}}**, % | The range, in metres or bar, and how tall the tank is | Critical below 15 % ({{ui.act_now}}); Low below 35 % ({{ui.check_today}}) |
| 2 | Pressure ([sheet HW11](#hw-pressure)) | **{{ui.reading_pressure}}**, bar | The top of the range, in bar | None |
| 3 | Flow ([sheet HW12](#hw-flow)), if fitted | **{{ui.reading_flow}}**, litres a minute | The top of the range, in litres a minute | No flow at or below 0.2 litres a minute ({{ui.act_now}}), only when the pump's running state is read too |

**Its inputs are left in their default 0 to 20 mA mode, on purpose.** A wire that has come off then reads 0, which is below the 4 mA of an empty tank, so Greecon can see it and say so (*cannot be a tank level*). In the module's own 4 to 20 mA mode a broken wire might read like an empty tank.

## Settings, and where they are made

| Setting | Value | Where |
|-----------------|-------------------------------------------------|-----------|
| Its number | **3.** It is delivered as 1, and its number is kept in a register: there is no switch. Set it with the maker's setting tool and a USB-to-RS-485 adapter, with no other device on the cable | At the office |
| Speed | 9600 baud, 8 data bits, no parity, 1 stop bit, which is how it is delivered. Check it | At the office |
| Input mode | Left at the default, 0 to 20 mA. Do not change it | Nowhere |

Label the module with its number, and photograph the label.

## Fitting

{{who:pm}} mounts the module on the DIN rail in the enclosure, powers it from the 24 V supply and joins it to the data cable. {{who:e}} wires the transmitters' loops into its inputs.

{{diagram:ref-loop}}

- {{cb}} **Each transmitter has its own input:** level on input 1, pressure on input 2, the flow meter on input 3.
- {{cb}} **A two-wire transmitter takes its power from the loop,** so each loop has the 24 V supply in series with the module's input, wired as the module's manual draws it. The maker does not say that the module powers the loop, so the loop has a supply of its own.
- {{cb}} Number every wire at both ends, and photograph the terminals before the enclosure is closed.

## In the platform

- **Finding it.** In step 4 of the setup list, **{{step:4}}**, press **{{ui.find_equipment}}**. The box recognises the module by the register that holds its own number, and by its inputs. Found at number 3, its address is filled in: *unit 3: a 4 to 20 mA input module, reading 12.0 mA, 9.0 mA, 5.1 mA*.
- **The ranges.** In step 5, **{{step:5}}**, the page asks one thing for each transmitter, in the words of its label: the **{{ui.range_on_label}}** and the **{{ui.unit_on_label}}** (metres or bar) of the level transmitter and **{{ui.tank_height}}**; the **{{ui.top_of_range}}** of the pressure transmitter, and of the flow meter. Press **{{ui.save_the_ranges}}**. Greecon works out the register and the scale: nobody types either.
- **A transmitter the site does not have** (no flow meter): tick **{{ui.not_fitted}}**. The page asks first, because the reading and its history are removed.

## Acceptance test

**At the office, on the desk:**

- {{cb}} The module is numbered 3, alone on the cable, and labelled.
- {{cb}} Behind the converter, the box finds it at number 3 (`greecon-edge find --host 192.168.1.50`).
- {{cb}} With a loop calibrator in place of a transmitter (a hand-held that sends 4, 12 and 20 mA), the module reads 4000, 12000 and 20000 on that input. Address 0 is input 1, 1 is input 2, 2 is input 3:

```
greecon-edge modbus-test --host 192.168.1.50 --unit 3 --type input --address 0
```

- {{cb}} With nothing connected to an input, it reads 0.

**On the day, as part of commissioning:**

::: tests
| Check and how | Pass when | Greecon shows | Real | Result |
|----------------------|-----------------|--------|--------|--------|
| **4 to 20 mA channels.** With a loop calibrator, send 4, 12 and 20 mA into each input that is used. | The reading at the bottom, the middle and the top of its range | | | {{pf}} |
:::

On the tank's input, the top of the range reads more than 100 when the transmitter is longer than the tank (125 for a 0 to 5 m transmitter in a tank 4 m tall), and Greecon may call that impossible while you test. That is the test, not a fault.

## What goes wrong

| What you see | Likely cause | What to do |
|-------------------|----------------------|------------------------------|
| **A reading below zero** (*-31.2 cannot be a tank level*) | No current in the loop: a wire has come off, or the loop has lost its 24 V supply. The module reads 0 | Read the input from the box. 0 means no current. The electrician checks the loop and its supply |
| **A reading far too high or too low** | The range, or the tank's height, was given wrongly; or a label in bar was entered as metres (it then reads about ten times too low) | Read the label again and give the ranges again |
| **The right number on the wrong reading** | Two transmitters on each other's inputs | Level on input 1, pressure on input 2, flow on input 3 |
| ***Nothing that looks like a 4 to 20 mA input module answers at unit 3*** | The module has no power, was left at number 1, or its A and B wires | Check its power and its two data wires. Read its label. A module that was not numbered at the office goes back there, or the spare that was numbered there is fitted |

More is in {{ref:runbooks}}: R15 (a device is not found) and R18 (a reading is impossible after the ranges were given).

## Not yet proven

- **This software has not yet read a real one of these modules.** Its registers (the inputs at input registers 0 to 7, in microamps; its number at holding register 0x4000) are from the maker's published pages, read again on 31 October 2026, and everything is tested against a pretend module that answers as those pages say. The first real kit is rehearsed on a desk, and anything that differs from this sheet is written down and reported to Greecon.
- The prices are planning figures from shop listings seen in October 2026, not quotes.

@@BUYING@@
