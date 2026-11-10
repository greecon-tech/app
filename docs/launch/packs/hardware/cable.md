Every meter, module and field sensor of a kit hangs on one two-wire data cable (RS-485) that starts at the converter. Almost every fault that looks random comes from how this cable was run, not from what was bought, so this sheet is mostly rules. The labels are on the same sheet because they are fitted at the same time, and because the next person to open the enclosure has nothing else to go by.

## At a glance

@@GLANCE@@

## How it qualifies

**It qualifies if:**

- {{cb}} The data cable is **shielded twisted pair**: one pair for A and B, with a conductor for the ground where the devices have a GND terminal.
- {{cb}} The network cables are ordinary patch cords, one for the box and one for the converter, tested with a cable tester.
- {{cb}} There are ferrules for every stranded end, and labels for every device and for both ends of every wire.

::: stop
**Do not** use unshielded cable for the data line, do not run it in the same duct as power cables, and do not join devices with branches. A cable that qualifies and is run as a star still fails.
:::

## The rules of the cable

{{diagram:ref-rs485}}

- **One cable, a daisy chain:** from the converter to the first device, on to the next, and so on. No branches: stars and tees cause the errors that look like random failures.
- **A to A and B to B at every device.** A and B swapped is the commonest mistake. If nothing answers, swap the two wires at the converter.
- **The shield joined to ground at one end only.** Keep the cable away from power cables, and note any place where it has to cross one.
- **Every device its own number, the same speed.** They are set at the office: on site you check each label and do not change it.
- **A 120 ohm resistor** across A and B at each end of the cable only for a run longer than about 50 metres, or if readings are unreliable at 9600 baud.
- **Plan the whole run under 100 metres.** A sensor further away than that needs another plan: ask the founder before promising it.

## At each kind of site

@@SITES@@

## Labels

Label, on the day, and photograph before the enclosure is closed:

- {{cb}} The unit number on every device (it was set at the office), and the settings on the converter.
- {{cb}} The number of every wire, at both ends.
- {{cb}} The site name and the date, on a sticker inside the lid of the enclosure, and on the box.

**Never write a code or a password on anything.**

## Fitting

{{who:pm}} runs the cable, and connects it at the converter, the modules and the field sensors. {{who:e}} connects its ends at any device inside a distribution board (the meters), because their terminals are inside the board.

- {{cb}} Walk the route first, and write down its length.
- {{cb}} Strip, fit ferrules, and connect A, B and the ground in the same order at every device.
- {{cb}} Join the shield to ground at the converter's end only.
- {{cb}} Fix the cable so that it cannot be pulled, and seal the glands.

## In the platform

The cable is not in the platform. What it carries is: when it is right, **{{ui.find_equipment}}** finds every device at its own number, and step 6 of the setup list, **{{step:6}}**, turns **{{ui.status_done}}** by itself.

## Acceptance test

- {{cb}} The patch cords pass the cable tester.
- {{cb}} **{{ui.find_equipment}}** finds every device of the kit, each at its own number.
- {{cb}} On the box, `greecon-edge status` lists every device as **ok**, and still does an hour later.
- {{cb}} The length of the run, and whether a resistor was fitted, are written on the commissioning record.

## What goes wrong

| What you see | Likely cause | What to do |
|-------------------|----------------------|------------------------------|
| **Nothing behind the converter answers** | A and B swapped | Swap the two wires at the converter |
| **One device does not answer, the others do** | That device's own A and B, its power, or the number on its label | Check its two wires and its power. Read its label against the install card. Numbers are not changed on site |
| **Devices answer, then fail now and then** | A branch in the cable, the shield joined to ground at both ends, a run beside power cables, or a long run with no resistor | Make it one line. Ground the shield at one end. Move it away from power. Over about 50 metres, fit the 120 ohm resistors |
| **Two devices answer over each other** | Two devices with the same number: one was not numbered at the office | That part goes back to the office, or the spare that was numbered there is fitted |

## Not yet proven

- The figures on this sheet (under 100 metres, a resistor over about 50 metres) are rules of thumb from the hardware guide, not measurements at a Greecon site. Write down the length of every run and whether a resistor was needed: the first sites will say whether the rule holds.

@@BUYING@@
