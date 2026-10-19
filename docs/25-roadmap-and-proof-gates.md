# 25. Roadmap and proof gates

Status: written 2026-10-18 from all nine research reports. It replaces the sequencing in
`docs/15-master-roadmap.md` (which stays as a record of what was done) and uses the constitution's
method (`docs/17-constitution.md`): each step is either proven needed, left as a seam with a written
trigger, or not built. There are no dates: a one-person company's calendar is set by customers, not
by a plan. The order is firm; the pace is not.

Every number below that is not a cited fact is a proposal from the research, to be reset after the
first five sites.

## 1. Where things stand

The platform is honest and verified in simulation (`docs/18`). It watches, computes health from
evidence, raises a small set of alerts and checks commands against operating limits, but it has not
met a customer, a real plant room or real hardware, and its alerts reach people only when they open
the app. The thesis in `docs/17` is a hypothesis, and the first job is to test it with the people who
would pay.

## 2. The beachhead, and what would disprove it

**Owner-managed hotels, guesthouses and agritourism sites of 6 to 60 rooms in the coastal, lake and
river zones covered by Normative Act 8/2023, with a tank and pump room, plus a wastewater plant or
solar.** Reasons (inference, from `docs/research/07-market-users.md`): the pain is publicly
documented (Durrës supply "less than 10 hours a day"; businesses "face high costs to secure water from
alternative sources"); the plant duty is a dated reason to buy records and alarms; water, wastewater,
solar and garden irrigation sit on one site, so it tests "one platform" on one customer; one owner
decides; read-only monitoring first keeps safety exposure low; the off-season (November to March) is
the install window. Installers are the channel, not the end user.

Segment ranking for the first five paying customers, by pain, budget, willingness to pay, reach,
regulatory friction and safety exposure: hotels and agritourism (22 of 30), integrators and electricians
(20, a channel), farmers (18, second, with IPARD), commercial solar and battery (18, second; free
vendor portals compete), utilities (14, later: procurement and drinking-water safety), irrigation
consortia (14, later: no budget).

**Proof.** Of 20 conversations with owners or managers, at least 8 describe a costly failure in the
last twelve months in their own words, and at least 5 sign a paid 90-day pilot within 30 days of the
first visit. **Disproof**: fewer than 3 describe a costly failure; the vendor app or the electrician
"already solves it"; the buyer is a management company elsewhere; or the most owners will pay is below
hardware plus support cost. Then fall back to integrators or commercial solar. The interview guide and
what to observe on a site visit are in the market report, sections A and B.

## 3. The sequence

### Phase 1: prove the need, and close the gaps a first pilot would expose

The conversations come first and cost nothing to build. In parallel, build only what a read-only pilot
cannot be honest without:

| Work | Why it is in this phase | Evidence |
|---|---|---|
| Alert delivery: a channel adapter, e-mail first; a test of two SMS providers to Albanian operators; a daily message ("all fine" or "needs you"); acknowledgement; escalation | Today alerts reach people only when they open the app. Detection by consequence (a guest, a bill, an inspector) is the problem to remove | `docs/18` open 1; `docs/21` section 3 |
| Gateway heartbeat and server watchdog | Silence is detected from data age today; a heartbeat adds buffer depth, clock skew and a quick "box is down" | `docs/23` section 3 |
| Edge buffer sizing for at least 72 hours (batching, or a larger limit) | The default is about a day for a small site | `docs/24` section 3 |
| Customer export (CSV and JSON of everything) | A day-one requirement under Law 124/2024 and the EU Data Act; also the answer to lock-in | `docs/22` section 4 |
| Two-factor sign-in for owners and admins; distinct demo passwords; self-service reset | The first customer account is the first takeover target | `docs/23` section 5 |
| `security.txt`, vulnerability policy, a bill of materials and secret scanning in the build, an incident runbook with the real clocks, a restore drill | Cyber Resilience Act reporting is live; customers will send questionnaires | `docs/22`, `docs/23` |
| Hotel wastewater evidence: the laboratory-result register, site profile, operating records, and the five alerts | The reason a hotel buys; "records, not certification" | `docs/19` section 2 |
| Albanian interface and alert text, reviewed by a native editor | Albanian-speaking owners and staff; SMS length depends on it | `docs/21` |
| Sector guides rewritten to what runs today (done in this change) | The guides promised features that did not exist | `docs/guides/` |

None of these needs a customer to justify it. Everything else waits for evidence.

**Experts to engage before the first pilot** (each report lists its questions): a lawyer (the 15
questions in `docs/22`, above all the control addendum, the liability cap and the processing
agreement); a process engineer and the water regulator (`docs/19` section 6); an electrical engineer
if solar is in scope; a native Albanian editor; an insurer. Reviewing the research before relying on
it is not optional: it is desk research, not expert-reviewed.

**Exit gate:** the proof in section 2, and the items above built and tested.

### Phase 2: a paid, read-only pilot at up to five sites

Design against "pilot purgatory" (a 2017 survey found 60% of IoT initiatives stall at the proof of
concept): paid from day one for 90 days, with price and conversion in the order form; three written
success criteria before installation (data current at least 95% of the time; the owner opens the daily
message 5 days of 7; at least one real event caught and confirmed); a named person with signing
authority; read-only, no actuation; a decision meeting fixed for day 60; the hardware stays Greecon's
until conversion; no free extension beyond 30 days. Off-the-shelf industrial PC and standard Modbus
devices, no custom hardware; installation by an electrician under the customer's lock-out procedure.

Support and warranty (proposal): a 24-month hardware warranty (repair or replace); acknowledgement within
4 business hours, Monday to Saturday in season; on-site help the next day through the installer; no
24-hour promise until it is staffed; the service level measured on what Greecon controls (data
currency, message delivery), and a statement that the box keeps working locally when the cloud is
down. Liability cap about twelve months' fees; "not a safety system" stated. Publish no uptime figure
before six months of measurement.

**Exit gate (all the metrics in section 4 that are labelled proof gates, over the first five sites).**

### Phase 3: convert and repeat

Convert pilots at the lowest price three of the first five pay without a discount. Price per site, never
per point, so a new sensor is not a penalty: test EUR 20, 40 and 80 a month, billed from day 91, hardware
at cost plus installation one-off (a derivation from published prices and Albanian wages, not a
market fact). Reach 50 sites through three to five installer partners with about ten sites each,
clustered on the coast and in the mountains, with the wastewater register as the hook; the installer
keeps the install margin and Greecon owns the subscription and support. Second segment: farmers,
bundled into the irrigation quote, with IPARD III aid (up to 60%, with no explicit line for sensors:
ask the agency) and the per-zone configuration, sensor metadata and plain irrigation advice in
`docs/19` section 3. Third: solar sites, starting with energy from counters and the six checks in
`docs/19` section 4.

Work in this phase is chosen by what the paying sites ask for, against the seam register in
`docs/24` section 2.

### Phase 4: supervised control, only if the evidence arrives

No command reaches equipment until the release gate in `docs/23` section 4 is met, which includes 90
days of read-only operation at 98% current data and the same action requested by three owners, plus a
signed control addendum, the insurer's agreement and the integrator's commissioning evidence. Solar
inverters only through the vendor's documented path with written approval and the distribution
operator's consent. Water treatment, dosing and chlorination: never remote.

## 4. Metrics

All thresholds are proposals. A calm product is opened rarely, so activity is not success.

| Metric | Definition | Threshold | Kind |
|---|---|---|---|
| One-screen test | A first-time owner, no help, answers "is everything all right, what needs me, how old is this" within 5 seconds | 4 of 5 correct; 5 of 5 notice deliberately stale data | Proof gate |
| Unboxing to first reading | Minutes from power-on to the first real reading on the owner's phone, one installer | Median 60 or less over the first 10 sites; none over 4 hours | Proof gate |
| Sites reporting current data | Share of site-hours where every required reading is younger than three intervals, over 30 days, each gap tagged power, network or device | Fleet 98% or more; no site under 90% for two weeks | Proof gate |
| Push-level alerts per site per day | In steady state, excluding the first 14 days | 1 or fewer; every alert has a defined action | Proof gate |
| Share of alerts acted on | Acknowledged within the response time and followed by a logged action or a "no action needed, because" note | 80% or more; no alert type muted by operators | Proof gate |
| Confirmed avoided incidents | An alert preceded a fault that a person confirms in one tap as "real, would have continued" | At least 3 across the first 5 sites in 90 days | Proof gate |
| Water or energy saved | Same site, written baseline (12 months of bills, or 4 weeks of metering), normalised for occupancy or weather, shown as a range | Reported only after a full season and only if larger than the baseline's year-to-year variation | Proof gate after the baseline; vanity before |
| Responsive operators | Sites where a named person acknowledged an alert or read the daily message on at least 5 of 7 days | 80% of sites in weeks 3 to 12 | Proof gate |
| Support minutes per site per month | Logged human help after month 3 | 30 or fewer | Proof gate (above it, the services trap is open) |
| Retention | Paying sites still paying and still current; month 12 spans a full hotel season | 4 of 5 at month 6 for the first five; 85% at month 12 for the first fifty | Proof gate |

Vanity on their own: sites installed, points ingested, dashboards or rules created, downloads,
recurring revenue before pilots convert, the number of "insights", logins and minutes in the app.

## 5. What we are not building, and what would change that

| Not building | Why not now (evidence) | Trigger |
|---|---|---|
| A platform, plug-in marketplace or white label | A toolkit vendor "cannot ship an opinionated 'all right / not all right' answer" | Three integrators ask for it and pay, after 20 sites |
| A digital twin | No customer demand found; at a small pump site the status page is the model | Five paying sites ask a question that live status plus 12 months of history cannot answer |
| AI optimisation | Farmers "would not use technology to replace field measurements"; no savings percentage before pilots; aggregation and trading are licensed activities | A rule-based schedule already saves a measured amount over 12 months, the model beats it on 10 sites, and owners ask in writing |
| Carbon accounting | No Albanian small-business obligation or customer demand found | A funder or buyer makes a report a condition of money, named by three sites |
| A marketplace for parts, installers, energy or water | Trading is legally gated; no demand data | Installers pay for leads, or tickets show 30 sites needing the same part |
| Remote actuation from day one | Needs approvals, limits, the insurer's check | The release gate |
| A utility or municipal line | Public procurement and drinking-water safety | A donor-funded call names monitoring, or a utility pays for a pump-station pilot |
| Custom hardware | Incumbents give the portal away and earn on hardware | Never needed so far; off-the-shelf is the rule |
| A built-in universal threshold for anything | `docs/17` rule R9 | Pilot evidence of a safe default |

Why these start-ups fail, and the guard in the plan: pilot purgatory (paid 90-day pilots with written
criteria); hardware margins (no custom hardware); the services trap (site templates and a fixed
commissioning bundle, support minutes tracked); channel conflict (the installer keeps the install
margin; customer data is portable); support burden (the service level scoped to what Greecon controls;
local operation continues offline); liability for control (read-only first); seasonal cash (invoice at
season start; size the market before hiring).

## 6. Open decisions for the founder

1. Whether to commit to the hotel beachhead now, or to test two segments in the first 20 conversations.
2. Who is the first installer partner, and on what terms.
3. Who covers the four-hour and 24-hour incident clocks (`docs/22`): a named person, a phone, a rota.
4. What the product is called in Albanian, and who reviews the words (`docs/21`).
5. Which messaging channel to build delivery on first, decided from the conversations, not from this
   document.
6. How much of the founder's time the pilots will take, and at what point to hire.
