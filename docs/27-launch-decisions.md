# 27. Launch decisions

**Status:** decided on 19 October 2026 by Claude, acting for the founder, who asked for every department's decisions
to be made so that Greecon could be put on the market with a project manager. They are **decisions, not facts**.
They rest on the research in [17](17-constitution.md) to [26](26-research-register.md) and on engineering judgement, and
none has been reviewed by a lawyer, an electrical engineer, an accountant or a customer. The founder can reverse any of
them; the last column says what would make that sensible. A decision is changed by a new record that supersedes this
one, never by editing it quietly (see [the index](README.md)).

The practical pages that follow from these decisions are in [launch/](launch/README.md).

## The decisions

| # | Decision | Why | What would change it |
|---|---|---|---|
| **L1** | **First customers: hotels and guesthouses** on the coast, 6 to 60 rooms, with a water tank and pump, solar and a grid connection | Two bills and two ways to fail (a tank dry in July, solar quietly stopped) and one person who decides; they scored highest in [25](25-roadmap-and-proof-gates.md) (22 of 30) | Fewer than 3 of the first 20 owners describe a costly failure in their own words, or most say the installer already solves it: go to installers or commercial solar |
| **L2** | **Second: farms with irrigation and commercial solar. Channel: electricians and solar installers** (they fit it and keep the install; Greecon keeps the subscription) | Farmers buy slowly and cheaply; installers multiply reach | Three installers each asking for ten sites in writing |
| **L3** | **A paid, read-only, 90-day pilot.** Pilot fee **EUR 250**, once, at signing; Greecon lends the equipment; a decision meeting on **day 60** against three goals written at signing (readings current 95 percent of the time; the owner reads the morning message on 5 days in 7, as the owner says, because Greecon does not track opens; one real event caught); one extension of at most 30 days; if they stop, Greecon removes its equipment in 14 days and they keep their data | Paid from day one is what separates a pilot from a free trial that never ends ([25](25-roadmap-and-proof-gates.md)); EUR 250 is small enough for an owner to sign without a committee and real enough to mean something | A buyer who refuses any fee but wants it: ask what they will pay; one who wants it free: say no |
| **L4** | **After the pilot: the customer buys the hardware at cost** (the pilot fee is credited), and pays a **monthly fee per site from day 91: EUR 20 (Essentials), EUR 40 (Standard, the usual hotel), EUR 80 (Plus)**. Never per sensor | Hardware at cost keeps Greecon's money free and the customer free to leave; per site means a new sensor is not a penalty. The three prices are a hypothesis to test, not a market fact | The lowest price at which three of the first five pay without a discount sets the price |
| **L5** | **Greecon lends the first five kits** (EUR 4,000 to 9,000, plus the electrician and travel) **unless that is too much cash:** then the customer buys the hardware on day one and the pilot fee falls to EUR 150 | The founder decides this with eyes open before the first order form goes out. A kit that stays Greecon's until a customer converts is the better pilot; a customer-owned kit is the safer cash position | Cash available. This is the founder's one money decision before the first signature |
| **L6** | **Sales-led, not self-service.** The sign-in page has **Request access**; the request is emailed to Greecon and listed under **Requests**; the project manager answers within one working day. No form creates an account by itself | An account is only useful with a site, a box and a person who answers; a stranger cannot be given one. It is also the safest | A queue of installers who can onboard their own customers |
| **L7** | **The project manager installs the first five sites with a subcontracted electrician; the founder owns every incident, with the project manager as deputy. Hire after five paid sites** | One person's work is learned before it is split; the electrician carries the part that needs a licence | Five paid sites; or more than eight hours a week of support per site |
| **L8** | **One way to install:** standard kits bought by specification; the box prepared at the office; one pasted line; the box asks the platform what to read; a replacement box takes the old one's place with a new code | Cheapest to run across many sites for many years; a mistake is found at a desk and not at a hotel | A different box or converter proves better in the first five |
| **L9** | **The box: a fanless x86 mini PC with an SSD or eMMC, a real-time clock, and "power on after power loss".** A Raspberry Pi 5 is allowed with a proper SSD, never an SD card. An industrial PC only where heat or vibration needs it | Albania's power cuts corrupt SD cards; an x86 box with a disk survives them | Failures in the first five |
| **L10** | **Measure at the AC cable with Eastron meters,** one at the supply entry and one on the inverter's output, instead of reading the inverter | Works with any inverter brand; the figure is Greecon's own, not the maker's | An inverter maker that gives written access to its meter data |
| **L11** | **Email first; text for Act now only.** Act now: email at once, text 10 minutes later if nobody has acknowledged, the next person after 30 minutes (email and text). Check today: one email to the first person, held through quiet hours (22:00 to 07:00). Everything else is shown, never pushed. One morning message at 07:30. No WhatsApp, Viber, voice or app push yet | Alert fatigue destroys trust faster than silence; texts are the expensive, intrusive channel and are kept for what cannot wait | A customer asking in writing for WhatsApp or Viber; Twilio's reach to Albanian networks proving poor |
| **L12** | **English only for now.** Speak Albanian in conversation; nothing Greecon sends is written in Albanian until a native editor has read it | The founder's decision; messages and interface are English throughout | An owner who will not use an English message; then pay for a native edit |
| **L13** | **Read-only. Greecon is not a safety system.** No command reaches equipment until the release gate in [23](23-safety-and-security-case.md) is met | The platform measures and tells; the protection in the customer's equipment stays the safety layer | The release gate: 90 days of read-only operation at 98 percent current data, the same request from three owners, a signed control addendum, the insurer's agreement |
| **L14** | **No savings figure, no "AI", no certification claim.** The product says what the customer's own solar kept on site, at the customer's own prices, from real readings; the demo says "Simulated" | The claims table in [21](21-communication-system.md) | A full season of data and a written baseline: then a measured, adjusted, ranged figure |
| **L15** | **Security: two-factor sign-in waits until after the fifth site, and before any control.** Meanwhile: one account per email address; sign-in rate limited; sessions end at once when a person is turned off or changes their password; staff accounts are the owner's alone to add; every staff action in a customer's account is written under their name; customer data separated by account and tested for it; an outside check on the platform | The first customers hold meter readings and the names of staff, not secrets that can move equipment. Two-factor needs a recovery plan that must work before it locks out the only administrator | The fifth site; any control of equipment; a customer's security questionnaire that requires it |
| **L16** | **Hosting: Railway, in a European region,** with `api.greecon.earth` and `app.greecon.earth`. **`api.greecon.earth` never changes once a box exists.** The paid plan once a customer is live (scheduled backups). Google Cloud later | A box remembers the platform's address; Railway is the least to set up for a founder alone | More than about 50 sites, or a customer whose rules name a hosting country or provider |
| **L17** | **Operations: an outside uptime check, the fleet table, and Greecon's own morning message.** No paging system | Greecon must hear of a silent box before the customer does; at five sites a morning look is enough | About 15 sites: add an immediate message for a silent box |
| **L18** | **The customer's data is theirs and downloadable** (every reading for 31 days, hourly averages for a year, alerts, the audit log, account setup; and, when they stop, every reading Greecon holds, as a file, on request). Deletion on written request, by the founder, after they have their data, in one documented transaction. **No retention rule is built yet** | Required by Law 124/2024 and the EU Data Act; the answer to lock-in | The database nears its volume, or at about ten sites: decide how long raw readings are kept |
| **L19** | **Before the first signature: a lawyer reads the order form, the data terms and the privacy page (`/privacy`), the accountant says how to invoice, and an electrician agrees a written price** | Not optional ([22](22-legal-and-compliance-map.md), section 6) | Nothing |

| **L20** | **Approved equipment only, set at the office.** A kit is made of approved models (the Eastron SDM630 and SDM230 meters, the Waveshare 4 to 20 mA input module and the Waveshare digital input module), each with the same number on the cable in every kit (grid 1, solar 2, water module 3, load or pump meter 4, pump contact 5, soil 6, weather 7) and the same speed (9600, 8, none, 1). Greecon sets the numbers, the speeds and the converter **at the office**; the project manager checks the labels and changes nothing. Equipment that is not approved is added, typed from its datasheet, and the platform says so | A project manager with no engineering skills cannot be asked to know a register or a baud rate; the way to remove the question is to remove the choice ([30](30-guided-setup.md)) | A customer whose equipment must stay; a model that fails on a desk; a maker that stops selling one |
| **L21** | **The box looks at the customer's network only when a person presses "Find equipment", for about a minute, at private addresses only, one port (502), and only reads.** Nothing is scanned on a schedule. The customer's network administrator is told so, in the same words, in writing before the installation day | The aim is that nobody types an address; the price is that Greecon's box looks at a network that is not Greecon's, so it does so only when asked, briefly, narrowly, and in a way that can be explained and defended ([30](30-guided-setup.md), section 4) | A customer's policy that forbids it (then the address is typed, as before); a lawyer's advice on the order form's wording ([22](22-legal-and-compliance-map.md)) |
| **L22** | **Two checks that no one can skip, and that must say who and when:** the papers (the signed order form and the agreed data terms, step 1, before anything goes into the customer's building) and the electrician (name and licence number, or that no electrical work was needed, before commissioning) | The papers and the licence are somewhere else; the record here is the only one a customer, an insurer or a lawyer can find. A step with no name is a step nobody answers for | A register of licences a program may check; a lawyer who wants the papers held in the platform |
| **L23** | **Three messages are always the same** (before the day, for the customer's network administrator, after the handover), written once, with the site's name in them, and each also as an Albanian draft to be read by someone who writes Albanian every day before it is sent | Customers speak Albanian and the interface does not ([L12](27-launch-decisions.md)); a message written afresh each time is a message that forgets to say that Greecon only reads | An owner who needs the interface in Albanian; then a native editor and a template in the platform |

## What was built to make these decisions possible

Research and the first build left a platform that could be shown but not run by a project manager. These were built, in
this order, and each is tested ([18](18-reality-audit.md) has the evidence):

- **A project manager's whole job in one place:** onboarding a customer, opening its account to set it up (recorded under their name), a site from a template, one pasted line that installs the box, central configuration of what each box reads, a checklist the platform computes from evidence, and a printable handover sheet.
- **Telling people:** ordered contacts, email and text, escalation, quiet hours, a morning message, a delivery log, test messages.
- **The box:** one program, three days of buffer, a heartbeat every 30 seconds, updates with rollback.
- **The customer's data:** downloads of readings, alerts and the account's setup, each recorded in the audit trail.
- **Greecon's own team:** a login for each person, who is told about silent boxes each morning, and one table of every customer's sites. Only the owner of Greecon's account can add people or reset a customer's password; a person turned off loses their session on their next click.
- **A public privacy page** (`/privacy`), linked from the sign-in page, the request-access page, the choose-your-own-password page and the footer of every screen: what is kept, why, who sees it, how long, and the person's rights, written to be true of the platform as it is and read by a lawyer before the first signature.
- **Guided setup ([30](30-guided-setup.md)):** approved equipment with its numbers and settings fixed in code and set at the office; "Find equipment" (the box looks, the platform recognises what answered by what it positively said, matches it to the site's devices, refuses to guess, and fills in the addresses as the person who asked); the range on a transmitter's label as the only thing typed for the 4 to 20 mA module; the papers and the electrician as steps that must say who and when; and an install card per site, worked out from its own equipment, with three messages to the customer.
- **Smaller things found on the way:** one account per email address (sign-in looks the account up by it); readings that share a second are ordered by name; a meter note that gave one maker's speed for another's.

## Not verified, and why it matters

These could not be tested from here. Each is a step in [01](launch/01-founder-go-live.md) or [02](launch/02-project-manager-manual.md).

- **Text messages to Albanian networks.** The adapter is tested against a stand-in for Twilio. Whether a sender name survives on each Albanian network is only learned by sending to a phone on each.
- **Email deliverability from `alerts@greecon.earth`.** The domain must be verified at Resend and the mail seen to arrive, outside spam.
- **Real meters and modules.** Every register is from the maker's published tables; a pretend kit and the real wire protocol are tested; no real Eastron meter and no real Waveshare module has been read by this software. The SDM230's total power register and its serial defaults vary by version. The first real kit is rehearsed on a desk before any site ([30](30-guided-setup.md), section 8).
- **Railway.** Nothing here has been deployed to a real Railway project. The steps are the platform's own settings, in the order the software needs them.
- **Prices.** Every price in [03](launch/03-hardware-and-wiring.md) is a planning estimate from public listings. The fee and the monthly prices are hypotheses.
- **The order form.** It is a draft.

## Deliberately not built

Each has a trigger; none is built before it.

| Not built | Trigger |
|---|---|
| Control of any equipment | The release gate in [23](23-safety-and-security-case.md) |
| "AI" or optimisation | A rule-based schedule saving a measured amount over 12 months, then asked for in writing |
| Self-service sign-up, a forgot-password email | A queue of requests the project manager cannot answer in a day |
| Two-factor sign-in | The fifth site, or any control |
| An Albanian interface | An owner who needs it; then a native editor |
| Hotel wastewater evidence register | A hotel that asks for it and a process engineer who has reviewed it ([19](19-domain-playbook.md)) |
| An installer portal; billing and invoicing in the platform | Three installers; ten paying sites |
| A raw-data retention rule | The database nears its volume, or ten sites |
| A public status page; an immediate message for a silent box | Fifteen sites |
| Viber or WhatsApp; voice calls | A customer in writing, and an approved template |
| A hardware image to flash | Ten sites: the operating-system step then costs more than an image does |

## Amendments

A decision is changed by a record here, not by editing the table above quietly. (The table now carries the amended wording, so
that the pages that quote it agree.)

- **A1, 20 October 2026: pilot goal 2 is confirmed by the owner, not measured.** L3 said the owner "opens" the morning message
  on 5 days in 7. The platform does not know whether an email is opened (it would need a tracking image in every message,
  which the privacy page would have to disclose, and mail programs that hide such images defeat it). The goal is that the
  owner **reads** it on 5 days in 7 and says so at the day-60 meeting; the platform's own record is that it was **sent** on
  those days. Nothing else about L3 changes.

- **A2, 31 October 2026: L8 is amended by L20 to L23.** "One way to install" now includes that the equipment is approved and prepared at the office, that the
  project manager presses Find equipment instead of typing an address, and that the papers and the electrician are written down before a site can be commissioned.
  Nothing else about L8 changes.

## Review

Re-read this page after the first five signatures and after the first day-60 meeting. Write what was wrong as a new
record. The founder confirms the statements in [21, section 8](21-communication-system.md) before any is used.
