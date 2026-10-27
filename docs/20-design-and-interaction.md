# 20. Design and interaction

Status: written 2026-10-18 from `docs/research/06-design.md`, and checked against the running
interface. `docs/06-frontend-design-system.md` still owns the brand: colours, type, spacing and the
icon set. This document owns how the product behaves: what it shows first, how it says a thing is
wrong, how it asks for an action, and how it works outdoors on a phone. Numbers quoted from alarm
standards came through secondary sources (the standards are paywalled); the report says which.

## 1. The five rules of the interface

1. **Answer first.** The first thing on any screen is the answer or the next step. Data, thresholds
   and reasoning sit one tap behind it ("How is this calculated?").
2. **A status is computed, never typed.** It comes from a value, its limit, its age and its quality.
   If any of those is missing the status is Unknown.
3. **Word, shape and colour, never colour alone.** A person in direct sun, or one who cannot tell red
   from green, must still read every status.
4. **Every number says how old it is.** Old data is dimmed and labelled, never quietly kept.
5. **One pattern for one thing.** One alert anatomy, one confirmation pattern, one vocabulary, one
   object model (site, asset, point, event, rule, report) across water, energy and agriculture.

## 2. The four answers and the shapes that carry them

| State | Word | Shape | Meaning |
|---|---|---|---|
| Stable | Stable | steady filled circle | Every site is reporting current readings and nothing is open |
| Attention | Attention needed | filled triangle | A warning is open that someone should plan for |
| Action | Action required | filled diamond | A critical alert is open. It stays until its cause clears, even after someone acknowledges it |
| Unknown | Unknown | hollow circle, dashed outline | We cannot tell: no readings yet, or readings are out of date |

The most urgent state wins across sites: Action required, then Unknown, then Attention needed, then
Stable. One site that cannot be checked makes the whole answer Unknown. A failure is never averaged
away, and green needs positive evidence. The headline is one sentence ("Action required: Tank level
is critical at Saranda Resort pump station."), the number of sites reporting, and when it was worked
out. Other shapes in use: hollow square for Simulated, and the same triangle and diamond for the
words Check today and Act now on alerts. Contrast of every status word on its own tint is at least
5:1 (the earlier warning tint was 3.5:1).

Built: `packages/gaia-core/src/health.ts`, the Overview headline, the status styles in
`apps/web/src/app/globals.css`.

## 3. Alerts

### What an alert is

An alert is something abnormal that a person should act on within a stated time. Needing irrigation,
having surplus solar, a daily summary, or a reminder are not alerts: they are ordinary operation
and appear in the interface without raising an alert.

### Three priorities

| Priority | Meaning | Delivery |
|---|---|---|
| Act now | Needs a person within minutes | Pushed, escalated if not acknowledged |
| Check today | Needs a person today | In the app and the daily message |
| For your information | No action possible or required | In the app, never pushed |

The engine's internal severities map straight onto these: critical is Act now, warning is Check
today, everything lower is information. The words Danger, Warning and Caution are not used: in sign
standards they classify injury hazards, and OSHA reserves Danger for immediate danger.

### The numbers behind the discipline

EEMUA 191 and ISA-18.2 (via the UK Health and Safety Executive, the ASM Consortium and exida):
at most one new alarm per ten minutes on average for one control-room operator, at most ten in the
first ten minutes after a major upset, three priorities in roughly a 5% / 15% / 80% split. The
ASM benchmark of 37 consoles found none met the flood target throughout. Hospitals estimate 85 to
99% of alarm signals need no intervention. The scale of a refinery does not transfer to a small
site, but the laws do, and at a small site the danger inverts: with few alerts, silence from absent
logic reads as health. A working hypothesis to test in pilots: at most about one push-level alert per
site per day in steady state.

### What the engine does (built)

- One alert per condition, however long it lasts or however often the value wobbles.
- A pump must run with no flow for 30 seconds before anyone is told (start-up is normal).
- A condition that clears and returns within 15 minutes reopens the same alert.
- Escalation: if it gets worse after acknowledgement it reopens.
- An alert closes only when its condition can actually be seen. When a reading goes quiet the alert
  stays open, and a "readings are out of date" alert opens beside it.
- Cleared alerts stay in a log on the Alerts page.

### Anatomy

| Part | Example |
|---|---|
| What happened | Pump 2 stopped at 14:05 |
| Where | Hotel plant, lift station |
| Why it matters | Only if a validated model computes it |
| First step | Start Pump 1 within 15 minutes |
| Urgency | Act now |
| Who | On duty: night technician, then the manager at 14:20 |
| Evidence | Level 2.4 m, limit 2.8 m, data 20 seconds old, sensor good |
| State | New, acknowledged by, in progress, cleared |

Not yet built: who is on duty, escalation, and delivery by push or SMS. The first-step text exists on
every alert type the engine raises.

## 4. Asking for an action

Confirmation is proportional to consequence. Routine confirmations train people to click through, so
the common ones are skipped and the rare ones are specific ("Open the discharge valve to 47%"), with a
verb on the button and never a default on the dangerous choice.

| Tier | Example | Pattern |
|---|---|---|
| T0, no physical effect | Filter, acknowledge, add a note | Act at once, with an undo that says what it undoes |
| T1, low consequence, reversible | Start or stop a non-critical pump within limits | One tap, visible progress, a visible Stop |
| T2, consequential | Setpoint, open a discharge, dosing, override a limit | A sheet naming the object, the current and new value, the expected effect and whether it can be undone; a second approver and a reason for an override, with an expiry |
| T3, people-exposed or irreversible | Mixers, confined-space valves, deleting data | No remote start; or typed confirmation and a second person, audited, possibly office-only |

A command has a lifecycle the interface shows honestly: requested, sent, accepted by the controller,
in progress, confirmed by a field signal, failed, or Unknown on timeout. "Running" appears only
after confirmation. Physical commands are never queued offline: with no live path the command is
refused with the reason.

A blocked command says why, what would unblock it and who may override ("Blocked by operating limit:
tank level 96%, limit 95%. Allowed below 90%."), never a greyed button without a reason. Stop is
never blocked by a process condition.

Every automatic action records what it did, which rule and version, which inputs with their age and
quality, and who can change it, and the interface shows it as "Because". Automation climbs a ladder
only on evidence: suggest (compute and log what it would do), execute on approval, execute after a
veto window, execute then inform; the current level is shown wherever the automation appears.
Approvals are rare and carry the decision facts, with "do nothing" as the safe default if nobody
answers.

Status: all commands are simulated today; the safety rules and tests exist, the lifecycle, tiers and
"Because" records are the design for the first pilot with a real actuator (`docs/23`).

## 5. Outdoors, on a phone, in Albania

- **Touch.** At least 44 by 44 points everywhere (WCAG 2.2 AA minimum is 24, AAA 44; Apple 44, Android
  48). Hypothesis to test with gloves and wet hands: field-critical controls 56 to 64 and 16 apart.
- **Sunlight.** A phone screen is a mirror outdoors. At 40,000 lux a 4.5:1 design contrast falls to
  about 1.8:1 (an illustrative calculation, not a measurement). No palette fixes direct sun, so
  meaning is always redundant (word, shape, position) and an Outdoor mode is planned: text at 7:1,
  thick strokes, status words at least 18 px bold, no meaning carried by mid-tones.
- **Offline and stale.** Each value carries "as of" and is dimmed and labelled once it passes its
  limit. A connection lost banner says "Offline. Showing data from 14:05" and disables controls
  with the reason. Only notes and acknowledgements may queue offline, never actuation.
- **Platforms.** iOS is 56.9% of Albanian mobile web traffic against 42.9% Android (StatCounter, a web
  proxy), so the product cannot assume Android. On iPhone, web push works only for a site added to the
  Home Screen (iOS 16.4 and later) and there is no background sync, so the app syncs on open and on
  returning to the foreground, and installers guide the Home Screen step.
- **Language and units.** Albanian and English. Albanian numbers use a space and a decimal comma
  ("1 234 567,89"); the default clock is 12-hour, so force 24-hour; a short date has a two-digit
  year, so write the year in full; whole-sentence templates, never concatenation. SI units. Check the
  type for the letters ë and ç.
- **Skills.** Only about 23% of Albanians aged 16 to 74 had at least basic digital skills (2023). So:
  installer-assisted first run with sector defaults, value within minutes, no password-first
  sign-up, and a human phone number in the app.

## 6. Navigation

Two audiences have two sets of five places (the full definition, and what each page is for, is
[28](28-ux-definition.md)). A client sees **Overview, Sites, Alerts, Reports and Settings**; Greecon's
team sees **Today, Clients, Requests, Team and Settings**. A site's equipment, its setup list and
its handover sheet are one step inside Sites, for the people who may change them; the old Automation
and Monitoring pages are gone, because Greecon only reads (L13). In the Nielsen Norman study hidden
navigation was used in 27% of cases on a desktop against 48 to 50% for visible navigation, and in 57%
against 86% on a phone, so nothing important sits behind a menu icon: the five places are a bar at the
foot of a phone and a bar on the left of a desk, and the person's own menu (Account, Help, Log out)
is a small mark at the top right. Five visible destinations follows Apple's tab-bar guidance. A role
sees only what it may use (a viewer sees no control surfaces at all, not greyed ones).

| Level | Purpose | Example |
|---|---|---|
| 1 | The answer | Overview, a site's headline |
| 2 | Act | Acknowledge an alert, open a customer's account |
| 3 | Detail | Trends, readings, equipment |
| 4 | Diagnose | The equipment and readings page, the setup list, the audit log |

Operators live at 1 and 2 with 3 one tap away; administrators reach 4.

## 7. Showing data

A dashboard is the most important information on one screen, monitored at a glance. Use a linear
bullet graph for a tank or battery level, a small trend beside a number, and the same chart at the
same scale for each pump or zone. Always show the normal band, the labelled limits, event marks
(alert, command, mode change) and data quality: gaps stay gaps and the tail after the last reading
is marked "last known". Do not chart a single current value (number, word and age), a handful of
irregular events (list them), an on and off state (a strip), or stale data. No gauges, pies,
three-dimensional charts or decoration. Default ranges are hypotheses to test: solar from sunrise,
pumping the last 24 hours, irrigation the last 48 hours, each with 1 hour, 24 hours and 7 days.

## 8. Accessibility checklist (WCAG 2.2 AA items that matter here)

Text 4.5:1 (3:1 large); non-text 3:1 (status shapes, chart lines, input borders); not colour alone;
text resize to 200% and reflow at 320 px; visible focus, not hidden by sticky bars; pointer targets;
no path-based or drag-only controls; no action on touch-down; no memory test at sign-in (paste and
password managers allowed); status messages announced; auto-updating content can be paused or
controlled unless essential; honour reduced motion. About 1 in 12 men and 1 in 200 women have a colour
vision difference, and red and green, green and yellow, and white and cyan are the common
confusions, which is why shapes differ.

Built: contrast-checked tokens, shapes, visible focus, reduced-motion rule, 44-point targets on a
phone width, and the live region on the headline; and, since 2026-10-27 (document 29, which says how
each is measured by `scripts/e2e/a11y-audit.cjs`): text that follows the person's size and holds at
200%, a dark appearance and a more-contrast one that follow the device (no switch of Greecon's own),
forced colours, a keyboard that reaches everything and shows where it is, and quick find (Ctrl+K).
Not yet done: a screen reader pass, and the Outdoor mode.

## 9. How we will know the design works

Three claims to test, with real people on their own phones:

1. The home screen answers "is everything all right, and what needs me?" correctly and fast: a
   first-time owner, no help, answers within five seconds; four of five correct, and all five notice
   data made stale on purpose. The false-reassurance rate must be zero: nobody says "fine" when the
   right answer is "cannot tell".
2. Unknown, stale and blocked states are understood and never read as OK.
3. First value arrives within minutes: from the box to a correct headline on the owner's phone in
   10 minutes self-serve, 30 with an installer.

Method: eight to ten field visits at the real plant room or field with no software, then small
rounds of five users per segment (five users surface about 85% of problems), sessions in Albanian,
a two-week diary study in the person's own channel (voice notes on the messaging app they use), and
after launch the measures in `docs/25-roadmap-and-proof-gates.md`. Targets are proposals.
Consent and retention for these studies fall under Law 124/2024 (`docs/22`).

## 10. Not yet designed or built, with the evidence that would justify it

| Item | Evidence that would prove the need |
|---|---|
| Outdoor mode (a night mode is built: Greecon follows the device's light or dark, document 29) | Midday legibility fails on real phones |
| Native shell for Critical alerts and background sync | Field data show gaps in push or sync on the phones in use |
| Two-person approvals, time-limited elevated access | The first real actuator pilot |
| Alert-health dashboard (rate per site per day, floods, chatter, priority mix) | Alert load per site passes the budget |
| Sector lenses as data (vocabulary, default charts, templates per site type) | A second sector at a paying site |
| "Time to overflow"-style forecasts | A validated model with visible provenance |
| Multi-client hierarchy for integrators | Three integrators ask for it and pay (`docs/25`) |

## 11. Questions only users can answer

Who is on duty at night and at weekends, and what do they check first? Which phone do they carry,
and which channel do they read within five minutes (push, SMS, a messaging app, a call)? How many
alerts a week before people mute? What do they want automation to do, and who is accountable? What
are the Albanian words for each state, and does "Unknown" cause anxiety or extra phone calls? These
are the interview questions in `docs/research/07-market-users.md`.
