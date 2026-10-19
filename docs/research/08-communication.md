# 08 - Communication system for Greecon (research report)

> **Desk research, October 2026. Not reviewed by a licensed expert, and not legal, engineering, agronomic or safety advice.**
> Written from public sources on the dates inside. Facts are separated from inferences in the text, and
> anything marked UNVERIFIED, recalled or "search summary" was not confirmed from a primary source. File
> names such as `src/law124.txt` refer to the researcher's working folder, not to this repository. The
> decision-ready summary of all nine reports is `docs/17-constitution.md` to `docs/26-research-register.md`.

Researcher: COMMUNICATION. Date of research: 2026-10-18. Status: complete (sections A to K).
Evidence labels: FACT (primary source cited), INFERENCE (reasoned from facts), OPEN QUESTION. Anything recalled from memory is marked [UNVERIFIED].

## A. Voice and tone

**Principles (INFERENCE, built from the sources in the table and Greecon's principles).**
1. Calm: state the fact, the time and the next step. Urgency lives in the priority label and a deadline, never in adjectives, capitals, exclamation marks or emoji.
2. Answer first. 3. Say what to do, not what failed inside the system. 4. Say what is unknown, with data age. 5. One word per thing (closed glossary, section G); active verbs. 6. Never explain how the rules engine decides: name the customer's own rule and what it did.

| Source (FACT) | Exact wording | Use at Greecon |
|---|---|---|
| Microsoft Style Guide, Top 10 tips [S1] (page metadata: updated 2026-10-15) | "Use bigger ideas, fewer words"; "Write like you speak. Read your text aloud."; "Lead with what's most important... Make customer choices and next steps obvious"; "Give customers just enough information to make decisions confidently"; replaces "Invalid ID" with "You need an ID that looks like this: someone@example.com" | length rule, read-aloud test, error wording |
| GOV.UK Publishing, Writing guidelines [S2] | "Your GOV.UK content needs to be written to certain guidelines"; subpages "Use clear language", "Use the right tone", plus an A to Z style guide. Subpage text NOT read | pointer only; editor reads before drafting |
| OSHA 29 CFR 1910.145 [S6] | (e)(2) "The wording of any sign should be easily read and concise. The sign should contain sufficient information to be easily understood."; (f)(4)(iv) message "understandable to all employees who may be exposed" | regulatory precedent: concise but sufficient |
| Apple HIG, EEMUA 191, ISA-18.2 (quoted in 06-design.md) | titles say what happened, context and why; "Build trust by accurately representing the urgency"; an alarm needs a timely response | priority mapping; no alert without an action |
| Aviation alerting (FAA AC 25.1322-1: tiered alerts, inhibits that suppress nuisance alerts when they cannot be acted on) | not fetched | [UNVERIFIED] analogy for quiet hours and inhibit rules; read the AC before citing |

**One-page style guide.**

| Rule | Before | After |
|---|---|---|
| Fact and deadline first | "WARNING!!! Critical anomaly detected in pumping subsystem" | "Pump 2 stopped at 14:05. Start Pump 1 within 15 min." |
| Give data age; no hard-coded OK | "Pump 2: OK" (data 25 min old) | "Pump 2: no data since 14:05 (25 min). State unknown." |
| Tell what to do | "Error 503: command rejected" | "The command was not sent: the gateway is offline. Pump 2 keeps its last setting." |
| Value, unit, time | "Level high" | "Level 2.4 m, limit 2.8 m, 14:05." |
| No praise, no emotion | "Great news! You saved 23%" | "Energy this month: 8 120 kWh. Same month last year: 9 070 kWh. Weather is not adjusted." |
| Name the rule, not the engine | "Mitigation profile 7 triggered" | "Your rule 'Dry-run protection' stopped Pump 2." |
| One word per thing | alarm / notification / warning / event used alike | "alert" only (G) |
| Honest limits | "Greecon protects your pump" | "Greecon watches the pump and tells you. The motor starter protects the pump." (04-security-safety.md: not a safety system) |

## B. Plain language

- **ISO 24495-1:2023** "Plain language, Part 1: Governing principles and guidelines", published June 2023; covers text-based information; examples are English but it applies to most written languages [S4] (ISO page itself returned HTTP 403; facts from standards-body listings). Principle 1 is titled "Readers get what they need (relevant)", principle 2 "Readers can easily find what they need (findable)" [S4]. Principles 3 and 4 (understandable, usable) [UNVERIFIED, recalled]. Greecon tests (INFERENCE): relevant = the alert reaches the right role; findable = an installer finds the wiring page within 60 s (F); understandable = a non-expert can paraphrase it; usable = the first step is inside the message.
- **European Commission, DG Translation, "How to write clearly"** [S3] (copy read in full text; file last-modified 2006; a later edition has ten hints). Headings: "Put the reader first", "Use verbs, not nouns", "Concrete, not abstract", "Active, not passive", "Whodunnit? Name the agent", "KISS: Keep It Short... and Simple", "False friends". Quotes: readers "are in a hurry. Don't overestimate their knowledge, interest or patience"; "1 sentence = 20 words"; "But varying sentence length makes for more interesting reading"; "If you want outsiders to understand, don't use Eurojargon". Hints, not rules.
- **Readers.** 23.8% (2021) and 23.3% (2023) of Albanians aged 16-74 had at least basic digital skills (EC 2025 report, via 06-design.md). WCAG 3.1.5 Reading Level (lower secondary education) [UNVERIFIED, recalled]. No validated Albanian readability formula found (OPEN QUESTION; English formulas do not transfer). Working limits (hypothesis): average 20 words per sentence [S3], one instruction per sentence, no abbreviation outside the glossary, a paraphrase test with 5 readers per language before release.

**Numbers, dates, units: verified by running ICU 77.1 / CLDR 47.0 in Node 22.22.0 on 2026-10-18 [S5].**

| Item | Albanian (sq) | English (en-GB) | Rule |
|---|---|---|---|
| Number | 1 234 567,89 (group separator is a no-break space; 4-digit numbers are not grouped: 1234,5) | 1,234,567.89 | use Intl, never hand-format |
| Long date | 18 tetor 2026 | 18 October 2026 | prose |
| Short date | 18.10.26 (two-digit year) | 18/10/2026 | do not use CLDR short style; print 18.10.2026 |
| Time | default 12-hour ("4:05 e pasdites"); hourCycle h23 gives 16:05 | 16:05 | always 24-hour |
| Relative | 5 minuta më parë; 1 minutë më parë | 5 minutes ago | whole-sentence templates |
| List | A, B dhe C | A, B and C | use Intl.ListFormat |
| Plural | one: 1; other: 0, 2, 5, 21 | same | two forms |
| Units | Intl gives "23,5 L", "km/orë", "gradë C"; kWh and bar unsupported | | type symbols with a no-break space: 23,5 °C, 2,4 bar, kWh, m³/h |

Store UTC and SI units; display site-local time (Europe/Tirane was UTC+2 on 2026-10-18) with "as of" age.

## C. Alert and message wording

**C1. Signal words and colours.**

| Source | Term | Defined meaning | Status |
|---|---|---|---|
| OSHA 1910.145(c) [S6] | Danger (red) | "indicate immediate danger and that special precautions are necessary" | FACT |
| same | Caution (yellow) | "only to warn against potential hazards or to caution against unsafe practices"; "a possible hazard against which proper precaution should be taken" | FACT |
| same | Safety instruction (green) | "general instructions and suggestions relative to safety measures" | FACT |
| 1910.145(f) tags | Danger tag; Caution tag | "major hazard situations where an immediate hazard presents a threat of death or serious injury"; "minor hazard situations where a non-immediate or potential hazard or unsafe practice presents a lesser threat" | FACT (paragraph numbers as returned by the fetch; verify before legal use) |
| OSHA (d) | colours | ANSI Z535.1-2006(R2011) incorporated by reference; table not read | FACT (incorporation only) |
| ANSI Z535.5 | DANGER, WARNING, CAUTION, NOTICE by injury severity | will / could result in death or serious injury; minor or moderate injury; no injury | [UNVERIFIED, recalled] |
| ISO 3864-1, ISO 7010 | red prohibition; yellow warning; blue mandatory; green safe condition | | [UNVERIFIED, recalled; search could not confirm] |
| IEC 60073 | red emergency; yellow abnormal; green normal; blue mandatory; white neutral | | [UNVERIFIED, recalled; only the edition list 1984, 1991, 1996, 2002 was found [S7]] |

Decision (INFERENCE): do not name priorities Danger, Warning or Caution. In the sign standards those words classify physical-injury hazards, and OSHA reserves Danger for immediate danger. Keep Act now / Check today / For your information (06-design.md); red only for Act now, amber for Check today, neutral for information, never colour alone. Albanian labels proposed: "Veproni tani", "Kontrolloni sot", "Për dijeni" (needs native review).

**C2. Template** (anatomy is in 06-design.md; this is the wording order). Full form: `[Priority]: [Asset] [event] at [time], [site]. [Evidence: value, limit, data age]. [First step] within [time]. [Who is next, when]. [Link]`. Short form for SMS and push: priority, asset, event, first step, link; drop evidence and who. Say why it matters only if a validated model computes it. Never write "resolved" until a reading confirms it.

**C3. Worked examples** (illustrative values; counts computed 2026-10-18 with a GSM 03.38 table; link is a 24-character stand-in).

| Priority | English | Albanian (needs native review) | SMS cost |
|---|---|---|---|
| Act now, short | "Act now: Pump 2 stopped 14:05, lift station. Start Pump 1 within 15 min. [link]" | "Veproni tani: Pompa 2 u ndal 14:05, stacioni i pompimit. Ndizni Pompën 1 brenda 15 min. [link]" | EN 97 chars = 1 segment; SQ 112 chars = 2 (UCS-2) |
| Act now, long | adds "Level 2.4 m, limit 2.8 m." and "If it will not start, call [phone]." | adds "Niveli 2,4 m, kufiri 2,8 m." and "Nëse nuk ndizet, telefononi [phone]." | EN 185 = 2; SQ 210 = 4 (2 if diacritics were stripped) |
| Check today | "Check today: Greenhouse 2 soil moisture is 22% at 06:10 (your setting: 25%). Irrigation did not run at 05:30. Check valve 4 this morning. [link]" | "Kontrolloni sot: Lagështia e tokës në Serën 2 është 22% në 06:10 (cilësimi juaj: 25%). Ujitja nuk u nis në 05:30. Kontrolloni valvulën 4 këtë paradite. [link]" | EN 162 = 2; SQ 176 = 3 |
| For your information (in-app or daily digest, never pushed) | "For your information: Solar plant produced 412 kWh yesterday (day before: 502 kWh). Weather is not adjusted. No action needed." | "Për dijeni: Impianti diellor prodhoi dje 412 kWh (një ditë më parë: 502 kWh). Moti nuk është marrë parasysh. Nuk kërkohet veprim." | not SMS |
| Push (Act now) | title "Act now: Pump 2 stopped" (23); body "Hotel plant, lift station. Start Pump 1 within 15 min." (54) | title "Veproni tani: Pompa 2 u ndal" (28); body 71 chars | payload far below limits |

**C4. Channel constraints.**

| Channel | Constraint | Consequence for Greecon |
|---|---|---|
| SMS, GSM-7 | "up to 160 characters (packed in up to 140 octets)" [S8]; 153 per segment when concatenated (arithmetic: 140 octets minus a 6-octet header; INFERENCE, matches computed 153) | English alerts fit one segment if short |
| SMS, UCS-2 | "at most 70 characters (140 octets)" [S8]; 67 per segment (derived); one character outside the alphabet and "the whole message gets reencoded using the UCS-2 encoding" [S8] | Albanian "ë" forces UCS-2. Default table has Ç (0x09) but not ç, ë or Ë, and none of the Turkish, Spanish or Portuguese tables on that page has ë [S8] (3GPP TS 23.038 itself not read; no Albanian national table seen). Rule: Albanian SMS at most 134 characters including link (2 segments); do not strip diacritics silently (decision for native editor) |
| Push | FCM "limit is 4096 bytes for most messages... 2048 bytes" for topics [S11] (quoted by search summary; page not read); APNs 4 KB from secondary sources only; no official display-length limit found | title at most 30, body at most 80 characters (hypothesis; test on real devices) |
| WhatsApp | categories "Marketing", "Utility", "Authentication"; "template messages are the only message type that can be sent outside of a customer service window"; window 24 hours, opened by the user's message; non-template messages and utility templates are free inside it; free entry point window 72 hours; per-message pricing replaced conversation pricing on 1 July 2025 [S9] | alerts are pre-approved utility templates with variables; no promotion inside them; category definitions not on that page (read the template-categorisation page before submitting) |
| Viber Business | Albania coverage NOT verified. Infobip: session = 24-hour window, consent required, transactional is text-only; Tyntec: transactional templates need Viber approval only in Russia; Messaggio lists the product on its Albania page [S10] | later seam; ask users which channel they read first (06-design.md J) |
| Email | no limit that shapes alerts | reports, receipts, formal notices; subject = priority, site, event; never the only Act now channel |

**C5. Quiet hours and escalation wording** (defaults are hypotheses, from 06-design.md: no acknowledgement in 10 min then SMS; quiet hours pass only Act now).
- Setting text: "Quiet hours 22:00-06:00. Only Act now alerts reach you."
- To the next person: "Act now, not acknowledged: Pump 2 stopped 14:05. [Name] was alerted at 14:05 and has not answered. You are next. Start Pump 1 within 15 min."
- To the first person: "No answer yet. [Name] was alerted at 14:20."
- On acknowledgement: "Acknowledged by [Name] at 14:07. Escalation stopped."
- On recovery: "Pump 2 is running again at 14:12. Level 2.3 m and falling."

## D. Incident and outage communication

**Practice.** Status-page stages (Investigating, Identified, Monitoring, Resolved) and update cadence are [UNVERIFIED, recalled]: the Atlassian handbook URL returned HTTP 404 on 2026-10-18 and no primary source was read. Every update carries a time with zone, what we know, what we do not know, what the customer should do, and the time of the next update. Proposed cadence (hypothesis): first acknowledgement within 30 minutes of detection, updates at the promised interval even when nothing changed, written summary within 5 working days.
- **Say:** facts with times; the effect on the customer's site in concrete terms; what still works locally (only if tested); one contact.
- **Do not say:** a cause before it is confirmed; "no evidence that data was accessed" while the investigation is open; "fully secure"; "resolved" before a reading or log confirms it; blame of a supplier or customer; anything about how the rules engine decides. In a safety event the first line is the step that protects people, not an explanation.

**Clocks that shape wording (FACT; primary texts read locally 2026-10-18: EUR-Lex copies of NIS2 and CRA, Law 124 English text, Law 25 Albanian text, GDPR via gdpr-info.eu).**

| Instrument | Who notifies whom | Clock and content | Wording consequence |
|---|---|---|---|
| NIS2 Art. 23 [S12] | essential or important entity to CSIRT or authority | 23(4)(a) "within 24 hours of becoming aware... an early warning"; (b) "within 72 hours... an incident notification" with initial assessment and indicators of compromise; (c) intermediate report on request; (d) final report "not later than one month after the submission of the incident notification". 23(1): entities "shall notify, without undue delay, the recipients of their services of significant incidents that are likely to adversely affect the provision of those services" | in-scope EU customers need Greecon's facts within hours; keep one fact base for all clocks |
| CRA Art. 14 [S13] | manufacturer to CSIRT coordinator and ENISA via the Art. 16 single reporting platform; then to users | actively exploited vulnerability: 24 h early warning, 72 h notification, final report "no later than 14 days after a corrective or mitigating measure is available"; severe incident: 24 h, 72 h, final report "within one month after the submission of the incident notification". 14(8): "inform the impacted users" of "any risk mitigation and corrective measures that the users can deploy" | a user notice must contain actions users can take; Art. 14 applies from 11 Sep 2026 (05-legal.md, Arts 69-71) |
| GDPR Art. 33-34 [S17] | controller to authority; processor to controller; controller to data subject | "without undue delay and, where feasible, not later than 72 hours after having become aware of it", unless unlikely to result in a risk; a later filing "shall be accompanied by reasons for the delay"; Art. 34 (high risk): communicate "without undue delay" and "in clear and plain language" | as processor Greecon tells the customer first; the data-subject text has a legal plain-language duty |
| Albania Law 124/2024 Art. 29 [S14] | controller to the Commissioner; processor to controller "immediately" and data subjects from about Jan 2027 (05-legal.md) | controller "as soon as possible, but no later than 72 hours, after having become aware of it" | state the customer-notice promise in hours |
| Albania Law 25/2024 Art. 23(3),(5) [S15] | critical or important information-infrastructure operator to National and sector CSIRT | all incidents "brenda 4 orëve nga momenti i identifikimit të incidentit" (within 4 hours); significant incidents: update and initial assessment "brenda 72 orëve"; final report "brenda një muaji" | a classified customer (for example wastewater, 05-legal.md) needs Greecon's facts in under 4 hours: a staffed 24-hour contact path or an explicit contractual limit |

OPEN QUESTION: the Digital Omnibus proposal (Nov 2025) would route CRA, NIS2 and GDPR reports through one ENISA entry point; 05-legal.md found it unresolved into 2027. Re-check before relying on any clock above.

**Templates** (English masters; each needs an Albanian master from a native editor and counsel's review; statutory filings follow the regulator's form, not these).
- **Outage or degraded service.** "[time, zone] Investigating. Since [time], [function] is unavailable for [scope]. Effect on your site: [what still works; what does not]. What to do: [action, or nothing]. Next update by [time]." Later: "Identified. Cause: [fact, or not yet known]." "Monitoring. [measure] has been normal since [time]." "Resolved. Restored at [time]; duration [x]. Written summary by [date]."
- **Safety event.** "[time] Safety notice. [One fact: what happened at which asset.] Step for your staff now: [one step]. Do not rely on [function] until [condition]. Protections in your equipment ([named]) are [not affected, checked at [time]]. We have stopped [command execution] for your site. 24-hour contact: [phone]. Next update by [time]."
- **Security incident.** "[time] Security notice. On [date, time] we detected [event] in [system]. Known: [facts]. Not yet known: [list]. Your data: [affected / not yet known / not affected, only when verified]. Done so far: [containment]. Please: [credential change, log check]. Contact: [security contact]. Next update by [time]; full report within one month." Give a controller what it needs for its own filing: nature, categories and numbers if known, likely consequences, measures taken (Law 124 Art. 29 wording read; GDPR Art. 33(3) list [UNVERIFIED]).

## E. Claims discipline

**Legal frame.**
- **B2B (Greecon's main market), Directive 2006/114/EC [S18].** Purpose: "to protect traders against misleading advertising and the unfair consequences thereof". Art. 3 lists what is judged, including "the results to be expected from their use, or the results and material features of tests or checks carried out" and the advertiser's "qualifications... or his awards and distinctions". Art. 4: comparison only if it "objectively compares one or more material, relevant, verifiable and representative features". INFERENCE: every savings figure, test result and certification mention is in scope. It binds EU Member States; an Albanian B2B equivalent was NOT found (OPEN QUESTION for counsel; 05-legal.md also lists it unverified).
- **B2C, Albania Law 9902/2008** (English copy, may predate later amendments) [S20]: misleading if it "contains false information... or in any way, including overall presentation, deceives or is likely to deceive the average consumer, even if the information is factually correct" (Art. 14); omitting "material information that the average consumer needs" (Art. 15); aggressive practices (Art. 16); "Unfair commercial practices shall be prohibited". A farm or hotel buying for its business is probably a trader, not a consumer (INFERENCE, OPEN QUESTION). Directive (EU) 2024/825 applies from 27 Sep 2026 and is B2C (05-legal.md). The Commission page shows the Green Claims Directive proposal as "Status: Pending" [S19]. The UCPD guidance notice 2021/C 526/01 was not read.
- **AI wording.** Commission guidelines C(2025) 5053 [S16]: the AI definition "should not cover systems that are based on the rules defined solely by natural persons to automatically..." execute operations; para. 46: "Basic data processing system refers to a system that follows predefined, explicit instructions". INFERENCE: a deterministic rules engine is not called AI in marketing. FTC "Keep your AI claims in check" [UNVERIFIED: URL returned HTTP 404].
- **Savings baseline.** IPMVP (EVO) [UNVERIFIED, recalled; Wikipedia fetch returned HTTP 404]: savings = adjusted baseline use minus reporting-period use, with routine adjustments (weather, occupancy, production) and non-routine adjustments; Options A and B (retrofit isolation), C (whole facility), D (calibrated simulation); related M&V standard ISO 50015 [UNVERIFIED]. Working rule (hypothesis): metered baseline spanning a full seasonal cycle, 12 months.
- **Uptime arithmetic (INFERENCE):** 99.9% allows 43.8 minutes of downtime per 30.44-day month; 99.99% allows 4.4 minutes.

| Claim type | Allowed wording | Forbidden wording | Evidence needed |
|---|---|---|---|
| Safety | "Greecon monitors your equipment and alerts you. The protection built into your equipment remains the safety layer." | "protects", "safe", "fail-safe", "prevents overflow", "SIL", "guarantees" | written intended-use statement (04-security-safety.md: not a safety system); tests; incident log |
| Savings | "In [pilot], energy use was [Y] kWh ([Z]%) lower than the adjusted baseline ([dates]); method [IPMVP option]; weather adjusted" | "saves up to 30%", "cut your bill by a third"; simulated or estimated savings stated as measured | baseline data, adjustment model, uncertainty, customer consent. Today none exists, so no savings figure |
| AI | "Automation follows explicit rules your team sets" (once built and tested) | "AI-powered", "intelligent", "self-learning", "predictive" for deterministic rules | method description; if a learning model is added: what it learns from, accuracy measured on whose data |
| Compliance | "Designed to support your records and reporting under [law]" (after counsel maps it) | "NIS2 compliant", "CRA compliant", "GDPR certified" | counsel's mapping; signed DPA; CRA conformity assessment before CE marking |
| Certification | "[Standard], certified by [body], scope, certificate number, valid until" | a logo, "certified", "CE marked" or "IEC 62443 certified" before a certificate exists; "assessment planned" without a signed engagement | the certificate (Directive 2006/114/EC Art. 3: "awards and distinctions") |
| Uptime | "Measured availability, last 90 days: [x]% (probe from two locations; maintenance excluded and listed)"; "Sites keep reading local data when the internet is down" (after a test) | "100% uptime", "always on", "never fails"; an SLA figure with no measurement | monitoring data, written definition, incident history |
| Security | "Report vulnerabilities to [contact]; we reply within [x] days" | "unhackable", "bank-grade", "military-grade", "100% secure" | CRA Annex II requires "the single point of contact where information about vulnerabilities... can be reported" [S13] |
| Customers and data | "Demo data is simulated" on every demo screen | customer or deployment counts when there are none; simulated results shown as measured; logos without permission | contracts; consent |

**Claims register (INFERENCE).** Each public claim has an ID, the exact sentence, an evidence file, an owner, a date and a review date (every release or 6 months). Sales and press use only registered sentences; a second person approves each.

## F. Documentation system

- **Structure (FACT).** Diátaxis "identifies four distinct needs, and four corresponding forms of documentation - tutorials, how-to guides, technical reference and explanation" and proposes that documentation "should itself be organised around the structures of those needs" [S21]. Mapping (INFERENCE): tutorial = first install of a demo site; how-to = "an alert fired, what do I do", one page per alert type, which doubles as the operator runbook and supplies the alert's first-step text; reference = points, states, units, glossary, API; explanation = what Greecon does and does not do, safety limits, data flows.
- **Docs-as-code** [UNVERIFIED, recalled; Write the Docs]: Markdown in the product repository, reviewed like code, built in CI, Albanian and English side by side, a check that flags words outside the glossary.
- **Release notes (FACT).** Keep a Changelog 1.1.0 [S22]: types "Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"; "The latest version comes first. The release date of each version is displayed." Greecon adds a flag "Changes how alerts behave" (INFERENCE: changed thresholds or wording alter what people do) and writes for customers, not engineers.
- **ADR (FACT).** "An Architectural Decision (AD) is a justified design choice that addresses a functional or non-functional requirement that is architecturally significant" [S23]. One page per decision touching safety, security, data or claims (Title, Status, Context, Decision, Consequences [UNVERIFIED, recalled]), linking the evidence that proved the need.

| Reader | Must find in under 60 seconds (hypothesis: stopwatch test, 5 people per role) | Form |
|---|---|---|
| Customer | what an alert means and the first step; who gets called and how to change it; what Greecon does not do; a phone number | in-app how-to, phone-readable, Albanian first |
| Installer | wiring and commissioning checklist; network and power needs; the test that proves each point reads correctly; gateway replacement | how-to and reference; one tutorial |
| Auditor | intended use and limits; data flows and hosting location; incident procedure and log; release history; who approved which command | explanation, reference, evidence pack. CRA Annex II items read: manufacturer contact; "single point of contact where information about vulnerabilities... can be reported"; unique identification; intended purpose and security environment; known circumstances that may lead to significant cybersecurity risks; address of the EU declaration of conformity [S13] |

## G. Vocabulary

**Why closed (INFERENCE).** One concept, one word, in every screen, alert, document, contract and sales line, so a reader who learns "alert" never meets "alarm", "notification" and "warning" for the same thing. Microsoft: "Avoid jargon" [S1]; ISO 24495-1 wants readers to understand what they find [S4, principles 3-4 UNVERIFIED]. A new term enters only by change request that also names the Albanian term and the banned synonyms. Legend: NNR = needs native review; "attested" = the word occurs in an official Albanian text, source in brackets (found by searching the local texts 2026-10-18; attestation shows the word exists, not that it has this meaning).

| # | Term (banned synonyms) | Plain definition | Albanian |
|---|---|---|---|
| 1 | Site | A place where Greecon watches equipment | NNR ("lokacion" attested [S15]) |
| 2 | Asset (device, unit) | One piece of equipment: pump, valve, tank, inverter | "pajisje" attested [S15]; NNR |
| 3 | Point (tag, channel) | One value measured or set on an asset | NNR |
| 4 | Reading (sample) | One measured value with its time | "lexim" attested (meter reading) [S26] |
| 5 | Alert (alarm, warning, notification) | A message that asks a person to act | NNR; "sinjalizim" attested once [S15]; "njoftim" = notification |
| 6 | Priority | How soon to act | NNR: "Veproni tani", "Kontrolloni sot", "Për dijeni" |
| 7 | State | The condition of an asset or site now | "gjendje" attested [S15] |
| 8 | Stable | All fresh inputs are within limits | NNR ("Stabil", "Në rregull") |
| 9 | Attention needed | Outside normal range; no action due yet | "vëmendje" attested [S26]; NNR |
| 10 | Action required | A person must act within a stated time | "veprim" attested [S26]; NNR |
| 11 | Unknown | Data missing or too old to tell | NNR ("I panjohur") |
| 12 | Rule | A condition and action the customer's team set | "rregull" attested but means regulation; NNR |
| 13 | Gateway (edge box) | The box on site that talks to equipment and to Greecon | NNR |
| 14 | Command | An instruction sent to an asset: start, stop, open, close, set | NNR ("urdhër" attested as legal order) |
| 15 | Simulated | Made-up data, or a command not sent to real equipment | NNR |
| 16 | Live | Real data or a real command | NNR |
| 17 | Limit (setpoint, threshold) | A number the customer sets; readings are compared with it | "prag" = threshold attested [S26] |
| 18 | Acknowledge | Confirm you have seen the alert and are acting | NNR |
| 19 | Escalate | Pass an unacknowledged alert to the next person | NNR |
| 20 | On duty | The person responsible now | NNR |
| 21 | Data age | Time since the latest reading arrived | NNR |
| 22 | Offline | The site cannot reach Greecon | NNR |
| 23 | Incident | An event that harms or may harm service or security | "incident", "incident i rëndësishëm" attested [S15] |
| 24 | Outage | A period when a function is unavailable | "ndërprerje" attested [S26] |
| 25 | Maintenance | Planned work | "mirëmbajtje" attested [S26] |
| 26 | Customer | The organisation under contract | "konsumator" attested [S25, S26] but means consumer; NNR |
| 27 | User | A person using the app | "përdorues" attested [S15] |
| 28 | Report | A summary document for a period | "raport" attested [S26] |
| 29 | Baseline | The reference period or level used to measure change | NNR |
| 30 | Evidence | The values and times shown with an alert | NNR |

**Sector terms found in official Albanian texts** (unfound terms are NNR).

| Domain | English | Albanian as found | Source |
|---|---|---|---|
| Water | drinking water; water supply; sewerage | "ujë i pijshëm"; "ujësjellës"; "kanalizim" | 2019 draft water law; ERRU 2025 [S26] |
| Water | wastewater; treatment plant | "ujërat e ndotura"; "impiante të trajtimit të ujërave të ndotura" | Law 9115/2003; Joint Instruction 1/2024 [S26] |
| Water | pump; reservoir; leak; losses; non-revenue water | "pompë"; "rezervuar"; "rrjedhje"; "humbje"; "Uji Pa të Ardhura (UPA)" | draft water law; ERRU 2025 [S26] |
| Water | water meter; meter reading; interruption of supply | "matës"; "leximit të matësve të ujit"; "ndërprerjen e furnizimit me ujë të pijshëm" | draft water law [S26] |
| Energy | electricity; energy sector; solar energy | "energji elektrike"; "sektori i energjisë"; "energjia diellore" | ERRU 2025; VKM 683/2024 [S26] |
| Energy | regulator; supplier; consumer; free market | "Enti Rregullator i Energjisë"; "furnizues"; "konsumator"; "treg i lirë" | ERE site [S25] |
| Agriculture | agriculture; plant protection products; chemical fertilisers | "bujqësi"; "produkteve të mbrojtjes së bimëve"; "plehrave kimike" | Gazette 2025/9; VKM 683; Joint Instruction 1/2024 [S26] |
| Not found | greenhouse, irrigation, drip, farmer, inverter, battery, voltage, sensor, pumping station; valve not searched | NNR. Words to test: "serrë", "ujitje", "fermer", "invertor", "bateri", "tension", "sensor", "valvul" [UNVERIFIED] | no hits in the texts read; the ministry site returned an empty page |

## H. Stakeholder statements

Facts assumed (founder to confirm before use): no customers, no product on the market, simulated data only, no certification, a pilot plan not yet started.

| Audience | Statement true today | Must not imply |
|---|---|---|
| Customers | "Greecon is an early platform that watches energy, water and agriculture equipment and tells you what needs attention. Today it runs on simulated data and does not control real equipment. We are looking for a few sites for a supervised pilot: read-only monitoring and alerts first, control only with your written agreement. Greecon is not a safety system; the protection in your equipment stays in place." | live sites, savings, certification, guaranteed alerts, 24-hour support unless staffed |
| Installers | "We are designing the edge box and the commissioning steps with installers. There is no production hardware release and no support commitment yet. We want to learn how long a commissioning takes, what fails on site and which documents you need." | a partner programme, margins, exclusivity, installer certification, a release date |
| Regulators | "Greecon Sh.p.k. is an early-stage company at Durana Tech Park. We have placed no product on the market. We design for Law 124/2024, for the cybersecurity duties customers will pass on under Law 25/2024 and, for the gateway, for the Cyber Resilience Act. We will notify within the legal clocks." | compliance, approval, endorsement; that any authority reviewed the design |
| Investors | "Greecon is pre-revenue with no customers. The software runs on simulated data; a pilot plan will test whether owners of small and mid-size sites pay for calm monitoring and supervised automation. Main risks: customers do not pay, installation and support cost more than planned, safety, security and legal work takes longer. We give no forecasts." | traction, pipeline, revenue, AI differentiation, market-size certainty |
| Press | "Greecon Sh.p.k. is an early-stage Albanian company building software and an edge box to monitor energy, water and agricultural sites. It has no customers and has not been deployed on real equipment. We say what is built and what is planned. We do not discuss the internal design of our rules engine." | a launch, customers, awards, results, savings figures |

## I. Implications

**Must exist from day one**
1. Closed glossary with banned synonyms, Albanian terms agreed once (G; S1, S4).
2. Whole-sentence alert templates per priority with an Albanian master, never concatenated (C3; S5).
3. 24-hour time, decimal comma, four-digit year, no-break-space units, all through Intl (B table; S5).
4. Fact, time, first step, deadline in every alert; Danger, Warning, Caution never used as priorities (A, C1; S6).
5. Claims register and the claims table; "simulated" label on demo data (E; S18; 04-security-safety.md).
6. A 24-hour incident contact, three templates, one fact base for the 4 h, 24 h and 72 h clocks (D; S12-S15, S17).
7. Albanian SMS capped at 134 characters including link because of UCS-2 (C3, C4; S8).
8. WhatsApp alerts only as pre-approved templates (C4; S9).
9. Docs in four Diátaxis forms in the repository, with a customer, installer, auditor map (F; S21, S13).
10. Keep a Changelog format with a "Changes how alerts behave" flag (F; S22).

**Seams for later**
1. Channel adapter for Viber and voice; Albania coverage unverified (C4; S10).
2. Third language and locale packs (06-design.md; S5).
3. Public status page once real customers exist; a private incident log until then (D).
4. Machine-readable user notices for CRA Art. 14(8) (D; S13).
5. Savings module following IPMVP options (E; [UNVERIFIED]).
6. Runbook pages generated from alert definitions; ADR folder (F; S23).
7. Albanian readability test tooling; none validated (B).
8. Auditor evidence-pack export (F; 06-design.md).

**Things to avoid**
1. Hype, emoji, exclamation marks, "AI-powered" for deterministic rules (A, E; S16).
2. Stripping ë and ç silently to save SMS cost (C4; S8).
3. Sign-standard signal words as priority names (C1; S6).
4. Promising update intervals or response times nobody staffs (D).
5. Naming compliance or certification Greecon lacks (E; S18).
6. Hand-formatted numbers; the CLDR short date with a two-digit year (B; S5).
7. A hard-coded "OK" or "resolved" without a reading (A, C5; 06-design.md).
8. Exposing rules-engine internals in messages, docs or press (A, H).

## J. Open questions

**User research**
1. Which channel does each segment read within 5 minutes: push, SMS, WhatsApp, Viber, call? Is SMS from an unknown sender trusted? (06-design.md J.)
2. Do users prefer "Veproni tani / Kontrolloni sot / Për dijeni", or other words? Run a paraphrase test.
3. Do users want English technical loanwords or Albanian terms?
4. Is a 2-segment Albanian SMS acceptable in cost and delay, or would users accept diacritic-free text?
5. How much outage detail does each role want; does anyone read a status page before the first five customers?
6. Which customers will flow down a 4-hour incident clock?

**Native-speaker editor**
1. Every Albanian line in C3 and C5 and every NNR row in G.
2. Formal or informal address, and imperative forms, for alerts.
3. State labels (Stable, Attention needed, Action required, Unknown) and the word for alert.
4. Agriculture and energy terms not found in sources.
5. Policy for ë and ç in SMS and URLs.
6. A reading-level target and an Albanian paraphrase-test script.

**Counsel and unverified items to close**
1. B2B advertising rule in Albania; is a farm or hotel a consumer (E).
2. Digital Omnibus status; GDPR Art. 33(3) list; UCPD guidance 2021/C 526/01.
3. Not verified: ANSI Z535.5 definitions, ISO 3864-1 and 7010 colours, IEC 60073 colour table, FAA AC 25.1322-1, FTC AI-claims guidance, IPMVP text, status-page stages, APNs 4 KB and display limits, Viber Albania coverage, ISO 24495-1 principles 3-4, TS 23.038 itself.

## K. Source list

All accessed 2026-10-18. "Local" means read from the research folder (downloaded earlier; see 00-manifest.md).

| ID | Source and URL | Publisher | Use |
|---|---|---|---|
| S1 | Top 10 tips for Microsoft style and voice, https://learn.microsoft.com/en-us/style-guide/top-10-tips-style-voice | Microsoft | voice rules (A, G) |
| S2 | Writing guidelines, https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/ | GOV.UK Publishing | pointer only (A) |
| S3 | How to write clearly, https://mail.civilservant.org.uk/library/fight_the_fog.pdf (PDF dated 2006, text read locally) | European Commission, DG Translation (copy hosted by civilservant.org.uk) | plain language (B) |
| S4 | ISO 24495-1:2023 listings, https://scc-ccn.ca/standardsdb/standards/8184602 and https://accessible-eu-centre.ec.europa.eu/content-corner/digital-library/iso-24495-12023-plain-language-part-1-governing-principles-and-guidelines_en (via search summary; ISO page returned 403) | Standards Council of Canada; EU Accessible EU Centre | principles 1-2, scope (B) |
| S5 | ICU 77.1, CLDR 47.0 in Node 22.22.0, run locally | Unicode CLDR | number, date, unit formats (B) |
| S6 | 29 CFR 1910.145, https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.145 | US OSHA | signal words, colours, wording (A, C) |
| S7 | IEC 60073 editions, https://reference.globalspec.com/ref/3879665/iec-60073-2002 | GlobalSpec | edition list only (C) |
| S8 | GSM 03.38, https://en.wikipedia.org/wiki/GSM_03.38 (first 100,000 of 193,968 characters read) | Wikipedia, secondary to 3GPP TS 23.038 | SMS encoding and lengths (C) |
| S9 | WhatsApp pricing, https://developers.facebook.com/docs/whatsapp/pricing | Meta | categories, window, pricing (C) |
| S10 | https://infobip.com/docs/viber/business-messages/compliance-guidelines ; https://www.tyntec.com/helpcenter/docs/internal/message-types-overview/ ; https://messaggio.com/messaging/albania/ (via search summary) | Infobip; Tyntec; Messaggio | Viber Business (C) |
| S11 | FCM error codes, https://firebase.google.com/docs/cloud-messaging/error-codes (via search summary) | Google | FCM size limit (C) |
| S12 | NIS2 Directive (EU) 2022/2555, https://eur-lex.europa.eu/eli/dir/2022/2555/oj (local copy) | EU | Art. 23 clocks (D) |
| S13 | Cyber Resilience Act (EU) 2024/2847, https://eur-lex.europa.eu/eli/reg/2024/2847/oj (local copy) | EU | Art. 14, Annex II (D, E, F) |
| S14 | Law 124/2024 (English text) and Gazette 2025 no. 9 (Albanian), local | Republic of Albania | Art. 29 (D, G) |
| S15 | Law 25/2024 On Cyber Security, Albanian text, local | Republic of Albania | Art. 23, terms (D, G) |
| S16 | Guidelines on the definition of an AI system, C(2025) 5053, local | European Commission | AI wording (E) |
| S17 | GDPR Arts 33-34, https://gdpr-info.eu/art-33-gdpr/ and https://gdpr-info.eu/art-34-gdpr/ | gdpr-info.eu (unofficial transcription of Regulation (EU) 2016/679) | breach clocks (D) |
| S18 | Directive 2006/114/EC, https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32006L0114 | EU | B2B advertising (E) |
| S19 | Green claims, https://environment.ec.europa.eu/topics/circular-economy/green-claims_en | European Commission | proposal status "Pending" (E) |
| S20 | Law 9902/2008 on consumer protection, English, https://erru.al/doc/Consumer_Protection_Law_No.9902,_17.04.2008_English_version.pdf (unofficial translation, possibly pre-2016) | ERRU copy | B2C unfair practices (E) |
| S21 | Diátaxis, https://diataxis.fr/ | Daniele Procida | documentation structure (F) |
| S22 | Keep a Changelog 1.1.0, https://keepachangelog.com/en/1.1.0/ | Keep a Changelog | release notes (F) |
| S23 | Architectural Decision Records, https://adr.github.io/ | ADR GitHub organisation | ADR definition (F) |
| S24 | WCAG 2.2 Understanding SC 3.1.5, https://www.w3.org/WAI/WCAG22/Understanding/reading-level.html | W3C | verifies the B line tagged UNVERIFIED: "When text requires reading ability more advanced than the lower secondary education level after removal of proper names and titles, supplemental content... is available" (Level AAA) |
| S25 | Enti Rregullator i Energjisë, https://www.ere.gov.al/ | Albanian energy regulator | energy terms (G) |
| S26 | Local Albanian texts: ERRU Annual Report 2025; Law 9115/2003 consolidated; 2019 draft water-sector law; Joint Instruction 1/2024; VKM 683/2024; Gazette 2025/9 | Albanian authorities | vocabulary (G) |
| S27 | 04-security-safety.md, 05-legal.md, 06-design.md, 07-market-users.md in this folder | same research programme | facts reused, not repeated |

Attempted and not obtained (not retried): ISO page (403), FAA AC 25.1322-1 (403), FTC AI-claims blog (404), Atlassian incident handbook (404), Firebase concept-options (404), Wikipedia IPMVP (404), Albanian agriculture ministry site (empty page), GOV.UK subpages (not read).
