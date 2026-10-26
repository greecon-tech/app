This book takes the platform from nothing to live, and a customer from the first call to day 90. Three people use it: the founder, the project manager and the electrician. Read this part first. It says who does what, how the pieces fit together, which pack goes with which site, and what must be ready before the first customer.

## [1.1]{.num} Who does what

| Who | Does | Never does |
|-------------|------------------------------|-----------------------------|
| **The founder** | Puts the platform on the internet, once (Part 2). Gives the project manager a login. Owns every incident about the platform or about security. Reads the morning check when the project manager is away. Meets the customer at day 60 and day 90 | Hands out hardware, or installs anything at a customer, before the go-live checklist is ticked |
| {{who:pm}} | Surveys, prepares the customer in Greecon and the box at the office, installs the low-voltage side with the electrician, works down the setup list, commissions, hands over, and looks after the site (Parts 3 and 6) | Works inside a distribution board. Touches the solar panels' wiring, a tank that must be entered, wastewater or chemicals. Promises a saving. Says Greecon is a safety system |
| {{who:e}} | All the mains-voltage work: meters' voltage taps and current clamps, the pump's run contact, anything inside a distribution board, under the customer's lock-out procedure | Works on a live conductor for Greecon's sake. Connects anything of Greecon's to a control circuit |
| {{who:c}} | Names the people who are told, gives access and a socket that stays on, starts and stops their own equipment, signs the handover | |

The colours used for these people in every step table are the same all through the book: black for the electrician, green for the project manager, sand for the customer.

::: stop
**Five rules that never bend** (section 3.1 has all six).

1. **Greecon only reads.** It never switches anything. Never connect a wire from Greecon's equipment to a pump starter, an inverter's control, a valve or any safety circuit.
2. **Anything inside a distribution board is the electrician's work,** under the customer's lock-out procedure. The project manager watches and writes it down. Nobody works on a live conductor.
3. **The project manager does the low-voltage and software side only.**
4. **Never touch the solar panels' wiring (DC),** a tank you must climb into, wastewater or chemicals.
5. **Greecon is not a safety system.** The float switches, relief valves and trips already in the customer's equipment stay the safety layer.
:::

## [1.2]{.num} How the pieces fit together

{{diagram:how-it-works}}

Meters and sensors at the site are read by a small computer, the **box**. The meters and modules share one two-wire cable (RS-485); a **converter** puts that cable on the network so that the box can reach every device. The box sends what it reads to the platform over the internet, and keeps about three days of readings if the internet is down. The platform turns readings into a picture of the site and, when something needs attention, tells the people on the list. Everything points one way: Greecon reads, and nothing it does can switch a pump, an inverter or a valve.

## [1.3]{.num} The path of a customer

{{diagram:order-of-things}}

Section 3.3 has the table of the eleven stages with who does what and how long each takes. The two days on site are the install day and the commissioning; everything else is at the office, at the telephone, or a five-minute morning check.

## [1.4]{.num} Which pack for which site

| If the site has | Use | Template in the platform | The pack is |
|---------------------------|--------------|---------------------|-----------|
| A water tank and pump, solar on the roof and a grid connection (the usual first site) | **Kit {{kit.H.letter}}**: {{kit.H.name}} | {{kit.H.template}} | {{ref:packs}}, PDF 04 |
| Solar and the grid, with or without a battery | **Kit {{kit.S.letter}}**: {{kit.S.name}} | {{kit.S.template}} | PDF 05 |
| Soil and weather at a field, with the water supply behind it | **Kit {{kit.F.letter}}**: {{kit.F.name}} | {{kit.F.template}} | PDF 06 |
| A tank, a pump and the pipe it feeds | **Kit {{kit.W.letter}}**: {{kit.W.name}} | {{kit.W.template}} | PDF 07 |
| None of these | Ask the founder: the platform has an empty template, to be used only when nothing else fits | | |

The Hardware Reference (Part 4) describes every part of every kit, and Appendix D has the shopping lists with room for three quotes.

## [1.5]{.num} Before the first customer

Tick these before the first customer is surveyed. Nothing here needs a technician.

- {{cb}} **The platform is live,** and the founder has ticked every line of the go-live checklist (Part 2, the last page).
- {{cb}} **The project manager has a login** of their own and has chosen their own password.
- {{cb}} **The rehearsal is done** (section 3.11, record A.5): the whole job on a desk, with a laptop standing in for the meters. It finds the mistakes in the room instead of at a hotel.
- {{cb}} **One full kit has been bought and bench-tested.** Change the specification, not the kit, when something fails. Quotes for every part are in the shared drive.
- {{cb}} **The spares kit is complete,** and the project manager's tools are in the car (Appendix D).
- {{cb}} **An electrician is named, and a second one,** and the contact sheet is filled in (Appendix E).
- {{cb}} **The pilot order form and the discovery questions** are to hand (the Sales kit, document 04, is not part of this book).

## [1.6]{.num} How to read this book

**The set.** The same text is printed in eight PDFs, so that each reader prints only what they need. A part has the same number and the same words in every PDF it appears in.

| PDF | For | Print |
|------------------------|---------------|-------------------|
| 00 Complete Deployment Guide | Everyone | Once, to keep in the office |
| 01 Founder Go-Live Guide (Part 2) | The founder | Once, before the first customer |
| 02 Project Manager Field Manual (Parts 3 and 6, the runbooks a project manager uses, the appendices) | The project manager | Once, and the forms for each site |
| 03 Hardware Reference (Part 4) | The project manager and the electrician | Once, for the spares kit |
| 04 to 07 Site packs H, S, F and W (Part 5) | The project manager and the electrician at that kind of site | The whole pack, for each site |

**Marks.** A box to tick is a real square, to be ticked in pen. Shaded boxes: **Do** (do this), **Check** (check this), **Stop** (stop, and call the electrician where it says so), **Tip** and **Say** (words for the customer). Every drawing is labelled with its kit (Figure H-2 is the wiring of kit H) and shows how the parts connect, not terminal numbers: follow the maker's manual for terminal numbers.

**Prices** are planning estimates in EUR, excluding VAT and labour, from public shop prices seen in October 2026. They are not quotes. Replace them with real quotes in the first week.

**Screen names** follow the web app as redesigned in October 2026: Greecon's team has **{{ui.today}}**, **{{ui.clients}}**, **{{ui.requests}}**, **{{ui.team}}** and **{{ui.settings}}**; a customer has **{{ui.overview}}**, **{{ui.sites}}**, **{{ui.alerts}}**, **{{ui.reports}}** and **{{ui.settings}}**.

**What this book is made from.** The launch documents in `docs/launch/` and the platform's own code; it is rebuilt with `npm run docs:pdf`. If something in it does not match what you see, fix the source and rebuild, and do not mark up the PDF. The ten setup-list step titles are checked against the platform at every build. A maker's terminal numbers, register tables and menus are in the maker's manual that came with the part.
