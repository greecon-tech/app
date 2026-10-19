# Greecon Sh.p.k. — Legal Landscape Research Brief (Albania + EU)

> **Desk research, October 2026. Not reviewed by a licensed expert, and not legal, engineering, agronomic or safety advice.**
> Written from public sources on the dates inside. Facts are separated from inferences in the text, and
> anything marked UNVERIFIED, recalled or "search summary" was not confirmed from a primary source. File
> names such as `src/law124.txt` refer to the researcher's working folder, not to this repository. The
> decision-ready summary of all nine reports is `docs/17-constitution.md` to `docs/26-research-register.md`.

Status: RESEARCH BRIEF, not legal advice. Prepared 2026-10-13 for the founder and future counsel. Confidence: High / Medium / Low. "UNVERIFIED" = not confirmed from a primary source in this run. "memory" = general knowledge, not fetched. Local file names refer to `research/src` and `research/raw`.

## A) Ranking: the 8 things that matter most (next 24 months)
1. **Customer-pulled cybersecurity** (Law 25/2024 + VKM 683/2024): wastewater operators are automatically "critical", incident reports are due within 4 hours, supply-chain security is mandatory, a June 2026 draft adds hosting declarations. Greecon must be able to sign a security addendum.
2. **Liability boundary**: advisory, not a safety system, in design AND contract; Albania's Law 82/2026 (in force ~20 Aug 2026) already treats software as a "product"; EU PLD applies from 9 Dec 2026; insure before commands go live.
3. **Law 124/2024 processor duties** (DPA, sub-processors, 72 h / "immediately" breach clocks, records, EU hosting): in force ~1 Feb 2025; DPIA and data-subject breach notice from ~17 Jan 2027.
4. **Cyber Resilience Act** for the edge gateway once sold in the EU: Art 14 reporting applies since 11 Sep 2026; full application 11 Dec 2027.
5. **GAIA trade-secret hygiene and open-source compliance** (Grafana AGPL; TimescaleDB licence limits and acquisition consent).
6. **Energy regulation**: stay a technology provider; no aggregation, trading or market dispatch until ERE rules and the new Power Sector Law are clear.
7. **EU Data Act** once serving EU customers: SaaS switching/export, fair B2B terms.
8. **EU AI Act**: GAIA probably not an "AI system" while deterministic; Annex III high-risk now 2 Dec 2027 and needs an AI safety function plus a CER-critical EU deployer; AI literacy and Art 50 remain.

## B) Personal data: Albania Law 124/2024 (+ GDPR)
Sources: `law124.txt` (English), `fz_2025_9.txt` (Gazette), `idp_dec1_2025.txt`, EC Albania 2025 Report. High unless marked.

**Dates.** Approved 19.12.2024, decree no. 5 of 15.1.2025, Official Gazette 2025 no. 9 of 17 Jan 2025; in force 15 days after publication, ~1 Feb 2025 (Art 101(1), computed). Art 101(2): Arts 29(3) (breach notice to data subjects), 31 (DPIA), 32, 35-36, 64-65, 67(2),(3),(5) start two years after publication, ~17 Jan 2027 (computed). Repeals Law 9887/2008 (Art 99). Footnote 1 and the EC 2025 Report: "full alignment" with GDPR (7 of 10 implementing acts adopted; IDP capacity weak).

| Topic | Rule | Consequence for Greecon |
|---|---|---|
| Scope, roles | Art 4: controllers/processors established in Albania, and non-established ones targeting people there (4(2): then Ch. IV transfers apply). Art 26(8): a processor deciding purposes/means becomes controller. Art 88(2),(4),(5): processor liable only for processor-specific duties or acting against lawful instructions; joint-and-several to data subjects, with recourse | Controller for own accounts/CRM/website, processor for customer data; no reuse of customer data for own analytics or training without a basis |
| Processor contract | Art 26(3)(a)-(f): subject-matter, duration, purpose, data and subject categories; written instructions; confidentiality (Art 30, survives termination); Art 28 security; sub-processors only with prior specific/general written authorisation and notice of changes (26(2),(4)); help with rights and Arts 28-29; delete/return at end; audits; flag infringing instructions. Art 26(7): Commissioner may publish SCCs (none verified) | DPA template |
| Records | Art 27 covers processors; the <250-staff exemption (27(3)) is lost for non-occasional processing | Keep records |
| Breach | Art 29(1): controller to IDP "as soon as possible, no later than 72 hours" (unless unlikely to endanger rights); 29(2): processor to controller "immediately"; 29(3) data subjects if high risk (from ~Jan 2027); 29(6) log every breach | Customer-notice clause in hours |
| DPIA, DPO | Art 31 DPIA (new technologies, profiling, large-scale sensitive data), ~Jan 2027. Art 33 DPO: public bodies, or core activities = regular systematic monitoring of data subjects at scale, or large-scale sensitive data; 34(3) publish and notify | DPO probably not mandatory (core activity monitors assets, not people; Medium); name a privacy lead |
| Rights | Arts 12-20; answer in 30 days, extendable to 60 (12(4)); erasure Art 16, portability Art 18, automated decisions Art 20 | Export and delete per user |
| Transfers | Arts 39-42; adequacy by Commissioner decision (Art 40). IDP Decision 01/30.04.2025: EU/EEA; Convention-108 parties meeting conditions; Annex 1 incl. UK, Switzerland, Serbia, Kosovo, Montenegro, North Macedonia, Bosnia and Herzegovina, Moldova, Georgia, Israel, Japan, Korea, Canada (commercial only), USA (only EU-US DPF-certified companies, Decision 2023/1795). Else Art 41(1) (BCRs, Commissioner SCCs, approved code/certification), 41(2) contract clauses need Commissioner authorisation, 41(3)-(4) narrow derogations | EU-region hosting is an adequate destination; a US region or US-parent access needs the provider's DPF status (check, Medium) or Art 41 tools |
| Penalties | Art 94(1): up to ALL 1 bn or 2% of global turnover, whichever higher (English text cites Arts 8(6), 11 and "Chapter III of Part II" except Art 22; read as controller/processor duties incl. contract, records, security, breach, DPO; counsel to confirm). Art 94(2)-(3): up to ALL 2 bn or 4% (principles Arts 6-9, rights Arts 12-20, transfers Arts 39-42, Arts 43-46 incl. direct marketing, ignoring Commissioner orders). Factors Art 93; appeal Art 95; damages Art 88 | ALL 1 bn ~ EUR 10m (approx. 100 ALL/EUR); "whichever higher" is also in the Albanian original |

**Telemetry is personal data when tied to a person** (sole-trader farmer, household prosumer, hotel owner, user name/email, IP addresses, audit logs, plot GPS of a named person); otherwise usually not (Medium; no Albanian guidance verified).

**GDPR (Medium, memory).** No EU establishment, so Art 3(1) is not triggered; Art 3(2) applies if Greecon offers services to, or monitors, people in the EU (EDPB Guidelines 3/2018 catch a non-EU processor whose processing relates to a controller's Art 3(2) targeting). I found no EU adequacy decision for Albania (unverified), so EU customers will bring Commission SCCs (2021/914) and may ask about an Art 27 EU representative.

**What Greecon (mostly a processor) must have**
- DPA template: Art 26(3) content; SCC-ready annex; general sub-processor authorisation with notice and objection; customer-notice target (e.g. 24 h; statute says "immediately"); help with rights and DPIA; remote audit plus certifications; deletion/return window incl. backups; data location; TOMs annex; liability cap aligned with F.
- Sub-processor register: Railway, GCP, email, analytics/error tracking, payments, any AI API (entity, country, data, purpose, transfer tool, date).
- Retention schedule per data class (accounts, audit logs, telemetry, backups, web logs, marketing); Albanian statutory accounting/tax periods NOT verified.
- Breach runbook: detect, triage in hours, notify customer, support the controller's 72 h filing, keep the Art 29(6) log, post-mortem.

## C) Cybersecurity: Albania Law 25/2024 + VKM 683/2024; NIS2; Cyber Resilience Act
**C1. Law 25/2024 "On Cyber Security"** (`cyberlaw_final_sq.txt`; footnote 1: "partially aligned" with NIS2). Adopted 21.3.2024, decree 149 of 16.4.2024, in force 15 days after Gazette publication (Art 51(1); Gazette date unverified); Arts 35-38 only on EU accession.
- Scope: Art 3, Annexes I-II. Annex I: energy (electricity incl. producers and market participants; heating; oil; gas; hydrogen), drinking water, wastewater, digital infrastructure (cloud, data centres), "ICT service management B2B" (managed service, managed security, ICT service, system development/maintenance providers), tourism, health, public administration. Annex II: food, waste, manufacturing (electrical, electronic, machinery), digital providers. Only entities on the confidential list (Art 12(5); Council of Ministers; updated at least every two years; EC 2025 Report: new list June 2025) carry operator duties.
- Operator duties: risk measures incl. supply-chain security (Art 21(1)(ç)), secure development/maintenance and vulnerability handling (21(1)(d)), MFA (21(1)(g)); **every incident to the National and sectoral CSIRT within 4 hours; significant incidents: 72-hour update; final report in one month (Art 23(3),(5))**; conformity-assessment report every 2 years (31(7)); National CSIRT direct access to premises and systems (31(5)); corrective measures (Art 43).
- Penalties (Arts 44-46): ALL 1-10m (~EUR 10-100k) for failing to report incidents or breaching Art 31; ALL 0.2-5m for other listed breaches; after two successive measures the Authority may seek domain blocking, licence suspension or suspension of the responsible executive.
- Transition: 24 months from entry into force (Art 50(1)): expired or expiring ~mid-2026 (Medium).
- DRAFT amendment (consultation RENJK 999, PDF dated 23 Jun 2026; adoption NOT verified): Art 20/1 self-declaration of measures; **Art 20/2 operators declare hosting entity, location, measures and cloud use**; Art 17(3)(g) duty to block IOCs/IOAs notified by the Authority; Art 41(3) list of operators that must use certified ICT products/services; higher fines (ALL 5m missing self-declaration, 3m hosting non-declaration); local government added to Annex I.

**C2. VKM 683/2024 (6.11.2024)** (`vkm683.txt`; implements Art 12(2)): classification by service and threshold; services without cyber-dependency are not classified.
| Customer | Rule | Result |
|---|---|---|
| PV/electricity generation | Ch. V II.3.1: 15-100 MW important, >100 MW critical | Typical PV customers (<15 MW) NOT classified |
| Transmission, distribution, power exchange | automatic | Critical |
| Drinking water | quality monitoring critical; distribution/treatment 30,000-70,000 subscribers important, >70,000 critical | Large utilities |
| **Wastewater collection/treatment** | Ch. X 3.1: automatically critical, no threshold (Annex I excludes non-core activity) | **WWTP operators in scope: strongest vendor pull** |
| Hotels | accommodation with >50,000 guests/year important | Most hotels below |
| ICT service management B2B | Ch. XII 2.1: services by a "large business" to critical/important infrastructure critical | Greecon (small) not caught today |
| Cloud/on-premise hosting | Ch. XI 3.2: hosting of critical/important services critical | OPEN: could a SaaS hosting WWTP monitoring count? ask counsel (Low) |

Vendor implications: classified customers must manage supply-chain security, so expect questionnaires, a security addendum, 4-hour incident-notice flow-down, audit/inspection rights, hosting transparency (draft Art 20/2), patch SLAs, possibly certified-product demands (draft Art 41).

**C3. NIS2 (Directive (EU) 2022/2555; local text).** Covers medium-sized-or-larger Annex I/II entities providing services in the Union (Art 2(1)), applied from 18 Oct 2024 (Art 41). Albania is a candidate, not a Member State: NIS2 does not bind Albanian entities directly (jurisdiction follows EU establishment, Art 26; non-EU managed-service/cloud providers serving the EU need an EU representative, only if above the size-cap). Greecon is micro/small: outside NIS2. Indirect pull: EU water/energy customers must handle supplier risk (Art 21(2)(d), 21(3); recital 85 urges contract flow-down) and report 24 h / 72 h / one month (Art 23). EC 2025 Report: Law 25/2024 "enabled further alignment" with NIS2; list updated June 2025; Strategy 2025-2030 adopted; implementing legislation still to finish; ePrivacy alignment and the AI Act are open items.

**C4. Cyber Resilience Act (Regulation (EU) 2024/2847; local text).**
- Scope: products with digital elements made available on the EU market with a data connection (Art 2(1)); Albania-only sales are outside it. The edge gateway (hardware + image + agent) is one; Greecon is "manufacturer" if it designs it or has it designed and sells it under its name.
- SaaS: stand-alone cloud services are out (recital 12; NIS2 covers them), but a "remote data processing solution" (Art 3: software made by or for the manufacturer whose absence stops the product performing a function) is part of the product. Cloud features the gateway needs (remote config, OTA, command channel, rules fetch) are inside; functions that work offline are not. Commission guidance is awaited (recital 6). Medium.
- Class: default self-assessment unless core functionality matches Annex III (e.g. network management systems, routers/switches, firewalls/IDS, hypervisors/container runtimes) or Annex IV (smart meter gateways in smart metering systems). Likely default; do not market it as a smart-meter gateway, router or firewall without a CRA check.
- Dates (local text, Arts 69-71): in force 10 Dec 2024; Chapter IV 11 Jun 2026; **Art 14 reporting from 11 Sep 2026, also for in-scope products already on the market (Art 69(3))**; all else 11 Dec 2027 (earlier products only if substantially modified, Art 69(2)).
- Art 14: actively exploited vulnerability or severe incident: early warning 24 h, notification 72 h, final report 14 days after a fix (vulnerability) or one month (incident). Fines (Art 64): up to EUR 15m / 2.5% (Annex I, Arts 13-14); EUR 10m / 2%; EUR 5m / 1%.
- Omnibus: the Nov 2025 proposal would route CRA/NIS2/GDPR incident reports through one ENISA entry point; mid-2026 commentary expected the process to run into early 2027; I found no change to CRA dates (verify).
- Do now: choose the first EU placement date; SBOM in CI; signed updates with rollback; per-device credentials, TLS and ACLs on MQTT; secure defaults; vulnerability intake (security.txt) and patch SLA; technical file and risk assessment; 5-year minimum support (Art 13(8)); keep documentation 10 years (Art 13(13), memory). Use IEC 62443-4-1/4-2 or ETSI EN 303 645 until harmonised standards exist.

**C5. One incident, several clocks**
| Regime | Who | Clock |
|---|---|---|
| Law 124/2024 Art 29 | Greecon to customer; customer to IDP | "immediately"; 72 h |
| Law 25/2024 Art 23 | classified customer to CSIRT | 4 h; 72 h update; 1 month |
| NIS2 Art 23 | EU essential/important customer | 24 h; 72 h; 1 month |
| CRA Art 14 | Greecon as manufacturer (EU placement) | 24 h; 72 h; 14 days / 1 month |

## D) EU AI Act
Sources: `ai_def_guidelines.txt` (C(2025) 5053, 29.7.2025); `draft_guidelines_annex3.txt` (DRAFT Art 6 guidelines, 2026, consultation text, not final); web for the omnibus (Medium).

**D1. Is GAIA an "AI system" (Art 3(1))?** No automatic answer or list exists; assess architecture and function (para 62). Recital 12 (para 40) excludes "simpler traditional software" and systems "based on the rules defined solely by natural persons to automatically execute operations". Outside: basic data processing under fixed human-programmed rules (para 46), descriptive analysis/visualisation (47), classical heuristics (48), baseline predictors such as averages (49-51), optimisation that stays basic data processing (42). Counter-pointer: logic- and knowledge-based approaches (knowledge bases, inference engines, expert systems) CAN be AI systems (39), and an expert system that outputs recommendations has "some degree of independence" (18). Assessment (Medium-High): GAIA today (human-authored deterministic threshold/priority rules, human approval) is probably NOT an AI system; keep it so (no learned weights, no inference engine generating rules) and document it. Planned ML forecasting beyond baselines probably IS one; redo the test then. Most AI systems face no AI Act duty beyond Arts 4 and 50 (para 63).

**D2. High-risk (Art 6(2), Annex III point 2).** DRAFT guidelines (paras 178-206): two cumulative conditions. (1) The AI is a "safety component" (Art 3(14)): it directly protects physical integrity; systems that are "merely supportive, informational, organisational or optimisation-oriented" are excluded (180-181). Six safety functions (184): detect hazards, detect safety-relevant maintenance needs, prevent unsafe operation start, limit harm, mitigate consequences (safe stop), supervise another safety system; a redundant protective system counts (186); cybersecurity-only AI is not a safety component (187). (2) Use in supply of water (drinking water AND wastewater collection/treatment/disposal, 197) or electricity (generation, demand response, aggregation, storage, 203), AND the deployer must be identified as a critical entity under the CER Directive (190, 198, 204). Draft examples that ARE safety components: AI pressure monitoring in drinking-water networks; AI predicting sewage overflow that affects drinking water. CER identification is by EU Member States, so this can bite only EU customers today. Agriculture/irrigation is outside point 2. Draft only: verify the final text.

**D3. Timeline (web, Medium-High; confirm in the OJ).** Original: prohibitions and AI literacy (Art 4) 2 Feb 2025; GPAI 2 Aug 2025; the rest incl. Annex III and Art 50 on 2 Aug 2026; Annex I products 2 Aug 2027. "Digital Omnibus on AI" adopted (Parliament 16 Jun 2026, Council 29 Jun 2026, in force ~27 Jul 2026; number reported as Regulation (EU) 2026/1744, unverified): Annex III deferred to **2 Dec 2027**, Annex I to **2 Aug 2028**; Art 50(2) marking grace to 2 Dec 2026 for systems already on the market, other Art 50 duties from 2 Aug 2026 (now); registration reinstated for providers self-assessing Annex III systems as non-high-risk; sandboxes to 2 Aug 2027. UNVERIFIED: whether Art 4 AI literacy was changed (the Nov 2025 proposal would have moved it to the Commission/Member States); assume it applies. The wider omnibus (GDPR, Data Act, reporting) was still in process mid-2026. Albania: the EC 2025 Report (Ch. 10) says it "should fully align with the EU's Artificial Intelligence Act"; no Albanian AI statute verified.

**D4. Duties that apply anyway.** Art 4: staff literacy for AI tools whose output reaches the EU (short AI-use policy, training log). Art 50: disclose AI interaction if GAIA gets a chat/agent interface; mark synthetic content. Reach: Art 2 (EU placement or EU use of output).

**D5. Design choices that keep Greecon honestly out of high-risk**
1. Keep GAIA deterministic and human-authored; do not market deterministic logic as "AI".
2. Advisory first: a named human approves each action, logged; any later closed loop only for non-safety optimisation with bounded set-points and local fallback.
3. Hard interlocks outside Greecon (overpressure, overflow, dry-run, overcurrent, high-level, e-stop) in PLC/relay/safety hardware owned by the asset owner; Greecon never sits in a safety loop.
4. Intended-purpose statement (the provider's stated purpose drives classification): monitoring, informational alerts, optimisation advice, not a safety function; never sell an ML module as detecting leaks/overflows/pressure faults as protection for water or power infrastructure.
5. A pre-release "AI gate" checklist: definition test, safety-function test, is the deployer a CER critical entity.

## E) EU Data Act
Source: FAQ v1.4 of 22 Jan 2026 (`dataact_faq.txt`); Regulation (EU) 2023/2854. "(memory)" = not in the FAQ extracts read.
- **Dates:** applies from 12 Sep 2025; Chapter IV (unfair terms) to contracts concluded after that date, and from 12 Sep 2027 to older indefinite or 10+ year contracts (FAQ); switching charges cost-based until 12 Jan 2027, then none (Art 29; FAQ Q54).
- **Territory (memory, Art 1(3)):** reaches connected-product makers placing products on the EU market and data-processing-service providers serving EU customers, wherever established. Albanian-only customers are outside it.
- **SaaS is a "data processing service" (Art 2(8)):** FAQ Q58a: Chapter VI "applies to all SaaS types" showing on-demand access, rapid provisioning with minimal provider interaction, and elasticity; custom-built or beta services get the lighter Art 31 regime but still need open interfaces and structured, machine-readable export (Q52). Self-serve tenants likely qualify; bespoke integrations maybe not (Medium). EU contracts then need (Art 25, memory): switching right (notice up to 2 months), transition up to 30 days (extendable), 30-day data-retrieval window, exhaustive list of exportable data and digital assets (Q53: input/output data, metadata, configuration, access settings; provider IP and trade secrets excluded, so GAIA internals stay protected), deletion, no switching charges from 12 Jan 2027, and public statements on jurisdiction and protection against unlawful third-country government access (Arts 28/32, memory).
- **Connected product/related service (Chapter II):** gateway data plus the cloud link may make Greecon a "data holder" for EU users (data access by design, pre-contract information, user access, sharing with third parties, Arts 3-5). Gateway status is uncertain (Art 2(5): primary function must not be processing for someone other than the user): Low-Medium. FAQ Q10: a "related service" needs two-way data exchange and must affect product function; Greecon's command/config channel fits. Exemption (memory, Art 7(1)): micro and small enterprises are out of Chapter II unless they have a medium/large partner or linked enterprise; re-check after fundraising (holdings above 25% can create partner status; Recommendation 2003/361 has VC/angel carve-outs).
- **Upside:** customers can authorise Greecon as "third party" to receive data from EU-made inverters, pumps and meters (Art 5); Art 6 limits: use as agreed, no profiling beyond the service, no onward sharing, no competing connected product.
- **B2B fairness (Art 13):** unilateral terms on data access/use or on liability for data-related breaches can be void if unfair; product warranties and technical service terms are not caught (FAQ). For EU business customers: no exclusion of liability for intent or gross negligence, no use of customer data beyond the service, no export blocking, no unreasonably short termination notice (Art 13(4)-(5), memory).
- **Build in:** full tenant export (CSV/JSON + OpenAPI) incl. configuration; a Terms schedule separating exportable data, digital assets and Greecon IP; 30-day retrieval window; deletion confirmation; no egress fees; switching runbook; third-country-access statement for hosting; per-asset data-sharing consent records.

## F) Liability and contracts
**F1. EU Product Liability Directive (EU) 2024/2853** (adopted 23 Oct 2024; rest memory, High-Medium). Repeals 85/374/EEC; transposition by 9 Dec 2026; applies to products placed on the market after that. Software, firmware, apps, AI systems and digital manufacturing files are "products"; integrated digital services count as components; cybersecurity weaknesses and missing security updates within the manufacturer's control can make a product defective. Strict liability; claimants are natural persons (death/injury incl. recognised psychological harm; property not used exclusively for professional purposes; non-professional data); disclosure and presumptions ease proof; for non-EU makers the EU importer, authorised representative or fulfilment provider answers; 10-year long-stop (25 for latent injury); non-commercial open source excluded. So crop loss, downtime and lost yield are contract matters, but injury to a person or private property from a defective edge/automation product cannot be disclaimed.

**F2. Albania: verified vs not.** Verified from secondary sources (Medium): the Civil Code (Law 7850/1994) holds a product-liability regime broadly following 85/374 with exceptions in Art 628 (Mondaq 2018); Law 9902/2008 (consumer protection) and Law 10480/2011 (general safety of non-food products) complement it. **Law 82/2026 amending the Civil Code: Official Gazette 5 Aug 2026, in force 15 days later (~20 Aug 2026, computed); "product" now includes software, digital manufacturing files, digital services and products with digital elements; liability extends to authorised representatives and entities placing products on the market or putting them into service; defect criteria and exclusions refined; commercial late-payment periods/interest move to the special late-payment legislation** (Boga & Associates newsletter, not the primary text). The EC 2025 Report (earlier) called Albania only partly aligned on product liability. NOT verified: caps and exclusions under Albanian contract law (intent/gross-negligence carve-outs), limitation periods, non-pecuniary damages, whether business property damage is covered, court vs arbitration forum.

**F3. Contract architecture (and why)**
- Master Subscription Terms + Order Form (scope, fees, term, IP, confidentiality, liability, law/forum); DPA (+ SCC annex for EU), Law 124 Art 26(3).
- SLA/Support Policy (availability, severity/response, service credits as sole remedy, exclusions for customer network, power, third-party cloud).
- Hardware Sale/Lease Terms (title/risk, warranty, RMA, qualified-installer duty, firmware support end-date, WEEE take-back).
- Acceptable Use Policy (no safety-function use, no reverse engineering, no scraping GAIA outputs, no unauthorised control of third-party assets).
- Security Addendum (TOMs, incident notice, audit, vulnerability disclosure) for Law 25 customers.
- Control/Automation Addendum before commands go live (named approvers, interlocks, fail-safe, change management, risk allocation).
- Pilot/Evaluation Agreement (no warranty, limited data use, conversion terms); OSS notices schedule (H).

**F4. Key clauses**
- "Not a safety system"/intended purpose: supports AI Act classification, product-liability defence and insurance; repeat it in the UI at the approval step. Text does not bind injured third parties or excuse gross negligence; interlocks and approval gates are the real defence.
- Liability cap ~12 months' fees; exclude indirect loss, lost yield/crop/production and customer regulatory fines; carve out intent, gross negligence, death/injury and non-excludable law; consider a higher data-protection super-cap; keep it mutual and reasonable for EU business customers (Data Act Ch. IV).
- Warranty: software conforms to documentation; forecasts and recommendations are estimates, no outcome guarantee; hardware warranty with repair/replace as sole remedy.
- Customer duties: qualified installation, local interlocks and manual overrides, human review before approving GAIA suggestions, credential security; permits, discharge and grid limits stay with the customer.
- Indemnities: Greecon IP indemnity (capped); customer indemnity for unlawful instructions, unsafe installation, unauthorised use; open-source pass-through only.
- Data/AI: customer owns its data; limited licence to run the service; no model training on customer data without opt-in; GAIA and feedback remain Greecon IP.
- Suspension/termination for security or non-payment; Data Act-ready export/deletion; force majeure covering cloud, grid and connectivity failure.
- Insurance (ask a broker; Albanian availability unverified): technology E&O, cyber (first-party plus third-party), general and products liability (hardware, injury, property), later D&O. Insurers will ask whether the platform can actuate equipment: re-underwrite before commands go live.

## G) Energy regulation in Albania
Sources: Law 43/2015 "On Power Sector" (ERE-hosted copy, 2015 text; later amendments NOT checked) and Law 24/2023 (ERE-hosted English text), both read; EC 2025 Report; search summaries of Energy Community material (not read in full). Medium.
- **Licensed activities (Law 43/2015 Art 37(2)):** generation, transmission, distribution, supply, trading, market operation. Monitoring software, edge gateways and optimisation advice are not on the list: no ERE licence found for a pure technology vendor.
- **Generation exemptions (Art 37(6)-(7)):** off-grid self-producers and grid-connected producers up to 1 MW need no generation licence but must follow market rules and grid codes (2015 text; verify threshold).
- **Prosumers (Law 24/2023):** a renewables self-consumer is a final customer generating for own use who may store/sell surplus (non-households: not as primary activity); self-generators max 500 kW may generate, consume, store, sell (Art 20(1)); compensation by net invoicing under a Council of Ministers decision (20(2)-(4)); up to 10.8 kW connects on notification to the DSO (Art 18(4)); DSO register (20(6)); Art 20 applies from 1 Jan 2024, the 500 kW net-metering scheme being the earlier regime (Art 30(9); VKM 369/2017). **Art 20(5): a third party may own or manage the installation incl. operation, metering and maintenance if it stays subject to the self-generator's instructions**: operating a customer's PV/storage on instruction is accommodated.
- **Aggregation/demand response:** defined in Law 24/2023 but no licence category in Art 37. Per search summaries, the Energy Community Secretariat says active customers, aggregation, storage and citizen energy communities await the new Power Sector Law (draft reviewed July 2025; EC 2025 Report: drafting ongoing; April 2026 update: pending). Selling or trading electricity or flexibility likely needs market-participant status and possibly a trading licence (Art 37(2)(e)): do NOT pool customers and dispatch into markets without counsel and ERE confirmation.
- **Metering:** DSO/TSO own metering and reading; independent metering operators need ERE approval; revenue meters are sealed and verified; customers may install additional measuring units at their own cost (Law 43/2015 Arts 76-77). Greecon's customer-side sub-metering is permitted; read access to DSO meter data is NOT verified.
- **Context (EC 2025 Report):** 20/35/110 kV customers deregulated, 10 kV from Jan 2025, 6 kV from Jan 2026, only 0.4 kV regulated after; ERE restructured Oct 2024.
- **Could not verify:** consolidated Law 43/2015; the Council of Ministers decision under Law 24/2023 Art 20; ERE third-party data-access rules; storage licensing; ESCO/energy-efficiency rules; water regulator (ERRU) rules; public-procurement duties for municipal utilities (Law 162/2020, memory).

## H) IP and open source
- **Trade secret (GAIA).** Law 9947/2008 "On Industrial Property" as amended by Law 96/2021 (7.7.2021; in force 22 Aug 2021) transposed Directive (EU) 2016/943; Tirana District Court competent (Art 111/e) (Medium; secondary sources; a newsletter also cites a "Law 88/2026": unverified). The Directive (Art 2(1)) needs secrecy, value from secrecy, and "reasonable steps" to keep it secret, so evidence of steps is the legal core: NDAs (staff, contractors, pilots, investors), need-to-know access, repo/secrets hygiene, access logs, trade-secret register, exit procedures, no rule detail in decks, docs or marketing. Reverse engineering of lawfully acquired products is allowed unless contractually barred (Directive Art 3(1)(b)): bar it in Terms; keep rule bundles server-side or encrypted on the edge. Data Act export excludes provider trade secrets (FAQ Q53).
- **Software IP.** Written IP assignment in every founder, employee and contractor agreement, incl. pre-incorporation code to the Sh.p.k.; dated repo history; open-source contribution policy. Albanian rules for employee-created programs not verified (EU Software Directive 2009/24/EC Art 2(3) gives the employer the rights).
- **Trademarks.** A stand-alone Albanian Trademark Law took effect 16 Aug 2025 (AIPPI, Petosevic; Medium); office DPPI (dppi.gov.al). An EU trade mark does not cover Albania: national filing plus Madrid designations (confirm route), 6-month Paris priority. Clear "GAIA" (crowded name) separately from "Greecon" and "GAIA Tech"; consider "GAIA by Greecon"; classes 9, 42, 35.
- **Licences (memory unless noted; Medium-High; verify on vendor pages).**
| Component | Licence | Meaning for Greecon |
|---|---|---|
| Grafana OSS | AGPL-3.0 (since v8, 2021) | Unmodified, separate container: no copyleft on Greecon code. Modified Grafana offered to users over a network triggers a source-offer duty (AGPL s.13); shipping it in the edge image is "conveying": include licence text, notices, source or offer; trademarks not licensed. No patches or embedding of Greecon code; else buy Grafana Enterprise/Cloud |
| TimescaleDB | Apache-2.0 core + Timescale License (TSL) | TSL text read (posted 24 Sep 2020; check current): free internal use; permitted inside "Value Added Products or Services" (not primarily a database product; substantial different value; users contractually or technically barred from changing the schema); binaries only inside such a product, with TSL notice; DBaaS prohibited; modifications restricted; auto-termination on breach; assignment/M&A needs Timescale consent (s.7.6). Keep customer DB roles read-only, ban DDL in Terms, or use an Apache-only build/plain Postgres |
| Mosquitto | EPL-2.0 / EDL-1.0 dual (EDL BSD-style) | Choose EDL: permissive, ship with notices |
| Next.js, NestJS, PostgreSQL | MIT / PostgreSQL licence | Keep notices |
- **Edge-image checklist:** SBOM and third-party notices file; licence scanner in CI; list GPL/LGPL/AGPL components and provide source or written offer; no non-redistributable firmware; TSL notice and schema-change ban in hardware terms; encrypted GAIA bundle.

## I) Marketing / communications law
- **Directive (EU) 2024/825 (green transition):** transposition by 27 Mar 2026, applies from **27 Sep 2026** (web, Medium-High). It amends the UCPD and Consumer Rights Directive and blacklists, among others: generic environmental claims ("eco-friendly") without recognised excellent performance; whole-product claims when one aspect qualifies; offset-based "carbon neutral"/reduced-impact claims; sustainability labels not based on certification or public authority; future-performance claims without a verified plan (memory).
- **B2B relevance:** business-to-consumer only, so Greecon's B2B marketing is outside it. Still: B2B misleading-advertising rules (Directive 2006/114/EC for EU markets; Albanian equivalent unverified), and customers (hotels, PV operators, farms) may repeat Greecon's claims to consumers, so savings figures need baseline, period and method. Honesty rule: no "AI-powered" for deterministic features, no "carbon neutral", no unproven savings.
- **Green Claims Directive proposal (COM(2023) 166):** paused by the Commission in June 2025; June 2026 commentary calls it effectively stalled; not law (Medium).
- **Cookies/ePrivacy:** EU ePrivacy Art 5(3) needs consent for non-essential cookies. The EC 2025 Report says Albania needs further ePrivacy alignment: no verified Albanian cookie rule; Law 124 consent (Art 8) applies when cookies process personal data; Art 46 allows direct marketing on legitimate interest with a right to object (Art 19(2)). Practical: strictly necessary cookies plus cookieless first-party analytics means no banner; otherwise opt-in banner and consent log.
- **European Accessibility Act (Directive 2019/882):** applies from 28 Jun 2025 to consumer-facing products/services; B2B SaaS is not directly in scope (memory, Medium-High). Public buyers may ask for WCAG 2.1 AA: a later seam.

## J) Commercial basics (ask the accountant; unverified except the e-invoicing note)
- **E-invoicing/fiscalisation:** trackers report mandatory B2B e-invoicing via the Central Invoicing Platform since 2021 under Law 87/2019 (UBL 2.1, unique invoice identifier, 5-year archive); check export invoices and 2026 changes (Medium-Low).
- **VAT and tax:** VAT on SaaS and hardware exports (place of supply, zero-rating, registration threshold), customs and preferential-origin paperwork, profit-tax regime and any Durana Tech Park incentives: not verified.
- **CE marking if Greecon ships its own gateway (memory, Medium):** by design, Radio Equipment Directive 2014/53/EU (any Wi-Fi/Bluetooth/LTE radio; delegated act 2022/30 cybersecurity duties from 1 Aug 2025), EMC 2014/30/EU, LVD 2014/35/EU (mains above 50 V AC), RoHS 2011/65/EU, WEEE 2012/19/EU (producer registration per Member State, usually via an authorised representative), Batteries Regulation 2023/1542 if cells fitted; CRA CE declaration from 11 Dec 2027. A CE-marked OEM industrial PC with only software changed reduces effort, but whether Greecon becomes the "manufacturer" of the combined product needs a conformity consultant. Albania's own transposition and conformity rules: unverified.

## K) Design-for-compliance implications for the platform
**(i) MUST EXIST FROM DAY ONE**
1. Tenant isolation, per-user accounts, RBAC, admin MFA, no shared credentials (Law 124 Art 28; Law 25 Art 21(1)(g); CRA Annex I).
2. Tamper-evident audit log of security events and every human approval/command (who, what, when, before/after, source) with a defined retention period: Art 29(6) breach records and liability evidence.
3. Tenant-wide and per-user export (CSV/JSON + API) incl. configuration, excluding GAIA internals (Law 124 Art 18; Data Act).
4. Retention/deletion engine per data class and tenant, backup expiry, deletion confirmation (Art 26(3) end-of-service; Art 16).
5. DPA hooks: processing records, sub-processor register with customer-visible change log, data-location setting (EU region default).
6. Incident workflow: security-contact registry per tenant, runbook that notifies within hours, incident log (C5).
7. TLS everywhere, encryption at rest, secrets management; per-device identity and authenticated MQTT with ACLs; signed updates with rollback; SBOM and vulnerability scan in CI; security.txt.
8. "Simulated vs live" command mode as a hard flag, default simulated; live only after the Control Addendum is accepted in-product and interlocks are attested.
9. Human-approval gates with named approver, reason and expiry; fail-safe default (hold last safe state, no autonomous action) on connectivity loss.
10. Versioned Terms/Privacy acceptance log; "not a safety system" notice at the approval step.
11. Backups with restore tests; availability monitoring.

**(ii) SEAMS for later (extension point -> evidence that proves the need)**
| Seam | Evidence trigger |
|---|---|
| Regional hosting/data-residency selector | First EU customer or RFP; classified customers' hosting declarations (draft Art 20/2) |
| SSO/SAML/OIDC, SCIM | Utility or large-customer security review asks |
| Audit-log streaming to customer SIEM; per-tenant retention | Classified (Law 25) customer or DPA negotiation demands it |
| Command-safety layer: interlock registry, bounded set-points, shadow mode, two-person approval, kill switch | First live-actuation pilot; insurer request |
| AI/ML registry (intended purpose, model version, oversight) + "AI gate" | First ML forecast ships; any EU deployment |
| CRA pipeline: published SBOM, ENISA-reporting hook, technical file, CE declaration | First EU hardware sale (Art 14 already live) |
| Switching/export assistant | First EU SaaS customer |
| ISO/IEC 27001, IEC 62443-4-1 | Tender requirements; draft Art 41 certified-product lists |
| Albanian-language UI, WCAG 2.1 AA, e-invoice integration | Municipal/public tenders |
| Flexibility/aggregation module | New Power Sector Law adopted AND a licensed counterparty |

**(iii) THINGS TO AVOID**
- Claims: "safety", "fail-safe", "guaranteed savings/yield", "AI-powered/autonomous" for deterministic rules, "NIS2/GDPR/CRA compliant" (say "designed to support"), "certified" without a certificate, "ERE-compliant", "green/eco-friendly/carbon neutral", "real-time" without a latency bound, "unhackable", any promise that discharge, water-quality or grid-code limits will be met.
- Automations: autonomous control of safety-relevant actuators (pump trips, overflow valves, dosing/chlorination, electrical protection) or anything that can override a local interlock; auto-approval of GAIA suggestions by default; actions triggered by cloud-connection loss; unstaged remote firmware updates; auto-bidding or dispatch into electricity markets; training models on customer data without opt-in; collecting end-user personal data (e.g. hotel guests) beyond need; reading DSO meter data without authorisation; GAIA rules in clear text on the edge.

## L) Lawyer's checklist (15 questions)
1. Law 124/2024: confirm in-force dates (~1 Feb 2025; deferred provisions ~17 Jan 2027), which IDP acts exist (SCCs, DPIA lists), whether a DPO or any IDP notification is needed, and the "whichever higher" penalty mapping.
2. Controller vs processor for accounts, audit logs and telemetry linked to sole-trader farmers or prosumer households; legal basis for audit logs; transfer tool for Railway/GCP and their DPF status.
3. GDPR reach (Art 3(2), EU representative), SCC modules for EU customers, Albania's EU adequacy status.
4. Law 25/2024: Gazette date and end of the 24-month transition; status of the June 2026 amendment and sub-legal acts; could Greecon's SaaS be "cloud hosting for critical services" (VKM 683 Ch XI 3.2) or a "large-business" ICT provider (Ch XII 2.1)?
5. Which flow-downs from classified customers (4-hour notice, CSIRT access, audits, hosting declarations) Greecon may accept.
6. CRA: is the gateway a product with digital elements and Greecon its manufacturer; remote-data-processing perimeter; Annex III/IV risk; ENISA reporting set-up; should EU hardware sales wait?
7. AI Act: written memo that GAIA is not an AI system; did Art 4 survive the omnibus; Annex III point 2 exposure for any anomaly-detection feature at EU water customers.
8. Data Act: is Greecon a "data processing service" and/or data holder; micro/small status after fundraising; switching clauses; fairness audit of Terms.
9. Law 82/2026 scope for software; enforceability of caps, exclusions and mandatory carve-outs; limitation periods; status of farmers who are sole traders.
10. Insurance programme, exclusions for control of industrial equipment, go-live trigger for live commands.
11. Energy: licence/registration for monitoring, third-party operation of PV/storage (Law 24/2023 Art 20(5)), aggregation or demand response; Law 43/2015 as amended; the self-generator decision; DSO data access.
12. Water and public buyers: ERRU and procurement-law requirements, security demands of municipal utilities, WWTP discharge-reporting duties (Law 9115/2003; VKM 177/2005) that must stay with the customer.
13. IP: "reasonable steps" programme for GAIA; founder/employee/contractor assignments; trademark strategy (DPPI + Madrid) and "GAIA" clearance.
14. Open source: AGPL (Grafana) in the edge image; TSL flow-down and acquisition consent; replace TimescaleDB or not.
15. Tax/commercial: e-invoicing for foreign invoices, VAT on SaaS/hardware exports, Tech Park incentives, CE/RED/EMC/LVD, WEEE/RoHS, EU authorised-representative duties.

## M) Source list
Local primary (research dir): `src/law124.txt`; `src/fz_2025_9.txt`; `src/idp_dec1_2025.txt`; `src/cyberlaw_final_sq.txt` (Arts 3, 12, 21-23, 31, 43-46, 50-51, Annexes); `src/vkm683.txt`; `raw/32022L2555.txt`; `raw/32024R2847.txt` (Arts 3, 13, 14, 64, 69-71, Annexes III-IV); `src/ai_def_guidelines.txt` (paras 18, 39-51, 62-63); `src/draft_guidelines_annex3.txt` (paras 178-206); `src/dataact_faq.txt` (Q10, Q52-54, Q58a); `raw/albania-report-2025.txt` (Ch. 10, 15, 23, 28). Fetched this run (scratchpad `dl_renjk999/`, `dl_energy/`): draft amendment to Law 25/2024 and explanatory report (consultation PDFs, 23 Jun 2026); Law 24/2023 and Law 43/2015 (ERE PDFs); Civil Code newsletter.

Web (secondary unless stated; Medium):
- AI omnibus: https://www.freshfields.com/en/our-thinking/blogs/technology-quotient/eu-ai-act-unpacked-34-the-final-digital-omnibus-on-ai-key-amendments-to-the-a-102nber ; https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/ ; https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes
- Wider omnibus: https://www.alvarezandmarsal.com/node/94911 ; https://cm.twobirds.com/en/insights/2025/digital-omnibus-package-single-eu-harmonised-incident-reporting-regime-across-cyber-and-data-protect
- Law 25/2024 amendment: https://konsultimipublik.gov.al/documents/RENJK_999_Projektligji-per-disa-shtesa-dhe-ndryshime-ne-ligjin-Per--Sigurine-Kibernetike--.pdf
- Energy: https://www.ere.gov.al/doc/Law_on_energy_sector_approved_on_43.2015.pdf ; https://ere.gov.al/media/files/2024/01/31/Law_no._24_2023_On_the_promotion_of_the_use_of_energy_from_renewable_sources.pdf ; https://www.energy-community.org/dam/jcr:3e3eef90-0f2e-4140-844b-31202aceb22f/Albania_IR25CP.pdf ; https://www.energy-community.org/news/Energy-Community-News/2026/4/10.html ; https://www.infrastruktura.gov.al/wp-content/uploads/2018/10/VKM_Nr369_date_2642017.pdf
- Liability: https://www.bogalaw.com/pdf/Newsletter - Amendments to the Civil Code Of The Republic of Albania.pdf ; https://www.mondaq.com/product-liability-safety/709022/product-liability-2018-albania
- IP: https://www.aippi.org/news/new-law-on-trademarks-enters-into-force-in-albania/ ; https://www.petosevic.com/resources/news/2025/09/4906 ; https://www.lexology.com/library/detail.aspx?g=a50bed43-f639-45a6-a4a8-1176686df98e ; https://dppi.gov.al/en/ ; https://raw.githubusercontent.com/timescale/timescaledb/main/tsl/LICENSE-TIMESCALE (primary text)
- Marketing/tax: https://www.taylorwessing.com/en/insights-and-events/insights/2025/07/green-claims-richtlinie ; https://www.e-invoice.app/country/AL ; https://www.banqup.com/resources/compliance-pulse/albania

NOT fetched (memory; verify on EUR-Lex/vendor pages): GDPR Art 3 and EDPB Guidelines 3/2018; Directives 2024/2853, 2016/943, 2024/825, 2019/882; Data Act Arts 1(3), 7(1), 13, 25; Grafana, Mosquitto and current Timescale licence pages; RED/EMC/LVD/WEEE/RoHS.
