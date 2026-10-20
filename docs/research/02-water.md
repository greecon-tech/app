# 02 - Water and wastewater: desk research for the Greecon Platform

> **Desk research, October 2026. Not reviewed by a licensed expert, and not legal, engineering, agronomic or safety advice.**
> Written from public sources on the dates inside. Facts are separated from inferences in the text, and
> anything marked UNVERIFIED, recalled or "search summary" was not confirmed from a primary source. File
> names such as `src/law124.txt` refer to the researcher's working folder, not to this repository. The
> decision-ready summary of all nine reports is `docs/17-constitution.md` to `docs/26-research-register.md`.

Status: complete (all sections A to J), 2026-10-13.
Confidence legend: High = primary text read directly or multiple concordant authoritative sources; Medium = one authoritative secondary source or engineering consensus; Low = single weak source or inference. "UNVERIFIED" = not confirmed in a source I could open.

## A) What a small hotel/resort wastewater plant operator does and must prove

### A1. The Albanian trigger (primary text, High)
Normative Act no. 8 of 28.12.2023 (web/normakt8.txt, fetched from aksesdrejtesi.al) covers agrotourism, guesthouses, hostels, tourist villages, B&Bs, hotels (a building of at least 6 rooms), campsites, tourist complexes, motels, resorts, accommodation structures and "service units" (bar, restaurant, canteen) in coastal, lake-side and river-side zones that discharge untreated wastewater near or into bathing waters (Art. 2-3). They had to fit a plant or individual system within 90 days of entry into force, which was immediate (Art. 4(1), 11(2), 12); septic tanks must be replaced (Art. 4(3)); new buildings need the plant before the certificate of use (Art. 4(4), 8(5)). A Task Force under the AKUK head inspects and samples (Art. 6-7); its mandate was one year, extendable by the Prime Minister (Art. 6(2)); whether it was extended is UNVERIFIED. Penalties for having no compliant plant: by pollution load, category I (up to 50 PE) 1.5-1.85 million ALL, II (up to 180 PE) 1.9-2.2 million, III (over 180 PE) 2.4-2.65 million (Art. 8(1)); 60 days to comply, then double the fine, then a proposal to withdraw the licence or permit at season end (Art. 9). The Task Force also posts a public sign on whether a site treats its sewage (Art. 7(1)(dh); fine 100,000 ALL for hiding it).

### A2. What the operator must be able to show an inspector
1. A real plant, not a septic tank, connected through an inspection manhole (NA Art. 7(1)(a); JI Art. 8-9, 11).
2. Effluent values for its JI category at the outlet manhole, with at least the minimum samples, in the monitoring register (JI Annex 2-3, Art. 15).
3. Sludge hauled by a licensed operator under contract, with a discharge/volume schedule (JI Art. 14). With no sewer and no irrigation reuse, treated water is stored 5-7 days and emptied by licensed vacuum operators (JI Art. 11(6)-(7)). My arithmetic from JI Art. 10: 60 rooms x 3 persons x 200 L = 36 m3/d, so 5-7 days is about 180-252 m3 of storage: its level is a first-order operating signal and cost driver.
4. Under Law 9115 Art. 7, 20: staff training, operating documentation, registers, and a self-monitoring programme tied to the permit.

### A3. Plant types (engineering knowledge, Medium; JI Art. 8 prescribes activated sludge)
| Type | Principle | Signals worth recording | What breaks |
|---|---|---|---|
| Extended-aeration package plant (the JI reference) | Aeration tank plus clarifier, sludge return | DO, blower run/power, tank and sump level, SV30 (manual) | Blower, filter or diffuser failure; bulking and foam; overload at season start; scum |
| SBR | One tank cycles fill, react, settle, decant under a timer/PLC | Phase, level, DO, decant valve | Decanter or valve faults, level-sensor error, blower failure |
| MBBR | Plastic carriers carry biofilm in an aerated tank, then settling | DO, blower power | Carrier loss through screens (the recast UWWTD, Annex I Part B(5), requires permanent monitoring and reporting of biomedia releases for plants in its scope), clogged retention sieves |
| MBR | Activated sludge plus membranes, no clarifier | Transmembrane pressure, permeate flow and turbidity, air scour | Membrane fouling, chemical cleaning (hypochlorite, acid), energy and cost |
| Constructed wetland | Planted beds after settling | Flow, level | Clogging, cold-season loss; acceptability under JI Art. 8 is a regulator question |

### A4. Routine (NY DEC operator toolbox for DO about 2 mg/L; rest general practice, Medium)
- Daily, 10-20 min: blowers running, air pattern even, mixed-liquor colour and odour, foam, screens and grease trap, pumps and levels, log meter and DO.
- Weekly: SV30 settleability and sludge wasting (WAS/RAS) against sludge age, probe cleaning and calibration, pH and temperature, alarm tests.
- Monthly: blower filters, belts, oil; diffuser inspection; float tests.
- Seasonal: restart before opening (biomass starves during closure), book samples (at least 2 in summer), sludge haulage, mothballing plan.

### A5. What breaks, and hotel-specific upsets
Blower failure or fouled diffusers cause low DO, and low DO is the most-cited cause of filamentous bulking (NY DEC toolbox; utility Q&A in J); Nocardia-type foam; sludge not removed leading to solids carry-over; hydraulic or organic overload at opening; fouled or miscalibrated probes (a DO probe that reads low makes the blower run more than needed, NYWEA OpQuiz 102); overflows. Hotel loads (Medium, engineering judgement): kitchen grease against the 20 mg/l fats limit, wet wipes and rags jamming pumps, pool backwash and cleaning or laundry chemicals disturbing the biology, laundry peaks, power cuts, and a trained operator absent after the season starts.

## B) Albanian + EU compliance evidence

Reading note. Local texts are Albanian; figures are my translation. JI = Joint Instruction 1/2024 (raw/udhezim1_2024.txt); VKM = Decision 177/2005 (raw/vkm177.txt; its Annex 2-4 tables are NOT in the text file, I read them from page images raw/vkm177_png/p-27..p-31.png, low resolution: numbers High-Medium); Law = Law 9115/2003 consolidated (raw/law9115_consolidated.txt). The JI rests on Normative Act no. 8 of 28.12.2023 (Art. 2 pts 1-12 define covered entities and deadlines); that act is not in the local set (see B7).

### B1. Who is covered, and what the plant must be (JI) - confidence High on text, Medium on scope
- JI Art. 1(2)-(3): entities with economic activity in coastal, tourist, lake-shore or river-bank zones that discharge wastewater "will be monitored and inspected" by the Task Force set up under the head of AKUK (National Agency of Water Supply and Sewerage).
- Category by size (JI Annex 1): hotel/motel/B&B under 60 rooms = C, 60-200 rooms = B, over 200 = A. Resort/tourist complex/accommodation structure: 10-60 units D, 60-100 C, 100-500 B, over 500 A. Restaurant/"service unit"/agritourism/camping by dining area: under 100 m2 E, 100-250 D, 250-500 C, 500-2,500 B, 2,500+ A.
- Design load (JI Art. 10): 3 persons per room/unit, 200 L/person/day, 1 PE = 1 person = 200 L/d, service units 40 L/person/d (1 person = 0.2 PE), wastewater = 100 % of water consumed. A 60-room hotel is about 180 PE.
- Technology mandate (JI Art. 8, 11): activated-sludge plant (septic tanks must be replaced) = pre-treatment/sedimentation unit (also excess-sludge store) + biological unit (aeration, sedimentation, clear-water separation, sludge removal) + outlet control manhole that is the sampling point (Art. 9(5)-(6)). No public sewer and no discharge or irrigation: manhole sized for 5-7 days of treated-water storage, emptied by licensed vacuum operators (Art. 11(6)-(7)).
- Reuse (JI Art. 12): treated water may irrigate the complex's green areas or wash surroundings when discharge values comply. The article cites "Annex 1" (the category table); "Annex 2" is presumably meant. Flagged.

### B2. Duties and records (JI, Law)
- JI Art. 15(1)-(3), Annex 3: regular analysis of post-treatment samples; the operator MUST keep a monitoring register of analyses, open to Task Force control and to institutions on request; sampling frequency is mandatory; the Task Force also takes independent samples.
- JI Art. 14: sludge: contract with a licensed hauler plus the receiving site's contract; schedule of discharges and volumes available at all times for inspection; agricultural use only after analysis within VKM 127/2015 norms; if dried, prove final disposal.
- Law Art. 7(1): discharge only within limits; staff training; documentation of all treatment actions and processes; registers by wastewater class for quantity, content and purification; facilitate inspectors; Art. 7(2) liability for health and environmental damage.
- Law Art. 20: self-monitoring at own cost (own trained staff or contracted institutes), covering all treatment stages and the receiving environment; an individual monitoring programme (methods, frequency, sampling points scaled to plant size) is submitted with the environmental-permit application. Law Art. 18 (permit conditions) was repealed by Law 10448/2011, so the permit regime sits in that law (not read: UNVERIFIED).
- Law Art. 22-24: prohibited: discharge above limits, treatment by unlicensed persons, unsuitable or unapproved technology, any use of (untreated) wastewater. Offences include no permit, permit breach, no register of liquid discharges, monitoring not done, data not provided or published, public not informed. Fines: 100,000-300,000 ALL (register, monitoring, information), 300,000-500,000 (no permit, permit breach, plant-operation breach), 500,000-1,000,000 (uncontrolled discharge, no plant), plus temporary or permanent closure (Art. 24(2)). Art. 17: inspector orders discharge stopped until limits are met.
- VKM Ch. IV(8): dumping sludge into receiving waters is prohibited; Ch. V(9): basin councils publish biennial reports on discharges and sludge removal.

### B3. Limits and monitoring (one table)
Hotel categories A/B/C/D/E are from JI Annex 1-2. "Where" = text and condition. Frequency for hotels = JI Annex 3 (up to 50, 180, 300 and 560 PE: 4 samples per year, at least 2 in the summer season; the table stops at 560 PE, so larger plants have no stated frequency: open question).

| Parameter | Limit | Where it applies | Monitoring frequency | Online-measurable? | Lab-only? |
|---|---|---|---|---|---|
| BOD5 | JI: 20/30/40/50/200 mg/l. VKM urban plant: 25. UWWTD recast: 25 (+70-90 % reduction). Reg 2020/741 Class A: 10 | JI Annex 2; VKM Annex 4 T1 (agglomerations 2,000+ PE); UWWTD Annex I T1; Reg Annex I T2 | JI 4/yr; VKM 12/yr (2,000-49,999 PE; 4/yr after year 1 if compliant for 2,000-9,999), 24/yr from 50,000 PE; UWWTD 12/yr (1,000-9,999 PE); Reg Class A weekly | No (5-day test). Online respirometry or UV proxies only | Yes (reference lab) |
| COD | JI: 50/50/100/100/400. VKM 125. UWWTD 125 (or TOC 37) | same | same | Proxy only (UV-Vis spectral probe, TOC analyser, with site correlation) | Reference is dichromate lab method |
| TSS | JI: 30/40/50/50/60. VKM 35 (over 10,000 PE) or 60 (2,000-10,000). UWWTD 35 (optional). Reg Class A 10 | same | same; Reg Class A weekly | Proxy only (turbidity or optical SS with correlation) | Reference is gravimetric (0.45 um filter or centrifuge, 105 C) |
| Total P | JI: 2.0 (A-D) only when discharging directly into bathing waters in a listed sensitive zone (JI Art. 7(2), Annex 2 note, Annex 4). VKM sensitive zone: 2 mg/l (10,000-100,000 PE), 1 above | JI Annex 2; VKM Annex 4 T2 (annual mean, Ch. V(7)(c)) | as above | Partial (online phosphate analyser gives ortho-P, not TP) | TP is lab spectrophotometry |
| Total N | JI: 10/10/15/15 (same condition). VKM 15 (10,000-100,000 PE), 10 above | same | as above | Partial (NH4/NO3 ion-selective probes are proxies, not TN) | TN is lab |
| Fats, oils, grease | JI: 20 (A-D), 100 (E) | JI Annex 2 | JI Annex 3 | No | Yes |
| E. coli | JI: 500 (inland), 250 (coastal/transitional) cfu/100 ml, only when discharging directly into bathing waters through the entity's own collector. Reg: A 10, B 100, C 1,000, D 10,000 per 100 ml | JI Annex 2 notes; Reg Annex I T2 | JI 4/yr; Reg A and B weekly, C and D twice a month | No | Yes (culture; methods not named in JI) |
| Intestinal enterococci | JI: 200 (inland), 100 (coastal/transitional) cfu/100 ml, same condition | JI Annex 2 | JI Annex 3 | No | Yes |
| Turbidity | No Albanian limit. Reg Class A 5 NTU | Reg Annex I T2 | Reg Class A continuous | Yes (online) | No |
| pH, DO, flow | No hotel or urban limit in JI or VKM Annex 4. VKM industrial Annex 3 uses pH 6-9 (not hotel) | process indicators | none stated | Yes | No |

JI footnotes call inland waters "closed waters" (ujera te mbyllura); the 200/100 and 500/250 values match, as I recall, the "excellent" thresholds of Directive 2006/7/EC Annex I (not verified in this run). VKM compliance rule: each parameter judged separately; Table 3 allows failures (4-7 samples: 1; 8-16: 2; 17-28: 3; 29-40: 4; 41-53: 5; up to 351-365: 25) and a failing sample may not exceed the limit by more than 100 % (150 % for TSS) (Ch. V(7)-(8)); samples are 24-h flow-proportional or once per 24 h at one fixed outlet point (Ch. V(4)). VKM Annex 4 formally concerns urban agglomerations of 2,000 PE and above; for a hotel plant the JI plus the plant's own permit conditions govern.

### B4. What the EU texts add (confidence High on text; status check in B7)
- UWWTD recast, Directive (EU) 2024/3019 (OJ 12.12.2024): treatment duties attach to agglomerations: secondary treatment at 2,000+ p.e. (Art. 6(1)) and 1,000-1,999 p.e. by 31.12.2035 (Art. 6(3)). Below 1,000 p.e. national rules apply. Individual systems (Art. 4) must be registered and risk-based inspected only in agglomerations of 1,000+ p.e.; implementing acts on design, operation and maintenance are due by 2.1.2028. Annex I Part B(1): plants must be designed so representative influent and effluent samples can be taken. Part C: 24-h flow-proportional or time-based composites; 1,000-9,999 p.e. one sample a month; for seasonal activity gaps of up to two months are accepted if extra samples are taken in the season (12 per year). Equivalent alternative methods are allowed if shown equivalent; TOC may replace BOD5 if a relationship is established (Table 1 Note 1). Art. 15(1): reuse for agricultural irrigation must meet Reg 2020/741. Art. 11 energy audits start at 100,000 p.e. (31.12.2028): not a hotel duty.
- Reg (EU) 2020/741: scope is agricultural irrigation only (Art. 2(1)); hotel garden irrigation is outside it unless a state extends it. Classes A-D (Annex I T1-T3) per table above; Class A = secondary + filtration + disinfection, E. coli 10/100 ml, BOD5 10, TSS 10, turbidity 5 NTU, Legionella under 1,000 cfu/l if aerosolisation, nematodes 1 egg/l for pasture. Compliance: values met in 90 % or more of samples, deviation at most 1 log (microbes) or 100 % (BOD5, TSS, turbidity). Routine monitoring Class A: E. coli, BOD5, TSS weekly, turbidity continuous, Legionella and nematodes twice a month. Validation monitoring before start-up and after equipment changes. Art. 5 and Annex II require a Water Reuse Risk Management Plan; Art. 6 a permit stating class, use, place, yearly volume and monitoring conditions.
- Delegated Reg (EU) 2024/1765 (OJ 20.6.2024), Annex: the plan must set monitoring procedures (laboratory analysis, real-time sensors or analysers, with location and frequency), maintenance programmes for equipment "including probes for online detection", emergency procedures (treatment failure, limit exceedance, bypass or overflow) and lists "online tools, sensors and controllers that will trigger real-time alarms" among measures to consider. This is the only text read that treats sensors as part of the compliance system, and it frames them as risk-management tools, not as the legal proof.
- None of the EU acts binds an Albanian operator directly (candidate country); they are the likely benchmark for reuse and future alignment. The JI itself cites Directive 91/271/EEC and the bathing-water directive (JI Art. 4).

### B5. What a monitoring platform can and cannot evidence
- CANNOT evidence legal compliance from sensors. Every limit that binds hotels (BOD5, COD, TSS, N, P, fats, E. coli, enterococci) is judged on physical samples analysed by reference methods (VKM Annex 4 methods; JI sampling is counted in samples per year). Online COD/TSS/NH4 are proxies; equivalence needs a demonstrated correlation (UWWTD Annex I Part C(1)).
- CAN evidence: (1) the operating record that explains a result (aeration hours, DO, flow, pH, turbidity trend, desludging dates, alarms); (2) provenance of each sample (time, point, flow at that time, composite or grab); (3) the lab results themselves as signed records, with the count against the annual minimum (4 per year, 2 in summer) and a reminder before the season; (4) the 5-7 day storage level and haulage events (level sensor plus collection receipts); (5) a register export for the Task Force.
- Records an operator must keep: monitoring register of analyses (JI Art. 15(2)); sludge contracts and the discharge/volume schedule (JI Art. 14(3)-(4)); disposal proof if dried (Art. 14(5)); operating documentation and wastewater registers (Law Art. 7(1)(d), (dh)); the individual monitoring programme filed with the permit (Law Art. 20(4)-(5)); staff training (Law Art. 7(1)(ç)); under EU reuse rules, validation, routine and incident records and the risk plan (Reg 2020/741 Annex I, Art. 5).

### B6. Defects in the Albanian text to raise with the regulator
JI Art. 7(2) says total N and P apply near sensitive zones "listed in Annex 4" but the Annex 2 note says "Annex 3" (the sampling table); Art. 11(2) and Art. 12 cite "Annex 1" for discharge values (should be Annex 2); Annex 3 stops at 560 PE; the sample type (grab or 24-h composite), reference methods and laboratory accreditation are not specified; VKM's "special treatment" for agglomerations under 10,000 PE discharging to coast (Ch. IV(7)) is likely a rendering of "appropriate treatment" (UNVERIFIED).

### B7. Status checks (as of 2026-10-13)
- Normative Act 8/2023: text read (A1). NOT verified: whether Parliament converted it into a law, whether the Task Force mandate was extended, and the permit details of Law 10448/2011. Note the act's size categories I-III (50/180 PE, fines) differ from the JI's A-E (limits).
- Directive (EU) 2024/3019: in force since 1.1.2025 (Art. 34: twentieth day after publication on 12.12.2024); transposition by 31.7.2027 for Arts 2-11, 14-26 and Annexes I, III, V, VI (Art. 33); Arts 12-13 and Annexes II, IV apply from 1.8.2027 (uwwtd.txt, read). One standard web search found no 2026 amending act or omnibus change; I did not search EUR-Lex for amendments, so "no amendment found" is Medium confidence.
- Reg (EU) 2020/741 and Delegated Reg (EU) 2024/1765 (OJ 20.6.2024): texts read; I did not read their application-date articles (Reg 2020/741 applying from 26.6.2023 is my recollection: UNVERIFIED).

## C) Measurable parameters, sensors and failure modes
Evidence key: S = independent source found; V = vendor claim; E = engineering judgement, not sourced in this run (treat as Medium to Low; confirm with the sensor datasheet and a process engineer). Cost bands are rough: € under 300, €€ 300-2,000, €€€ above 2,000 per probe or meter.

| Quantity | Typical accuracy in service | Drift and fouling | Clean / calibrate | Cost | Ev. |
|---|---|---|---|---|---|
| Flow, full pipe (electromagnetic) | 0.5-2 % of reading, full pipe only | Grease on electrodes or liner; partial fill reads wrong | Clean 6-12 months; verify yearly | €€-€€€ | E |
| Flow, open channel (ultrasonic level + flume or weir) | 3-5 % at best | Dirty flume, foam, condensation | Clean flume monthly; check zero | €€ | E |
| Level (ultrasonic, radar, hydrostatic; floats for switches) | 0.1-0.5 % of range (about 5-10 mm) | Foam, condensation, grease on diaphragm | Tape check of zero and span yearly | €-€€ | E |
| Dissolved oxygen (optical) | Often 0.1-0.2 mg/L after calibration; vendor sheet: 0.5 % of value, drift under 1 %/yr | USGS river test: optical fouling drift 0-0.02 mg/L in 2-3 weeks vs 0.17-0.37 mg/L for Clark cells; sludge fouls faster | Clean 1-4 weeks; air-saturation check 1-3 months; replace sensing cap about yearly | €€ | S, V |
| pH (glass) | 0.1-0.2 pH after two-point calibration | 0.1-0.3 pH per month; junction coated by grease or biofilm | Calibrate 2-4 weeks; replace 6-18 months | € | E |
| Temperature (Pt100/Pt1000) | 0.2 C | Negligible | Yearly check | € | E |
| ORP | Relative only, 10-20 mV | Electrode poisoning, coating | Check against standard monthly | € | E |
| Turbidity (nephelometric) | 2-5 % of reading or 0.02-0.05 NTU at low range | Window fouling, bubbles, NTU vs FNU differ by instrument | Clean weekly-monthly; standards 3-6 months | €€ | V, E |
| TSS / MLSS (optical) | 5-10 % only after site calibration against lab gravimetry | Particle-type dependence, fouling | Recalibrate vs lab quarterly | €€ | E |
| Conductivity | 1-2 % | Scale, grease | 3-6 months | € | E |
| Ammonium / nitrate (ion-selective) | 5-10 % or 0.5-1 mg/L | High: membrane ageing; K+ interferes with NH4, chloride with NO3; coastal infiltration worsens it | Calibrate weekly-monthly; membranes 3-6 months | €€ | E (no source found: Low) |
| Chlorine residual (amperometric or colorimetric) | 0.05 mg/L or 5 % | Membrane or reagent upkeep, needs steady sample flow | Check vs DPD handheld weekly | €€-€€€ | E |
| Blower/pump runtime and power (CT clamp, contactor contact, kWh meter) | 1-2 % | None; CT ratio and wiring errors at commissioning | Verify at commissioning | € | E |

Take-aways: runtime and power are the cheapest, most trustworthy evidence; DO, turbidity and pH need routine cleaning that small plants rarely do; ammonium/nitrate probes and online TSS are the wrong first purchase for a hotel.

What the platform must record for any sensor-based reading:
- Sensor registry: tag, location, principle, model, serial, range, unit, installed and replaced dates (serial in and out).
- Calibration event: time, person, method and standard (lot, expiry), as-found and as-left readings, slope or offset, pass or fail, next due.
- Maintenance event: cleaned, cap or membrane or reagent changed, wiper replaced, firmware; a maintenance window that flags data and mutes alarms.
- A per-reading quality flag from a short closed list: good, suspect (implausible, stuck, jump after cleaning), bad (fault), maintenance, estimated; "no data" kept distinct from zero.
- Reference checks: handheld or lab value paired with the online value, to show bias.
- Raw and corrected value, unit, edge timestamp, and gap markers.

## D) Control and analytics: proven vs speculative; early warning; energy

### D1. Proven at small scale
| Practice | Evidence and caveats | Platform role |
|---|---|---|
| DO control of the blower by VFD | EPA fine-pore aeration design manual, as quoted by WWD magazine: automatic DO control saves 25-40 % of aeration energy, up to 50 %; the same article says anything from 0 to 50 % is realistic depending on plant, mixing limits, equipment and loading (secondhand, Medium). ORNL training deck warns VFDs may not suit centrifugal blowers. Hotel-size savings not documented (Low). Needs a clean optical probe and a blower that tolerates turn-down | Edge/PLC loop only, with fallback to fixed air on probe fault; platform shows and records. Seam, not day one |
| SBR cycle timing | Mature technology; the timer or PLC runs the phases (E) | Show phase and duration; changes only by the integrator or engineer |
| Level-based pump staging, lead-lag | Standard practice (E) | Monitor alternation, starts per hour, runtime; floats stay hard-wired |
| Scheduled desludging | Required in effect: contract plus schedule must be shown (JI Art. 14(3)-(4)) | Calendar plus trigger from SV30 or storage level; log each haulage |
| Timer-based intermittent aeration | Common in small plants (E, Medium) | Record on/off and runtime |

SPECULATIVE at hotel scale (no sound small-plant evidence found): machine-learning forecasts of BOD/COD or limit breaches; soft sensors for BOD without calibration data; cloud closed-loop control; model-predictive control; auto-tuning of SBR cycles; optimised chemical dosing; vibration-based predictive maintenance for small blowers.

### D2. Early-warning indicators and their false positives
| Indicator | Why it matters | Pitfalls (false positives) |
|---|---|---|
| Blower expected on but current or status absent | Loss of aeration; low DO within hours (E, High value) | Intentional off phases (SBR idle, timers): the alert must know the schedule |
| Blower power up at steady DO setpoint, or DO down at steady power | Fouled diffusers, clogged inlet filter, belt slip (E) | Occupancy swings, water temperature (DO saturation falls as it warms), a fouled or low-reading DO probe (NYWEA OpQuiz 102): check the probe's quality flag first |
| Effluent turbidity trending up | Solids carry-over, bulking, filter breakthrough (E, Medium) | Bubbles, window fouling (slow upward drift looks like a trend), algae in storage; turbidity is not TSS without a site correlation |
| Sludge blanket rising (interface sensor) or SV30 trend | Bulking, rising sludge (E) | Foam and bubbles fool sensors; small plants rarely have one, and SV30 by hand is the proven low-cost check |
| Pump runtime/day, starts/hour, high-level events vs occupancy | Infiltration, leaks, clogging (E) | Pump wear changes flow per hour; cleaning events; rain |
| Treated-water storage: days to full (remaining volume / daily rise) | Schedules haulage (arithmetic, High) | Foam and condensation on level sensors; irrigation draw |
Alarm hygiene (calm over chaos): require persistence, hysteresis, a maintenance mute, occupancy context, and never alarm on readings flagged suspect.

### D3. Energy
Aeration is the largest single electricity use of activated-sludge plants: 50-60 % is attributed to EPA in a 2026 Water Online column (secondhand), and LBL's tip sheet says "more than half". A 45-75 % range is commonly cited in my recollection but I could not verify it. Small extended-aeration plants without digesters probably sit at the high end (E, Low). The cheapest proven step is to record blower kWh and runtime and report kWh per m3 or per PE-day as a baseline before any DO-control claim.

## E) Pumping and distribution (brief)
Confidence Medium throughout: standard practice, IWA terminology recalled, not fetched this run.
- Pump staging: duplex lead/lag with alternation on wet-well level; booster sets by pressure (VFD constant-pressure or cascade). Platform value: alternation actually happening, starts per hour (short-cycling points to float or pressure-tank precharge faults), runtime per day, and the already-settled dry-run rule (running pump, no flow). Floats stay hard-wired.
- Pressure: the existing water.pressure.bar suffices; useful events are low-pressure and unstable-pressure periods, not transients.
- Leakage and non-revenue water: the IWA standard water balance splits system input into authorised consumption and water losses (apparent plus real); non-revenue water is unbilled authorised use plus both losses. At property level this means metered inflow vs the sum of sub-meters (irrigation, pool, kitchen, rooms). Night-flow analysis takes the minimum flow in a quiet window (about 02:00-04:00) minus known legitimate night use as the leakage estimate. A hotel never has zero night use (guests, laundry, pool top-up, tank refill, cooling, irrigation timers), so track the minimum-night-flow baseline per occupancy band and alert only on a persistent rise; it needs a meter with fine low-flow resolution (pulse of about 1 L or better). A tank level that falls with pumps off suggests a leak or a stuck float valve.
- Drinking-water side: Directive 2020/2184 defines "priority premises" (large non-household premises for public use, as identified by Member States) and requires Legionella control measures to target at least those (32020L2184.txt, Art. 2 definition and the Legionella paragraphs near lines 283, 597-599). Hotels are likely candidates in the EU; not binding in Albania. Hot-water loop temperature logging is a seam, not day one.

## F) Standards and data modelling for effluent-quality data

### F1. One observation, minimum fields (design proposal)
Site; sampling point (for example "outlet control manhole", the JI's sampling point); parameter (controlled list); value plus comparator (<, =, >) for censored lab results; unit; limit of detection or quantification when a lab reports "<"; phenomenon time (an instant, or start and end for a composite); result time; sample type (grab, 24-h flow-proportional, time-proportional); origin (online sensor, lab, field test, handheld); procedure (sensor id, or method standard and lab with accreditation); quality (flag, calibration state at the time, raw or validated); optional uncertainty; document reference (lab report id); entered-by. The legal limit, category and its source article live in a separate versioned rules table (parameter, limit, basis, article), never on the observation: limits change, measurements do not.

### F2. Standards to borrow from (not to implement in full)
- OGC SensorThings API Part 1: Thing, Datastream (unitOfMeasurement with name, symbol and definition; observed property; sensor), Observation (phenomenonTime, result, resultTime, resultQuality, parameters). Used by the USGS water-data service and described in an EC INSPIRE good-practice document with a French hydrometry example. Lightweight JSON/REST/MQTT, a good fit for edge devices (S: sources in J).
- WaterML 2.0 (OGC, built on Observations and Measurements, ISO 19156): time series with per-value quality and qualifier, interpolation and processing metadata. Best treated as an export or exchange target; I could not fetch the specification this run, so this is recollection (Medium).
- SDMX-style thinking: keep structure (dimensions: site, point, parameter; attributes: unit, method, status, detection limit) apart from code lists (parameters, units, status codes); a new parameter is a new code-list row, not a code change (design hint, no SDMX source read).

### F3. How to extend a closed vocabulary without code changes
Keep the list closed but make it data: a versioned registry of quantity kinds (key, label, quantity kind, canonical unit, allowed units with conversions, value type, plausible range, maximum rate of change, allowed origins, display precision), validated at load; code only stores, charts, thresholds and exports generically. Turbidity (NTU vs FNU depends on instrument) and cfu are procedure-defined units: store the method beside the unit. A UCUM or QUDT mapping is an optional export aid.

## G) Safety boundaries specific to water
- Overflow and high-high level: hard-wired float or relay interlocks stay with the integrator; the platform shows their state and never writes, bypasses or "acknowledges away" them. Raw-sewage overflow is a discharge offence (Law 9115 Art. 22(a), 23(ç); 500,000-1,000,000 ALL).
- Dosing and chlorination (hypochlorite, ferric chloride for phosphorus, acids for membrane cleaning): hazardous chemicals, incompatible ones release toxic gas. No remote dosing commands or set-point changes; "no dosing without flow" interlocks stay hard-wired; the platform may show dosing-pump status and tank level only.
- H2S and confined spaces: sumps, wet wells, tanks and digesters are confined spaces; H2S is heavier than air and can numb smell at high concentration. OSHA lists pits, manholes and wells as H2S build-up places; its permit-required confined-space rule is 29 CFR 1910.146 (cited by secondary sources, not read), with calibrated direct-reading multi-gas detection, ventilation and rescue. The Albanian equivalent is UNVERIFIED. The platform must never display "safe to enter" or authorise entry from remote data; a fixed H2S detector may feed an alarm but the local horn and beacon stay hard-wired.
- Remote start/stop and lock-out: no remote start of a machine under local control or lock-out; honour the local "remote enable" selector; a maintenance mode disables start commands but a stop is never blocked (settled rule).
- Reuse irrigation: spraying treated effluent can aerosolise pathogens and Legionella near guests (Reg 2020/741 Class A sets Legionella below 1,000 cfu/l where aerosolisation is possible). The platform must not decide when effluent may be used for irrigation.
- Never automate: bypass or overflow gates; sludge-valve or tanker loading; aeration shut-down; chemical dosing; disinfection set-points; resets of faults that need inspection; alarm suppression outside a logged maintenance window; any statement that the effluent "complies" based on sensors.

## H) Implications

### (i) Must exist from day one (proven need)
1. Lab-result register (a record type, not a time-series point). Fields per F1; parameters preloaded from JI Annex 2 (BOD5, COD, TSS, total N, total P, fats/oils/grease, E. coli, intestinal enterococci) plus field pH and temperature; comparator and limit of quantification; sample type; sampling point; lab and method; report attachment; append-only, corrections as new versions with a reason. Show "samples this year vs minimum (4, at least 2 in summer)" and the reference limit with its article, with a standing note that it is a reference value and the platform does not certify compliance. Evidence: JI Art. 15(2), Annex 3; Law 9115 Art. 23(e), (ë), (f) fines.
2. Site profile (configuration): JI category A-E from rooms or units (rooms x 3 = PE), discharge route (public sewer, coastal bathing water, inland bathing water, storage and haulage, irrigation), sensitive-zone flag (N and P apply), plant type, permit references. Limits live in a versioned rules table with source article.
3. Operating records (events, not points): haulage or desludging (date, m3, licensed hauler, receipt), sample taken, sensor calibration, sensor maintenance, sensor replaced. Evidence: JI Art. 14(3)-(4), Art. 11(6)-(7); Law Art. 7(1)(d).
4. Reuse existing points with a role tag instead of new names: water.tank.level.percent for influent sump, aeration tank and treated-water storage (high and high-high thresholds as display only); water.flow.lpm for effluent and inflow; water.pump.status and .command for lift or transfer pumps where the integrator enabled remote control. No command on blowers, dosing or valves.
5. Three new points only: aeration blower status (run, stop, fault), blower power or energy (reuse an energy-domain point if one exists), and dissolved oxygen in mg/L, the last only where a probe is already fitted. Names in the existing style, as proposals: water.aeration.blower.status, water.aeration.blower.power.kw, water.process.do.mgl. Reasons: aeration is the largest energy use and the main failure point (D3, A5); status and power are the cheapest trustworthy evidence; DO has the best independent evidence (C, D1).
6. A per-reading quality flag (good, suspect, bad, maintenance, estimated) on the new sensor points; "no data" distinct from zero; "last calibrated n days ago" shown.
7. Five alarms only, decided at the edge: blower stopped while the plant should be aerating; treated-water storage high, with days-to-full; sump high-high (hard-wired float contact read as status); sustained low DO while the quality flag is good; sample due before and during the summer.
8. Honest wording in the hotel guide: "records lab results and operating evidence; online sensors are indicators, not proof; does not certify compliance".

### (ii) Seams for later
| Seam | Extension point | Evidence that would prove the need |
|---|---|---|
| Registry-as-data for quantity kinds (F3) | Versioned registry plus generic handlers | Three or more parameter requests in a quarter, or an integrator needing custom points |
| Online pH, turbidity, ORP, conductivity, temperature | Registry entries | A permit or a customer with MBR or reuse requires them; sites log calibrations on time |
| DO-based blower control | Edge rule with limits and fallback; guarded command channel | VFD blower and clean probe on site; a season of kWh and DO data showing over-aeration; engineer-approved set-points |
| Reuse records (Reg 2020/741-style classes, validation, risk plan, incident log) | Class field on the register plus plan document | Albania adopts classes or a permit requires them; hotels irrigating with effluent |
| Lab import | CSV or XML importer into the register | Two or more labs deliver structured results |
| Authority export | Export template | AKUK or the ministry publishes a template or portal |
| Ammonium, nitrate, MLSS, sludge-blanket probes | Registry entries | Sensitive-zone customers with N limits and a proven maintenance routine |
| Anomaly detection on blower power, DO, turbidity | Analytics on registry data | A full season from about 10 plants, maintenance logs as labels, measured false-alarm rate |
| Night-flow leak detection | Derived metric on water.flow.lpm | Sub-metered sites with a baseline and confirmed leaks |
| Hot-water Legionella temperature logging | New points | EU-aligned customer demand |

### (iii) Things to avoid
- Any compliant or non-compliant badge, or a "predicted breach", computed from sensor data.
- Remote commands on blowers, dosing, valves or bypass; cloud-dependent safety; automatic restart after a fault.
- Free-text parameter names or per-site units; Albanian limits hard-coded (the JI has numbering errors and may change).
- Overwriting lab results; treating proxies as equivalents (turbidity as TSS, UV as COD) without a site correlation.
- Alarm floods and SCADA-style plant graphics: one "plant OK / needs a person" status and five alarms are enough.
- Recommending ion-selective or online TSS probes to hotels, or selling any sensor without a cleaning and calibration routine.
- Any "safe to enter" or entry-permit function.

## I) Open questions for a licensed process engineer / the regulator
Regulator (AKUK Task Force, Ministry of Tourism and Environment, environment agency):
1. Was Normative Act 8/2023 converted into law, and was the Task Force mandate extended past one year? Are existing hotels still within the 90-day duty, and are inland (non-water-side) hotels covered?
2. JI Annex 3: grab or 24-h composite samples; who may sample (operator, accredited lab, Task Force); required reference methods and lab accreditation; report format, submission channel and retention for the monitoring register.
3. Sampling frequency above 560 PE (200-room hotels are about 600 PE). Are limits judged per sample or by an annual failure allowance as in VKM 177 Table 3? With 4 samples a year, is one exceedance a breach?
4. Cross-reference errors: JI Art. 7(2) vs the Annex 2 note (sensitive zones in Annex 3 or 4); Art. 11(2) and Art. 12 citing Annex 1.
5. Which limits apply where treated water goes to a public sewer, to storage and haulage, or to irrigation (JI Art. 12; Law 9115 Art. 22(dh))? Any disinfection or aerosol rules for irrigation?
6. Is an environmental permit and monitoring programme (Law 9115 Art. 20; Law 10448/2011) required for hotel plants, and from which authority? Are online data or flow metering accepted as supporting evidence?
7. Are SBR, MBBR, MBR and constructed wetlands accepted as "activated sludge" under JI Art. 8?
8. Albanian confined-space and operator-qualification rules (UNVERIFIED).

Process engineer:
9. Can small package plants hold COD 50 mg/l and BOD5 20-30 mg/l under seasonal loading, and is filtration needed? Which disinfection (UV or chlorine) meets E. coli 250 per 100 ml, with what residual limits?
10. TN 10-15 mg/l and TP 2 mg/l in sensitive zones: configuration, alkalinity, carbon, chemical P dosing and its safety implications.
11. Seasonal closure and restart: acceptable idle time, keep-alive aeration, restart procedure.
12. Blower type and VFD turn-down limits; sensible DO set-points; minimum viable instrumentation (blower current, level, DO).
13. Hotel inhibitors (pool backwash, cleaning agents, laundry) and grease-trap sizing; confirm the JI sizing (3 persons per room, 200 L/person/day, 5-7 days storage).

## J) Source list
Confidence: High for the primary texts read; Medium for items marked as search summaries; Low where marked E in C and D.

Local primary (all under ):
- raw/udhezim1_2024.txt: Joint Instruction no. 1 of 1.2.2024 (Art. 1, 4, 7-12, 14-15; Annexes 1-4). High.
- raw/vkm177.txt and raw/vkm177_png/p-27 to p-32.png: CoM Decision 177/2005 (Ch. II-V in text; Annex 3 industrial limits p-27/28; Annex 4 urban tables p-29 to p-31 read from low-resolution images; Annex 5 p-31/32). High for text, Medium-High for table figures.
- raw/law9115_consolidated.txt: Law 9115/2003 (Art. 7, 11, 17, 20-24). High.
- web/normakt8.txt: Normative Act 8/2023, text extracted from the PDF at https://aksesdrejtesi.al/dokumenta/1705664662akt-normativ-2023-12-28-8%20(1).pdf (not compared with the Official Gazette). Medium-High.
- raw/uwwtd.txt: Directive (EU) 2024/3019 (Art. 2-6, 11, 15, 33-34; Annex I). High.
- raw/32020R0741.txt: Regulation (EU) 2020/741 (Art. 2, 5, 6; Annex I). High.
- raw/32024R1765.txt: Delegated Regulation (EU) 2024/1765 (Annex, monitoring and emergency parts). High.
- raw/32020L2184.txt: Directive (EU) 2020/2184 (priority premises, Legionella; searched by keyword only). Medium.

Web (search summaries unless stated; titles as returned):
- Normative Act and JI entries: https://leap.unep.org/en/countries/al/national-legislation/normative-act-no-8-dated-28-december-2023-taking-urgent-measures ; https://leap.unep.org/en/countries/al/national-legislation/instruction-no-1-dated-1-february-2024-approval-technical (JI published in Official Gazette 27/2024 on 13.2.2024 per the summary).
- EU act status: https://www.eumonitor.eu/9353000/1/j9vvik7m1c3gyxp/vmjpsg06o1yj ; https://leap.unep.org/en/countries/eu/national-legislation/directive-eu-20243019-concerning-urban-wastewater-treatment
- Aeration energy: https://www.wateronline.com/doc/rethinking-aeration-demand-based-do-control-and-energy-optimization-0001 (50-60 %, EPA attributed) ; https://industrialapplications.lbl.gov/sites/default/files/2023-08/Tipsheet%203%20-%20Optimize%20Dissolved%20Oxygen%20-%20Final.pdf ; https://www.wwdmag.com/wastewater/automatic-aeration-control-saves-money (EPA fine-pore design manual, 25-40 %) ; https://bptraining.ornl.gov/wp-content/uploads/2021/09/11-Aeration-Systems.pdf (VFD and centrifugal blowers). The primary EPA document was not located.
- Operations: https://dec.ny.gov/environmental-protection/water/water-quality/wastewater-treatment-resources/plant-operation/operator-toolbox ; https://nywea.org/wp-content/uploads/2024/05/OpQuiz_102.pdf (training exercise, weak source).
- Sensors: https://pubs.usgs.gov/of/2006/1047 (optical vs Clark-cell DO, river water, 2006) ; YSI WQ-FDO specification sheet (vendor claim). No source found for ion-selective electrodes.
- Data standards: https://labs.waterdata.usgs.gov/docs/sensorthings/about-sensor-things-pbs-api ; https://wikis.ec.europa.eu/download/attachments/65700040/OGC%20SensorThings%20API%20INSPIRE%20Good%20Practice_V4.pdf?api=v2 ; https://sensorup.atlassian.net/wiki/spaces/SPS/blog/2015/11/07/17301576
- Safety: https://osha.gov/hydrogen-sulfide/hydrogen-sulfide-workplaces (via summary); 29 CFR 1910.146 cited, not opened.

Not fetched this run (recollection, flagged in text): IWA water-balance terminology, WaterML 2.0 specification, Directive 2006/7/EC thresholds, Law 10448/2011, WEF/EPA 45-75 % aeration range.
