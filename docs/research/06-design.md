# Greecon Platform: Design and Human-Factors Desk Research (06-design)

> **Desk research, October 2026. Not reviewed by a licensed expert, and not legal, engineering, agronomic or safety advice.**
> Written from public sources on the dates inside. Facts are separated from inferences in the text, and
> anything marked UNVERIFIED, recalled or "search summary" was not confirmed from a primary source. File
> names such as `src/law124.txt` refer to the researcher's working folder, not to this repository. The
> decision-ready summary of all nine reports is `docs/17-constitution.md` to `docs/26-research-register.md`.

Confidence tags: High / Medium / Low. "Not found" means no published number was located; no numbers are invented. Hypotheses are labelled. Source IDs in [brackets] resolve in K (L local file, F fetched this run, S search snippet only, N cited from the literature, not fetched).

## A) What made the original iPhone revolutionary in human-factors terms, and what transfers

**Primary claims.** Apple's 9 Jan 2007 release: "an entirely new user interface based on a large multi-touch display and pioneering new software, letting users control iPhone with just their fingers"; a touch keyboard "predictive to prevent and correct mistakes" in place of "small plastic keyboards"; Jobs: "We are all born with the ultimate pointing device—our fingers" [APPLE07] (High). The human-factors substance is older: direct manipulation (continuous representation of the object, physical action instead of syntax, rapid reversible actions with visible effect: Shneiderman 1983; "directness" as small gulfs of execution and evaluation: Hutchins, Hollan, Norman 1985) [N, Medium], plus response-time limits: 0.1 s feels like direct manipulation, 1 s keeps flow, 10 s loses attention [NN-R] (High).

| Principle | iPhone move | Transfers as | Breaks where |
|---|---|---|---|
| Direct manipulation | Touch the object; instant, reversible | Tap the asset: state and action in one place | The plant answers late, may refuse, cannot be undone. Show commanded vs actual (EPRI: output "O: 33%" beside actual "A: 38%"); never show "running" on a tap |
| No intermediaries | No stylus, keyboard, menus | Answer-first Home; no report-building or tag-browsing | Keep safeguards (interlocks, approvals) but make them visible and explained |
| One mental model | Same gestures everywhere; HIG: people "expect most gestures to work the same regardless of their current context" [HIG-G] | One object model, status vocabulary, alert anatomy, confirm pattern across PV, water, agriculture | Do not flatten real sector differences: use lenses (G) |
| Software-defined controls | Only the controls the task needs | Show only actions valid now; blocked ones say why | Controls that change meaning by mode cause mode errors (Sarter and Woods 1995, N); Stop stays fixed and visible |
| Defaults | "Just works"; HIG: "Provide reasonable default settings" [HIG-O] | Sector templates, installer-assisted setup | Safety limits are not a taste default |
| Feedback and latency | UI reacts in about 0.1 s | Acknowledge taps under 0.1 s | Physics is slow: sent, accepted, confirmed by field signal; a timeout is "Unknown", never "OK" |

**What does not transfer.** (a) Discovery by play: nobody experiments on live equipment; HIG says custom gestures must be discoverable and "not the only way" [HIG-G]; eye-tracking (71 users) found weak signifiers cost 22% more time and 25% more fixations [NN-F]. Use labelled buttons. (b) Opaque magic: provenance hidden where numbers drive physical or financial decisions; "simple" means fewer concepts, not less evidence, with detail one step away [NN-P]. (c) Delight: the aim is a trustworthy "no news", technology that stays out of the way while people "remain serene and in control" [WEISER]. (d) The single-owner device: operations need roles, approvals, audit. (e) Error cost: a wrong tap loses an email on a phone and floods a tank on a manifold.

**Bottom line (inference, Medium).** The transferable revolution is conceptual compression: one answer, one object model, one alert anatomy, one confirm pattern, honest feedback. Not fewer features, not hidden complexity.

## B) Alarm science with published numbers (EEMUA 191, ISA-18.2, ISA-101, EPRI high-performance HMI)

**Published targets** (per control-room operator, process industry; the scale does not transfer to small sites, the laws do). EEMUA 191, ISA-18.2 and IEC 62682 are paywalled; numbers come via HSE, ASM/Honeywell, exida, Chemical Engineering and a vendor page.

| Metric | Published value | Source, confidence |
|---|---|---|
| Long-term average, normal operation | At most 1 new alarm per 10 min (about 144/day) | EEMUA via [HSE] and [ASM09] slides 11, 18. High |
| Maximum manageable average | Up to 12/hour (2 per 10 min, about 288/day); vendor: 150/day likely manageable, 300/day maximum | [CHEMENG] Medium-High; [IFACT] Medium |
| After a major upset | At most 10 alarms in the first 10 min | [HSE], [ASM09]. High |
| Flood | Starts at more than 10 new alarms in 10 min, ends at a window with fewer than 5; target under 1% of time in flood | [CHEMENG] Medium-High; 1% target [IFACT] Medium |
| Priorities | About three: 5% high, 15% medium, 80% low; set by consequence if the operator fails to respond | [HSE] citing EEMUA p.65. High |
| Nuisance | Top-10 alarms about 1-5% of load; chattering and fleeting zero; stale (over 24 h) fewer than 5 per day | [EXIDA]. Medium-High |
| What is an alarm | "Requiring a timely response"; status indicators, prompts, reminders, FYI messages are not alarms | ISA-18.2 via [CHEMENG]; [HSE]. Medium-High |

EEMUA band labels (very likely acceptable to very likely unacceptable) are confirmed [ASM09 slide 15]; band edges (often quoted 5 and 10 per 10 min) are unverified: Low.

**Reality check.** ASM benchmark (37 consoles, 90 months): "manageable" averages are sustainable, yet no console met the flood target throughout and 60% saw a 10-minute window above 100 alarms [ASM09 slides 12, 15-16] High. Pembroke 1994: 275 alarms in the last 11 minutes for two operators, about GBP 48 million damage, displays that did not help operators understand [HSE] High. Missing alarms kill too (Texas City 2005, 15 dead, known non-working alarms) [ASM09 slide 5] Medium. Hospitals: an estimated 85-99% of alarm signals need no clinical intervention; 98 alarm-related events, 80 deaths (date window differs by source) [TJC] Medium. IT: "Every page should be actionable"; urgency only "a few times a day before I become fatigued" [SRE] High.

**Rules that follow** (ISA-18.2/EEMUA; NUREG-0700 Rev.4).
- Actionable only: defined response, consequence, time allowed. EPRI's alarm popup: class, priority 3, setting, "Response Time: <15 min", consequences, causes, corrective actions [EPRI09 Fig 5-6]; HSE: "Have a defined response to each alarm".
- Rationalise against a written philosophy, recording cause, consequence, response, priority [IFACT] Medium; prioritise by urgency and safety challenge (§4.1.3-1).
- Flood handling by state, never silently: suppressed alarms stay retrievable; filter only what has no operational significance (§4.1.3-2, -3). Operators get operational impact and response, not fault detail (§4.1.4-1, -2). Keep an alarm log (§4.1.5-1); show new, acknowledged, cleared (§4.2.1-1b).
- Shelving: time-limited, listed, handed over each shift [IFACT] Medium. Chatter: deadband plus on-delay, typically 3-10 s [IFACT2] Low-Medium.

**ISA-101 / high-performance HMI evidence** [EPRI09].
- ASM/Nova simulator study, 21 operators (Table 1-1): detecting abnormal situations before alarms 10% to 48% ("5X"); success handling them 70% to 96%; task time 18.1 to 10.6 min (-41%); modelled saving US$800,000/yr for one ethylene plant. Reported, not replicated: Medium.
- EPRI's own coal-plant test (8 operators, 4 scenarios, counterbalanced): no significant duration difference (a roughly 5 min learning effect dominated); a damper failure caught by 3 of 8 on traditional vs 6 of 8 on high-performance graphics; but 2 of 8 missed a sticking valve on the new graphics and one depiction worked better on the old. Small n, directional; details matter. Medium.
- Rules (App. C §1.5-1.7): grey background; colour only for abnormal and never the sole differentiator (grayscale print test); alarm colours used for nothing else; no gratuitous animation; analog indicators showing the normal range; embedded trends; four levels (L1 overview, L2 control, L3 detail, L4 diagnostics); "never necessary for an operator to type in a graphic name or a point identification".

**Implication.** A small site has few alarms, so the risk inverts: silence from absent logic (audit: alerts never generated) reads as health. Apply the laws in miniature: three priorities, actionable only, deadband and on-delay, an alarm log, a per-site alert budget (hypothesis, Low: at most about one push-level alert per site per day in steady state; test in H).

## C) Answer-first status design for non-expert users

**Precedent.** Nuclear plants carry a safety parameter display so personnel can "determine the safety status of the plant during normal, abnormal, and emergency conditions" [NUREG §5, p.5-1]; EPRI's Level 1 overview serves "situation awareness" (§1.3), and an operator said it "showed what was going wrong very clearly" (§4.5.4). Greecon needs the small-operator equivalent: one computed sentence per site and across sites. (Endsley 1995: perception, comprehension, projection; N, Medium.)

**Computed, never typed.** Four states shown as word + dot + distinct shape, never colour alone (WCAG 1.4.1 [WCAG22]): Stable, Attention needed, Action required, Unknown. Unknown is first-class: missing, stale or unvalidated data never renders as stable. NUREG-0700: indicate invalid data (§14.3-3), clearly mark unvalidated data (§14.3-4), show a quality indicator (valid, invalid, unvalidated, estimate) with access to individual sensor readings (§14.3-5, p.14-6). HIG: with no connection, "show cached or placeholder data and a nonintrusive label that describes the problem" [HIG-A].

Inputs, each rule inspectable under "How is this calculated?":
1. Freshness: age of the newest value vs its expected interval (hypothesis: stale after 3 missed intervals).
2. Communications: gateway and device heartbeat, last contact.
3. Sensor quality: good, uncertain, bad per point; a bad input degrades only its dependents.
4. Open alerts by priority, and the unacknowledged count.
5. Pending approvals and blocked actions.
6. Mode (automatic, manual, override, maintenance) and shelved count.

Add coverage ("11 of 12 sensors reporting") and "as of 14:05, 2 min ago". Roll-up: Action required beats Unknown (on inputs critical for that asset type), then Attention needed, then Stable.

**No false reassurance.** Remove the hard-coded "OK" and static notes ("Within operating range"): a card shows a state only if computed from value, thresholds, age and quality; otherwise "No recent data". Silence is not safety: a dead gateway turns the headline to Unknown on a timer (dead-man rule, design reasoning). Nielsen: feedback "within a reasonable amount of time"; predictable interactions "create trust" [NN-H]. Never average away a failure; green needs positive evidence.

**Anatomy of an actionable alert** (EPRI popup; HIG titles say "what happened, the context in which it happened, and why", never "Error 329347" [HIG-A]; NN/g heuristic 9: plain language, suggest a solution [NN-H]; NUREG §4.1.4-2).

| Part | Illustrative, Greecon voice |
|---|---|
| What happened | Pump 2 stopped at 14:05 |
| Where | Hotel plant, lift station |
| Why it matters | Wet-well level is rising; overflow limit in about 40 min (only if a validated model computes it) |
| First step | Start Pump 1 (one button); if it will not start, call the number below |
| Urgency | Act now, within 15 min |
| Who | On duty: night technician; escalates to the manager at 14:20 if unacknowledged |
| Evidence | Level 2.4 m, limit 2.8 m, trend, data age 20 s, sensor good |
| State | New, acknowledged by, in progress, cleared |

No action possible or required means a log entry or notice, not an alert [HIG-A][HSE]. Three priorities: Act now, Check today, For your information (never pushed).

## D) Safe interaction design for physical actions

**Confirmation proportional to consequence.** NN/g: confirm serious or irreversible actions only; routine confirmations train click-through; be specific, never "Are you sure?"; verb buttons; no default Yes; a nonstandard action (typing a word) for dangerous operations [NN-C]. Raskin: "Never Use a Warning When you Mean Undo" [RASKIN]. HIG: no alert for common undoable actions; alert for uncommon irreversible ones; specific titles, not "OK"; no primary destructive button, because "people sometimes choose a primary button without reading it first" [HIG-A][HIG-B]. WCAG 3.3.4: reversible, checked or confirmed [WCAG22].

| Tier | Example | Pattern |
|---|---|---|
| 0 No physical effect | Filter, acknowledge, note | Act at once; undo toast saying what it undoes [HIG-U] |
| 1 Physical, low consequence, easily reversed | Start or stop a non-critical pump within limits | One tap, lifecycle feedback, visible Stop |
| 2 Consequential | Setpoint, open discharge, curtail PV export, dosing | Confirm sheet: object, current to new value, expected effect, reversibility, verb buttons; hold-to-confirm (about 1 s) as the nonstandard action |
| 3 Safety-critical or irreversible | Override interlock, reset trip, delete data | Typed confirmation or second person; reason; time limit; audited; may be office-only |

- Hold-to-confirm: no published standard or study found (Low); test about 1 s with wet and gloved hands. Provide alternatives: WCAG 2.5.1, 2.5.7 (no path-based or drag-only control), 2.5.2 (no action on touch-down; allow abort), 2.5.4 (not shake-only) [WCAG22].
- Typo guard: "opening a slide valve to 47% instead of 4.7%": confirm inappropriate-looking numeric entries [EPRI09 App C §5.23]; bounded steppers with units, "from X to Y". EPRI's shutdown dialog defaults to Cancel; HIG advises no default on destructive alerts; both: never default to the dangerous action.
- Label reversibility: reversible; reversible with delay (water hammer, restart lockout); irreversible (dosed, discharged).

**Blocked commands show the reason.** HIG: "Show people when a command can't be carried out and help them understand why" [HIG-F]. EPRI on traditional graphics: "Interlock functions are NOT consistently shown on graphics, nor is the information needed to clear the interlock" [EPRI09]. Pattern: "Action blocked by safety policy" + because (tank level 96%, limit 95%) + what unblocks it (below 90%) + who may override + log entry. Never a greyed button without a reason.

**Command lifecycle.** Requested, sent, accepted by controller, in progress, confirmed by field feedback, failed, or Unknown on timeout; elapsed time and Stop. Never queue physical commands offline: with no live path, reject with the reason (design reasoning, High).

**"Why did the system do that."** Each automated action records action, rule and version, inputs with age and quality, expected effect, who can change it; shown as "Because" on the asset and in the timeline. Trust is calibrated by seeing purpose, process and performance (Lee and See 2004); surprises come from opaque modes (Sarter and Woods 1995; Bainbridge 1983) [N, Medium].

**Shadow mode and autonomy ladder.** 1 Suggest (shadow: computes and logs what it would do, compared with what people did); 2 Execute on approval; 3 Execute after a veto window; 4 Execute, then inform. After the Sheridan-Verplank scale in Parasuraman, Sheridan, Wickens 2000 (level 5 executes if the human approves; level 6 allows restricted time to veto) [secondary summaries; Medium]. Start at 1; promote on evidence (agreement rate, no unsafe suggestions over an agreed period); demote on any incident; show the level wherever the automation appears.

**Approvals without rubber-stamping.** Habituation is documented (85-99% non-actionable hospital alarm signals [TJC]; routine confirmations become automatic [NN-C]). Approvals are rare and carry decision facts (what changes, readings with age, the alternative, the deadline, a safe default if nobody answers: do nothing); no default-approve; requester differs from approver at Tier 3; log view-time and approve rate as rubber-stamp indicators; sample audits.

## E) Field reality with numbers

**Touch targets.**

| Source | Minimum |
|---|---|
| WCAG 2.2 SC 2.5.8 (AA) | 24x24 CSS px, or smaller if a 24 px circle on it touches no other target [WCAG22] |
| WCAG 2.2 SC 2.5.5 (AAA) | 44x44 CSS px [WCAG22] |
| Apple HIG | hit region at least 44x44 pt [HIG-B] |
| Android / Material | 48x48 dp (about 9 mm), 8 dp apart; "recommended 7-10 mm" [ANDROID] |
| NN/g (Parhi, Karlson, Bederson) | 1 cm x 1 cm; fingertip 1.6-2 cm, thumb 2.5 cm (MIT Touch Lab) [NN-T] |

Gloved or wet hands: no published target-size evidence found. Hypothesis, Low: field-critical controls 56-64 dp tall, 16 dp or more between opposing actions; test with gloves and wet hands (H).

**Sunlight.** Phone screens "are mirrors"; DisplayMate tests to 40,000 lux ("almost direct sunlight"), noon sun is 100,000 lux, and dark-room contrast is "for the most part irrelevant" outdoors; legibility depends on peak brightness and reflectance (iPhone 4: 541 cd/m2, 7.0%) [DISPLAYMATE]. Full daylight (not direct sun) is 10,000-25,000 lux, office light 320-500 [LUX]. My calculation, illustrative, Medium-Low: effective contrast = (Lhi + Lamb) / (Llo + Lamb), Lamb = R x E / pi, with R 5%, white 800 cd/m2, cream background (Lamb 637 and 318 cd/m2).

| Design contrast, text on cream | 40,000 lux | 20,000 lux |
|---|---|---|
| 4.5:1 | 1.8:1 | 2.3:1 |
| 7:1 | 1.9:1 | 2.7:1 |
| Black | 2.1:1 | 3.3:1 |

No palette fixes direct sun; in daylight only near-maximum contrast stays near 3:1. Design: Outdoor mode (text 7:1 or better, WCAG 1.4.6 AAA; thick strokes; status words at least 18 px bold; no meaning in mid-tones); meaning always redundant (word + dot + shape); light theme outdoors, "night" for evenings, visible toggle (HIG: dark mode is "tailored for low-light environments" [HIG-D]); audit every cream, sand, mist, leaf token pair against 4.5:1 and 3:1 (not computed here).

**Offline-first and honest staleness.**
- Platforms: StatCounter Albania mobile, Sep 2025-Sep 2026: iOS 56.87%, Android 42.94% [SCSV] (web-traffic proxy, Medium); Start.io, Nov 2024: about 67% Android among messaging-app users (Low). Conflict: see J.
- iOS: Web Push only for Home Screen web apps, iOS/iPadOS 16.4+, permission request after a user gesture, honours Focus [WEBKIT-PUSH]. Safari deletes script-writable storage after seven days of use without interaction; Home Screen apps are exempt [WEBKIT-ITP]. Background Sync is Chromium-only and Periodic Background Sync Chrome 80+ only; neither in Safari or Firefox [BCD]. So: sync on open and on foreground, guide iPhone users to Add to Home Screen, request persistent storage [MDN-Q], keep a native-shell seam.
- Stale labelling: every value carries "as of" age; after one missed interval a word flag ("12 min old"); after three, grey the value, draw a gap, label "Last known". Persistent banner "Offline. Showing data from 14:05"; disable controls and say why [WEBDEV][HIG-A]. Offline queue for notes and acknowledgements only, never actuation.

**Notifications.** Push: free; iOS needs install; Focus can delay; no guarantee. SMS: no data needed; cost; plain text. WhatsApp: outside the 24-hour customer-service window only pre-approved templates may be sent [TWILIO], so alert wording is templated; needs data. Viber: reported popular in the Balkans (vendor claim, Low); business messaging paid (unverified). Voice call: top priority only. Albania usage: no authoritative survey found; WMTips: WhatsApp on 76% of sites embedding messaging (proxy); Prelude.so: Viber leads (no data); NapoleonCat: 1.2 million Messenger users, 40.2% of population (May 2022): all Low [S]. Build channel adapters; ask users (J). HIG levels: Passive, Active, Time Sensitive (events now or within an hour), Critical (entitlement); "Build trust by accurately representing the urgency" [HIG-N]: Act now = Time Sensitive, Check today = Active, FYI = in-app. Escalation defaults (hypothesis, Low, per sector): no acknowledgement in 10 min, SMS; at 30 min, next contact; quiet hours pass only Act now; one-tap acknowledgement records who.

**Language and units** (Node 22, ICU 77.1, CLDR 47, run locally). Albanian: "1 234 567,89"; default clock is 12-hour ("4:05 e pasdites"), so force 24 h (validate); plurals one/other; "5 minuta më parë". Use Intl; store SI units (m3/h, kW, kWh, bar, °C, ha); whole-sentence templates, not concatenation (Albanian marks definiteness on nouns, Medium); allow about 30% expansion (hypothesis); agree a glossary with users; translate SMS and push; check Plex glyphs for ë and ç.

**WCAG 2.2 AA items that matter** [WCAG22]: 1.4.3 text 4.5:1 (3:1 large); 1.4.11 3:1 for UI components and graphics (dots, chart lines, input borders); 1.4.1 not colour alone; 1.4.4 200% resize, 1.4.10 reflow at 320 px; 2.4.7 and 2.4.11 focus visible and not hidden by sticky bars; 2.5.8 24 px; 2.5.1, 2.5.2, 2.5.7 pointer alternatives; 3.3.7 redundant entry; 3.3.8 no memory test at login (paste, password managers, magic link or QR); 4.1.3 announce status messages; 2.2.2 pause or control auto-updating content unless essential. Reduced motion: honour prefers-reduced-motion (2.3.3 AAA; HIG caution on fast-moving, blinking animation [HIG-X]); 150-250 ms fades are fine. Colour vision: about 1 in 12 men and 1 in 200 women [CBA]; EPRI lists red/green, green/yellow, white/cyan confusions; add distinct dot shapes; test in a deuteranopia simulator.

**Low-digital-literacy onboarding.** Only 23.8% (2021) and 23.3% (2023) of Albanians aged 16-74 had at least basic digital skills; women 21.6% (2023) [EC25] High. Farmers (UK qualitative): uptake driven by ease of use ("really simple", "instantaneous information", "too much text... visualisation is the key"), trust, cost, relevance, peers [ROSE16] Medium. South African irrigators (n=29): ease of use, personal after-sales service, a phone call with a trusted adviser; set-up time was the main reason a free service went unused; no age effect [SA21] Medium. HIG: onboarding fast, optional, interactive, contextual tips, defaults [HIG-O]. Implication: installer-assisted first run by QR with sector defaults, value within minutes, no password-first signup, a human phone number in the app.

## F) Data visualisation for operations

- A dashboard is "a visual display of the most important information needed to achieve one or more objectives; consolidated and arranged on a single screen so the information can be monitored at a glance" (Few) [FEW-D]; for Greecon, Home.
- Bullet graph over gauge: one featured measure, an optional comparative marker, two to five qualitative ranges; linear, so smaller and more efficient to read than radial meters [FEW-B]. Use for tank level, state of charge, pressure, valve position, bands named in words.
- Sparklines and small multiples (Tufte 1990, 2006; N, Medium): a word-sized trend beside each number; the same chart at the same scale per pump, zone or day.
- Embedded trends beat on-demand ones: EPRI says building one "may require thirty or more selection and scaling actions"; tight default y-span (+/-2% to 5% of engineering units, adjustable); timebase suited to the process (examples 10 min, 2 h, 24 h); prior history shown on call-up [EPRI09 App C §5.24]. Operators: "we just don't have time to manually build trends".
- Default ranges: no published norm for small operators. Hypotheses, Low: PV and storage, today from sunrise with yesterday faint; wastewater and pumping, last 24 h (2 h for pump cycles); irrigation and greenhouse, last 48 h with schedule; every chart offers 1 h, 24 h, 7 d.
- Always show the normal band, labelled limits, event marks (alert, command, mode change) and data quality: gaps stay gaps, uncertain segments dashed with a legend, stale tail "Last known". HIG charts: fixed or dynamic axis by meaning, zero baseline for bars, accessibility labels [HIG-C]; add a text summary.
- Do NOT chart: one current value (number + word + age); a handful of points or irregular events (list them); on/off (state strip); stale or unknown data; the question "is it OK" (headline). No gauges, pies, 3-D or decorative animation [FEW-B][EPRI09].

## G) Information architecture proposal

**Evidence.** HIG: "it's generally easier to navigate among fewer tabs"; avoid overflow "More" tabs [HIG-T]. NN/g: hidden (hamburger) navigation was used in 27% of cases on desktop vs 48-50% for visible or combined, and on mobile 57% vs 86% for combined; discoverability fell over 20%, rated difficulty rose 21%, tasks were 15% (mobile) to 39% (desktop) slower [NN-N]. EPRI: four levels, progressive exposure, most actions at Levels 2-3, never type a point identification, any screen within 5 seconds [EPRI09]. No published ceiling on item count was found; five visible phone tabs follows the HIG overflow rule (inference).

**Core model.** Site, Asset (pump, valve, tank, inverter, battery, zone), Point (measurement, state, setpoint), Event (alert, command, note), Rule (automation), Report; one Home. A sector lens (Energy, Water, Agriculture) is data on a site or asset type: vocabulary, default KPIs and charts, alert and report templates. A hotel with PV and a wastewater plant carries two lenses. No sector gets its own menu.

**13 items become 5 destinations plus Account.** Home <- Overview. Sites <- Sites, Monitoring (Live tab), Devices (Devices and data quality tab), Maintenance history (History tab), site audit trail (Activity tab). Alerts <- Alerts, Maintenance work items. Automations <- Automation (rules, schedules, modes, "because" timeline). Reports <- Reports, Analytics. Account (avatar menu) <- Admin, Clients (integrators only), Settings, global Audit log.

| Role | Lands on | Navigation (phone tab bar, desktop sidebar) | Notes |
|---|---|---|---|
| Owner | Home | Home, Alerts, Sites, Reports; Account | Approvals first; outcomes and cost; no raw tags |
| Admin | Home | Home, Sites, Alerts, Automations, Reports; Account | Users, devices, clients, notification rules; Level 4 diagnostics |
| Operator | Home, or a site's Field view | Home, Sites, Alerts, Automations | Field view: large targets, outdoor contrast, manifold controls; Tier 3 not shown |
| Viewer | Home | Home, Sites, Alerts, Reports | Control surfaces not rendered (not greyed out) |
| Auditor | Activity | Activity, Sites, Alerts, Reports | Read-only: who did what, approvals, shelving, rule versions, evidence export |

Progressive disclosure (after EPRI): L1 answer (Home, site headline); L2 act (asset controls); L3 detail (trends, parameters); L4 diagnose (devices, comms, raw tags, audit). Operators live in L1-L2 with L3 one tap away; admins reach L4.

**Overview (Home), top to bottom.**
1. Headline: one sentence, state word + dot + shape, "as of" time. "Stable at 3 of 3 sites. Updated 14:05." or "Action required at Hotel plant: Pump 2 stopped." Tap: "How is this calculated?"
2. Needs you: Act now (n), Approvals (n), Blocked actions (n). "Nothing needs you" only if every input is fresh; otherwise the line says what is unknown.
3. Trust line: "Data fresh. Communications OK. 12 of 12 sensors good", or the exceptions linking to Devices and data quality.
4. Site rows, worst first: name, lens label, state word and reason, one KPI as bullet graph or sparkline in context, data age.
5. Since you last looked: alerts, commands, automatic actions, each with its "Because" line.
6. Footer: support phone, version. The "Operating Identity" paragraph leaves the dashboard (About or onboarding).

KPI card: value, unit, normal range, computed state, age, quality; never a static note. Desktop: headline across the width, Needs you and Sites left, timeline right. Success test: someone answers "Is everything okay, and what needs me?" within 5 seconds (H).

## H) Validation plan

Test three claims: (1) Home answers "Is everything okay, and what needs me?" correctly and fast; (2) Unknown, stale and blocked states are understood and never read as OK; (3) first value arrives within minutes, on the person's own phone, outdoors.

1. **Field visits (weeks 1-3, no software).** 8-10 contextual visits, about 3 per segment (greenhouse and irrigation farmers, PV operators, hotel technical managers with wastewater plants), at the real manifold or plant room. Observe what they check first, how they learn of trouble today (call, WhatsApp, Viber, alarm light), what they ignore, glare, gloves, signal, who covers nights. Field research finds "the unexpected" an office cannot [NN-FS].
2. **Small repeated rounds.** 5 users per segment per round: five users surface about 85% of problems (typical L = 31%) and several small tests beat one large one [NN-5]. Round 1: clickable prototype of Home, an alert, a blocked command, stale data. Round 2: working PWA on their own phone, outdoors.
3. **Tasks and metrics** (targets are proposals):
   - 5-second Home test: correct answer at least 90%.
   - Fault injection with replayed data (stale feed, dead gateway, degraded sensor, blocked command): false-reassurance rate 0 (nobody says "fine" when the right answer is "cannot tell").
   - Alert first action correct at least 90%; wrong-asset or wrong-action errors 0 on Tier 2-3 tasks.
   - Benchmarks: average task completion is 78% over almost 1,200 usability tasks; average SUS is 68 across 500 studies, above 80.3 is the top 10% [MU]. Aim above both.
   - Time to first value: QR claim or invite to first correct headline on their phone, at most 10 min self-serve; power-on to live data at most 30 min with an installer.
   - Field checks: midday legibility at maximum brightness, gloved and wet taps, hold-to-confirm success, airplane-mode behaviour, iOS Home Screen install completion.
4. **Diary study.** 2 weeks, 8-10 people, prompts and answers in their own channel (voice notes on WhatsApp or Viber): what they checked, what interrupted them, which alerts they ignored and why [NN-D]. Shows fatigue and channel reality over time.
5. **After launch, instrument:** glance rate, time to acknowledge, share of alerts with a logged action, mutes and snoozes (fatigue), approval view-time and approve rate (rubber-stamp), Unknown frequency and time to resolve, support calls per site per month.

Cost is mostly time. Run sessions in Albanian, compensate participants, record consent (Law 124/2024 on personal data; see 05-legal.md).

## I) Implications
### (i) Must exist from day one (proven need)
1. Computed headline with an Unknown state, "as of" time, freshness, communications, sensor quality, open alerts, pending approvals; delete the hard-coded "OK" and static notes (C; NUREG §14.3; code audit).
2. Status recomputed on a timer (heartbeat, dead-man check) for points, devices, sites (audit: set once, never recomputed).
3. Alerts generated from live data, minimum rules: communications lost, data stale, sensor quality bad, value out of range (deadband, on-delay), device fault. Actionable anatomy, three priorities, acknowledge, alarm log, no alert without a defined action (B, C).
4. Home per G, five destinations, role-specific navigation for owner, admin, operator, viewer, auditor; viewer sees no controls; "Operating Identity" paragraph leaves the dashboard.
5. Safe command pattern: Tiers 0-2, command lifecycle, blocked-with-reason, audit record, no offline actuation (D).
6. Field-ready UI: targets at least 44 px (56+ for primary controls), contrast 4.5:1 and 3:1, Outdoor mode, word + dot + shape status, reduced motion, 200% text (E).
7. Notifications: push with iOS Home Screen guidance plus SMS fallback, one-tap acknowledgement, quiet hours that pass Act now (E).
8. Honest offline and stale labelling; sync on open; persistent storage (E).
9. Albanian and English with correct number and date formats, 24-hour time, whole-sentence templates (E).
10. Installer-assisted onboarding with sector defaults and QR claim; a human support number (E).
11. Audit log of commands, approvals, acknowledgements, rule and threshold changes (D, G).

### (ii) Seams for later (leave room now, build later)
- Automation `mode` (suggest, approve, veto-window, auto) and a shadow log; write "because" records (rule version, inputs, ages, quality) from day one even if the UI is minimal (D).
- Point model with source timestamp and quality (good, uncertain, bad); alert model with state (new, acknowledged, cleared, shelved with expiry, suppressed, out of service) (B, C).
- Notification channel adapter and per-user escalation policy; WhatsApp, Viber, voice later (E).
- Native shell for Critical alerts and background sync if field data show gaps (E).
- Sector lens as data (asset types, KPIs, templates, vocabulary); more lenses and languages (G).
- Alert-health dashboard (rate per site per day, floods, stale, chattering, priority mix) and rationalisation workflow (B).
- Two-person approvals, time-limited elevated access, Tier 3 flows (D).
- Multi-client hierarchy for integrators; Clients appears only then (G).
- Auditor evidence packs, regulation-specific report templates (G).
- Forecasts such as "time to overflow", only with validated models and visible provenance (C).

### (iii) Things to avoid
- Any status not computed from data; green by default; Unknown shown as OK or as an error; averaging away a failure.
- Alerts for information; alarms on every sensor by default; email-only alerts; more than three priorities; modal alerts at app start [HIG-A].
- Confirmation on everything, "Are you sure?", "OK" as the default button, a destructive primary button [NN-C][HIG-B].
- Gesture-only controls, slide-to-confirm without a tap alternative, shake-to-undo, hidden hamburger as primary navigation [NN-N].
- Queued physical commands; commands without lifecycle feedback; greyed buttons without a reason.
- Gauges, pies, 3-D, decorative animation, colour-only status, red/green pairs, low-contrast tints that carry meaning.
- Marketing text, hype, exclamation marks and emoji on operational surfaces.
- Assuming Android, WhatsApp, Background Sync or granted push permission.
- Treating refinery alarm numbers as absolute targets for small sites; "AI" explanations without provenance.

## J) Open questions needing user research
1. Who is "on duty" in each segment at night and weekends, what do they check first, and how often?
2. Which phone OS do target users carry? StatCounter says iOS 56.87%, Start.io about 67% Android; it decides push and install design.
3. Which channels are read within 5 minutes (push, SMS, WhatsApp, Viber, call)? Is SMS from an unfamiliar sender trusted?
4. How many alerts per site per week before people mute? What are the real consequences and time constants (overflow, empty tank, frost, inverter trip) behind the three priorities?
5. Minimum target size and hold duration with gloves or wet hands; does the brand palette survive midday sun?
6. Do users want automation to act, at what level, and who is accountable and approves: owner or operator?
7. Albanian technical vocabulary versus English loanwords; 24-hour time and decimal comma expectations; wording for Unknown.
8. Which records do authorities require (wastewater discharge, PV grid reporting), so the auditor view fits (see sector research files)?
9. How often and how long are sites offline; how many rural sites have weak mobile coverage?
10. Does Unknown cause anxiety or extra phone calls; how should it be calibrated?
11. Do EEMUA-style rates have a small-site analogue: alert rate against ignoring behaviour.
12. Staff-notification consent and retention under Law 124/2024 (legal question).

## K) Source list
Base path for local files: 

**Local (L)**
- [ASM09] 06-design-work/honeywell-asm-2009.txt: Hewitt and Andow, ASM Consortium/Honeywell, 24 Aug 2009, slides 3-18.
- [EPRI09] 06-design-work/epri-2009.txt: EPRI 1017637, Operator HMI Case Study, Dec 2009, §1.1-1.3, §4, App. A and C.
- [NUREG] 06-design-work/nureg0700r4.txt: NUREG-0700 Rev.4 §4.1.3-4.1.5, §4.2.1, §5, §14.3.
- [HIG-A, -B, -F, -O, -N, -X, -D] 06-design-work/apple/{alerts, buttons, feedback, onboarding, managing-notifications, accessibility, dark-mode}.txt
- [ROSE16] rose2016.txt; [SA21] sa_study.txt; [EC25] al2025.txt (statistical annex, digital-skills row, about line 4930; columns 2012, 2020-2024); [BCD] 06-design-work/bcd/SyncManager.json, PeriodicSyncManager.json (MDN browser-compat-data).

**Fetched (F)**
- [APPLE07] https://www.apple.com/newsroom/2007/01/09Apple-Reinvents-the-Phone-with-iPhone/
- [HIG-G, -T, -C, -U] https://developer.apple.com/design/human-interface-guidelines/{gestures, tab-bars, charts, undo-and-redo} (read from the site's JSON feed)
- NN/g, https://www.nngroup.com/articles/ : [NN-H] ten-usability-heuristics/ ; [NN-R] response-times-3-important-limits/ ; [NN-C] confirmation-dialog/ ; [NN-F] flat-ui-less-attention-cause-uncertainty/ ; [NN-T] touch-target-size/ ; [NN-N] hamburger-menus/ ; [NN-P] progressive-disclosure/ ; [NN-5] why-you-only-need-to-test-with-5-users/ ; [NN-D] diary-studies/ ; [NN-FS] field-studies/
- [RASKIN] https://alistapart.com/article/neveruseawarning/ (title and opening read)
- [HSE] https://www.hse.gov.uk/pubns/chis6.pdf (CHIS6, 3/00)
- [EXIDA] https://exida.com/alarm-management/assessment ; [CHEMENG] https://www.chemengonline.com/?p=115704 ; [IFACT] https://ifactoryapp.com/industries/power-plant/power-plant-alarm-management-isa-18-2 ; [IFACT2] https://ifactoryapp.com/blog/alarm-management-rationalization-chemical (vendor pages)
- [SRE] https://sre.google/sre-book/monitoring-distributed-systems/
- [WCAG22] https://www.w3.org/TR/WCAG22/ ; [ANDROID] https://support.google.com/accessibility/android/answer/7101858
- [DISPLAYMATE] https://displaymate.com/Smartphone_Brightness_ShootOut_1.htm ; [LUX] https://en.wikipedia.org/wiki/Lux
- [SCSV] https://gs.statcounter.com/os-market-share/mobile/albania (CSV export, Sep 2025-Sep 2026)
- [WEBKIT-PUSH] https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ ; [WEBKIT-ITP] https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ ; [MDN-Q] https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria ; [WEBDEV] https://web.dev/articles/offline-ux-design-guidelines
- [TWILIO] https://www.twilio.com/docs/whatsapp/key-concepts ; [CBA] https://www.colourblindawareness.org/colour-blindness/ ; [WEISER] https://calmtech.com/papers/coming-age-calm-technology
- [FEW-B] https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf ; [FEW-D] https://www.perceptualedge.com/articles/ie/dashboard_confusion.pdf
- [MU] https://measuringu.com/task-completion/ ; https://measuringu.com/sus/
- Intl output: Node 22.22, ICU 77.1, CLDR 47.0, run locally.

**Search snippets only (S)**
- [TJC] Joint Commission Sentinel Event Alert 50 (Apr 2013) via https://beckershospitalreview.com/quality/joint-commission-alert-medical-device-alarm-safety.html ; original not fetched.
- Albania channel share: https://www.wmtips.com/technologies/instant-messaging/country/al/ ; https://prelude.so/countries/al ; https://napoleoncat.com/stats/messenger-users-in-albania/2022/05 ; https://www.start.io/audience/messaging-app-users-in-albania

**Not fetched (N)**: Shneiderman 1983 (IEEE Computer 16(8)); Hutchins, Hollan, Norman 1985 (Human-Computer Interaction 1(4)); Endsley 1995 (Human Factors 37(1)); Sarter and Woods 1995 (Human Factors 37(1)); Bainbridge 1983 (Automatica 19(6)); Lee and See 2004 (Human Factors 46(1)); Parasuraman, Sheridan, Wickens 2000 (IEEE Trans. SMC-A 30(3):286-297; levels 5 and 6 confirmed only via secondary summaries); Parhi, Karlson, Bederson 2006 (MobileHCI, via [NN-T]); Tufte, Envisioning Information (1990) and Beautiful Evidence (2006); EEMUA 191, ISA-18.2-2009 / IEC 62682, ISA-101.01-2015 (paywalled; numbers via HSE, ASM, exida, Chemical Engineering). Unavailable: Fast Company on Norman and Tognazzini (HTTP 403), MITRE levels-of-automation PDF (403), Apple archived HIG (script-rendered), any gloved-touch target-size study.
