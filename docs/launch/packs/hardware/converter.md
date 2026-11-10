The meters, the modules and the field sensors speak Modbus RTU on a two-wire cable (RS-485). The box speaks Modbus TCP on the network. The converter sits between them: it puts the cable on the network, so that the box can reach every device on it. One of its settings matters more than all the others, and that is its mode.

## At a glance

@@GLANCE@@

## How it qualifies

Any make qualifies that meets every line below. The box keeps one connection to a converter and asks one thing at a time, so any converter that does this will do.

**It qualifies if:**

- {{cb}} It converts RS-485 to Ethernet, fits a DIN rail and takes 9 to 36 V DC, so that it shares the 24 V supply.
- {{cb}} It has a **Modbus TCP to RTU gateway mode**. Makers also call it "Modbus gateway", "Modbus TCP server" or "protocol conversion".
- {{cb}} Its serial side can be set to 9600 baud, 8 data bits, no parity, 1 stop bit.
- {{cb}} Its TCP port can be set to 502.
- {{cb}} It can keep a fixed address on the network: set in the converter, or reserved for it in the router.

A basic converter costs about EUR 30 to 60 and an industrial one EUR 250 and up. Either qualifies.

::: stop
**Do not buy** a converter that has only a "transparent" or "raw TCP" mode, or only "Modbus RTU over TCP". In those modes the box's requests arrive on the cable as noise, and nothing answers.
:::

## At each kind of site

Every site has one converter. What changes is what is behind it. The number after each device is its number on the cable.

@@SITES@@

## Settings, and where they are made

Greecon sets the converter in its own web page at the office, before the kit leaves. On site you check its label. The settings are here in case a converter ever has to be set again.

| Setting | Value |
|-------------------|------------------------------------------------------|
| Mode | Modbus TCP to RTU (gateway) |
| Serial: speed | 9600 baud, the same as every device on the cable |
| Serial: data bits, parity, stop bits | 8, none, 1 |
| TCP: port | 502 |
| Address on the network | A fixed one: a reservation for the converter in the customer's router (on its MAC address), or an address set in the converter itself, on the same range as the router. Arranged on site, and written down |

Write the settings on the converter's label and photograph its settings page.

## Fitting

{{who:pm}}

- {{cb}} Mount it on the DIN rail in the enclosure, on the low-voltage side, and power it from the 24 V supply.
- {{cb}} Connect the data cable: A to A, B to B, and the ground where there is one, on to the first device and from there to the next. The rules of the cable are on [sheet HW03](#hw-cable).
- {{cb}} Plug its network socket into the same router or switch as the box (or into the 4G router). Never a guest network.
- {{cb}} Check its label against this sheet: gateway mode, 9600 baud, 8 data bits, no parity, 1 stop bit, port 502.
- {{cb}} Ask the customer's network person for a fixed address for it, and write the address down. You do not type it anywhere: the box finds the converter.

## In the platform

The converter is not a device in the platform. It is the address of every device behind it, shown on each as *Reached at 192.168.1.50:502, unit 3*.

- **Finding it.** In step 4 of the setup list, **{{step:4}}**, press **{{ui.find_equipment}}**. The box tries port 502 on the private addresses of its own network (such as 192.168.x.x and 10.x.x.x), and behind whatever answers it asks unit numbers 1 to 10 a few read-only questions. It never writes to anything, and it takes about a minute.
- **If the converter is on another part of the network, or uses another port:** open **{{ui.i_know_the_address}}**, type its address (each part without a leading zero: 192.168.1.50) and the port only if it is not 502, and press **{{ui.look_at_this_address}}**. Only private addresses are accepted.
- **If its address changes later** (the router gave it a new one), every device behind it stops answering at the same moment. Press **{{ui.find_equipment}}** again: the devices say **{{ui.found_found}}** at the new address, and **{{ui.use_this_address}}** sets them. Then ask for the fixed address.

## Acceptance test

**On a desk at the office, with the box:**

- {{cb}} The converter's settings page shows gateway mode, 9600 baud, 8 data bits, no parity, 1 stop bit and port 502, and its label says the same.
- {{cb}} With one numbered device on its cable, the box finds the converter and that device at its own number:

```
greecon-edge find --host 192.168.1.50
```

It prints the converter's address and, under it, one line for each unit that answers, for example `unit 1: an Eastron meter, reading 1.80 kW at 231 V`.

- {{cb}} With two devices on the cable, each answers at its own number, with its own reading. If every number answers with the same words, the converter is not in gateway mode.
- {{cb}} A number that no device has does not answer.

**On the day:** **{{ui.find_equipment}}** finds every device of the kit, and step 6, **{{step:6}}**, turns **{{ui.status_done}}** by itself.

## What goes wrong

| What you see | Likely cause | What to do |
|-------------------|----------------------|------------------------------|
| ***No Modbus converter answered on this network*** | The converter is off, or not on the same network as the box: a guest network, a second router, a cable in the wrong socket | Look at its power and network lights. Put the box and the converter on the same router. If it is on another part of the network, give its address |
| ***A converter answers at 192.168.1.50, but nothing answers behind it*** | The network side works and the cable side does not: A and B swapped, the converter not in gateway mode or not at 9600 baud, devices without power, a cable that is broken or branched | Swap the two wires at the converter. Check the mode and the speed in its settings page. Check that the devices have power |
| ***Units 1, 2 at 192.168.1.50 all answered with exactly the same words*** | The converter answers every unit number as the one device behind it: it is not in gateway mode | Set its mode to Modbus TCP to RTU (gateway), then press **{{ui.look_again}}** |
| **Every device behind it stops at the same moment** (*no answer from 192.168.1.50:502 (unit 1)*), with the box online | The router gave the converter a new address | Press **{{ui.find_equipment}}**, then **{{ui.use_this_address}}**. Ask for a fixed address, so that it does not happen again |

More is in {{ref:runbooks}}: R15 (a device is not found), R16 (a device is found at another address) and R17 (the converter's address changed).

## Not yet proven

- This software has not yet looked at a real converter. It is tested against a pretend one that answers as the makers' documentation says. The first real kit is rehearsed on a desk before any site.
- Converters differ. Asked for a unit that is not there, some say so at once and some say nothing: the box handles both. One that accepts a single connection may drop the box's reading connection for a moment while the box looks, which costs one round of readings.
- A single device behind a converter in the wrong mode looks like a device at whichever number it is asked at: the box can tell the mode is wrong only when two units give the same answer. That is why the mode is checked on the settings page, and the first reading is compared with the meter's own display.

@@BUYING@@
