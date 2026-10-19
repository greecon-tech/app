# 26. Research register

Status: written 2026-10-18. This is the index of the evidence behind the blueprint
(`docs/17` to `docs/25`): what each report is, what it changed in the product, how far to trust it,
and what a person still has to check. The reports are in `docs/research/`.

**What kind of evidence this is.** Nine desk-research reports, written from public sources by research
assistants working under instructions to separate fact from inference, to mark anything not confirmed
from a primary source, and to invent nothing. No licensed lawyer, engineer, agronomist, regulator or
customer has reviewed them. No customer has been interviewed. Standards that are paywalled (IEC 61508,
IEC 61511, IEC 62443, EEMUA 191, ISA-18.2, ISA-101) were not read; their numbers come through public
guidance and are labelled as such. Treat the reports as a well-sourced starting brief and the
questions below as the work that turns it into knowledge.

Confidence words in the reports: **High** (a primary text read directly, or several concordant
authoritative sources), **Medium** (one authoritative secondary source, or engineering consensus),
**Low** (a single weak source or inference). **UNVERIFIED** means recalled or seen only in a search
summary.

## 1. The reports

| # | Report | Scope | What it changed or settled | Trust, and what limits it |
|---|---|---|---|---|
| 01 | [Energy](research/01-energy.md) | What small solar and battery operators need; KPI definitions and the claims ladder; protocols and drivers; control and optimisation; fault detection evidence; protection boundaries; the Albanian market and programmes | No built-in surplus constant (`docs/17` R9); read-only first; six deterministic checks; honest KPI wording; per-site tariffs and settlement as data | Good on physics and vendor documents. No published detection rate exists for power-only checks. The Albanian prosumer regime is in transition and sources conflict. Grid code, tariffs and curtailment not found |
| 02 | [Water](research/02-water.md) | What a hotel wastewater plant operator must prove; Albanian and EU compliance texts; sensors and failure modes; control and early warning; data modelling; water safety limits | The hotel beachhead and its evidence register; five alerts only; never automate dosing, bypass or entry | Albanian texts read directly (and machine-read). Whether the Normative Act became law and its task force extended is unverified. Process engineer needed |
| 03 | [Agriculture](research/03-agriculture.md) | Irrigation science; sensors and their limits; what farmers want and distrust; Albanian context and IPARD III; weather inputs; safety | No built-in irrigation threshold; per-zone configuration; "cannot advise" over a guess; no savings promises | Strong on FAO-56 and the farmer studies, weaker on Albanian soils, tariffs and what IPARD accepts. Agronomist needed |
| 04 | [Security and safety](research/04-security-safety.md) | The safety boundary; safe command design; data validity and alarms; the regulatory and standards map; device identity, updates and disclosure; multi-tenant security; a threat model | The direction rule, start gating, dry-run semantics, the release gate for a first real write, the security roadmap | Reads public guidance and vendor papers; the standards themselves unread. Functional-safety engineer and security architect needed |
| 05 | [Legal](research/05-legal.md) | Albanian and EU law that touches the product: data protection, cybersecurity, AI, data, liability, energy, IP and open source, marketing | The top-eight ranking, the control addendum, export as a day-one requirement, the claims table, the lawyer's checklist | Primary texts read where possible (the Albanian cybersecurity law only in machine translation). Several dates conflict. Not legal advice |
| 06 | [Design](research/06-design.md) | What transfers from the iPhone; alarm science with numbers; answer-first status; safe interaction; field reality; visualisation; navigation; validation plan | The four states, the three priorities, the confirmation tiers, the navigation, the accessibility fixes | Alarm numbers via secondary sources; no published evidence for gloved touch targets or hold-to-confirm. Needs testing with real users |
| 07 | [Market, users and competition](research/07-market-users.md) | Who the users are and who pays; how they work today; competitor teardown; the iPhone insight; pricing and go-to-market; metrics; Albanian context; risks | The beachhead, the "caretaker's round" thesis, the metrics, the not-building list | No customer interviewed. Descriptions of people are inference; prices are published list prices or the author's derivation. Reviews are illustrations, not a sample |
| 08 | [Communication](research/08-communication.md) | Voice and tone; plain language; alert and message wording and channel limits; incident communication; claims discipline; documentation; vocabulary; stakeholder statements | The style guide, alert templates, the Albanian SMS finding, the claims table and register, the glossary | Albanian terms need a native editor. Several standards (sign colours, aviation alerting, advertising guidance) not verified |
| 09 | [Architecture and data](research/09-architecture.md) | Semantic model; ingest; storage; edge autonomy; rules; tenancy; scale triggers; API; observability; build-or-buy; decision records | The seam register, the growth stages, the decision records, plain PostgreSQL behind an interface | No vendor-neutral plain-PostgreSQL benchmark exists in what was found; the size estimate and every threshold are proposals. Needs a prototype |

## 2. The findings that changed the most

1. The platform said things it did not know (`docs/18`): static statuses, readings that never
   expired, alerts that were never generated. Fixed, and tested.
2. A guard that cannot be stopped is a hazard: the direction rule for commands.
3. A universal threshold is wrong for most fields and plants: the same 28% is waterlogged in sandy
   soil and dry in clay; 1.5 kW is a third of one plant and nothing on another. The site states its own.
4. Albanian SMS is UCS-2: the letters ë and ç force 70 characters per message, so an alert must be
   short and the wording planned, not trimmed afterwards.
5. The only large independent field test found for automatic solar fault detection caught 19 to 30% of
   faults with 12 to 16% false alerts, so "intelligent fault detection" is not for sale.
6. Customers, not law, pull cybersecurity first: wastewater operators are automatically critical
   under Albania's Law 25/2024, with a four-hour incident clock.
7. The plain-PostgreSQL route, not a time-series licence, is the safe storage default; retention tiers
   are mandatory at scale.
8. Hotels are the right first customers (documented water pain, a dated plant duty, one decision
   maker), and the beachhead is a hypothesis with a test, not a result.

## 3. What a person still has to check, by whom

Each report ends with its own open questions; these are the ones that block a decision.

| Who | What | Before |
|---|---|---|
| Lawyer (Albanian and EU) | The 15 questions in `docs/22`: processing agreement, control addendum, liability cap, the Cyber Resilience Act position of the gateway, Law 25/2024 flow-downs, Timescale licence if ever used | The first pilot |
| Native Albanian editor | Every Albanian term and message: states, priorities, alert templates, the SMS policy for ë and ç, the glossary | Anything Albanian ships |
| Process engineer and the water regulator | Limits by discharge route, sampling rules, the hotel register, the five alerts, minimum instrumentation | The hotel pilot |
| Electrical engineer, installer, the distribution operator | Certificates for grid-interface protection, whether a read-only connection is acceptable, commissioning tests, the net-billing formula | A solar pilot |
| Agronomist | Local field capacity and wilting point, allowable depletion, sensor choice, the IPARD evidence | A farmer pilot |
| Functional-safety engineer | The command taxonomy, per-asset fail states, start permissives, the consequences of stopping | Any real write |
| Security architect | Enrolment, certificates and hardware keys, the update stack, row-level security | Before the second customer, or an EU hardware sale |
| Insurer | Whether the platform can actuate equipment, and what cover applies | Any real write |
| Customers | The interview guide in `docs/research/07-market-users.md`, section A | Now |
| Prototype and benchmark | The 11 questions at the end of `docs/24` | Before the 10-site stage |

## 4. Where the weakest evidence is

So that nobody builds on sand:

- **Search summaries only** (the page was not opened): several Albanian electricity and net-billing
  items, parts of the Fraunhofer fault-detection study, the Cisco pilot-stall survey, the EBRD
  programme details, Viber's Albanian coverage, push-notification display limits.
- **Recalled, not read:** the clause numbers of IEC and ISO standards, EEMUA benchmarks beyond those in
  public guidance, several RFC and tool details.
- **Conflicting dates:** the Power Sector Law and net-billing start; the AI Act application dates;
  Normative Act 8/2023's status; Law 25/2024's Gazette date.
- **Proposals, not facts:** every threshold and trigger marked "proposal" (alert budget, scale stages,
  shadow period, escalation defaults, price points, success metrics).
- **No evidence at all:** what Albanian hotels and farms buy; the number of hotels and installers; the
  business electricity tariff; rural water committees; any detection rate for power-only solar checks.

## 5. Keeping it current

Legal and regulatory items carry a review date: re-check the Cyber Resilience Act and the
"digital omnibus" proposals, the Albanian energy and cybersecurity texts, the AI Act dates and the
Data Act guidance every six months and before any statement that depends on one. A change that
affects a claim updates the claims register (`docs/21`). When a customer or an expert resolves an
open question, record the answer in the relevant report and change the decision or the seam it
affects, citing the new evidence.
