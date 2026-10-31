# 22. Legal and compliance map

Status: a research brief written 2026-10-18 from primary texts where they could be read and from
secondary sources otherwise (`docs/research/05-legal.md`). **It is not legal advice.** No lawyer has
reviewed it. Items marked unverified were not confirmed from a primary source, and several
dates and statuses conflict between sources: the section "Uncertainties" lists them. Its purpose is
to tell the founder what to ask a lawyer, and to tell the engineers what the law already requires
the product to be able to do.

## 1. What matters most in the next 24 months, in order

1. **Customer-pulled cybersecurity.** Under Albania's Law 25/2024 and Council of Ministers Decision
   683/2024, wastewater operators are automatically classed as critical, incidents must be reported
   within four hours, and supply-chain security is mandatory. A June 2026 draft amendment would add
   hosting declarations. Greecon must be able to sign a security addendum.
2. **The liability boundary.** Advisory, not a safety system, in the design and in the contract.
   Albania's Law 82/2026 (in force about 20 August 2026) already treats software as a "product"; the
   EU Product Liability Directive 2024/2853 applies to products placed on the market after 9
   December 2026. Insure before commands go live.
3. **Processor duties under Law 124/2024** (a contract, sub-processors, breach clocks, records, EU
   hosting). In force about 1 February 2025; data-protection impact assessments and breach notice to
   data subjects from about 17 January 2027.
4. **The Cyber Resilience Act** for the edge gateway once sold in the EU. Reporting (Art. 14) has
   applied since 11 September 2026, also to products already on the market; the rest applies from 11
   December 2027.
5. **Trade-secret hygiene for GAIA and open-source compliance** (Grafana's AGPL licence, the
   TimescaleDB licence limits and consent on a sale).
6. **Energy regulation.** Stay a technology provider: no aggregation, trading or market dispatch
   until the regulator's rules and the new Power Sector Law are clear.
7. **The EU Data Act** once EU customers use the SaaS: switching, export, fair business terms.
8. **The EU AI Act.** GAIA is probably not an "AI system" while it stays deterministic; the high-risk
   rules for water and electricity safety components were pushed to 2 December 2027 and need an AI
   safety function and an EU critical-entity customer.

## 2. Regime by regime

### Personal data: Albania Law 124/2024 (and GDPR)

- Greecon is a controller for its own accounts, website and sales, and a processor for customer
  data. A processor must not reuse customer data for its own analytics or training without a basis.
- Telemetry is personal data when it can be tied to a person (a sole-trader farmer, a household
  prosumer, a hotel owner, user names, e-mail, IP addresses, audit logs); otherwise usually not
  (no Albanian guidance verified).
- A processor contract needs (Art. 26(3)): subject matter and duration, instructions in writing,
  confidentiality, security, sub-processors only with authorisation and notice of change, help with
  rights and breaches, deletion or return at the end, audits.
- A processor tells the controller of a breach "immediately"; the controller tells the Commissioner
  within 72 hours. Rights requests are answered in 30 days (extendable to 60).
- Transfers: EU and EEA are adequate; so are several neighbours and, for the United States, only
  companies in the EU-US Data Privacy Framework. EU-region hosting is the safe default.
- Penalties reach 1 billion lek or 2% of turnover, whichever is higher (4% for principles, rights
  and transfers).
- A data protection officer is probably not mandatory (the core activity monitors assets, not
  people). Name a privacy lead anyway.
- GDPR applies if Greecon offers services to, or monitors, people in the EU. No EU adequacy decision
  for Albania was found, so EU customers will bring standard contractual clauses.

### The box looks at the customer's network, when asked (added 31 October 2026)

- Guided setup ([30](30-guided-setup.md)) lets a person at the site press **Find equipment**: the box then looks at the site's own network for about a minute (private
  addresses, one port, reading only) and tells Greecon what answered. It is never scheduled and never reaches a public address. This is a decision ([L21](27-launch-decisions.md)),
  not legal advice. Looking at a network that belongs to someone else is something computer-misuse rules care about, so the order form and the data terms should say it in one plain sentence and the
  customer's network administrator should be told in writing beforehand (the install card has the message). Counsel is asked to confirm that is enough (checklist 16).
- The setup record keeps free text typed by staff: who signed the order form, and the name and licence number of the electrician. Those are personal data of those people. The privacy page says so
  (`/privacy`); counsel is asked about the basis and how long they are kept (checklist 17).

### Cybersecurity: Law 25/2024, NIS2, the Cyber Resilience Act

- **Law 25/2024** (partly aligned with NIS2): operators on a confidential list carry the duties
  (risk measures including supply chain, secure development, multi-factor authentication; every
  incident to the national and sector CSIRT within four hours; significant incidents a 72-hour update;
  a final report within a month; a conformity assessment every two years). Typical solar customers
  (under 15 MW) are not classified; wastewater operators are, automatically; hotels only above
  50,000 guests a year; Greecon, as a small ICT supplier, is not caught today. Whether a SaaS that
  hosts wastewater monitoring counts as "cloud hosting for critical services" is an open question
  for counsel.
- **NIS2** does not bind Albanian entities directly and Greecon is below its size line, but EU water
  and energy customers must manage supplier risk and report in 24 hours, 72 hours and a month, so
  expect questionnaires, security addenda, a 24-hour supplier incident notice, a bill of materials
  and patch commitments.
- **Cyber Resilience Act.** The edge gateway (hardware, image and agent) is a product with digital
  elements; the cloud functions it needs to work (remote configuration, updates, the command
  channel) are part of the product, while functions that work offline are not. Likely default
  category (self-assessment), but not if the gateway is marketed as a smart-meter gateway, router,
  firewall or VPN. Reporting of actively exploited vulnerabilities and severe incidents: 24 hours,
  72 hours, then a final report. Minimum five-year support period, documentation kept ten years. Sales
  only in Albania are outside the Act.
- **Do now (cheap):** a risk assessment, a bill of materials generated in the build, signed updates
  with rollback, a vulnerability contact (`security.txt`) and patch commitments, a reporting runbook,
  a stated support period (`docs/23-safety-and-security-case.md`).

### The EU AI Act

GAIA's rules are written by people and executed deterministically, which the Commission's guidelines
place outside the definition of an AI system. It stays outside as long as it has no learned weights
and no inference engine that writes its own rules. A machine-learning forecast beyond a baseline
probably would be an AI system: redo the test then. The high-risk category for water and electricity
needs the AI to be a safety component and the customer to be an EU-identified critical entity, so it
can only reach EU customers. Design choices that keep Greecon honestly out: keep GAIA deterministic;
advisory first with a named approver; hard protection outside Greecon; an intended-purpose statement
("monitoring, informational alerts, optimisation advice, not a safety function"); and a pre-release
check against the definition, the safety-function test and the customer's status. Staff literacy
(Art. 4) and the disclosure duty (Art. 50) apply regardless.

### The EU Data Act

Applies since 12 September 2025 to services offered to EU customers. A self-serve SaaS is a "data
processing service": EU contracts then need a switching right, a transition period, a 30-day data
retrieval window, an exhaustive list of exportable data, deletion, and no switching charges from 12
January 2027. Provider trade secrets (the GAIA internals) are excluded from export. The gateway may
make Greecon a "data holder", but micro and small firms are out of that chapter unless a medium or
large partner or linked enterprise changes the picture (re-check after fundraising). Business-to-
business terms that unilaterally restrict data access or liability for data breaches can be void
if unfair.

### Liability and contracts

Crop loss, downtime and lost yield are contract matters. Injury to a person or private property from
a defective edge or automation product cannot be disclaimed under the EU directive, and Albania's
amended Civil Code now includes software. A "not a safety system" clause helps classification and
insurance but does not bind an injured third party or excuse gross negligence: the real defence is
interlocks and approval gates that actually exist. Contract set: master terms and order form; a
data processing agreement with a clauses annex for EU customers; a service level and support policy
with credits as the sole remedy; hardware terms; an acceptable-use policy (no safety-function use,
no reverse engineering, no unauthorised control of other people's assets); a security addendum; a
**control addendum before any command goes live**; a pilot agreement; an open-source notices
schedule. Key terms: liability cap of about twelve months' fees with carve-outs for intent, gross
negligence, death and injury; the customer keeps independent protection, local overrides, human
review of suggestions, permits and discharge and grid limits; the customer owns its data; no model
training on customer data without opt-in. Insurance (a broker's question): technology errors and
omissions, cyber, general and products liability; insurers will ask whether the platform can actuate
equipment, so re-underwrite before commands go live.

### Energy regulation in Albania

Monitoring software, edge gateways and optimisation advice are not licensed activities: no
regulator licence for a pure technology vendor was found. Self-generators up to 500 kW are
recognised, up to 10.8 kW connect on notification, and a third party may operate and maintain a
self-generator's installation while staying subject to the self-generator's instructions
(Law 24/2023, Art. 20(5)), so operating a customer's plant on their instruction is accommodated.
Customers may add their own measuring units; read access to the distribution operator's meter data
is not verified. Do not pool customers' assets or dispatch into a market without the regulator and
counsel: aggregation and storage operation are reported to be licensed activities under Law 59/2026.

### Intellectual property and open source

- GAIA is protected as a trade secret under Albanian law implementing the EU directive, which turns on
  "reasonable steps" to keep it secret: NDAs, need-to-know access, repository hygiene, access logs, a
  trade-secret register, exit procedures, and no rule detail in decks, documents or marketing. Bar
  reverse engineering in the terms; keep rule bundles server-side or encrypted on the edge.
- Written IP assignment from every founder, employee and contractor, including code written before
  incorporation. A stand-alone Albanian trademark law took effect 16 August 2025; an EU trademark does
  not cover Albania; clear "GAIA" separately from "Greecon".
- **Grafana** (AGPL-3.0): unmodified, in its own container, no copyleft on Greecon code; modifying it
  or embedding Greecon code in it, or shipping it in the edge image, brings source-offer duties.
  **TimescaleDB**: the core is Apache-2.0 but the advanced features sit under the Timescale
  licence, which allows use inside a value-added product only if customers are barred from changing
  the schema, prohibits offering a database service, and makes a sale of the company need the vendor's
  consent. The architecture research recommends staying on plain PostgreSQL behind a storage seam
  (`docs/24`). **Mosquitto**: choose the permissive licence option. Keep a bill of materials and a
  notices file, scan licences in the build.

### Marketing

The EU's 2024/825 directive (applies from 27 September 2026) is consumer-only and blacklists generic
environmental claims, offset-based "carbon neutral" claims and unverified labels; Greecon's business
marketing is outside it, but customers repeat claims to consumers, so a savings figure needs a
baseline, a period and a method. Business advertising in the EU falls under Directive 2006/114/EC;
an Albanian equivalent was not found. The Green Claims proposal was stalled. No cookie banner is
needed with strictly necessary cookies and cookieless first-party analytics. The claims table is in
`docs/21-communication-system.md`.

### Commercial basics (ask the accountant)

Electronic invoicing for business invoices under Law 87/2019; value-added tax on SaaS and hardware
exports; any incentive for firms at Durana Tech Park; if Greecon ships its own gateway: the radio
equipment, electromagnetic compatibility, low-voltage, hazardous-substances, electronic-waste and
battery rules, and the Cyber Resilience Act declaration from 11 December 2027. Using a CE-marked
industrial PC with only software changed reduces the effort, but whether Greecon becomes the
"manufacturer" of the combined product needs a conformity consultant.

## 3. Incident clocks in one place

| Regime | Who | Clock |
|---|---|---|
| Law 124/2024, Art. 29 | Greecon to its customer; the customer to the Commissioner | "immediately"; 72 hours |
| Law 25/2024, Art. 23 | A classified customer to the CSIRT | 4 hours; 72-hour update; a month |
| NIS2, Art. 23 | An EU essential or important customer | 24 hours; 72 hours; a month |
| CRA, Art. 14 | Greecon as manufacturer (EU placement) | 24 hours; 72 hours; 14 days or a month |

One fact base, three templates (`docs/21`), and a staffed 24-hour contact path or a contractual limit
on the four-hour flow-down.

## 4. What the product must be able to do (design for compliance)

**From day one.** Tenant isolation, per-user accounts, roles, two-factor sign-in for administrators
and no shared credentials. A tamper-evident audit log of security events and every human approval and
command, with a set retention period. **Export of everything per tenant and per user** (CSV and JSON,
including configuration, excluding GAIA internals). A retention and deletion process per data class,
backup expiry and deletion confirmation. Processing records, a sub-processor register with a change log,
and a data-location setting (EU region by default). A security-contact registry per tenant and an
incident runbook that notifies within hours. TLS everywhere, encryption at rest, secrets management,
per-device identity and authenticated MQTT with access lists, signed updates with rollback, a bill
of materials and vulnerability scan in the build, `security.txt`. A hard "simulated or live" flag on
commands, simulated by default, with live only after the control addendum is accepted in the product
and operating limits are attested. Human approval gates with a named approver, a reason and an
expiry, and a fail-safe default (hold the last safe state, no autonomous action) when connectivity is
lost. A versioned log of acceptance of terms and privacy notice, and a "not a safety system" notice
at the approval step. Backups with restore tests.

**Seams, and the evidence that proves each.**

| Seam | Evidence trigger |
|---|---|
| Regional hosting selector | The first EU customer or tender; classified customers' hosting declarations |
| Single sign-on, SCIM | A utility or large customer's security review asks |
| Audit-log streaming to a customer's monitoring system; per-tenant retention | A classified customer or a processing-agreement negotiation demands it |
| Command-safety layer: limit registry, bounded setpoints, shadow mode, two-person approval, kill switch | The first live-actuation pilot or an insurer's request |
| Registry of any learning model (intended purpose, version, oversight) and an "AI gate" | The first learned forecast ships, or any EU deployment |
| CRA pipeline: published bill of materials, reporting hook, technical file, declaration | The first EU hardware sale (Art. 14 is already live) |
| Switching and export assistant | The first EU SaaS customer |
| ISO/IEC 27001, IEC 62443-4-1 | Tender requirements, certified-product lists |
| Albanian-language interface, WCAG 2.1 AA, e-invoice integration | Municipal or public tenders |
| Flexibility and aggregation module | The new Power Sector Law is adopted and a licensed counterparty exists |

**Avoid.** Claims of safety, "fail-safe", guaranteed savings or yield, "AI-powered" for deterministic
rules, "NIS2, GDPR or CRA compliant" (say "designed to support"), "certified" without a certificate,
"real-time" without a latency bound, "unhackable", or any promise that discharge, water-quality or
grid-code limits will be met. Autonomous control of safety-relevant actuators; auto-approval of
suggestions by default; actions triggered by loss of connection; unstaged remote firmware updates;
dispatch into electricity markets; training models on customer data without opt-in; collecting
end-user personal data (for example hotel guests) beyond need; reading the distribution operator's
meter data without authorisation; rule logic in clear text on the edge.

## 5. Uncertainties to resolve before relying on this

- The status of the new Power Sector Law: one secondary source says Law 59/2026 has been in force
  since July 2026, while the legal research treated it as pending. The text was not read.
- The net-billing start (reported as May 2026 rules and as 1 January 2027).
- Whether Normative Act 8/2023 was converted into law and its task force extended.
- Law 25/2024's Official Gazette date and the status of the June 2026 amendment; whether Greecon's
  SaaS could be classed as cloud hosting for critical services.
- The "digital omnibus" proposals (reporting through one EU entry point; the AI Act dates) were
  still in process; Annex III dates and the Article 4 literacy duty need checking in the Official
  Journal.
- Whether the gateway is a CRA product for pilots and free trials, and the authorised-representative
  and importer duties with no EU establishment.
- Recalled-only items: IEC 61511 clause numbers, IEC 62443 requirement numbering, EEMUA benchmarks,
  EN 18031 listing.

## 6. The lawyer's checklist

1. Law 124/2024: confirm the in-force dates and the acts the Commissioner has issued (standard clauses,
   impact-assessment lists); whether a data protection officer or any notification is needed.
2. Controller or processor for accounts, audit logs and telemetry tied to sole-trader farmers or
   prosumer households; the legal basis for audit logs; the transfer tool for the hosting providers.
3. GDPR reach, EU representative, standard clauses for EU customers, Albania's adequacy status.
4. Law 25/2024: the Gazette date and end of the transition; the status of the 2026 amendment; whether
   the SaaS could be classed as hosting for critical services.
5. Which flow-downs from classified customers (four-hour notice, access, audits, hosting declarations)
   Greecon may accept.
6. CRA: is the gateway a product with digital elements and Greecon its manufacturer; the cloud
   perimeter; Annex III and IV risk; the reporting set-up; should EU hardware sales wait?
7. AI Act: a written memo that GAIA is not an AI system; whether Art. 4 survived the omnibus; any
   anomaly-detection feature at EU water customers.
8. Data Act: is Greecon a data processing service or data holder; small-enterprise status after
   fundraising; switching clauses; a fairness review of the terms.
9. Law 82/2026: its reach for software; enforceability of caps and exclusions; limitation periods; the
   position of farmers who are sole traders.
10. Insurance programme, exclusions for control of industrial equipment, and the trigger for live
    commands.
11. Energy: any registration for monitoring or for operating a third party's plant; aggregation and
    demand response; the self-generator rules; access to the distribution operator's data.
12. Water and public buyers: the water regulator's and procurement-law requirements, and the discharge
    reporting duties that must stay with the customer.
13. IP: a reasonable-steps programme for GAIA; assignments from founders, employees and contractors;
    trademark strategy and "GAIA" clearance.
14. Open source: Grafana in the edge image; the Timescale licence flow-down and consent on a sale;
    replace TimescaleDB or not.
15. Tax and commercial: e-invoicing for foreign invoices, VAT on exports, incentives at the tech park,
    CE and electronic-waste duties, EU authorised-representative duties.
16. The box looking at a customer's own network when a person at the site asks (private addresses, one port, reading only, about a minute): is one plain sentence in the order form and the data
    terms, and a written note to the customer's network administrator beforehand, enough under the Albanian computer-misuse rules and the customer's own policy?
17. The setup record keeps the names of who signed for the customer and of the licensed electrician with their licence number: the legal basis, how long, and whether the privacy page says enough.
