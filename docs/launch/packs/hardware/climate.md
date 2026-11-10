The temperature and humidity sensor reads the air at the field or in the greenhouse. The platform calls it the **{{ui.device_weather}}**. It speaks Modbus RTU on the same data cable as everything else. **No model is approved yet,** so it qualifies by its maker's register table: its address is entered by hand, and its two readings are mapped by hand. Its most useful work is the frost alert, and that uses the grower's own number.

## At a glance

@@GLANCE@@

## How it qualifies

**It qualifies if:**

- {{cb}} It speaks **Modbus RTU on RS-485,** on two data wires.
- {{cb}} **Its maker publishes its register table,** and you have it before you buy: the register of the temperature and of the humidity, the kind of number each is, and its scale.
- {{cb}} **The table says how a temperature below zero is given.** It is usually a signed 16-bit number.
- {{cb}} Its unit number and its speed can be set, and the maker says how: to a number of its own, and to 9600 baud, 8 data bits, no parity, 1 stop bit.
- {{cb}} It is made for where it will hang: outdoors, a sensor with a shield against sun and rain.
- {{cb}} Its supply voltage is one the kit has: read its label against the 24 V supply.

::: stop
**Do not buy a sensor whose register table you have not seen.** A sensor whose maker does not document its registers cannot be mapped honestly, so it cannot be used.
:::

## At each kind of site

@@SITES@@

## What Greecon reads from it

| Reading in Greecon | Unit | What is real | Standard alert |
|---------------------|---------|-----------------|-------------------------------------|
| **{{ui.reading_air_temp}}** | °C | -40 to 70 | None. *Frost alert at or below* has **no standard value** |
| **{{ui.reading_humidity}}** | % | 0 to 100 | None |

**The frost alert.** Frost belongs to the crop: the same air is harmless to one and ruinous to another, and it depends on how far on the crop is. So nobody can set the limit for the grower, and until it is entered Greecon says nothing about frost. Once it is entered, an **{{ui.act_now}}** alert opens when the air has been at or below it for two minutes: *Frost: the air at the field has fallen to the frost limit*. It can come in the night, so agree who is woken.

## Settings, and where they are made

| Setting | Value | Where |
|-----------------|-------------------------------------------------|-----------|
| Unit number | **7.** Many sensors are delivered as 1, the same as another device. Set it the maker's way, with the USB-to-RS-485 adapter and no other device on the cable | At the office |
| Speed | 9600 baud, 8 data bits, no parity, 1 stop bit, set the maker's way | At the office |
| Its label | The number, written on the sensor | At the office |

## Fitting

{{who:pm}}

- {{cb}} **In the shade,** a metre or two above the crop, away from walls and from the pump house. A sensor in the sun reads the sun, not the air.
- {{cb}} In a greenhouse: at the height of the crop, away from the heater, the vents and the door.
- {{cb}} It joins the data cable in the daisy chain: A to A, B to B, no branches ([sheet HW03](#hw-cable)).
- {{cb}} Photograph where it hangs, and write the place down.

## In the platform

The farm template makes the device **{{ui.device_weather}}** with its two readings and no registers.

1. **Its address** (step 4, **{{step:4}}**). The box cannot recognise the sensor, so its line says **{{ui.found_by_hand}}**. Under the device open **{{ui.enter_address_by_hand}}** and fill in the **{{ui.ip_address}}** (the converter's: the water module's line shows it), the **{{ui.port}}** (502) and the **{{ui.unit_number}}** (7). Press **{{ui.save}}**.
2. **Its registers** (step 5, **{{step:5}}**). Under each reading press **{{ui.choose_the_register}}**. The register kind is **{{ui.register_input}}** for a manual's 3xxxx and **{{ui.register_holding}}** for 4xxxx, and the address counts from zero. Under how it becomes the reading choose **{{ui.multiply_and_add}}**: a sensor that reports tenths of a degree is multiplied by 0.1. Press **{{ui.save_the_register}}**.
3. **Map the temperature as a signed number (int16).** Mapped as an unsigned one, a frosty morning reads as a hot afternoon: -2 degrees becomes thousands.
4. **The frost limit** (step 10, **{{step:10}}**). Ask the grower at what air temperature frost damages the crop, and in which weeks. Enter it as *Frost alert at or below*, between -30 and 15 degrees.

Write what you enter:

::: {.form .short}
| Reading | Register kind | Address | Kind of number | Multiply by |
|-----------------|-----------|---------|-------------|----------|
| {{ui.reading_air_temp}} | | | int16 | |
| {{ui.reading_humidity}} | | | | |
:::

## Acceptance test

**At the office, on the desk:**

- {{cb}} The sensor has its number (7), alone on the cable, and is labelled.
- {{cb}} Behind the converter, both registers are read from the box, and the numbers are the room's:

```
greecon-edge modbus-test --host 192.168.1.50 --unit 7 --type input --address 1 --data-type int16 --scale 0.1
```

(The kind, the address, the kind of number and the scale are the maker's: these are an example.)

**On the day, as part of commissioning:**

::: tests
| Check and how | Pass when | Greecon shows | Real | Result |
|----------------------|-----------------|--------|--------|--------|
| **{{ui.device_weather}}.** Against a hand-held thermometer at the sensor. No tolerance is laid down: write both numbers and judge. | Plausible for the time of day, and close to the thermometer | | | {{pf}} |
:::

## What goes wrong

| What you see | Likely cause | What to do |
|-------------------|----------------------|------------------------------|
| **A frosty morning reads as a hot afternoon,** or as thousands of degrees | The temperature was mapped as an unsigned number | Map it as int16 (signed), with the scale of the sensor's table |
| **The sensor does not answer** | A wrong unit number (left as delivered), a number or an address entered wrongly, a speed that is not the cable's, A and B swapped, or no power | Check each, in that order. Test the register from the box against the maker's table |
| **Temperature and humidity are swapped** | The two registers are the other way round | Read the maker's table again |
| **A reading is ten times too big** | The scale | Under **{{ui.multiply_and_add}}**, multiply by the table's factor |
| **The air reads far hotter than the thermometer at midday** | The sensor is in the sun, or by a wall | Move it into the shade, away from walls |
| **No frost alert came on a frosty night** | The frost limit was never entered | Enter the grower's own number (step 10), and send a test message to the person who is woken |

More is in {{ref:runbooks}}: R2 (a device does not answer) and R3 (a reading looks wrong).

## Not yet proven

- **No temperature and humidity sensor has been read by this software, and no model is approved.** Every make is a first time: the test above is the proof, for that sensor.
- The frost alert is tested in software. It has not yet been seen on a real frosty night.
- The prices are planning figures, not quotes.

@@BUYING@@
