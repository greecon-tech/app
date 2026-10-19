# 21. Communication system

Status: written 2026-10-18 from `docs/research/08-communication.md`. Every Albanian word in this
project needs a native editor before it ships; where this document gives one it is marked **NNR**
(needs native review). Quotes of standards and laws are in the research report with their sources
and with what could not be verified. This is not legal advice.

The rule behind everything here is the constitution's: say only what is built and proven, in words
a tired person can act on at 2 a.m.

## 1. Voice

Calm, plain, exact. State the fact, the time and the next step. Urgency lives in the priority and a
deadline, never in adjectives, capital letters, exclamation marks or emoji.

1. Answer first, detail one step away.
2. Say what to do, not what failed inside the system.
3. Say what is unknown, and how old the data is.
4. One word per thing (the glossary, section 6). Use active verbs.
5. Never explain how the rules engine decides. Name the customer's own rule and what it did.

| Rule | Before | After |
|---|---|---|
| Fact and deadline first | "WARNING!!! Critical anomaly detected in pumping subsystem" | "Pump 2 stopped at 14:05. Start Pump 1 within 15 min." |
| Give the data age; no hard-coded OK | "Pump 2: OK" (data 25 min old) | "Pump 2: no data since 14:05 (25 min). State unknown." |
| Tell what to do | "Error 503: command rejected" | "The command was not sent: the gateway is offline. Pump 2 keeps its last setting." |
| Value, unit, time | "Level high" | "Level 2.4 m, limit 2.8 m, 14:05." |
| No praise, no emotion | "Great news! You saved 23%" | "Energy this month: 8 120 kWh. Same month last year: 9 070 kWh. Weather is not adjusted." |
| Name the rule, not the engine | "Mitigation profile 7 triggered" | "Your rule 'Dry-run protection' stopped Pump 2." |
| Honest limits | "Greecon protects your pump" | "Greecon watches the pump and tells you. The motor starter protects the pump." |

Test every message by reading it aloud, then by asking a non-expert to say it back in their own
words. A target for pilots: five readers per language, paraphrase correct, before release.

## 2. Numbers, dates and units

Checked with ICU 77.1 and CLDR 47 in October 2026. Always format through `Intl`, never by hand.

| Item | Albanian | English | Rule |
|---|---|---|---|
| Number | 1 234 567,89 (no-break space; four-digit numbers not grouped) | 1,234,567.89 | decimal comma in Albanian |
| Short date | CLDR gives 18.10.26 (two-digit year) | 18/10/2026 | print the year in full: 18.10.2026 |
| Time | the default is 12-hour | 16:05 | always 24-hour |
| Units | `Intl` does not know kWh or bar | | type symbols with a no-break space: 23,5 °C, 2,4 bar, 8 120 kWh, m³/h |

Store UTC and SI units; display the site's local time with the age of the data. Whole-sentence
templates, never concatenated fragments: Albanian marks definiteness on nouns, so pasted pieces
break.

## 3. Alerts

**Priorities and wording.** Act now, Check today, For your information. Albanian labels proposed,
**NNR**: "Veproni tani", "Kontrolloni sot", "Për dijeni". The words Danger, Warning and Caution are
not used: in the sign standards they classify injury hazards (OSHA reserves Danger for immediate
danger). Red is only for Act now, amber for Check today, neutral for information, and never colour
alone (`docs/20`).

**Template.** Full form: `[Priority]: [Asset] [event] at [time], [site]. [Evidence: value, limit,
data age]. [First step] within [time]. [Who is next, when]. [Link]`. Short form for SMS and push:
priority, asset, event, first step, link. Say why it matters only if a validated model computes it.
Never write "resolved" until a reading confirms it.

> Act now: Pump 2 stopped 14:05, lift station. Start Pump 1 within 15 min. [link]
>
> Check today: Greenhouse 2 soil moisture is 22% at 06:10 (your limit: 25%). Irrigation did not run
> at 05:30. Check valve 4 this morning. [link]
>
> For your information: Solar plant produced 412 kWh yesterday (day before: 502 kWh). Weather is not
> adjusted. No action needed.

The last is shown in the app or a daily digest and is never pushed.

**Escalation wording.** To the next person: "Act now, not acknowledged: Pump 2 stopped 14:05. [Name]
was alerted at 14:05 and has not answered. You are next. Start Pump 1 within 15 min." On
acknowledgement: "Acknowledged by [Name] at 14:07. Escalation stopped." On recovery: "Pump 2 is
running again at 14:12. Level 2.3 m and falling." Quiet hours pass only Act now. Defaults to test, not
facts: no acknowledgement in 10 minutes, then SMS; at 30 minutes, the next contact.

### Channel limits that shape the words

| Channel | Constraint | Consequence |
|---|---|---|
| SMS | Up to 160 characters in the GSM-7 alphabet, 153 per part when joined. One character outside it re-encodes the whole message as UCS-2: 70 characters, 67 per part. The Albanian letter ë is not in the default alphabet, and ç is not (only the capital Ç is) | An Albanian alert is UCS-2. Cap Albanian SMS at 134 characters including the link (two parts). Do not strip ë and ç silently to save cost: that is a decision for the native editor |
| Push | A few kilobytes of payload; no official display limit found | Title at most 30 characters, body at most 80 (to test on real devices) |
| WhatsApp | Outside the 24-hour customer-service window only pre-approved templates may be sent | Alerts are pre-approved utility templates with variables; nothing promotional inside them |
| Viber | Business coverage in Albania could not be verified | A later seam; ask users which channel they read first |
| E-mail | No limit that shapes alerts | Reports, receipts and formal notices; never the only Act now channel |

Worked example, counted against the GSM table: the short Act now alert is 97 characters in English
(one part) and 112 in Albanian (two parts); the long form is 185 against 210 (two parts against
four). The research report has the Albanian renderings, **NNR**.

Built: the alert titles and first-step text for the six conditions the engine raises. Not built:
delivery, escalation, quiet hours, the daily message.

## 4. When something goes wrong at Greecon

Every update carries a time with a zone, what we know, what we do not know, what the customer should
do, and when the next update comes. First acknowledgement within 30 minutes of detection, updates at
the promised interval even if nothing changed, a written summary within five working days (all
proposals, and only promised if staffed).

Say facts with times, the effect on the customer's site in concrete terms, what still works locally
(only if tested), and one contact. Do not say a cause before it is confirmed, "no evidence that data
was accessed" while an investigation is open, "fully secure", "resolved" before a reading or log
confirms it, or anything about how the rules engine decides. In a safety event the first line is the
step that protects people.

### The clocks (primary texts read in October 2026; confirm with counsel)

| Instrument | Who tells whom | Clock |
|---|---|---|
| Albania Law 25/2024, Art. 23 | A designated critical or important operator tells the national and sector CSIRT | All incidents within **4 hours**; significant incidents: update and first assessment within 72 hours; final report within a month |
| NIS2 (EU), Art. 23 | An in-scope entity tells its CSIRT, and tells its own service recipients | Early warning 24 hours; notification 72 hours; final report within a month |
| Cyber Resilience Act, Art. 14 (applies from 11 September 2026) | The manufacturer tells the CSIRT and ENISA, then users | Actively exploited vulnerability or severe incident: 24 hours, 72 hours, final report within 14 days after a fix, or a month. The user notice must carry measures users can apply |
| GDPR Arts. 33 and 34; Albania Law 124/2024, Art. 29 | A processor tells the controller; the controller tells the authority | No later than 72 hours after becoming aware; a processor "immediately" |

A customer designated under Law 25/2024 needs Greecon's facts in under four hours, which means a
staffed 24-hour contact path or an explicit contractual limit. Keep one fact base for all clocks.
The EU "digital omnibus" proposal would route several of these through one entry point and was
unresolved when this was written: re-check before relying on a clock.

Templates (English masters; each needs an Albanian master and counsel's review; statutory filings
follow the regulator's form, not these):

- **Outage or degraded service.** "[time, zone] Investigating. Since [time], [function] is
  unavailable for [scope]. Effect on your site: [what still works; what does not]. What to do:
  [action, or nothing]. Next update by [time]." Then Identified, Monitoring, Resolved, each with its
  time.
- **Safety event.** "[time] Safety notice. [One fact: what happened at which asset.] Step for your
  staff now: [one step]. Do not rely on [function] until [condition]. Protections in your equipment
  ([named]) are [not affected, checked at [time]]. We have stopped [command execution] for your site.
  24-hour contact: [phone]. Next update by [time]."
- **Security incident.** "[time] Security notice. On [date, time] we detected [event] in [system].
  Known: [facts]. Not yet known: [list]. Your data: [affected / not yet known / not affected, only
  when verified]. Done so far: [containment]. Please: [credential change, log check]. Contact:
  [security contact]. Next update by [time]; full report within one month."

## 5. What we may claim

| Claim | Allowed wording | Never | Evidence needed |
|---|---|---|---|
| Safety | "Greecon monitors your equipment and alerts you. The protection built into your equipment remains the safety layer." | "protects", "safe", "fail-safe", "prevents overflow", "SIL", "guarantees" | A written intended-use statement; tests; the incident log |
| Savings | "In [pilot], energy use was [Y] kWh ([Z]%) lower than the adjusted baseline ([dates]); method [IPMVP option]; weather adjusted" | "saves up to 30%", "cut your bill by a third"; estimated savings stated as measured | A baseline spanning a full cycle (a hypothesis: twelve months), the adjustment model, the uncertainty, the customer's consent. **Today none exists, so no savings figure** |
| AI | "Automation follows explicit rules your team sets" (once built and tested) | "AI-powered", "intelligent", "self-learning", "predictive" for deterministic rules | A method description. A rules engine is outside the Commission's definition of an AI system |
| Compliance | "Designed to support your records and reporting under [law]" (after counsel maps it) | "NIS2 compliant", "CRA compliant", "GDPR certified" | Counsel's mapping, a signed processing agreement, a conformity assessment before any CE marking |
| Certification | "[Standard], certified by [body], scope, certificate number, valid until" | A logo, "certified" or "CE marked" before a certificate exists | The certificate |
| Uptime | "Measured availability, last 90 days: [x]% (probe from two locations; maintenance excluded and listed)"; "Sites keep reading local data when the internet is down" (after a test) | "100% uptime", "always on", "never fails" | Monitoring data, a written definition, the incident history. Publish no figure before six months of measurement |
| Security | "Report vulnerabilities to [contact]; we reply within [x] days" | "unhackable", "bank-grade", "100% secure" | A named contact |
| Customers and data | "Demo data is simulated" on every demo screen | Customer or deployment counts when there are none; simulated results shown as measured; logos without permission | Contracts and consent |

Business-to-business advertising in the EU is covered by Directive 2006/114/EC (results to be
expected, tests, qualifications and awards are all in scope); Albania's consumer law is
consumer-only and a hotel or farm buying for its business is probably a trader (a question for
counsel). The Green Claims proposal was still pending.

**Claims register.** Every public sentence has an identifier, the exact words, an evidence file, an
owner, a date and a review date (every release or six months). Sales and press use only registered
sentences, and a second person approves each.

## 6. The glossary (closed)

One concept, one word, in every screen, alert, document, contract and sales line. A new term enters
only by a change request that also names the Albanian term and the banned synonyms.

| Term (banned synonyms) | Plain definition |
|---|---|
| Site | A place where Greecon watches equipment |
| Asset (device, unit) | One piece of equipment: pump, valve, tank, inverter |
| Point (tag, channel) | One value measured or set on an asset |
| Reading (sample) | One measured value with its time |
| Alert (alarm, warning, notification) | A message that asks a person to act |
| Priority | How soon to act: Act now, Check today, For your information |
| State | The condition of an asset or site now |
| Stable | Every site is reporting current readings and nothing is open |
| Attention needed | A warning is open that someone should plan for |
| Action required | A critical alert is open |
| Unknown | Data is missing or too old to tell |
| Rule | A condition and action the customer's team set |
| Gateway (edge box) | The box on site that talks to equipment and to Greecon |
| Command | An instruction sent to an asset: start, stop, open, close, set |
| Simulated | Made-up data, or a command not sent to real equipment |
| Live | Real data or a real command |
| Limit (setpoint, threshold) | A number the customer sets; readings are compared with it |
| Acknowledge | Confirm you have seen the alert and are acting |
| Escalate | Pass an unacknowledged alert to the next person |
| On duty | The person responsible now |
| Data age | Time since the latest reading arrived |
| Offline | The site cannot reach Greecon |
| Incident | An event that harms or may harm service or security |
| Outage | A period when a function is unavailable |
| Maintenance | Planned work |
| Customer, User | The organisation under contract; a person using the app |
| Report | A summary document for a period |
| Baseline | The reference period or level used to measure change |
| Evidence | The values and times shown with an alert |

Albanian terms: the research report lists which words occur in official Albanian texts (for example
"lexim" for a meter reading, "gjendje" for state, "prag" for threshold, "mirëmbajtje" for
maintenance, "ujësjellës" for water supply). Occurrence shows a word exists, not that it carries this
meaning. Every term is **NNR**; none of the Albanian for greenhouse, irrigation, inverter, battery,
sensor or valve was found in the sources and all need a native editor.

## 7. Documentation

Four forms, kept in the repository and reviewed like code: tutorials (the first install of a demo
site), how-to guides (one page per alert type: what it means and the first step, which is also the
operator's runbook and supplies the alert's first-step text), reference (points, states, units,
glossary, API), and explanation (what Greecon does and does not do, safety limits, data flows).
Release notes follow Keep a Changelog (Added, Changed, Deprecated, Removed, Fixed, Security) plus a
flag "Changes how alerts behave". One page per decision touching safety, security, data or claims
(an ADR), linked to the evidence.

What each reader must find in under a minute (a stopwatch test, five people per role): a customer,
what an alert means, the first step, who is called and a phone number; an installer, the wiring and
commissioning checklist, the test that proves each point reads correctly; an auditor, the intended
use and limits, data flows and hosting, the incident procedure, the release history and who
approved which command.

## 8. What we say about ourselves

True today: no customers, no product on the market, simulated data only, no certification, a pilot
plan not yet started. The founder confirms these before any statement is used.

| Audience | A statement that is true today | Must not imply |
|---|---|---|
| Customers | "Greecon is an early platform that watches energy, water and agriculture equipment and tells you what needs attention. Today it runs on simulated data and does not control real equipment. We are looking for a few sites for a supervised pilot: read-only monitoring and alerts first, control only with your written agreement. Greecon is not a safety system; the protection in your equipment stays in place." | Live sites, savings, certification, guaranteed alerts, 24-hour support unless staffed |
| Installers | "We are designing the edge box and the commissioning steps with installers. There is no production hardware release and no support commitment yet. We want to learn how long a commissioning takes, what fails on site and which documents you need." | A partner programme, margins, exclusivity, a release date |
| Regulators | "Greecon Sh.p.k. is an early-stage company at Durana Tech Park. We have placed no product on the market. We design for Law 124/2024, for the cybersecurity duties customers will pass on under Law 25/2024 and, for the gateway, for the Cyber Resilience Act. We will notify within the legal clocks." | Compliance, approval, endorsement |
| Investors | "Greecon is pre-revenue with no customers. A pilot plan will test whether owners of small and mid-size sites pay for calm monitoring and supervised automation. Main risks: customers do not pay, installation and support cost more than planned, safety, security and legal work takes longer. We give no forecasts." | Traction, pipeline, revenue, AI differentiation |
| Press | "Greecon Sh.p.k. is an early-stage Albanian company building software and an edge box to monitor energy, water and agricultural sites. It has no customers and has not been deployed on real equipment. We do not discuss the internal design of our rules engine." | A launch, customers, awards, results, savings |

## 9. Day one, seams, and what to avoid

**Day one:** the closed glossary; whole-sentence alert templates per priority with an Albanian
master; 24-hour time, decimal comma and full years through `Intl`; fact, time, first step and
deadline in every alert; the claims table and register and the "Simulated" label; a 24-hour incident
contact with the three templates; Albanian SMS capped at 134 characters; WhatsApp alerts only as
approved templates; documentation in the four forms; changelog with the alert-behaviour flag.

**Seams:** a channel adapter for Viber and voice; a third language; a public status page once real
customers exist (a private incident log until then); machine-readable user notices for the CRA; a
savings module following IPMVP; runbook pages generated from alert definitions; auditor evidence-pack
export.

**Avoid:** hype, emoji, exclamation marks and "AI" for deterministic rules; silently stripping ë and ç;
sign-standard words as priorities; promising response times nobody staffs; naming compliance or
certification Greecon lacks; hand-formatted numbers; a hard-coded "OK" or "resolved"; engine
internals in messages, documents or press.
