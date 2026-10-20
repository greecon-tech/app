# 17. Constitution: what Greecon is for, and how we decide what to build

Status: adopted 2026-10-18. Owner: the founder. A rule here changes only through a written decision
(an ADR, see `docs/24-architecture-seams.md`), never by drift.

This document keeps the ten operating principles of `docs/00-platform-vision.md` exactly as they
are, adds the rules that the research of October 2026 proved necessary, and sets out the one method
we use to decide what goes into the platform and what does not. The evidence behind every rule is in
`docs/research/`; `docs/26-research-register.md` says what each report is and how far to trust it.

## 1. The idea

Everyone who looks after a site, a hotel's plant room, a greenhouse, a pump station, a solar roof,
does the same thing. They walk round, look at everything, and ask one question: is everything all
right, and does anything need me?

Greecon does that walk by itself, at any hour, and answers in one screen:

> Open one screen and know whether your water, power and fields are all right, and what needs you now.

That is the whole product. Everything else is in service of that sentence being true. If a feature
does not make the answer more correct, more honest, or easier to act on, it does not belong yet.

The promise is only worth anything if it is never false. A system that says "all well" when it does
not know is worse than no system, because people stop walking round. So the first duty of the
platform is to be honest about what it does not know.

## 2. What the iPhone teaches, and what it does not

The first iPhone did not add features. It took a messy category (a phone, a music player, an
internet device, each with its own buttons) and compressed it into one idea people already
understood, then removed the manual. Greecon's category is just as messy: one app per inverter, one
per irrigation controller, a WhatsApp group for the pump, a paper register for the inspector,
and an engineer for every change to a SCADA screen.

What transfers is the compression: one answer, one object model (site, asset, point, event, rule),
one anatomy for an alert, one pattern for confirming an action, and honest feedback. What does not
transfer, because the stakes differ: discovery by play (nobody experiments on live equipment), hidden
complexity (the evidence stays one step away, never hidden), delight (the aim is a trustworthy "no
news"), the single-owner device (operations need roles, approval and audit), and cheap mistakes (a
wrong tap loses an email on a phone and floods a tank at a plant). Evidence: `research/06-design.md`
section A; `research/07-market-users.md` section D.

## 3. The ten operating principles (unchanged)

These are the founder's principles, kept verbatim from `docs/00-platform-vision.md`.

1. Calm over chaos.
2. Simplicity before sophistication.
3. Minimal by design.
4. High standards in infrastructure, design, documentation, communication, and code.
5. Quality over speed.
6. Only what is needed.
7. No optional noise.
8. Independence from trends.
9. Structural integrity.
10. Timeless thinking for 10+ years.

## 4. Nine rules the research added

Each rule says what it means in practice and where it is enforced today. A rule that is not enforced
by a test or a review step is only a wish.

**R1. Never reassure falsely.** Silence is not safety. A status is computed from evidence, never
typed once and left. Missing, old or unchecked data is shown as Unknown, never as OK, never as zero,
never as "the last value". One site that cannot be checked makes the whole answer Unknown rather
than being averaged away. *In practice:* four states with their own words and shapes (Stable,
Attention needed, Action required, Unknown); every reading shows its age; an alert whose reading goes
quiet stays open. *Enforced by:* `packages/gaia-core/src/health.ts`, `freshness.ts`, `alerts.ts` and
their specs; `apps/api/src/platform/platform.status.spec.ts`.

**R2. Safety stays on site.** The cloud is never required for hard safety, and Greecon takes no
credit as a safety function. Hazards that can injure people or destroy equipment inside the process
safety time are handled by hard-wired protection and local controllers (levels L0 and L1), with no
dependency on Greecon. Greecon watches, advises, and, only when proven, supervises. We say "operating
limits", not "safety interlocks". *Enforced by:* the command safety rules (stopping is never blocked;
starting is gated; unfamiliar values are treated as the hazardous direction) and their specs;
`docs/23-safety-and-security-case.md`.

**R3. Answer first, evidence one step away.** Every screen leads with what the person needs to know
and what to do, and keeps the data, the thresholds and the reasoning one tap behind it ("How is this
calculated?"). Never lead with data. *Enforced by:* the Overview and `docs/20-design-and-interaction.md`.

**R4. The person stays in charge.** Approval, override and local control always win. The platform
may recommend; it acts only inside limits the owner approved, and it never replaces the owner's
judgement or a field measurement. *Enforced by:* simulated-only commands today; the release gate for
the first real write in `docs/23-safety-and-security-case.md`.

**R5. Say only what is built and proven.** Nothing in the product, the documents or a sales
conversation claims a saving, a safety level, "AI", a certification, or an uptime that has not been
measured. Simulated data is labelled simulated on every screen that shows it. Each public claim is
a registered sentence with its evidence. *Enforced by:* `docs/21-communication-system.md` (claims
table and register); the "Simulated" status on every demo site.

**R6. Proof before building.** A feature is built when evidence says it is needed, and that evidence
is written down with the feature (who asked, what failed, what it cost). A feature that is
plausible but unproven is not built; it gets a seam and a trigger (R7). *Enforced by:* the decision
method in section 5 and the trigger tables in `docs/24-architecture-seams.md`.

**R7. Leave a seam, not a feature.** For everything that might be needed later, leave the smallest
clean extension point now (a field, an interface, a table, a naming rule) and write the evidence that
would justify building on it. Space costs little; speculative features cost forever. *Enforced by:*
the seam tables in `docs/19`, `docs/23`, `docs/24` and `docs/25`.

**R8. The owner's data is the owner's.** Export everything in open formats at any time, no lock-in,
no charge to see your own data, and nothing about how the rules engine decides is needed to leave.
*Enforced by:* the export seam in `docs/22-legal-and-compliance-map.md` (a day-one requirement under
the EU Data Act and Law 124/2024).

**R9. No universal constants.** What counts as low, dry, surplus or out of date depends on the
tank, the soil, the pump and the plant, so the site states it. The platform has a standard only where
one is safe and honest, and says so ("Standard: 15"); elsewhere it says nothing until the site
decides (irrigation advice, solar surplus). Every limit carries who set it and when, and a change
takes effect at once and is recorded. *Enforced by:* `pointLimitDefinitions` in `packages/shared`,
the limits editor on a site's page, and `packages/gaia-core/src/limits.spec.ts`.

## 5. How we decide what to build

Every proposal, from the founder, a customer or an engineer, goes through the same six questions, in
order. If the answer to any is "we do not know", the work is research or a seam, not a feature.

1. **Who and what job?** Which person, on which site, has this problem, and what do they do about it
   today? (The beachhead is in `docs/25-roadmap-and-proof-gates.md`.)
2. **What is the evidence?** A named failure, a measurement, a customer in their own words, a
   regulation with an article number. "It would be nice" is not evidence.
3. **What is the smallest version** that fixes it, and what is left out on purpose?
4. **What can we honestly say about it?** Check the claims table. If the honest sentence is weaker
   than the feature, the feature is not ready to be sold.
5. **What is its safety class?** Advisory (tells), Supervisory (sets a mode or a setpoint on a
   controller that has its own protection), Direct actuation (commands equipment), Safety function
   (never offered). Anything beyond Advisory needs the release gate.
6. **What is the proof gate for the next step?** What measurement, from real sites, would tell us
   the feature earned its place, and what would make us remove it?

The outcomes are always one of three:

| Outcome | Meaning | Where it is recorded |
|---|---|---|
| Now | Evidence is in hand. Build it, with tests. | The roadmap, "now" column |
| Seam | Plausible, not proven. Leave the extension point and write the trigger. | The seam table, with its trigger |
| Not building | Evidence says no, or the cost is too high. Say why so it is not re-argued. | `docs/25`, "What we are not building" |

## 6. What Greecon is and is not

| Greecon is | Greecon is not |
|---|---|
| One calm answer, across energy, water and agriculture, with the age of the data | A dashboard of everything, or a tool for building dashboards |
| A read-only watcher first, a supervised helper only when proven | A safety system, a protection relay, or a replacement for hard-wired protection |
| Edge-first: the box on site keeps working when the internet does not | A cloud service that must be reachable for a pump to be safe |
| A system the owner can leave with all their data | A platform that holds the owner's data to keep the owner |
| Deterministic rules the owner can read and approve | "AI" that decides on its own |
| Honest that it is early, with simulated data in the demo | A product that implies customers, savings or certifications it does not have |

## 7. The words

The product uses a small fixed vocabulary, and one word for one thing. The four answers about a site
are **Stable**, **Attention needed**, **Action required** and **Unknown**. The three priorities on an
alert are **Act now**, **Check today** and **For your information**. The word for what the platform
raises is **alert**, only. The full glossary and the rules of tone are in
`docs/21-communication-system.md`; the interaction rules are in `docs/20-design-and-interaction.md`.

## 8. Changing this document

Principles 1 to 10 are the founder's and change only by the founder's decision, recorded. Rules R1 to
R9 can change when evidence says one is wrong; the change is a written decision that states the
evidence, the old rule, the new rule, and what test or review step enforces it. A rule is never
relaxed to make a deadline.
