A soil moisture probe sits in the soil of an irrigation zone and says how wet the soil is at its depth. It speaks Modbus RTU on the same data cable as everything else. **No model of soil probe is approved yet.** Greecon does not know any probe's registers, and the box cannot recognise one on a network. So a probe qualifies by its maker's register table, its address is entered by hand, and its reading is mapped by hand from that table.

## At a glance

@@GLANCE@@

## How it qualifies

**It qualifies if:**

- {{cb}} It speaks **Modbus RTU on RS-485,** on two data wires.
- {{cb}} **Its maker publishes its register table,** and you have it in your hand before you buy: the register that holds the moisture, the kind of number it is, and its scale.
- {{cb}} Its unit number and its speed can be set, and the maker says how: to a number of its own, and to 9600 baud, 8 data bits, no parity, 1 stop bit.
- {{cb}} What it reports becomes a percentage. The reading in Greecon is **{{ui.reading_soil}}**, from 0 to 100, and the table says how the probe's number becomes one.
- {{cb}} It is made to stay in the soil, and its cable reaches a dry junction with no joint in the ground.
- {{cb}} Its supply voltage is one the kit has: read its label against the 24 V supply.

::: stop
**Do not buy a probe whose register table you have not seen.** A probe whose maker does not document its registers cannot be mapped honestly, so it cannot be used. **And never bury a probe before its number is set:** one that was not must be dug up.
:::

## At each kind of site

@@SITES@@

## What Greecon reads from it

One reading for each probe: **{{ui.reading_soil}}**, in percent.

| | |
|--------------------------|------------------------------------------------------|
| What is real | 0 to 100. Outside that, Greecon says that the number cannot be soil moisture |
| Standard alert | None |
| The limit | *Start irrigating below*. It has **no standard value**: the same percentage is waterlogged in sand and bone dry in clay, and it depends on the crop, the depth of the roots and the probe |
| Until the limit is entered | Greecon gives no irrigation advice. It shows the reading and its trend |
| Once it is entered | Greecon says when the soil has fallen below it. That is ordinary work on a farm, not an alert |

Soil readings are only as good as the contact between the probe and the soil, and they mean little without the probe's depth and place. Both are written down.

## Settings, and where they are made

| Setting | Value | Where |
|-----------------|-------------------------------------------------|-----------|
| Unit number | **6.** A second probe, for a second zone, takes the next free number: 8, then 9. Many probes are delivered as 1, the same as another device. Set it the maker's way, with the USB-to-RS-485 adapter and no other device on the cable | At the office |
| Speed | 9600 baud, 8 data bits, no parity, 1 stop bit, set the maker's way | At the office |
| Its label | The number, written on the probe's cable at the end that stays above the ground | At the office |

## Fitting

{{who:pm}} with the grower, who says where and how deep.

{{diagram:kit-f-wiring}}

- {{cb}} **The place is typical of the zone:** not its wettest spot and not its driest. Walk the field with the grower and choose it together.
- {{cb}} **The depth is where the roots are.** Ask the grower.
- {{cb}} The probe is placed as its maker says, **in good contact with the soil,** with no air gap around it.
- {{cb}} It joins the data cable in the daisy chain: A to A, B to B, no branches ([sheet HW03](#hw-cable)). Plan the whole run under 100 metres.
- {{cb}} **Write down each probe's depth and place, and photograph it** before the soil is closed.

## In the platform

The farm template makes the device **{{ui.device_soil}}** with its reading and no register.

1. **Its address** (step 4, **{{step:4}}**). The box cannot recognise a probe, so its line says **{{ui.found_by_hand}}**. Under the device open **{{ui.enter_address_by_hand}}** and fill in the **{{ui.ip_address}}** (the converter's: the water module's line shows it, as *Reached at 192.168.1.50:502, unit 3*), the **{{ui.port}}** (502) and the **{{ui.unit_number}}** (6). Press **{{ui.save}}**.
2. **Its register** (step 5, **{{step:5}}**). Under the reading press **{{ui.choose_the_register}}**. The register kind is **{{ui.register_input}}** for a manual's 3xxxx and **{{ui.register_holding}}** for 4xxxx. The address counts from zero (30001 is address 0). Choose the kind of number, and under how it becomes the reading choose **{{ui.multiply_and_add}}**: a probe that reports tenths of a percent is multiplied by 0.1. Press **{{ui.save_the_register}}**.
3. **A second zone.** On the site's **{{ui.equipment_and_readings}}** page, under *Add equipment or a reading by hand (advanced)*, add a second soil probe and its reading. Then give it its address and its register as for the first, with its own unit number (8).
4. **The limit** (step 10, **{{step:10}}**). Leave *Start irrigating below* empty on the day. After the first week of readings, ask the grower which reading means "time to water", and enter it.

Write what you enter:

::: {.form .short}
| Probe | Unit number | Register kind | Address | Kind of number | Multiply by | Depth and place |
|-----------|-------|---------|-------|----------|--------|-----------------|
| Zone 1 | 6 | | | | | |
| Zone 2 | 8 | | | | | |
:::

## Acceptance test

**At the office, on the desk, before anything is buried:**

- {{cb}} The probe has its number (6), alone on the cable, and is labelled.
- {{cb}} Behind the converter, its register is read from the box, and the number is believable:

```
greecon-edge modbus-test --host 192.168.1.50 --unit 6 --type input --address 0 --data-type uint16 --scale 0.1
```

(The kind, the address, the kind of number and the scale are the maker's: these are an example.)

- {{cb}} In the air it reads low, and in a glass of water it reads high.

**On the day, as part of commissioning:**

::: tests
| Check and how | Pass when | Greecon shows | Real | Result |
|----------------------|-----------------|--------|--------|--------|
| **{{ui.device_soil}}.** In the air, then in a glass of water, then in the soil. | Three different readings: low in the air, high in the water, plausible in the soil | | | {{pf}} |
:::

## What goes wrong

| What you see | Likely cause | What to do |
|-------------------|----------------------|------------------------------|
| **The probe does not answer** | A wrong unit number (left as delivered, the same as another device), a number or an address entered wrongly, a speed that is not the cable's, A and B swapped, or no power | Check each, in that order. Test the register from the box against the maker's table |
| **The reading never changes,** or is the same in the air and in water | A wrong register, the wrong register kind (Input against Holding), or a wrong scale | Read the maker's table again and test the register from the box |
| **The reading is ten times too big or too small** | The scale | Under **{{ui.multiply_and_add}}**, multiply by the table's factor |
| **The reading is believable but does not follow watering** | Poor contact with the soil, or a place that is not typical of the zone | Place the probe again, with the grower. Write the new depth and place |
| **No irrigation advice is shown** | *Start irrigating below* has no standard value | After the first week, ask the grower and enter it (step 10) |

More is in {{ref:runbooks}}: R2 (a device does not answer) and R3 (a reading looks wrong).

## Not yet proven

- **No soil probe has been read by this software, and no model is approved.** Every make is a first time: the test above is the proof, for that probe.
- Greecon says nothing about what a soil reading means for a crop. The limit is the grower's own, and Greecon never waters anything: it only reads.
- The prices are planning figures, not quotes.

@@BUYING@@
