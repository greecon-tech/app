A battery at a solar plant is the customer's own equipment. Greecon buys nothing for it and approves no model. It can be read if, and only if, its maker publishes where its charge and its power are: its Modbus register table. Then its address is entered by hand and its two readings are mapped by hand. If the maker will not publish the table, the battery is left out. Nobody guesses a register.

## At a glance

@@GLANCE@@

## How it qualifies

**It qualifies if:**

- {{cb}} Its maker publishes the battery's **Modbus register table**, and you have it in your hand: the register of the state of charge and of the power, the kind of number each is, and its scale.
- {{cb}} It speaks Modbus where the box can reach it: on the site's network at an address of its own (Modbus TCP), or on its own RS-485 port.
- {{cb}} On RS-485, it can be set to the cable's speed (9600 baud, 8 data bits, no parity, 1 stop bit) and to a number no other device has.
- {{cb}} Reading it needs no password that changes, and no cloud account: the box reads registers and nothing else.

::: stop
**If the maker will not give the register table, leave the battery out,** and say so at handover. A register taken from a forum, or from another model, would show a charge that looks right and is not. Greecon only reads: it never sets a battery's mode, its limits or anything else.
:::

## At each kind of site

@@SITES@@

## What Greecon reads from it

| Reading in Greecon | Unit | What it must be | Standard alert |
|-----------------|-------|------------------------------|---------------------|
| **{{ui.reading_battery_charge}}** | % | The state of charge, 0 to 100 | **Low below 25 percent**, a {{ui.check_today}} alert. Set it above the reserve the battery system keeps for itself |
| **{{ui.reading_battery_power}}** | kW | The battery's power, **positive while charging** and negative while it discharges | None |

A charge outside 0 to 100, or a power beyond 2,000 kW either way, is called a reading that cannot be real.

## Settings, and where they are made

Nothing is set on the battery by Greecon. What is entered is in the platform, by the project manager, from the maker's table:

| What | Where it comes from |
|-----------------|-------------------------------------------|
| Its address | The battery's own address on the network; or, on RS-485, the converter's address |
| Its port | The maker's table (502 is usual) |
| Its unit number | The maker's table; on the data cable, a number no other device has (for example 8) |
| For each reading: the register kind, the address, the kind of number, which half comes first, and the scale | The maker's table |

## Fitting

Nothing is fitted. The battery is already there, and its installer's work is not touched.

- {{cb}} If it joins Greecon's data cable (RS-485), {{who:pm}} connects A, B and the ground at the battery's communication port, as the battery's manual draws it, at the end of the daisy chain. Nothing inside the battery's power side is opened.
- {{cb}} If it is on the network, nothing is connected: the box reaches it through the router.

## In the platform

The solar template makes the device **{{ui.device_battery}}** with its two readings and no registers.

1. **No battery at this plant:** press **{{ui.site_does_not_have}}** under it in step 4, and nothing waits for it.
2. **Its address** (step 4, **{{step:4}}**): the box cannot recognise a battery on a network, so its line says **{{ui.found_by_hand}}**. Under the device open **{{ui.enter_address_by_hand}}**, fill in the **{{ui.ip_address}}**, the **{{ui.port}}** and the **{{ui.unit_number}}**, and press **{{ui.save}}**.
3. **Its readings** (step 5, **{{step:5}}**): under each reading press **{{ui.choose_the_register}}**. The register kind is **{{ui.register_input}}** for a manual's 3xxxx and **{{ui.register_holding}}** for 4xxxx. The address counts from zero (40001 is address 0). Choose the kind of number and, for a number of two registers, which half comes first. Under how it becomes the reading choose **{{ui.multiply_and_add}}**: a battery that reports watts for a reading in kW is multiplied by 0.001. Press **{{ui.save_the_register}}**.
4. **Its limit** (step 10, **{{step:10}}**): agree the low-charge limit with the owner.

## Acceptance test

- {{cb}} Each register is read from the box before it is relied on, and the number is the one on the battery's own display:

```
greecon-edge modbus-test --host 192.168.1.60 --unit 8 --type holding --address 0 --data-type uint16 --scale 0.1
```

(The address, the unit, the kind and the scale are the maker's: these are an example.)

::: tests
| Check and how | Pass when | Greecon shows | Real | Result |
|----------------------|-----------------|--------|--------|--------|
| **{{ui.reading_battery_charge}}.** Against the battery's own display. | The two agree (write both numbers) | | | {{pf}} |
| **{{ui.reading_battery_power}}.** While the battery is charging, and again while it discharges. | Positive while charging, negative while discharging, and the size agrees with the battery's display | | | {{pf}} |
:::

## What goes wrong

| What you see | Likely cause | What to do |
|-------------------|----------------------|------------------------------|
| **A reading is a thousand times too big** | Watts shown as kilowatts | In the register form, multiply by 0.001 |
| **The power has the wrong sign** (negative while charging) | The maker counts the other way | In the register form, under *Multiply by*, enter a negative number (for example -0.001), so that charging is positive |
| **A reading is constant, or zero** | A wrong register, or the wrong register kind (input against holding) | Read the register from the box twice, a minute apart, against the maker's table |
| **The battery does not answer** | Its address, its port or its unit number; on RS-485, its speed or A and B | Check each against the maker's table and the battery's own settings page |

## Not yet proven

- No battery has been read by this software, and no battery model is approved. Every battery is a first time: the acceptance test above is the proof, for that battery.
- The energy picture shows a battery only from these two readings. If only one can be mapped, say at handover which one is missing.

## What to write down

There is nothing to buy. Write on the commissioning record:

::: {.form .short}
| Field | Answer |
|----------------------------------------|--------------------------------------------------|
| Battery make, model and firmware version | |
| Where the register table came from (document and date) | |
| Address, port and unit number entered | |
| Register, kind of number and scale of the charge | |
| Register, kind of number and scale of the power | |
| Acceptance test passed on (date), by | |
:::
