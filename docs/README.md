# Greecon documentation

Where to start depends on the question.

| If you want to know | Read |
|---|---|
| What Greecon is for and how it decides what to build | [17 Constitution](17-constitution.md) (the ten principles, kept as they were, and nine rules that follow from them) |
| What is true of the platform today, and what is not | [18 Reality audit](18-reality-audit.md) |
| How to use it, by kind of site | [guides](guides/00-overview.md) |
| What to build next, and what would prove it | [25 Roadmap and proof gates](25-roadmap-and-proof-gates.md) |
| How far to trust any of this | [26 Research register](26-research-register.md) |

## The blueprint (written October 2026, from nine research reports)

These nine documents are the product's reasoning. They are desk research and engineering judgement,
not the verdict of a lawyer, a process engineer, an agronomist or a customer. Each says what it
rests on and what a person still has to check.

| Doc | What it holds |
|---|---|
| [17 Constitution](17-constitution.md) | Purpose, principles, rules R1 to R9, how a feature earns its place |
| [18 Reality audit](18-reality-audit.md) | The ledger: 28 findings fixed with evidence, 12 gaps still open |
| [19 Domain playbook](19-domain-playbook.md) | Water and wastewater, agriculture, energy: what operators need, what the platform shows, what it will not claim |
| [20 Design and interaction](20-design-and-interaction.md) | The four states, the three priorities, answer-first screens, safe interaction, accessibility |
| [21 Communication system](21-communication-system.md) | Voice, alert wording and channel limits (Albanian SMS is 70 characters), the claims register, the glossary |
| [22 Legal and compliance map](22-legal-and-compliance-map.md) | Albanian and EU law that touches the product, the claims table, the lawyer's checklist |
| [23 Safety and security case](23-safety-and-security-case.md) | The safety boundary, the direction rule, the release gate for a first real write, the threat model |
| [24 Architecture and seams](24-architecture-seams.md) | What exists, the extension points with written triggers, growth stages |
| [25 Roadmap and proof gates](25-roadmap-and-proof-gates.md) | The beachhead and its disproof, the sequence, the metrics, what is not being built |
| [26 Research register](26-research-register.md) | The nine reports, what each changed, how far to trust it |

Supporting material:

- [adr/](adr/README.md): one page per decision that touches safety, security, data or claims. Four
  are accepted and built; fourteen are proposals from the research.
- [research/](research/): the nine reports in full, with their sources and open questions.
- [guides/](guides/00-overview.md): one guide per kind of site, written to describe only what runs today.

## Engineering reference (written as the platform was built)

These describe the code. Where a later document corrects them, the later document wins and the
earlier one says so at the top.

| Doc | Topic |
|---|---|
| [00 Platform vision](00-platform-vision.md) | Identity and the original ten principles |
| [01 Architecture](01-architecture.md) | Components and how they connect |
| [02 Data model](02-data-model.md) | Tables and the telemetry store |
| [03 GAIA internal boundaries](03-gaia-internal-boundaries.md) | What stays out of the browser and out of public copy |
| [04 Edge runtime](04-edge-runtime.md) | The gateway process |
| [05 API design](05-api-design.md) | Endpoints and contracts |
| [06 Frontend design system](06-frontend-design-system.md) | Brand, type, palette |
| [07 Security and RBAC](07-security-and-rbac.md) | Sign-in, roles, tenants |
| [08 Local development](08-local-development.md) | Running it on a laptop |
| [09 Testing and verification](09-testing-and-verification.md) | What is tested and how |
| [10 Deployment on Google Cloud](10-deployment-gcp.md), [11 on Railway](11-deployment-railway.md), [12 GitHub Pages demo](12-deployment-github-pages.md) | Hosting |
| [13 Pilot readiness](13-pilot-readiness.md) | The earlier gap log (history; the current ledger is 18) |
| [14 Edge hardware deployment](14-edge-hardware-deployment.md), [16 Modbus driver](16-modbus-driver.md) | Connecting real equipment |
| [15 Master roadmap](15-master-roadmap.md) | The earlier plan (history; the current one is 25) |

## Keeping the documents true

- A change that affects what the platform does updates the reality audit (18) and, if it changes a
  claim, the claims register (21) in the same commit.
- Legal and regulatory items carry a review date and are re-checked every six months (26, section 5).
- A decision is changed by a new decision record that supersedes the old one, never by editing it.
- Nothing is written in a guide that the platform does not do today.
