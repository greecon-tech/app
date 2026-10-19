# Greecon: market, users and competition research (file 07)

> **Desk research, October 2026. Not reviewed by a licensed expert, and not legal, engineering, agronomic or safety advice.**
> Written from public sources on the dates inside. Facts are separated from inferences in the text, and
> anything marked UNVERIFIED, recalled or "search summary" was not confirmed from a primary source. File
> names such as `src/law124.txt` refer to the researcher's working folder, not to this repository. The
> decision-ready summary of all nine reports is `docs/17-constitution.md` to `docs/26-research-register.md`.

Prepared for Greecon Sh.p.k. (Albania). Research date: 2026-10-13. Assumptions given by the founder: no paying customers yet, simulated demo data only.

Evidence legend: FACT = sourced, with URL and the figure as stated. INFERENCE = my reasoning, with the reason. OPEN QUESTION = something to ask real customers. [UNVERIFIED] = recalled from memory, no source checked.

## A. The real users (segments, jobs-to-be-done, who decides and who pays)

No customer has been interviewed. Descriptions of people, bad days and fears are INFERENCE from the tagged facts and must be tested with the questions at the end. "03/02/06" = the sibling reports in this folder. New tags are listed in section I.

| # | Segment and person | Bad day | Fear | Decides / pays |
|---|---|---|---|---|
| 1 | **Hotel, guesthouse, agritourism, restaurant** (coast, mountains): the owner, or the one maintenance person who knows the plant room | Taps dry with guests in. Durrës supply "less than 10 hours a day"; national average "16.3 hours per day" (2022-23); accommodation and restaurants "face high costs to secure water from alternative sources" [CITIZENS24]; 17.44 h/day in 2024 [ERRU25]. Wastewater: Normative Act 8/2023 covers hotels of 6+ rooms in coastal, lake and river zones; a 60-room hotel needs about 180-252 m3 of treated-water storage (02 A1, A2). Sites run unattended off-season: occupancy 61.5% Aug vs 20.4% Dec [G] | Guest complaints, an inspector and no records, night calls, tanker bills | Owner decides and pays from running costs; manager recommends |
| 2 | **Greenhouse, orchard, vineyard farmer**: owner-operator; average holding about 1.2 ha, 45% of farms 0-1 ha (03 D1) | Pump or power fails in a closed plastic greenhouse in a hot spell; a canal turn is missed; weak signal | Crop loss; a box overriding judgement: "All farmers said they would not use technology to replace field measurements and experience" (03 C1, quoting dW21) | The farmer alone, from own cash. IPARD III aid up to 60% (65% mountain, 70% young or organic) for irrigation and on-farm renewables; no explicit line for sensors (03 D2) |
| 3 | **Water utility operations manager**; rural water committee (no Albanian source found) | 2024: non-revenue water 61%, supply 17.44 h/day, 0.66 kWh/m3, metering 87.9% [ERRU25]. Energy about 29% of O&M in 2021 [ERRU21]. 17 licensed operators in 2025, from 58 utilities before regionalisation [ERRU25][ERRU-NL] | Public blame, regulator targets, losing a tender | Board plus public procurement; donor money (ERRU names World Bank, Austrian Government, EU, UN-Habitat, Danube Water Programme as technical-assistance partners) [ERRU25] |
| 4 | **Small commercial or industrial site** with solar, maybe battery: owner or plant manager (workshop, cold store, agro-processor) | Inverter offline for days unseen; battery not charging; vendor app disconnects (Growatt review, C2). Solar 631 MW cumulative end-2025, utility-scale "still the main investment driver"; no C&I count found [PVM26] | Paying for an outage; being tied to the installer | Owner or finance; installer influences. Net-billing rules from May 2026; Law 59/2026 (in force July) licenses storage and aggregation [PVM26] |
| 5 | **Irrigation consortium**: chair or technician of a Water Users Organisation, or a Drainage Board engineer | 13 state-financed Drainage Boards run main canals and dams; farmer WUAs "could not cover O&M" and became WUOs [CESR-ALB]; almost all irrigation pumping stations need replacing (03 D1) | Unpaid fees, blame | Board and ministry; state or donor money; members cannot pay |
| 6 | **Integrator or electrician** who installs and resells (count in Albania not found) | Truck roll to restart a tripped inverter or pump; blamed for a vendor's cloud outage | Losing the customer, support burden, liability | Chooses what to install; the customer pays the integrator. Pays Greecon only if it saves visits or earns margin (INFERENCE) |

**Ranking for the first 5 paying customers** (1-5, 5 = best for Greecon; my judgement, use the order not the totals; assumes the founder has no prior network in any segment).

| Segment | Pain | Budget | Will pay | Reach | Low reg. friction | Low safety exposure | Total | Role |
|---|---|---|---|---|---|---|---|---|
| 1 Hotels, guesthouses, agritourism | 4 | 3 | 3 | 4 | 4 | 4 | **22** | Beachhead |
| 6 Integrators, electricians | 3 | 3 | 3 | 4 | 4 | 3 | 20 | Channel, not end user |
| 2 Farmers | 4 | 2 | 2 | 3 | 4 | 3 | 18 | Second, with IPARD |
| 4 Commercial solar+battery | 3 | 4 | 2 | 3 | 3 | 3 | 18 | Second; free vendor portals compete |
| 3 Utilities | 5 | 3 | 2 | 2 | 1 | 1 | 14 | Later; procurement, drinking-water safety |
| 5 Irrigation consortia | 4 | 1 | 1 | 2 | 3 | 3 | 14 | Later; no budget |

**Recommended beachhead (ONE):** owner-managed hotels, guesthouses and agritourism of 6-60 rooms in the Normative Act 8/2023 zones, with a tank and pump room plus a wastewater plant or solar. Reasons (INFERENCE): the pain is publicly documented; the plant duty is a dated reason to buy records and alarms; water, wastewater, solar and garden irrigation sit on one site, so it tests "one platform" on one customer; one owner decides; read-only monitoring first keeps safety exposure low; off-season (November to March) is the install window.

**Prove or disprove** (thresholds are my proposal): of 20 owner or manager conversations, at least 8 describe a costly failure in the last 12 months in their own words, and at least 5 sign a paid 90-day pilot within 30 days of the first visit. Disproved if fewer than 3 describe a costly failure; if the vendor app or electrician "already solves it"; if the buyer is a management company elsewhere; or if the most owners will pay is below hardware plus support cost. Fall back to segment 6 or 4. OPEN QUESTION: number of hotels and beds (INSTAT monthly releases give occupancy, not stock).

**Interview questions** (past behaviour first; do not pitch).
1. Tell me about the last time water, power or a pump failed here. When, who noticed first, what did you do in the first hour, what did it cost?
2. Show me your phone: which apps, groups and numbers do you use for this site? Who is in them?
3. Who do you call at 2 a.m.? How long do they take, and what do they charge per visit?
4. When the site is closed or you are away, how do you know tank, pump, plant and solar are fine? What do you check first on arrival?
5. How many hours a day does mains water arrive now? What did you spend last year on tankers or extra tanks?
6. Has an inspector visited? What did they ask to see? Where are the records and who fills them in?
7. What do you look at every day or week (meter, inverter app, gauge, Excel, paper)? What do you ignore?
8. Which alerts or notifications do you get today? Which did you stop reading, and why?
9. What have you bought for this plant room in the last three years? Who chose it, what did it cost, was it worth it?
10. Who must say yes to EUR 500? To EUR 5,000? Who else must agree (owner, accountant, installer)?
11. What would you pay each month to never repeat the last failure? What price would make you doubt it?
12. What must a system never do on its own (start a pump, open a valve)? Who is blamed if it does?
13. Who installed your solar and pumps? What happens to your warranty if someone else connects to them?
14. If I showed you a daily "all fine / needs you" message from a read-only box next month, what would you do next, and who would you tell?

## B. How they run things today (tools, rituals, WhatsApp/Viber/Excel/paper, integrators)

FACT, INSTAT ICT survey, ages 16-74, 11 Dec 2025 [INSTAT-ICT25]: 87.2% use the internet, 97.3% of them several times a day; "99.9% of individuals access internet through mobile/smart phones" against 20.9% via desktop; "99.1% make calls/video calls (via Skype, Viber, WhatsApp, etc.)"; 21.3% used spreadsheet software and 23.5% changed software settings (skills table; general population, not operators). No survey splits WhatsApp from Viber (06 E). No source describes how Albanian site operators work: the rest of B is INFERENCE until interviews and visits confirm it.

| Today's tool or ritual | What it does for them | What breaks (evidence) |
|---|---|---|
| Phone call to the electrician, plumber or installer | The real alert and support channel | One person, no record, night and season. Farmers prefer "personal telephonic advice from an advisor they know and trust" (03 C1, dW21) |
| WhatsApp or Viber group | Photos of gauges and screens, "pump is off" | No owner, no acknowledgement, no status, history buried; sent by a person, not a sensor |
| Paper logbook, clipboard, Excel | Compliance record: wastewater plants must keep a monitoring register and operating documents (02 A2) | Late or back-filled entries before an inspection; only 21.3% have spreadsheet skill [INSTAT-ICT25] |
| Vendor apps (inverter, controller, weather station) | Free monitoring of one brand: "VRM is free" [VRM-MAN]; Hydrawise "free for most users" [HYDRAWISE-PRICE] | One app per brand (C2). Growatt: "Keeps disconnecting from Bluetooth so the datalogger won't reconnect" [AS-GROWATT]. Shelly: "Can't even create an account to register the app" [AS-SHELLY]. Davis: "four dollars a month to look at your own data" [AS-WEATHERLINK] |
| Integrator SCADA (Ignition, Siemens, Schneider) | Real control with safety logic | Built and priced for plants; every change needs an integrator (C2). Presence at small Albanian sites: OPEN QUESTION |
| Rounds by eye and ear | The baseline every tool must beat | Not at night or off-season. Farmers "would not use technology to replace field measurements and experience" (03 C1) |

**How they find out something is wrong** (INFERENCE; test first): (1) a guest, staff member or neighbour reports a visible failure; (2) a bill or tanker invoice weeks later; (3) a vendor push, only if the app is configured and connected; (4) an inspector; (5) the crop. Detection by consequence, not by sensor. Silence reads as health when logic is absent (06 B), so stale data must be shown as stale (06 E).

**What to observe on a site visit** (90 minutes, photograph with permission):
- Water path: source, tanks, level indication, pumps, dry-run protection, pressure gauge, manual valves, who operates them.
- The last failure: messages, call log, invoice; minutes from "wrong" to "someone is fixing it".
- Phones: count apps, logins and groups; who holds the router password; signal bars and a speed test inside the plant room.
- Equipment: makes and models of meter, inverter and controller; free RS-485 or Ethernet port; who knows the installer password; power backup.
- Wastewater plant and register: date of last entry, who writes it, whether it matches the gauge.
- Plant-room reality: space, heat, dust, damp, gloves, sun on the screen, the words used for each item.
- Who is on site by hour and by season, and who is called first.

## C. Competitor teardown

Method: public pricing pages and manuals fetched 2026-10-13; where a price was not public or not found it says so. "[UNVERIFIED]" = recalled from memory. No Albanian-language UI or Albanian distributor was verified for any product below (Victron's VRM manual was seen in de, pt, es, nl, fr, it; no sq).

**C1. What they are, how they are sold, what they cost**

| Product | Category and who it serves | Sold how; public price (FACT unless marked) | Lock-in | Energy + water + agri together? | Edge-first safety? |
|---|---|---|---|---|---|
| Victron VRM + GX device | Energy cloud; solar+battery owners, installers | Hardware plus portal; "VRM is free" [VRM-MAN]. GX device price not found | Victron devices | Energy only | Protection and control run on devices, cloud optional (INFERENCE from design, not verified) |
| Huawei FusionSolar | Energy cloud; residential and C&I solar | Free portal and app with inverter [UNVERIFIED] | Huawei inverters | Energy only | Inverter-level protection [UNVERIFIED] |
| SolarEdge monitoring | Energy cloud | Free with inverter [UNVERIFIED] | SolarEdge | Energy only | Inverter-level [UNVERIFIED] |
| Growatt ShinePhone | Energy cloud, low-cost inverters | Free app; App Store (US) 2.41 average, 170 ratings [AS-GROWATT] | Growatt | Energy only | Inverter-level [UNVERIFIED] |
| Hydrawise (Hunter) | Irrigation controllers, mostly landscape | Controller plus cloud; "The Hydrawise system is free for most users worldwide" [HYDRAWISE-PRICE]; paid plans exist, price not on page | Hunter controllers | Water/irrigation only | Controller runs schedules locally [UNVERIFIED] |
| Netafim NetBeat / GrowSphere | Irrigation OEM, commercial growers | Through dealers; no public price found [UNVERIFIED] | Netafim hardware | Agri/water only | [UNVERIFIED] |
| CropX | Soil sensors plus advice for growers | Subscription; price not found | CropX sensors | Agri only | No (advisory) [UNVERIFIED] |
| Sensoterra | Soil-moisture probes with built-in connectivity | "US$250 to $270 per sensor installed", includes three years of connectivity (2019 article, secondary) [PRODUCER-SENSO] | Own probes | Agri only | No (advisory) |
| Pessl Metos FieldClimate | Weather stations and sensors, vineyards and orchards | Subscription; price not found | Pessl loggers | Agri only | No |
| Davis WeatherLink | Weather stations | Free tier; a reviewer complains of paying "four dollars a month to look at your own data" [AS-WEATHERLINK] | Davis | Weather only | No |
| ThingsBoard | General IoT platform, for integrators | Cloud: Free $0 (5 devices); Prototype $49/month (50 devices); Pilot $149/month (100); Startup $399/month (500); Business $749/month (1,000); $0.30 per extra device; white-label mobile app $99/month plus $1,000 setup [TB-PRICE] | Low (open source edition) | Any, but nothing built in | Rule engine only; safety is the builder's job |
| Tuya / Smart Life | Consumer and OEM IoT cloud | Consumer app free; platform price not verified | High (cloud-bound devices) | Consumer devices | Mostly cloud [UNVERIFIED] |
| Grafana Cloud | Dashboards | Free; Pro "From $19 / month + usage"; Enterprise "Starts at $25,000 / year" [GRAFANA-PRICE] | Low | Any; display only | No control |
| Ignition (Inductive Automation) | SCADA for integrators | Licensed per server, tags and clients unlimited, sold by module [IGN-LIC]; list price not verified, third-party figures conflict ($1,200 to $26,950) [G2-IGN] | Medium, needs an integrator | Any, via integrator | Yes when PLC logic does the safety work |
| Siemens Insights Hub / WinCC, Schneider EcoStruxure, AVEVA | Industrial and utility | Quote-based; Siemens product page shows no price [SIEMENS-IH]; others [UNVERIFIED] | High | Industrial | PLC-level safety, mature |
| Home Assistant | Home automation, open source | Free software; Cloud US$6.50/month or $65/year, EU EUR 7.50/month or EUR 75/year [NABU-PRICE] | Low | Any, DIY | Local-first, but no safety claim or SLA |
| Shelly | Wi-Fi relays and meters | Hardware; app free [UNVERIFIED]; App Store (US) 3.15 average, 86 ratings [AS-SHELLY] | Medium | Any, DIY | Local scripts possible [UNVERIFIED] |

**C2. Where they fall short, where Greecon is worse today, where an incumbent cannot follow**

| Group | Does well | Does badly (evidence) | Greecon is WORSE today | Structurally cannot follow |
|---|---|---|---|---|
| Energy clouds (Victron, Huawei, SolarEdge, Growatt) | Mature monitoring of their own hardware; free to the owner | Growatt reviewer: "Keeps disconnecting from Bluetooth so the datalogger won't reconnect" [AS-GROWATT]. Each shows only its own brand | Zero installed base, no inverter drivers beyond a few, no 10-year track record, no warranty network | They earn on hardware, so the portal is an accessory. They will not read a competitor's inverter, a pump or a soil probe |
| Irrigation/agri (Hydrawise, Netafim, CropX, Sensoterra, Pessl, Davis) | Crop and irrigation know-how, agronomy models | Davis: paywall on own data [AS-WEATHERLINK]. Per-sensor or per-station fees grow with devices | No agronomy models, no sensor range, no dealer network | Business model is sensors and valves. They have no view of pump power, tank level or solar. Cloud-first advice, not site safety |
| General IoT (ThingsBoard, Tuya, Grafana) | Flexible, cheap to start | A toolkit: someone must build and maintain every site. Per-device or usage pricing [TB-PRICE] | Far smaller community and ecosystem | A toolkit vendor cannot ship an opinionated "all right / not all right" answer |
| SCADA (Ignition, Siemens, Schneider, AVEVA) | Real control, real safety, certified | Priced and built for plants and utilities; every change needs an integrator | No certifications, no references, no PLC ecosystem | Their cost and complexity do not scale down to a 2 kW pump site or a 1 ha greenhouse |
| Home automation (Home Assistant, Shelly) | Huge device support, local-first, cheap | Shelly reviewer: "Can't even create an account to register the app" [AS-SHELLY] | Far fewer devices; no community | No accountability: no SLA, no support, no safety posture for a business |

INFERENCE: nobody above covers energy, water and agriculture in one calm view with data-age proof; each answers for its own hardware. The gap is cross-vendor and cross-domain, and it exists because each incumbent's revenue is hardware, sensors, per-device fees or integrator hours. OPEN QUESTION: do customers value one view across vendors enough to pay, or do they only want the vendor app to stop failing?

## D. The "iPhone insight" (what is actually broken or unbundled in this market and the smallest product that fixes it)

**What the iPhone did** (06 A, [APPLE07]): it added no features. It compressed a category into one concept people already knew and removed the manual: "an entirely new user interface based on a large multi-touch display" instead of "small plastic keyboards". What transfers is conceptual compression: one answer, one object model, one alert anatomy, one confirm pattern, honest feedback; not fewer features and not hidden evidence (06 A).

**The equivalent here (INFERENCE from the evidence below; nothing is built or tested with customers).**
- **The mess:** each device ships its own app, free but tied to its brand (VRM "requires ... a Victron Global Remote" [AS-VRM]; Growatt shows Growatt; C2); one vendor charges for the owner's own data [AS-WEATHERLINK]; SCADA needs an integrator for every change (C2); the rest is calls, WhatsApp and paper (B).
- **The one concept people already hold: the caretaker's round.** "Walk the site, look at everything, tell me if all is fine or what needs me." It is the ritual in the last row of B's table, done by the site itself at any hour. The owner stays in charge.
- **One-sentence promise (to be earned):** "Open one screen and know whether your water, power and fields are all right, and what needs you now."
- **One-screen test:** a first-time owner, no help, within 5 seconds answers (1) is everything all right, (2) what needs me and by when, (3) how old is this answer. Pass = 4 of 5 owners correct, and all 5 notice data that was made stale on purpose.

| Claim | Evidence |
|---|---|
| People want the answer, not the data | Farmers want "something quick, easy to look at"; "a heap of information and figures ... is just too much" (R16, 03 C1). 86% of irrigators knew FruitLook, one used it: "too much information in different formats is too time-costly" (dW21, 03 C1) |
| The valued moment is "something needs me" | VRM: "the VRM helped us troubleshoot a problem we did not know existed" [AS-VRM] |
| Complexity is the complaint | FusionSolar: "the UX/UI is really bad - in desperate need of a good UX designer to make the complex more simple" and "it's a game of trial-and-error to figure out the optimal settings" [AS-FUSION]; VRM: "Using my mobile phone is more cumbersome than necessary" [AS-VRM] |
| Silos and installer dependence | An installer: VRM is "my favorite platform for remote monitoring" [AS-VRM]; SCADA "every change needs an integrator" (C2); Growatt (2.41 average): "Keeps disconnecting from Bluetooth so the datalogger won't reconnect" [AS-GROWATT] |
| Too many alerts get ignored | EEMUA: at most 1 new alarm per 10 minutes long-term, flood above 10 in 10 minutes; an estimated 85-99% of hospital alarm signals need no intervention [TJC]; Pembroke 1994: 275 alarms in the last 11 minutes (all 06 B) |
| Too few look like health | At a small site "silence from absent logic reads as health"; Texas City 2005 had known non-working alarms (06 B) |

Review caveat: the App Store page shows four reviews per app (FusionSolar 4.4 from 1.7k ratings; VRM 3.4 from 56 ratings), returned as excerpts. They illustrate; they are not a sample.

**A world-class product here must NOT** (evidence in brackets):
1. Lead with data. Lead with the answer, detail one step away (06 A; R16).
2. Send an alert without a defined action, owner and time (06 B). Hypothesis: about one push-level alert per site per day in steady state (06 B, Low).
3. Look healthy when it does not know: a timeout is "Unknown", never "OK" (06 A, E).
4. Lock, paywall or hide the owner's data (Davis, VRM; C2). Export always.
5. Need an integrator or a builder to change a threshold (SCADA, ThingsBoard; C2).
6. Act beyond limits the owner approved, or replace the owner's judgement (dW21; 06 D).
7. Promise a saving, a safety level or "AI" it has not measured: "Do not promise a percentage before pilots" (03 C3).
8. Make set-up the product: set-up time was the main reason a free service went unused (SA21, 06 E). Installer-assisted defaults instead.
9. Add a feature before its proof trigger (H).
10. Let a cloud outage or a trend decide whether a pump is protected: safety logic stays on site (C2 gap).

## E. Pricing and go-to-market

**Published pricing models** (figures as stated in C1). Per hectare and per m3: no public price found in this research.

| Model | Example | Reading (INFERENCE) |
|---|---|---|
| Free with hardware | VRM "is free" [VRM-MAN]; Hydrawise "free for most users" [HYDRAWISE-PRICE]; Growatt app free [AS-GROWATT] | A single-brand portal cannot be sold alone; a cross-vendor view with accountability must carry the price |
| Per device, monthly tiers | ThingsBoard $49 (50 devices), $149 (100), $399 (500), $0.30 per extra device [TB-PRICE] | Platform only; about $1.5 per device-month at 100 devices (my arithmetic) |
| Per sensor, hardware plus connectivity | "US$250 to $270 per sensor installed", three years of connectivity included (2019, secondary) [PRODUCER-SENSO] | Upfront price with service bundled; at most about $7 per month if all of it were connectivity (250/36) |
| Flat or usage | Home Assistant Cloud EUR 7.50/month [NABU-PRICE]; Grafana Pro "From $19 / month + usage" [GRAFANA-PRICE] | Remote access without an SLA is worth about EUR 7.50 |
| Pay for own data, licence, quote | Davis "four dollars a month to look at your own data" [AS-WEATHERLINK]; Ignition by server and module, list price unverified [IGN-LIC][G2-IGN]; Siemens: no price [SIEMENS-IH] | Resented, or integrator-sold |

**Plausible in Albania.** FACT (search summary of the INSTAT page, not opened) [INSTAT-WAGE26]: Q1 2026 average gross wage 90,119 lek, median 74,010 lek, minimum wage 50,000 lek from 1 Jan 2026; about EUR 900 for the average at roughly 100 lek per EUR [UNVERIFIED rate]. INFERENCE: $1.5 to $7 per point-month x 10 to 20 points = about $15 to $140 per site per month. Price per site, never per point, so a new sensor is not a penalty. Hardware at cost plus installation, one-off; subscription for support, updates and the message path. Test EUR 20, 40 and 80 per site per month, billed from day 91; keep the lowest price that 3 of the first 5 pay without discount. Farmers: bundle into the irrigation quote, one-off with years of connectivity (the Sensoterra model).

**Grant and subsidy levers** (verify each with the funder):
- IPARD III Measure 1: aid up to 60% (65% mountain, 70% young or organic, cap 75%); drip irrigation, wells, greenhouses and on-farm renewables eligible; no explicit line for sensors or ICT; IPARD II absorption 59.1% (03 D2). Sell inside the irrigation quote; ask the IPARD Agency whether controllers count. Rural-tourism measure: [UNVERIFIED].
- EBRD and EU "SME Go Green", phase 2, 6 Jun 2026: up to EUR 233m credit lines through local partner institutions, up to EUR 23.3m investment incentives, EUR 5.6m technical assistance; Albania among six economies; partner banks not named; solar, batteries, water and irrigation not mentioned; how the incentive is paid not stated [EBRD-SMEGG26]. ProCredit Bank Albania: EBRD up to EUR 10m, Oct 2025, at least 50% for green-eligible projects (search summary) [PROCREDIT-AL25]. Ask partner banks whether monitoring qualifies inside a solar or efficiency loan.
- Utilities: ERRU names World Bank, Austrian Government, EU, UN-Habitat and Danube Water Programme as technical-assistance partners [ERRU25]. KfW and SECO: Municipal Infrastructure Programme V, EUR 130m in up to 10 municipalities [WBIF-MIP5]. EIB EUR 80m for Tirana's network, date not seen [EXIT-EIB]. EBRD up to EUR 15m to Tirana's utility, old [SEENEWS-UKT]. GIZ: nothing found. USAID: not verified, assume unavailable. These are project sales for later.
- Not found: any grant for commercial solar or batteries [PVM26], or for the wastewater plants hotels must install.

**First 5 sites (INFERENCE).** Founder-led: 20 conversations (A) to 5 paid pilots, introduced by one or two electricians or plumbers who already serve hotels (referral fee, they do the wiring) and by the Hotel Association, whose head is quoted in [CITIZENS24]. Install November to March, at most one site a week. **First 50:** 3 to 5 installer partners with about 10 sites each, clustered on the coast and in the mountains; the wastewater register (02 A2) as the hook; greenhouse clusters in Fier and Berat (79.2% of greenhouse output [G]) only after a farmer pilot. Sites per support person is a guess until tickets per site are measured.

**Pilot design against pilot purgatory.** Cisco 2017, 1,845 decision makers: 60% of IoT initiatives stall at proof of concept; only 26% of companies had one they called a complete success (search summary, Cisco page not opened) [CISCO17]. Design: paid from day one for 90 days, with price and conversion in the order form (05 F3); three written success criteria before install (data current at least 95% of the time; owner opens the daily message 5 days of 7; at least one real event caught and confirmed); a named person with signing authority; read-only, no actuation; decision meeting fixed for day 60; hardware stays Greecon's until conversion; no free extension beyond 30 days.

**Warranty, support, SLA (INFERENCE; clauses in 05 F3-F4).** Irrigators value "personalised after-sales service" (dW21, 03 C1). Offer: 24-month hardware warranty (repair or replace); acknowledgement within 4 business hours, Monday to Saturday in season; on-site help next day through the installer; no 24/7 promise until staffed. Measure the SLA on what Greecon controls (data currency, message delivery), and state that the box keeps protecting locally when the cloud is down. Liability cap about 12 months' fees, "not a safety system" stated (05 F4). Publish no uptime figure before 6 months of measurement.

## F. Success metrics and proof gates

All thresholds are my proposals (INFERENCE), to be reset after the first 5 sites; no small-site benchmark for retention or alert rates was found. Anchors: alert budget and EEMUA numbers (06 B); set-up time was the main reason a free service went unused (SA21, 06 E); probes trusted only after "two to three seasons" of calibration (dW21, 03 C1); no savings percentage before pilots (03 C3).

| Metric | Definition | Threshold | Label |
|---|---|---|---|
| One-screen test | First-time owner, no help, answers "all right? what needs me? how old?" within 5 s (D) | 4 of 5 owners correct; 5 of 5 notice deliberately stale data | PROOF GATE |
| Unboxing to first reading | Minutes from box power-on to the first real reading on the owner's phone, one installer | Median 60 or less over the first 10 sites; none over 4 hours | PROOF GATE |
| Sites reporting current data | Share of site-hours where every required point is younger than three reporting intervals (06 E), rolling 30 days; each gap tagged power, network or device | Fleet 98% or more; no site under 90% for two weeks | PROOF GATE |
| Push-level alerts per site per day | Count of high-priority pushes in steady state, excluding the first 14 days | 1 or fewer (06 B hypothesis); every alert has a defined action | PROOF GATE |
| Share of alerts acted on | Acknowledged within the response time and followed by a logged action or a "no action needed, because" note | 80% or more; zero alert types muted by operators | PROOF GATE |
| Confirmed avoided incidents | Alert preceded a fault that a human confirms in one tap as "real, would have continued"; count only confirmed ones, owner's loss estimate kept separate | At least 3 across the first 5 sites in 90 days | PROOF GATE |
| Water or energy saved | Same site, written baseline (previous 12 months of bills, or 4 weeks of metering), normalised for occupancy or weather; shown as a range | Reported only after one full season, and only if larger than the baseline's year-to-year variation | PROOF GATE after the baseline; VANITY before |
| Weekly responsive operators | Sites where a named person acknowledged an alert or read the daily message on at least 5 of 7 days | 80% of sites in weeks 3 to 12. Logins, sessions and minutes in app are VANITY: a calm product is opened rarely | PROOF GATE (as defined) |
| Support minutes per site per month | Logged minutes of human help, after month 3 | 30 or fewer; above that the services trap is open (H) | PROOF GATE |
| Retention at 6 and 12 months | Paying sites still paying and still current, from pilot conversion; month 12 spans a full hotel season | 4 of 5 at month 6 for the first 5; 85% at month 12 for the first 50 | PROOF GATE |

VANITY on their own: sites installed, data points ingested, dashboards or rules created, app downloads, recurring revenue before pilots convert, number of "insights".

## G. Albania / Western Balkans context

Scope: Albania was researched. Kosovo, North Macedonia, Montenegro, Bosnia and Serbia were NOT researched (only tourist origin shares). Tags in [brackets] map to the numbered source list in section I. "(secondary)" = read only in a search summary or a news site, not in the primary document.

| Topic | FACT (figure as stated) | Source |
|---|---|---|
| Water utilities, 2021 | Non-revenue water 64.8% (2020: 65.4%), ERRU target 30%, "five utilities performed below the 30%". Continuity of supply 15.4 hours/day (target 18). Metering ratio 80.7% (743,709 metered of 921,158 connections). Coverage 76.8%. Current collection rate 77.6% (target 82%). Staff 5.37 per 1000 connections. Energy "about 29% of the O&M costs"; the Durres utility is about 31% of the sector's energy cost; sector energy cost up 207.5 million ALL vs 2020. | [ERRU21] |
| Water, later year | A news outlet reports 64.7% of produced water unbilled in 2023 (secondary, not checked against ERRU). | [ACQJ23] |
| Tourism seasonality | Hotel room occupancy: Aug 2025 61.5% (Aug 2024 59.6%); Oct 2025 31.6% (secondary); Dec 2025 20.4% (INSTAT prints Dec 2024 as "1 %", likely a typo). Aug 2025 non-resident visitors +40.6% y/y, largest growth on the coast (+47.8%). Top Aug markets: Kosovo 21%, Poland 12%, Italy 10%. | [INSTAT-AUG25] [INSTAT-OCT25] [INSTAT-DEC25] |
| Agriculture | 2025 vegetable output 1,445,286 t; greenhouse share 22.1%. Fier 155,905 t (48.7%) and Berat 97,648 t (30.5%) together = 79.2% of greenhouse output (my addition). Greenhouse area 1,997 ha in 2023 (secondary, CEIC citing INSTAT). Small farms "averaging 1.13 hectares" (secondary; scope unclear). | [INSTAT-AGR25] [CEIC-GH] [UNDP-GH] |
| Electricity price | Household base tariff 9.5 lek/kWh before VAT, 11.4 with VAT, before a 1 lek cut for households up to 700 kWh/month (2025, secondary). | [TARIFF25] |
| Prosumer rules | Households and SMEs up to 500 kW; "net metering ... calculated on a monthly basis" under Law 7/2017. ERE (2023): new renewables law adopted March 2023; slide reads "Net-metering on yearly basis starting from April 2024 net billing for prosumers" (ambiguous). Prosumer capacity: 102 MW (OSHEE) and 120 MW by Sept 2023 (secondary, different dates). | [AIDA-PROS] [ERE-ERRA23] [PVMAG19] |
| Connectivity | 3.49 million cellular connections (126% of population); 2.45 million internet users (88.4%) at end 2025; 88.5% of mobile connections are 3G or better. | [DR26] |
| Phone OS | Web-traffic share, Sept 2026: Android 50.04%, iOS 49.94%. Sept 2025: iOS 55.05%, Android 44.67%. | [STATCOUNTER] |
| Payments | Findex 2021: 44.1% of adults 15+ have an account; 17.65% made a digital payment (secondary). | [FINDEX] |
| Labour | UNDP 2025 survey of 2,185 enterprises: 94.9% of firms that tried to recruit reported difficulty filling vacancies. About 40% of the workforce is estimated to work abroad (IOM, via press, secondary). | [UNDP-SKILLS] [IOM-A2] |

INFERENCE (my reasoning):
- A 3x swing in hotel occupancy (61.5% in August vs 20.4% in December) means seasonal sites run pumps, tanks and solar unattended for months. "Is it all right while I am away" has value all year, not only in the peak.
- Water utilities: the money is in pumping energy (29% of O&M) and losses (64.8%), but they are public companies; procurement and budgets, not pain, are the barrier.
- Android and iOS are each about half of web traffic, so v1 should be an installable web app plus plain-text messages, not a native app per platform.
- Prosumer rules were in transition (monthly net metering to net billing). If export is paid below the retail price, visibility of self-consumption becomes more valuable. Needs checking against the current ERE rule.

NOT FOUND (say so to the founder): irrigated area and irrigation coverage; number of hotels and beds; 2026 business tariffs; mobile data prices; WhatsApp and Viber market share; technician wages; any Western Balkans comparison. [UNVERIFIED] recollection only: WhatsApp and Viber are the common messaging apps in Albania. Verify in interviews.

## H. Risks, anti-patterns, what NOT to build

**Why IoT, agtech and energy-software start-ups fail, and the guard** (mechanisms are INFERENCE unless a source is tagged).

| Failure mode | Evidence | Guard |
|---|---|---|
| Pilot purgatory | 60% of IoT initiatives stall at proof of concept [CISCO17] | Paid 90-day pilot, written criteria (E) |
| Hardware margins | Incumbents give the portal away and earn on hardware (C2; VRM, Hydrawise free) | Off-the-shelf industrial PC and standard Modbus devices; no custom hardware; box at cost plus install |
| Services trap | A toolkit needs someone to build every site (ThingsBoard, C2); SCADA "every change needs an integrator" (C2); irrigators adopt if "a consultant did the preparation and interpretation" (dW21) | Site templates; fixed commissioning bundle, custom work quoted; support minutes per site tracked (F) |
| Integrator channel conflict | Ignition is sold through integrators [IGN-LIC]; a Victron installer calls VRM "my favorite platform" [AS-VRM]: installers choose what gets installed | Installer keeps install margin, Greecon owns subscription and support; customer data portable; no approach to an installer's customers without agreement |
| Support burden | Irrigators value "personalised after-sales service" (dW21) | SLA scoped to what Greecon controls; local protection continues offline; a named human |
| Liability for control | Insurers ask whether the platform can actuate; "not a safety system" needs interlocks behind it (05 F4) | Read-only first; control addendum plus lawyer and insurer sign-off before commands |
| Seasonal cash, unknown market size | Occupancy 61.5% Aug vs 20.4% Dec [G]; hotel count not found (A) | Invoice at season start; size the market before hiring |

**Attractive but unproven: do not build until the trigger fires** (triggers are my proposals).

| Feature | Why not now (evidence) | Proof trigger |
|---|---|---|
| Platform, plug-in marketplace, white-label | A toolkit vendor "cannot ship an opinionated 'all right / not all right' answer" (C2) | 3 integrators ask for it and pay, after 20 sites |
| Digital twin | No customer demand found; at a 2 kW pump site the status page is the model (INFERENCE) | 5 paying sites ask a question that live status plus 12 months of history cannot answer |
| AI optimisation | Farmers "would not use technology to replace field measurements" (dW21); no percentage before pilots (03 C3); aggregation and trading are licensed activities under Law 59/2026 [PVM26] | A rule-based schedule already saves a measured amount over 12 months; the model beats it on 10 sites; owners ask in writing |
| Carbon accounting | No Albanian SME obligation or customer demand found in this research | A funder or buyer makes a report a condition of money, named by 3 sites |
| Marketplace (parts, installers, energy or water trading) | Trading is legally gated (01 D, 05 G); no demand data | Installers pay for leads, or tickets show 30 sites needing the same part or service |
| Remote actuation from day one | Needs approvals, interlocks, insurer check (05 F4, 06 D) | 90 days read-only at 98% current data; the same action requested by 3 owners; sign-off |
| Utility and municipal line | Public procurement, drinking-water safety (A) | A donor-funded call names monitoring, or a utility pays for a pump-station pilot |

## I. Source list

Numbers S1-S29 are the tags already used in C and G, in order of first use; S30-S44 are new in A, B, D, E, F and H. Acc.: 13 = read by the earlier run on 2026-10-13; 18o = opened on 2026-10-18; 18s = seen only in a search summary on 2026-10-18 (secondary, page not opened); * = the earlier run stored no URL, so this one was recovered from its logs by domain and page name and not re-opened: confirm before external use. Tags of the sibling reports (R16, dW21, SA21 in 03 J; TJC, APPLE07 in 06 K) are defined there.

| # | Tag | Publisher, item | URL | Acc. | Use |
|---|---|---|---|---|---|
| S1 | [VRM-MAN] | Victron Energy, VRM manual | https://www.victronenergy.com/media/pg/VRM_Portal_manual/en/introduction.html | 13* | VRM is free |
| S2 | [AS-GROWATT] | Apple App Store (US), ShinePhone by Growatt | https://apps.apple.com/us/app/id669936054 | 13* | rating, review quote |
| S3 | [HYDRAWISE-PRICE] | Hunter Industries, Hydrawise pricing | https://www.hydrawise.com/pricing | 13* | free for most users |
| S4 | [PRODUCER-SENSO] | Trade article on Sensoterra price (2019) | https://www.producer.com/2019/08/soil-moisture-sensors-piece-of-cake-to-install/ | 13* | price per sensor |
| S5 | [AS-WEATHERLINK] | Apple App Store (US), WeatherLink (Davis) | https://apps.apple.com/us/app/id1304504954 | 13* | data paywall quote |
| S6 | [TB-PRICE] | ThingsBoard, Cloud pricing | https://thingsboard.io/pricing/ | 13* | per-device tiers |
| S7 | [GRAFANA-PRICE] | Grafana Labs, pricing | https://grafana.com/pricing/ | 13* | usage pricing |
| S8 | [IGN-LIC] | Inductive Automation, Ignition licensing | https://docs.inductiveautomation.com/docs/8.3/platform/licensing-and-activation ; https://docs.inductiveautomation.com/docs/8.1/platform/licensing-and-activation.md | 13* | licence model |
| S9 | [G2-IGN] | G2, Ignition pricing (third party) | https://www.g2.com/products/inductive-automation-ignition/pricing | 13* | conflicting price range |
| S10 | [SIEMENS-IH] | Siemens, Insights Hub | https://www.siemens.com/en-us/products/insights-hub/ | 13* | no public price |
| S11 | [NABU-PRICE] | Nabu Casa, Home Assistant Cloud | https://www.nabucasa.com/pricing/ | 13* | cloud price |
| S12 | [AS-SHELLY] | Apple App Store (US), Shelly Smart Control | https://apps.apple.com/us/app/id1660045967 | 13* | rating, review quote |
| S13 | [ERRU21] | ERRU, utilities performance report 2021 (English) | https://www.iawd.at//files/Image/library/vod/Performance_Report_Utilities_Albania_21.pdf | 13* | 2021 water KPIs |
| S14 | [ACQJ23] | Albanian Center for Quality Journalism (news) | https://acqj.al/en/punesimet-ne-ujesjellesa-histori-qe-nuk-po-ndryshon/ | 18o | 2023 unbilled water 64.7% |
| S15 | [INSTAT-AUG25] | INSTAT, accommodation establishments, Aug 2025 | https://www.instat.gov.al/media/tkvm23eo/accommodation-establishments-m08-2025.pdf | 13* | hotel occupancy |
| S16 | [INSTAT-OCT25] | INSTAT, accommodation establishments, Oct 2025 | https://www.instat.gov.al/media/vzdp1mgy/accommodation-establishments-m10-2025.pdf | 13* | hotel occupancy |
| S17 | [INSTAT-DEC25] | INSTAT, accommodation establishments, Dec 2025 | https://www.instat.gov.al/media/4cflkvpf/accommodation-establishments-december-2025.pdf | 13* | hotel occupancy |
| S18 | [INSTAT-AGR25] | INSTAT, agriculture statistics 2025 | https://www.instat.gov.al/en/themes/censuses/agriculture-census/ | 13* | vegetable output |
| S19 | [CEIC-GH] | CEIC Data, Albania greenhouse area | https://www.ceicdata.com/ja/country/albania | 13* | greenhouse area |
| S20 | [UNDP-GH] | UNDP, farms and greenhouses | https://sdgprivatefinance.undp.org/market-intelligence/greenhouse-developments | 13* | farm size |
| S23 | [ERE-ERRA23] | ERE at ERRA conference 2023 | https://erranet.org/annual-conference/wp-content/uploads/2023/10/E.Radheshi_ERE_Albania_ERRAConference2023.pdf | 13* | net billing slide |
| S24 | [PVMAG19] | pv magazine 2019, Albania | https://www.pv-magazine.com/2019/06/05/albania-to-introduce-net-metering-for-solar-up-to-500-kw/ | 13* | prosumer capacity |
| S25 | [DR26] | DataReportal, Digital 2026: Albania | https://datareportal.com/reports/digital-2026-albania | 13* | connectivity |
| S26 | [STATCOUNTER] | StatCounter Global Stats, Albania mobile OS | https://gs.statcounter.com/os-market-share/mobile/albania | 13* | phone OS |
| S28 | [UNDP-SKILLS] | UNDP, 2025 enterprise skills survey | https://www.undp.org/index%2Ephp/albania/publications/skills-needs-analysis-albania-2025 | 13* | recruiting difficulty |
| S30 | [INSTAT-ICT25] | INSTAT, ICT usage in households 2025, press release 11 Dec 2025 | https://www.instat.gov.al/media/4jkhqz0c/ict-2025_english.pdf | 18o | phone, call and skills figures |
| S31 | [CITIZENS24] | Citizens.al, 'Priority tourism, but water with schedule', 1 Nov 2024 | https://www.citizens.al/en/2024/11/01/priority-tourism-but-water-with-schedule/ | 18o | hotel water pain, quotes |
| S32 | [PVM26] | pv magazine, 'Albania's solar market shifts toward storage, market integration', 27 Aug 2026 | https://www.pv-magazine.com/2026/08/27/albanias-solar-market-shifts-toward-storage-market-integration/ | 18o | 631 MW, Law 59/2026 |
| S33 | [ERRU25] | ERRU, Annual Report 2025 (Albanian), Feb 2026; local copy read | https://erru.al/wp-content/uploads/2026/03/Raporti-vjetor-2025_merged.pdf | 18o | 2024 KPIs, 17 operators, donors |
| S34 | [ERRU-NL] | ERRU, newsletter (English), May 2024 | https://erru.al/wp-content/uploads/2024/05/Newsletter-ERRU-ENG.pdf | 18s | 58 utilities merged |
| S35 | [CESR-ALB] | SESRIC, Albania presentation, Water Management Symposium (undated) | https://cesr.sesric.org/Presentations/Water_Management_Symposium/Albania/Albania.pdf | 18s | Drainage Boards, WUAs |
| S36 | [INSTAT-WAGE26] | INSTAT, wage statistics Q1 2026 | https://www.instat.gov.al/en/themes/labour-market-and-education/wages/publications/2026/wage-statistics-q1-2026/ | 18s | wage anchor |
| S37 | [EBRD-SMEGG26] | EBRD, SME Go Green phase 2, 6 Jun 2026 | https://www.ebrd.com/home/news-and-events/news/2026/EBRD-and-EU-scale-up-SME-Go-Green-support-in-the-Western-Balkans.html | 18o | grant lever |
| S38 | [PROCREDIT-AL25] | ProCredit Bank Albania, EBRD EUR 10m green loan, Oct 2025 | https://www.procreditbank.com.al/eng/newsdetails/press-release---ebrdgrants-10-million-green-l-245/ | 18s | bank credit line |
| S39 | [WBIF-MIP5] | WBIF, Municipal Infrastructure Programme V (KfW, SECO) | https://wbif.eu/project-detail/PRJ-ALB-ENV-015 | 18s | utility funding |
| S40 | [EXIT-EIB] | Exit.al, EIB loan for Tirana water network | https://exit.al/en/?p=154758 | 18s | EIB funding |
| S41 | [SEENEWS-UKT] | SeeNews, EBRD EUR 15m for Tirana water utility (older) | https://seenews.com/news/ebrd-lending-15-mln-euro-to-finance-water-project-in-albania-639452 | 18s | EBRD funding |
| S42 | [CISCO17] | Computing.co.uk on Cisco 2017 IoT survey | https://www.computing.co.uk/news/3010673/sixty-per-cent-of-iot-projects-stall-at-proof-of-concept-stage | 18s | pilot purgatory |
| S43 | [AS-FUSION] | Apple App Store (IE), FusionSolar | https://apps.apple.com/ie/app/fusionsolar/id1529080383 | 18o | review quotes |
| S44 | [AS-VRM] | Apple App Store (US), VRM Victron Remote Management | https://apps.apple.com/us/app/vrm-victron-remote-management/id658834560 | 18o | review quotes |

No URL recovered (re-capture before quoting outside this file): S21 [TARIFF25], S22 [AIDA-PROS], S27 [FINDEX], S29 [IOM-A2].
