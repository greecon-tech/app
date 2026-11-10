This module tells Greecon whether the pump is running. A spare contact of the pump's starter closes when the pump runs; the module reads that contact and answers the box, on the same data cable as everything else. It only reports. The module also has relay outputs, and they are never connected: nothing Greecon fits can switch a pump.

## At a glance

@@GLANCE@@

## How it qualifies

It is an approved model: the make and the model are named.

**It qualifies if:**

- {{cb}} It is the Waveshare **Modbus RTU IO 8CH**: eight isolated digital inputs, on RS-485. A dry contact on an input is enough.
- {{cb}} The maker's setting tool for it is on the office laptop, with a USB-to-RS-485 adapter: its number is set by a command, not by a switch.
- {{cb}} The pump's starter has a **spare auxiliary contact** that follows the pump (closed while it runs). This is asked at the survey. Without one, the module is not fitted.

::: stop
**Never connect anything to the module's relay outputs,** and never wire its input to a control circuit. The contact only reports. Greecon only reads, and it is not a safety system: the float switches and trips already in the customer's equipment stay the safety layer.
:::

## At each kind of site

@@SITES@@

**What is lost without it.** With no running contact, Greecon cannot tell a pump that has stopped from one that is running dry, and the alert "the pump is running but no water is flowing" cannot be raised. The site then removes the module from its list, and the handover says so.

## What Greecon reads from it

| Input | Reading in Greecon | What it means | Standard alert |
|--------|-----------------|----------------------|---------------------|
| 1 | **{{ui.reading_pump}}** | 1 while the pump runs, 0 while it is stopped | None of its own. With a flow meter ([sheet HW12](#hw-flow)) it makes the no-flow alert possible: pump running, flow at or below 0.2 litres a minute for 30 seconds, an {{ui.act_now}} alert |

Input 1 is the module's first digital input (read as a discrete input, address 0). The template fills it in: nobody types it. Inputs 2 to 8 are not used.

## Settings, and where they are made

| Setting | Value | Where |
|-----------------|-------------------------------------------------|-----------|
| Its number | **5.** It is delivered as 1, and its number is kept in a register: there is no switch. Set it with the maker's setting tool and a USB-to-RS-485 adapter, with no other device on the cable | At the office |
| Speed | 9600 baud, 8 data bits, no parity, 1 stop bit, which is how it is delivered. Check it | At the office |

Label the module with its number, and photograph the label.

## Fitting

{{who:pm}} mounts the module on the DIN rail in the enclosure, powers it from the 24 V supply and joins it to the data cable. {{who:e}} wires the starter's contact to it.

- {{cb}} A **spare auxiliary contact** of the pump's starter goes to **input 1** as a dry contact, as the module's manual draws it. The module's DI COM is left unconnected.
- {{cb}} Nothing is connected to the relay outputs.
- {{cb}} Number the two wires at both ends, and photograph the terminals before the enclosure is closed.

## In the platform

The templates call it **{{ui.device_pump_contact}}**.

- **Finding it.** In step 4 of the setup list, **{{step:4}}**, press **{{ui.find_equipment}}**. The box recognises the module by the register that holds its own number, and by its inputs. Found at number 5, its address is filled in: *unit 5: a digital input module, input 1 is closed*.
- **No spare contact at this site:** press **{{ui.site_does_not_have}}** under it. The device and its reading go, and nothing waits for them.
- **Nothing else is typed.** Its reading is mapped by the template.

## Acceptance test

**At the office, on the desk:**

- {{cb}} The module is numbered 5, alone on the cable, and labelled.
- {{cb}} Behind the converter, the box finds it at number 5 (`greecon-edge find --host 192.168.1.50`).
- {{cb}} With a wire across input 1 as the manual draws a dry contact, it reads 1; with the wire off, 0:

```
greecon-edge modbus-test --host 192.168.1.50 --unit 5 --type discrete --address 0
```

**On the day, as part of commissioning:**

::: tests
| Check and how | Pass when | Greecon shows | Real | Result |
|----------------------|-----------------|--------|--------|--------|
| **{{ui.reading_pump}}.** The owner's own person starts the pump, then stops it. | Greecon shows running within 30 seconds, and changes both ways | | | {{pf}} |
:::

Do not start or stop the pump yourself: the owner's own person does, because they know what else it affects.

## What goes wrong

| What you see | Likely cause | What to do |
|-------------------|----------------------|------------------------------|
| **The pump shows running when it is stopped** (and, with a flow meter, the no-flow alert opens while the pump is stopped) | The contact is inverted: it is closed when the pump is stopped | The electrician uses the other contact of the starter, or swaps its normally-open and normally-closed wires. Until it is right, the no-flow alert cannot be trusted |
| **The reading never changes** | The contact does not follow the pump (it is a contact of something else), or a wire is off | The electrician confirms which contact it is. Read the input from the box while the pump is started |
| ***Nothing that looks like a digital input module answers at unit 5*** | The module has no power, was left at number 1, or its A and B wires | Check its power and its two data wires. Read its label. A module that was not numbered at the office goes back there |

More is in {{ref:runbooks}}: R3 (a reading looks wrong) and R15 (a device is not found).

## Not yet proven

- **This software has not yet read a real one of these modules.** Its registers (the digital inputs read with function 02 at addresses 0 to 7; its number at holding register 0x4000) are from the maker's published pages, read again on 31 October 2026. The maker's page warns that its example frames do not always match their labels. Everything is tested against a pretend module that answers as the pages say. The first real kit is rehearsed on a desk, and anything that differs from this sheet is reported to Greecon.
- The planning price (EUR 30 to 60) is the earlier figure for a pump run input. It has not been checked against a shop price for this module.

@@BUYING@@
