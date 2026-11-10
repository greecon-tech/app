The 24 V supply is the one clean place the kit's low-voltage parts take their power from: the converter, the two modules and the transmitters' loops, and the box if the box takes 9 to 36 V. It sits on the DIN rail in the enclosure, on the mains side, behind its own fuse or small breaker. Its mains side is the electrician's work. Its 24 V side is the project manager's.

## At a glance

@@GLANCE@@

## How it qualifies

Any make qualifies that meets every line below.

**It qualifies if:**

- {{cb}} It gives **24 V DC,** fits a DIN rail, and is rated **30 to 60 W.**
- {{cb}} The mains voltage on its label is the site's.
- {{cb}} **Its power covers the kit.** Add up what the labels of everything it feeds say, and take a supply rated for that and half as much again. As a guide: 30 W is enough for the converter, the modules and the loops; take 60 W where the box or the 4G router shares the supply.
- {{cb}} Its data sheet says that its output is protected against a short circuit and an overload.
- {{cb}} It is a known make, with its safety approvals on the label, and the electrician who connects it accepts it. It is the part of the kit that is connected to the mains.

::: stop
**Do not use** a plug-in charger or an open supply with bare terminals in the enclosure. **The project manager never connects the mains side:** that is the electrician's work, and it has its own fuse or small breaker.
:::

## At each kind of site

@@SITES@@

## What it feeds

| It feeds | The part takes | When |
|-----------------------|------------------------|--------------------------------------|
| The converter | 9 to 36 V DC | Always |
| The 4 to 20 mA module | 7 to 36 V DC | Kits H, F and W |
| The pump contact module | The voltage on its label | Where there is a pump to watch |
| Each transmitter's loop | The loop's current, up to 20 mA | A two-wire transmitter takes its power from the loop |
| The box | 9 to 36 V DC | Only a box that takes 9 to 36 V. A box that takes 12 V keeps its own supply, or a small adapter from 24 V to 12 V |
| The 4G router, a soil probe, the weather sensor | The voltage on its label | Only if its label allows 24 V |

Read every label before a part is connected to 24 V. A part made for 5 V or 12 V is destroyed by 24 V.

## Settings, and where they are made

| Setting | Value | Where |
|-----------------|-------------------------------------------|----------------|
| Output voltage | 24 V. Many supplies have a small screw that trims it: leave it at 24 V | Measured with the multimeter, at the office |

## Fitting

{{who:e}} connects its mains side. {{who:pm}} connects the 24 V side.

{{diagram:ref-power}}

- {{cb}} It sits on the DIN rail, on the mains side of the enclosure, with the air around it that its manual asks for.
- {{cb}} **The mains comes in through its own fuse or small breaker.** The electrician connects it.
- {{cb}} Where the site has a mains UPS, the supply is behind it, so that the modules and the loops keep working in a short power cut ([sheet HW16](#hw-ups)).
- {{cb}} On the 24 V side, plus and minus go to the terminal blocks, and from there to each part. Plus and minus are checked against each part's label before the supply is switched on.
- {{cb}} Each transmitter's loop has the supply in series with the module's input, as the module's manual draws it ([sheet HW08](#hw-analog)).
- {{cb}} Number every wire at both ends.

## In the platform

The supply is not in the platform, and Greecon does not read it. What shows that it is working is everything it feeds: the modules answer, and the transmitters read 4 mA or more.

## Acceptance test

**At the office, on the desk.** The electrician makes up the office's bench lead: the project manager never wires mains.

- {{cb}} With nothing connected, the multimeter reads 24 V at the output, within a volt.
- {{cb}} With the whole kit connected and running for an hour, it still reads 24 V, and the supply is not hot.
- {{cb}} The box finds every device (`greecon-edge find --host 192.168.1.50`).

**On the day, as part of commissioning:**

::: tests
| Check and how | Pass when | Greecon shows | Real | Result |
|----------------------|-----------------|--------|--------|--------|
| **The 24 V side.** With everything connected, measure at the supply's output and at the part farthest from it. | 24 V at both, within a volt | | | {{pf}} |
:::

## What goes wrong

| What you see | Likely cause | What to do |
|-------------------|----------------------|------------------------------|
| **Everything on the 24 V side is dark** | No mains at the supply: its fuse or breaker, or the UPS in front of it | The electrician checks the mains side. You do not open it |
| **The supply's light is on, and one part is dark** | A loose 24 V wire, or plus and minus the wrong way round at that part | Switch the supply off, and check the two wires against the part's label |
| **The 24 V sags, or the supply clicks on and off** | Too much on the supply, or a short circuit on the 24 V side | Disconnect the parts one at a time to find it. A 30 W supply that also feeds the box or the router is changed for 60 W |
| **Every transmitter reads below zero at once** | The loops have lost their 24 V | As the first line. One transmitter alone is a wire: see its own sheet |

More is in {{ref:runbooks}}: R2 (a device does not answer).

## Not yet proven

- What each part really draws has not been measured: the guide above is from labels. Measure it at the rehearsal of the first kit, and write the figure down.
- The prices are planning figures, not quotes.

@@BUYING@@
