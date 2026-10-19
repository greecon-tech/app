# 01 - Energy-systems desk research for the Greecon Platform

> **Desk research, October 2026. Not reviewed by a licensed expert, and not legal, engineering, agronomic or safety advice.**
> Written from public sources on the dates inside. Facts are separated from inferences in the text, and
> anything marked UNVERIFIED, recalled or "search summary" was not confirmed from a primary source. File
> names such as `src/law124.txt` refer to the researcher's working folder, not to this repository. The
> decision-ready summary of all nine reports is `docs/17-constitution.md` to `docs/26-research-register.md`.

Run date: 2026-10-13. Status: COMPLETE for sections A-J as of 2026-10-18 (A-D written 2026-10-13; E-J written in a continuation run on 2026-10-18).
Confidence legend: High = primary/official source read directly; Medium = reputable secondary source or partial verification; Low = single weak source, inference, or recalled without re-verification. "UNVERIFIED" = not checked in this run.
Scope note: Albanian licensing / prosumer law is NOT repeated here; see 05-legal.md section G.

## A. What small/mid PV operators and commercial energy users need to know and do (daily/weekly)

Evidence: NREL, *Best Practices for O&M of PV and Energy Storage Systems*, 3rd ed. (docs.nlr.gov/docs/fy19osti/73822.pdf; read this run; High for what it says, but US/fleet-oriented) plus engineering synthesis (Medium, marked). The core finding: an operator does not want KPIs, he wants four answers: *is it running, did it make what it should, what is wrong, what do I do next?* Anything that cannot answer "what next" is decoration.

**A1. Questions the home screen must answer (ranked), the data behind each, and how strong the answer can honestly be**

| # | Operator question | Data that answers it | Honest strength |
|---|---|---|---|
| 1 | Is it running right now (and is my view live)? | inverter state + AC power vs sun elevation; "last seen" age of every source | Strong. NREL warns that instant comms-loss alerts are a known source of false alarms ("communications might be quickly restored"): show age, alert only after a grace period |
| 2 | How much did I make today/week/month? | AC energy counter (not integrated power) | Strong |
| 3 | Is anything faulted, derated or limited? | inverter status + alarm/fault code, temperature derating, export-limit/grid-limit active, DSO curtailment order (Law 24/2023 Art 17, see 05-legal.md G) | Strong *if the device reports it*; label "reported by inverter" |
| 4 | Did it make what it should have? | expected energy needs irradiance (sensor or satellite) | Weak without irradiance (see B). Peer comparison between inverters/strings of equal orientation is strong; plant-wide uniform loss is invisible |
| 5 | Is it dirty / time to clean? | soiling = ratio drift between rains; ideally a soiling sensor | Weak. NREL: typical ~0.05 %/day (0.01 %/day desert, 0.36 %/day heavy agriculture, up to 0.5 %/day heavy bird load; annual 4.3-7.5 % in the studies it surveys); rain resets it, so "dirty" is a cost-benefit judgement. Show a trend and a reminder to look, never "soiling = x %" |
| 6 | Do my bill/net-billing statement and my meters agree? | import/export energy counters from own check-meter; reading dates aligned with DSO cycle | Strong for own meter vs bill; DSO billing meter stays the legal reference (Law 43/2015 Arts 76-77; read access to DSO data NOT verified, see 05-legal.md G). Press reports a move from net metering to net billing from 1 Jan 2027 (UNVERIFIED: official decision not located); settlement checks get *more* valuable then |
| 7 | Battery: state, cycling, health? | SoC, power, BMS alarms/temperature, throughput; SoH only if BMS reports it | Strong for SoC/power; SoH is the BMS's estimate |
| 8 | (Hotel/farm) What is my load doing; how much solar do I use? | consumption, import/export, self-consumption/-sufficiency, peak import | Strong if a consumption meter exists; otherwise derived (and fragile with a battery) |
| 9 | Can I show the lender/regulator what the plant did? | monthly production, availability, (PR only with sensors) | Claim only what the data supports (B5) |

**A2. Cadence that real O&M follows (NREL tables and text; High for the listed items, Medium for my daily/weekly framing)**
- *Daily glance (minutes):* status, alarms, comms age, today's energy. *Weekly:* production vs expectation. NREL: report "lower-than-forecasted energy correlated to local weather ... on a weekly or monthly basis. Using intervals smaller than a week increases the possibility of false positives and usually does not provide business value" and keep 6 months of logger data with cloud backup. *Monthly:* meter/energy log (NREL task "maintain a log of cumulative power delivery", monthly), billing check. *Quarterly:* battery ventilation/filters. *Annual:* thermography, visual/corrosion, inverter service; 5-yearly torque checks.
- *Instrument upkeep:* pyranometers need cleaning and recalibration about every 2 years; module-temperature sensors fail by detaching or by bad placement (NREL). A platform that depends on a sensor must therefore also track sensor health, or it will report false underperformance.
- *Practical constraints (NREL, High):* many site owners will not let the monitoring system use the site network, so cellular backhaul is often required; the monitoring must tolerate gaps and backfill.
- *Balkan relevance (Low, my inference, test with data):* dry summers should accumulate soiling until the first autumn rains; a seasonal reminder is a cheaper first answer than an estimate.

## B. Standard KPIs: precise definitions, required data, what can be computed without an irradiance sensor

Sources read this run: Dierauf et al., *Weather-Corrected Performance Ratio*, NREL/TP-5200-57991 (docs.nlr.gov/docs/fy13osti/57991.pdf, High); NREL O&M guide above (High); Hukx application notes on IEC 61724-1:2021 (vendor, Medium); EU Regulation 2023/1542 text (EUR-Lex, High, read in the earlier run and re-grepped). **The text of IEC 61724-1:2021 itself is paywalled; its numeric accuracy limits per class are UNVERIFIED here.** IEC webstore (publication 65561, abstract read in the earlier run, Medium-High): Ed. 2.0 of 2021-07-21 replaces the 2017 edition; Class C was removed, so only Class A (high accuracy, utility/large commercial) and Class B (medium, rooftop/small-mid commercial) remain (confirmed by Hukx).

**B1. Definitions** (P0 = installed STC nameplate kWp, ideally flash-test sum; G_STC = 1 kW/m2; sums over the period; use energy counters, not integrated 1-min power)

| KPI | Formula | Needs | Notes |
|---|---|---|---|
| Specific yield (final yield Yf) | `Yf = E_AC / P0` [kWh/kWp] | AC energy counter, P0 | NREL "specific performance". Weather-confounded: not a quality metric |
| Capacity utilisation factor | `CUF = E_AC / (P_rated * hours)` | AC energy, stated capacity basis | A capacity factor, not an IEC 61724-1 KPI (Indian practice; Medium, not fetched). State AC- or DC-capacity basis; DC/AC ratio shifts it |
| Reference yield Yr | `Yr = H_POA / G_STC`, `H_POA = sum(G_POA*dt)` [h] | plane-of-array irradiance | reference cell or pyranometer |
| Performance ratio | `PR = Yf / Yr = sum(E_AC) / sum(P0*G_POA/G_STC*dt)` | AC energy + POA irradiance | Dierauf Eq.1. New systems typically 0.6-0.9; seasonal swing up to +-10 % because power moves about -0.5 %/degC |
| Temperature-corrected PR | `PRcorr = sum(E_AC) / sum(P0*(G_POA/G_STC)*(1+gamma*(Tcell_i - Tref))*dt)` | + module/cell temperature, gamma from datasheet | IEC 61724-1:2021 corrects to 25 degC (`Ck = 1+gamma*(Tmod-25)`, via Hukx; exact clause UNVERIFIED). NREL: correcting to 25 degC *overstates* performance, so it uses Tref = site annual irradiance-weighted mean cell temperature (modelled), Eq.2/8/9. Corrects temperature only, not soiling/snow |
| Availability | time-based `At = t_operating / t_eligible` (eligible = sun above horizon threshold); energy-based `AE = E_exp(operating) / E_exp(all)` | inverter state; AE additionally weather data, inverter/block level | IEC 61724-3 per NREL; "operating" = MPP tracking and feeding the grid; exclude events outside management control (grid outage, curtailment) when contractual. IEC 63019 (availability information model) was a draft in the NREL text: final status UNVERIFIED |
| Performance index | `PI = E_actual / E_expected(measured weather, agreed model)`; "in-service" variant excludes non-operating time | irradiance, Tamb, Tmod/wind, model | NREL: PI is more consistent than PR across seasons/sites; ideally about 1. Power-based capacity test is IEC TS 61724-2, energy-based IEC TS 61724-3 |
| Self-consumption | `SC = (E_gen - E_exp) / E_gen` | PV generation and export counters | share of PV used on site (directly or via battery). Standard literature definition (Luthander et al. 2015, Applied Energy 142; not re-fetched, Medium) |
| Self-sufficiency | `SS = (E_gen - E_exp) / E_load` | + load (metered or `E_gen+E_imp-E_exp+E_bat_dis-E_bat_chg`) | equals `1 - E_imp/E_load` only if the battery never charges from the grid: define the boundary in the UI |
| Round-trip efficiency | `RTE = E_dis_AC / E_chg_AC` over windows with SoC_end about SoC_start (or add the change in stored energy) | battery AC-side charge/discharge energy counters | system RTE includes inverter and standby; power-sample integration drifts, so prefer counters |
| SoC / SoH | SoC = BMS-reported %. SoH = remaining capacity / rated capacity, as reported by the BMS | BMS registers | NREL: full SoH needs capacity, resistance, self-discharge tests, beyond most operators. Reg. (EU) 2023/1542 Art 14 + Annex VII: from 18 Aug 2024 stationary BESS BMS must hold SoH (remaining capacity; where possible remaining power capability; remaining RTE; self-discharge trend; ohmic resistance) and expected-lifetime data (throughput, full equivalent cycles, harmful events), with read-only access for the purchaser *and third parties acting on his behalf*. Albania is not bound; applies to batteries placed on the EU market (Medium) |
| Grid import/export | two separate monotonic kWh counters at the point of connection | bidirectional meter | power points are for display only |

*Accuracy classes (recalled, not fetched; Medium/Low, verify):* active-energy meters IEC 62053-21 class 1/2, IEC 62053-22 class 0.5S/0.2S, EU MID EN 50470-3 class A/B/C; current transformers IEC 61869-2 class 0.5/0.5S/1. For irradiance, the Dierauf test protocol (an acceptance test, *not* IEC 61724-1) targets reference-cell uncertainty 3 %, ambient +-1 degC, module temperature +-1 degC, one-minute scan; NREL says most pyranometers need recalibration every 2 years.

**B2. What can be said without an irradiance sensor, and how weak it is**

| Metric | Without sensor | Honest label |
|---|---|---|
| Energy, specific yield, CUF, self-consumption/-sufficiency, import/export, battery throughput/RTE | yes (meter-limited) | exact numbers, but "production", never "performance" |
| Time-based availability | yes (inverter state + solar-elevation formula) | good; energy availability is not defined |
| Inverter-to-inverter / string-to-string normalised yield | yes if same orientation and shading | strong for *relative* faults; blind to uniform loss (soiling, degradation, grid curtailment of all units) |
| Expected energy from satellite/NWP irradiance + modelled cell temperature (PVGIS, CAMS, Open-Meteo, see D) | yes | irradiance error is far above a sensor's 3 % at hourly/daily scale and shrinks over months; a 3 degC cell-temperature error alone is about 1 % (3 x 0.4 %/degC, arithmetic). Show "estimated weather, +-range", treat small gaps as noise (threshold to calibrate on real sites; Low) |
| Power vs clear-sky model on detected clear periods | yes (coordinates, tilt, azimuth, P0) | catches large persistent shifts only; aerosol, model and soiling errors are confounded (see E) |
| IEC 61724-1 PR / temperature-corrected PR, PI, energy availability, absolute soiling %, degradation %/yr | no | do not display as such; at most an "indicative trend" |

**B3. Claims ladder for stakeholder/regulator evidence (the existing PV guide's promise should be worded to this):** Level 0, meters only: energy delivered with the meter's class, specific yield, time-based availability. Level 1, plus modelled weather: estimated PR/PI with range and weather source. Level 2, plus on-site POA irradiance and module temperature with documented class, calibration and cleaning: PR and temperature-corrected PR "per IEC 61724-1 Class B" (Class A needs a stricter instrument set; check the standard).

## C. Data and protocols (SunSpec, vendor Modbus maps, smart meters, IEEE 2030.5, IEC 61850-7-420) and what a driver/semantic layer must handle

**C1. Priority (inference, Low: no Balkan market data found).** Searches returned only global rankings: Wood Mackenzie H1 2025 puts Huawei and Sungrow first and second, then SMA, Fronius, Ginlong Solis (pv-magazine-usa.com/2026/01/05/huawei-sungrow-lead-wood-mackenzies-inverter-market-ranking/, Medium). Order for a read-only Modbus TCP driver: (1) **SunSpec auto-discovery** (one driver, many brands); (2) **Huawei SUN2000** map; (3) **Sungrow**; (4) **Modbus energy meters** (Eastron SDM, Carlo Gavazzi EM, Chint DTSU666, Janitza) for grid point and check-metering; (5) **Victron GX** for hybrid/off-grid sites (hotels, farms). Later: Growatt/Solis/GoodWe/Deye. **Not now:** DLMS/COSEM (IEC 62056; DSO-owned meters, optical/serial ports, no verified read access, see 05-legal.md G), IEEE 2030.5 (TLS/XML DER interface used by California Rule 21 and Australian CSIP; no Balkan DSO requirement known; recalled, Low), IEC 61850-7-420 (DER logical nodes for utility SCADA gateways; irrelevant to small operators; recalled, Low). A 1-day survey of 5 Albanian installers would replace this inference.

**C2. SunSpec facts (verified in the SunSpec reference library `pysunspec2/sunspec2/mb.py`, High; model list from github.com/sunspec/models/tree/master/json, High but listing truncated)**
- Default base address 40000, marker "SunS" = 2 registers; **everything is big-endian incl. 32/64-bit and float32 (high word first)**; scale factors (`sunssf`) are int16, applied as value x 10^SF and may change at run time (Fronius manual, notes) so re-read them.
- **"Not implemented" sentinels:** int16 0x8000; uint16/enum16/bitfield16 0xFFFF; int32 0x80000000; uint32/enum32/bitfield32 0xFFFFFFFF; int64 0x8000...; uint64 0xFFFF...; acc16/acc32/acc64 = 0; float32 NaN (0x7FC00000); float64 NaN; string first byte NUL; sunssf 0x8000.
- Models present: 1 (common); **101/102/103** (integer inverter: single, split, three-phase); **111/112/113** (float inverter); 120-123 (nameplate, settings, status, immediate controls), **124 storage**; 160 (multi-MPPT: per-input DC values, useful for string checks); **201-204** (integer meter: single, split, wye, delta) and 211-214 (float); 302-308 (irradiance, back-of-module temperature, inclinometer, GPS, reference point, met); 701-713 DER models. 714/715 and 801-806 (battery models, incl. 802) were not visible in the truncated listing: UNVERIFIED here (Medium from memory that 802 is the battery base model).
- Real devices implement subsets: SMA's profile 2.0 uses the 700-series, calls the 100-series outdated, and does not support 124 (SMA TI SunSpecModbus-TI-en-11.pdf, read this run, High).

**C3. Vendor maps: only what was read in the saved vendor documents (read this run unless marked "notes")**

| Vendor | Verified facts | Gotchas for the driver | Conf. |
|---|---|---|---|
| Huawei SUN2000 | *Modbus Interface Definitions V3.0, Issue 01, 2023-01-17* (mirror of the vendor doc). Proprietary map; each register has type and **gain**: 32016 PV1 voltage I16 V x10; 32064 input power I32 kW x1000; 32080 active power I32 kW x1000; 32089 device status (enum), 32090 fault code; 32106 cumulative energy U32 kWh x100; 32114 daily energy U32 kWh x100; 32-bit values take 2 registers; Modbus-TCP framing documented | gain differs per register; daily counter resets; Modbus-TCP on the dongle must be enabled by the installer and storage/meter registers are in a separate range (both recalled, UNVERIFIED here) | High (map), Low (access) |
| Sungrow (residential hybrid doc V1.1.11, 2025-11-17, mirror) | **U32/S32 are little-endian by word (low word first)**; register address = documented minus 1; unavailable: U16 0xFFFF, U32 0xFFFFFFFF, S16 0x7FFF, S32 0x7FFFFFFF; EMS mode 13050 (0 self-consumption, 2 forced, 3 external EMS, 4 VPP); external-EMS heartbeat 13080 (default 20 s); feed-in limit 13074/13087/13088; RW registers must not be polled/set frequently via WiNet-S; document says not for distribution to third parties | different sentinels and word order from SunSpec; string-inverter families use other documents (not read); check redistribution terms before shipping a map | High (this doc) |
| SMA | Modbus is **off by default**; unit ID = SMA ID + 123; no password once enabled; cyclic writes destroy flash except a short list of registers (model 123: Conn, WMaxLimPct, OutPFSet, VArWMaxPct, VArMaxPct; 704 equivalents) | enabling it is a customer security decision | High |
| Fronius (manual, earlier-run notes, Medium) | TCP unit 1, meter unit IDs 200-204; float (111-113) vs integer+SF (101-103) setting shifts addresses; control has priority rules and a revert timer; sequential requests, at most 2 parallel, timeout >= 1 s | discover models, never hard-code offsets | Medium |
| Victron GX (notes, Medium) | Modbus-TCP; unit ID selects the device (system = 100); register list `CCGX-Modbus-TCP-register-list.xlsx` in github.com/victronenergy/dbus_modbustcp; scaling per register | one GX exposes many services | Medium |
| SolarEdge | official SunSpec/power-control notes partly gated | UNVERIFIED; do not promise | Low |

Modbus meters (Eastron SDM630/SDM120, Carlo Gavazzi EM24/EM340, Chint DTSU666, Janitza UMG): I could not verify any register map this run. Recall (Low): RS-485 RTU behind a gateway, float32 or scaled integers, function code 3 vs 4 and word order differ by brand. Treat each as a **device profile** (function code, address base, type, word order, scale, sign convention) tested against a known load, never as a family default.

**C4. What the semantic layer must handle**
1. **Units/scale:** apply per-register gain or SunSpec SF; publish canonical kW/kWh/%.
2. **Types, sign, address base:** signed vs unsigned; battery and grid sign conventions differ by vendor (store per-profile "positive means charge/import"); documented-address vs wire-address off-by-one (Sungrow verified, Fronius notes).
3. **Word/byte order** per profile; plausibility self-test at commissioning (e.g. energy counter non-decreasing, power within nameplate).
4. **Sentinels to null, not zero**, with quality "not available" (note acc = 0 legitimately means "not accumulated").
5. **Quality and age on every point** (good/stale/not available/out of range/comms lost); inverters sleep or lose comms at night, so offline-at-night is normal and must be read against sun elevation.
6. **Energy counters over power:** use daily/lifetime counters for energy (handle midnight reset, rollover, device replacement); power is for display. Read multi-register values in one request to avoid torn reads (engineering practice, Medium).
7. **Device limits and flash wear:** pace requests; no periodic writes (SMA and Sungrow documents). A future write path needs allow-listed registers, rate limits, heartbeat/revert timers (Sungrow 13080, Fronius), and inverter-side protection that always wins.
8. **Identity and nameplate** (serial, model, rated power) captured at discovery; time source and DST for daily counters.

## D. Control and optimisation: proven vs speculative; forecasting and free data; why the 1.5 kW surplus constant is unsound

**D1. Proven vs speculative for small systems**

| Function | Status | Evidence | Runs where / Greecon's role |
|---|---|---|---|
| Export limiting / zero export | **Proven, mass-market** | built into inverters with a grid meter: Sungrow feed-in limit 13074/13087/13088 (W or ratio; ratio takes precedence), SMA model 123 `WMaxLimPct`, Fronius dynamic power reduction (vendor docs read, see C3) | inverter-side closed loop. Greecon *reads* "limit active" and the setpoint and reports curtailed energy; it does not run the loop |
| Self-consumption maximisation with battery | **Proven; vendor default** (Sungrow EMS mode 0 = self-consumption) | Sungrow doc (read) | inverter/BMS. Greecon reports self-consumption/-sufficiency (B1) |
| Solar-window loads (irrigation/pumping, water heating, EV, cold-store pre-cooling) | **Proven pattern**: start threshold + delay + stop threshold + delay | evcc documentation (docs.evcc.io/en/features/solar-charging, via search summary, Medium): enable threshold (default 0 W: export must reach the load's minimum power), enable delay default 1 min, disable threshold/delay (example 10 min), minimum charge power from IEC 61851 6 A: 1.4 / 2.8 / 4.1 kW for 1/2/3 phases, plus a residual-power offset | local controller with hard interlocks. First candidate for a *recommendation*, later a supervised command |
| Peak shaving with battery | Proven where a demand/capacity charge exists | recalled (Low). Whether Albanian 0.4 kV business customers pay one is UNVERIFIED; 10 kV deregulated Jan 2025, 6 kV Jan 2026 (EC 2025 Report via 05-legal.md G) | seam; verify tariffs first |
| Tariff-aware battery dispatch | Conditional on a time-varying retail tariff | none verified for small Albanian customers; ALPEX day-ahead (wholesale) operating since April 2023 (ERE/ERRA presentation, earlier-run notes); the 2026 draft electricity law mentions dynamic pricing (press, UNVERIFIED) | seam |
| Forecast-driven MPC | **Speculative** here | value needs a flexible load or battery whose decision hinges on the forecast; no field evidence gathered | seam |
| Trading, aggregation, VPP, P2P | **Speculative and legally gated** | no licence category for aggregation; do not pool and dispatch without ERE/counsel (05-legal.md G) | avoid |

**D2. Forecasting approach and free data (licence terms)**
Layering that matches the evidence: clear-sky model (open-source, e.g. pvlib; recalled) as the baseline; NWP day-ahead irradiance/cloud/temperature for planning; short-term persistence of the clear-sky index (recalled, Low). Build it only when a decision depends on it; for the monitoring baseline a modelled-weather estimate is enough.

| Source | Terms | Verified |
|---|---|---|
| Open-Meteo API (NWP forecast, historical) | Free API "only for non-commercial purposes"; commercial examples include "websites or apps that have subscriptions or display advertisements"; free limits <10,000 calls/day, 5,000/hour, 600/minute, 300,000/month; paid plans (Standard/Professional/Enterprise) for commercial use, price not on the terms page; data under CC-BY 4.0; "without any warranties", no SLA; self-hosting not addressed on the page | High (open-meteo.com/en/terms, read). **A SaaS must buy a plan or self-host: decide before building on it** |
| PVGIS (EU JRC): typical year, hourly historical radiation, PV yield | JRC catalogue: reuse authorised provided the source is acknowledged, no registration; software under EUPL 1.2; API rate limits and explicit commercial terms not found | Medium (data.jrc.ec.europa.eu entry, via search) |
| CAMS Radiation Service / EUMETSAT CM SAF; DWD ICON, ECMWF open data, NOAA GFS | recalled: free/open with registration or attribution; terms not checked | UNVERIFIED |
| Solcast, Solargis, Meteomatics | commercial, with SLAs; free tiers are non-commercial (recalled) | UNVERIFIED |

**D3. Why "surplus available = solar - consumption > 1.5 kW" is not a sound state**
1. *Scale:* 1.5 kW is 30 % of a 5 kW farm plant and 0.3 % of a 500 kW plant (the Law 24/2023 ceiling for self-producers). One constant cannot mean the same thing across the target range. It resembles a single-phase 6 A charger minimum (1.4 kW, IEC 61851 via evcc), i.e. an EV-charger number, not a plant property.
2. *It is not tied to a decision.* Surplus matters relative to a load that can use it (a 4 kW pump needs 4 kW, not 1.5).
3. *It ignores the controlled load itself:* when the pump starts, consumption rises and "surplus" collapses, so the state flaps. The load's own draw must be added back.
4. *Battery and limits are invisible:* charging power already "uses" surplus; a full battery turns it into export; under zero-export or curtailment, measured PV is cut to match the load, so "solar - consumption" is about 0 while headroom is large. Needs the battery policy and a "limit active" flag.
5. *No dwell or hysteresis:* cloud edges flip a threshold every few seconds; pumps and contactors have minimum on/off times. A 2-minute surplus cannot serve a 20-minute cycle.
6. *Measurement skew:* PV and load come from different meters/clocks; use the grid-point meter.

**Defensible definition (per load, parameters set per site and proven in a pilot, no universal constants):**
`H(t) = P_export_smoothed(t) + P_load_on(t) + [P_batt_charge(t) if the battery ranks below this load] - P_margin`
`surplus_available(L)`: `H >= P_min(L)` for at least `T_on`; ends when `H < P_min(L) - hysteresis` for at least `T_off`. `P_min(L)` is the load's rated or minimum operating power; `T_on/T_off` follow the load's protection times. The plant-level fact stays plain: smoothed export kW and "export-limited yes/no". Without a grid-point meter surplus is **not defined**: show "unknown". Likewise replace "battery constrained = SoC < 25 %" by "SoC at or below the device's reserve (read it: SunSpec 124 `MinRsvPct` or the vendor register; Fronius notes) plus margin, or BMS limit flag", and show usable kWh = (SoC - reserve) x capacity.

## E. Fault detection and analytics: evidence, power-only + clear-sky limits, false-positive pitfalls

Evidence read this run (IDs as in J): [S19] IEA PVPS Task 13 report T13-19:2021 (executive summary only; full report not read); [S20] IEA PVPS Task 13 report T13-07:2017 (full text extracted and searched); [S21] Fraunhofer ISE field study, EU PVSEC 2021 (publisher page blocked: figures come from a search-engine summary of the abstract, so Medium); [S22] Fraunhofer ISE monitoring slides, 2011; [S23] NREL pvanalytics API listing; [S24] Meyers 2022, soiling from power-only data (arXiv); [S25] Skomedal and Deceglie 2020 (abstract via search); [S1] NREL O&M guide. **What I did not find: any published detection rate for the exact combination "AC power + clear-sky model, no irradiance or string data".** Every rate below comes from studies that also had irradiance, temperature or string-level inputs, or that were synthetic.

**E1. What published detection rates say (FACT, with limits)**

| Source | Setting | Result as stated | Why it does not transfer | Conf. |
|---|---|---|---|---|
| Fraunhofer ISE, EU PVSEC 2021 [S21] | 85 rooftop-type PV systems in Germany, 46 months, maintenance records as ground truth, several automatic fault-detection methods | Best method found "almost one third (29.6%)" of observed faults with "an average of 15.8% false alerts"; the method with the fewest false alerts (11.7%) found 19%; sensitivity differs by fault type, so combining methods may raise it | Only large independent field test found. It gives the realistic order of magnitude: about 1 fault in 5 to 1 in 3 found, 1 alert in 8 to 1 in 6 false. Method inputs not checked | Medium (summary only) |
| IEA PVPS T13-19:2021 [S19] | Literature survey; 8 of 22 algorithms run head-to-head on the same data from one live PV system | "different algorithms have very different sensitivities"; training data close in time to the test data works better; for some ML algorithms "performance data and environmental data seem to be on par" for accuracy. Inputs used in the studied papers: current/voltage 25%, irradiance 19%, temperature 17%, IV curve 12% | Summary has no rates; one live system; AC-power-only is not the typical input. Lead authors are from a company (Green Power Engineering Ltd., Israel) | High (what it says) |
| IEA PVPS T13-07:2017 [S20] | LAPART on physics-model synthetic data (30 days, 1-min, 10,000 simulated single-module failures; inputs irradiance, ambient temperature, wind); SVM on a 10.8 kW array in Albuquerque (inputs power, voltage, current, POA irradiance, module temperature) | LAPART: detection up to 86%, false alarms as low as 7%. SVM: 82 true positives, 0 false positives, 242 true negatives, 0 false negatives. Clustering with parametric confidence intervals "produces many too many false alarms"; the non-parametric variant flagged a drop 1 day (K-means) or 3 days (DBSCAN) before the first major drop (one example). Report's own caveat: "Future work requires that the algorithms be applied to data at various seasons and locations" | Synthetic data or one site, 20-30 day windows, irradiance and temperature inputs. The conclusion that "no irradiance or weather sensors are required" is the authors' claim for their method, not tested independently in the report | High (what it says), Low (as evidence for Greecon) |
| NREL O&M guide [S1] (see A2) | Practice guidance | "Using intervals smaller than a week increases the possibility of false positives"; instant comms-loss alerts are a known false-alarm source | Fleet and US oriented | High |

INFERENCE: the gap between laboratory numbers (80-100% detection, 0-10% false alarms, with irradiance and module temperature as inputs) and the only large field test (19-30% detection, 12-16% false alerts) is the reason not to sell "intelligent fault detection". A small platform earns trust by (a) a few deterministic checks whose logic the operator can read in one sentence, (b) labelling each flag with its evidence and confidence, (c) recording the operator's answer (useful / not useful / already known) so that it measures its own precision before adding checks.

**E2. What power-only data plus a clear-sky model can and cannot detect**

| Check | What is possible with AC power + clear-sky | Evidence (FACT unless marked) | Minimum data for a trustworthy flag | False-positive traps | Conf. |
|---|---|---|---|---|---|
| 1. Data age, stale or frozen values, stuck sensors | Yes, no model needed | pvanalytics `quality.gaps.stale_values_diff` "Identify stale values in the data", `stale_values_round`, `completeness_score` "for each day" [S23]; SunSpec "not implemented" sentinels (C2) | Timestamp and expected cadence per point; a grace period before alerting (A1 row 1) | Night sleep; the platform's own polling gaps; devices that repeat the last value on comms loss | High (logic), Medium (thresholds) |
| 2. Inverter outage or repeated tripping | Yes: status/alarm register plus AC power against sun elevation; peer comparison if two or more inverters | T13-07 section 2.5 shows one inverter at three resolutions: at 5 min "severe drops in output", at 5 s "the inverter switches off for regular periods, suggesting that it is tripping off" [S20] | Status read at every poll; INFERENCE: 1-min power where the device allows, since 5-min data shows the drop but not the cause; event log if the device keeps one | Morning/evening ramps; grid outage (inverter correctly off); DSO curtailment; maintenance | High |
| 3. Partial string or MPPT outage | Not from inverter-level AC power: one string of ten is about -10% at the inverter, inside weather noise (arithmetic, INFERENCE). Needs per-MPPT/string current or power (SunSpec model 160, Huawei per-PV registers, C2-C3) or same-orientation peers | Current/voltage are the most used inputs (25%) [S19]; Fraunhofer's "minimal" configuration is total energy plus regional irradiation data, and "DC currents and voltages (maybe only exemplarily)" appear in its "standard" configuration [S22] | Per-input current or power at 1-5 min on clear periods; at least two inputs of equal orientation and size (proposal) | Different orientation or shading per input; MPPT sharing; snow | Medium |
| 4. Underperformance against expectation | Level 1 only (B3): weekly production against a modelled-weather band; relative faults through peers | NREL: report weekly or monthly, shorter intervals raise false positives (A2) [S1]; error sources of expected energy: B2 | One week per flag; INFERENCE: a site-specific clear-day envelope needs several clear days; show the weather source | Satellite/NWP irradiance error; aerosol and clear-sky model error; uniform losses stay invisible (soiling, all-unit curtailment) | Medium |
| 5. Soiling | Trend only. Power-only estimation exists, validated on synthetic data, a labelled test site and unlabelled fleets without ground truth | Meyers: input is "power measurements with time stamps, but no other information such as site configuration or meteorological data"; on the labelled site it "does worst around days 125-200, which was particularly rainy and cloudy. This lack of clear sky baseline ... negatively impact[s] the soiling estimate"; for 50 unlabelled systems "no known soiling trend to compare to" [S24]. Dataset notes: algorithms "do not adequately capture pollen and biosoiling effects" (via search) [S26]. T13-07 s.2.4.5: soiling shows as "a mild degradation of performance over several months followed by a sharp improvement after heavy rainfall"; action: advise when to wash [S20] | Reminder: dry-spell length plus trend between rains (INFERENCE). A percentage: at least one full year (INFERENCE; Meyers says more years improve the seasonal part) | Cloudy/rainy spells; shade growth; degradation (estimated jointly with soiling by [S25]); pollen | Medium (trend), Low (absolute %) |
| 6. Clipping at rated power | Yes, if the AC rating is known | pvanalytics `features.clipping.levels` "Label clipping in AC power data based on levels in the data"; `threshold` "Detect clipping based on a maximum power threshold"; `geometric` "Identify clipping based on a the shape of the *ac_power* curve on each day" [S23] | AC rating (nameplate or SunSpec 120) and several clear days at 1-5 min | Same flat top as an export limit or DSO order (row 7); clipping is by design, not a fault; lost energy needs DC-side data | Medium |
| 7. Curtailment or export limit active | Read the device flag and setpoint first (C3, D1). Shape-only inference is a flat top below rating that moves with the setpoint | The pvanalytics API listing has no curtailment function [S23]; limit registers documented by Sungrow, SMA, Fronius (C3) | Limit and setpoint registers polled with power | Confused with clipping; battery charging absorbs PV; cloud edges | High (flag), Low (shape) |
| 8. Shading by fixed objects | Repeated dips tied to sun position; a tool exists, its inputs were not verified here | pvanalytics `features.shading.fixed` "Detects shadows from fixed structures such as wires and poles" [S23]; Meyers: the shade analysis "depends on first estimating and correcting the soiling losses in the signal" (preliminary work cited there) [S24] | About one year (all sun positions); clear days; correct tilt and azimuth | Soiling; clouds; snow; wrong orientation entered | Low |
| 9. Meter and counter errors | Yes, by consistency checks, not by models: counters never decrease; PV + import - export + battery discharge - battery charge equals load; PV is 0 at night; inverter AC energy against the check meter | No published rate. Fraunhofer 2011: inverter-based monitoring has "Accuracy limited (mainly designed for operation control!)" and "No redundant data access"; independent energy metering "Uncertainty max. 1%" [S22] | Grid-point meter plus check meter; INFERENCE: one to two weeks of paired readings | Sign convention; CT ratio; phase wiring; clock offset; different cut-off times; rollover | Medium |
| 10. Irradiance or temperature sensor faults | Stale and above-clear-sky checks are deterministic; drift is invisible without a second reference | pvanalytics `quality.irradiance.clearsky_limits` "Identify irradiance values which do not exceed clearsky values" [S23]; NREL: pyranometers need recalibration about every 2 years, module temperature sensors detach (A2) [S1]; Fraunhofer: module-plane pyranometer "daily uncertainty < 2%", Si reference cell "Uncertainty < 5%", "Annual totals can differ up to 5% compared to the pyranometer" [S22] | Sensor metadata (type, install and calibration date), coordinates, tilt | Dirt or shade on the sensor; wrong tilt entered | Medium |
| 11. Degradation and data shifts (inverter or meter replaced) | Shifts yes; a degradation rate not on short records | pvanalytics `quality.data_shifts.detect_data_shifts` "Detect data shifts in a time series of daily values" [S23]; T13-07 s.2.4.6: degradation "usually ~0-1 % relative reduction per year", clearly faster points to module faults such as PID [S20] | One to two years for a rate (INFERENCE: 0-1 %/yr is smaller than the seasonal PR swing of up to +-10%, B1) | Seasonality; soiling; curtailment; replaced sensors | Medium (shifts), Low (rate) |

**E3. What a small platform should ship first, and what to defer** (my proposal; thresholds and triggers are uncalibrated and must be set on pilot data). Rule: ship only checks whose logic fits in one sentence and whose false alarm costs little; the Fraunhofer field result (19-30% detection, 12-16% false alerts [S21]) is the bar any smarter method must beat before it is built.

*Ship first (all deterministic, device-reported or arithmetic):*
1. Data age and stale or frozen values (row 1). 2. Inverter state and alarm, plus "not producing while the sun is high" after a grace period, labelled "reported by inverter" (row 2). 3. "Limited by export limit / rated power" explanation instead of "underperforming" (rows 6-7). 4. Meter sanity: monotonic counters, energy balance, commissioning self-test, check meter against inverter (row 9). 5. Sensor sanity where sensors already exist (row 10). 6. Weekly expected-against-actual band, Level 1, weather source shown, no alarm; a "worth a look" note only when the drop persists over weeks or peers disagree (row 4).

*Defer, with the proof trigger that would justify building it:*

| Deferred | Proof trigger (evidence needed) |
|---|---|
| Peer comparison across same-orientation inverters or MPPT inputs (rows 3-4) | A pilot site with two or more comparable units and at least one technician-confirmed fault that peer comparison would have flagged (proposed) |
| Soiling reminder with rain reset (row 5) | One full year at three or more pilot sites with operators' cleaning dates logged, to check the reminder against real jumps (proposed). A soiling percentage: not before there is ground truth |
| Per-string or per-MPPT diagnostics (row 3) | Pilot inverters that expose per-input data, plus confirmed string faults in the first months; otherwise do not promise it |
| Shading, degradation rate, ML or statistical anomaly models (rows 8, 11) | The platform's own labelled event log (proposal: a few dozen confirmed faults) and the measured precision of the six shipped checks; read the full Fraunhofer paper for per-fault-type rates. T13-07 (2017) itself says the ANN and clustering methods "have yet to be commercialized" [S20] |

**E4. Open questions**
- OPEN: no source gives detection rates for power-only plus clear-sky checks; only the platform's own pilot data can.
- OPEN: which polling interval the target inverters and dongles tolerate (write limits are known, C3; read limits per vendor not verified).
- OPEN: per-fault-type sensitivities in the Fraunhofer study and the T13-19 head-to-head (full papers not read; publisher page blocked, summary only).
- OPEN: accuracy of the clear-sky model at Balkan sites in dusty or smoky conditions: not found.

## F. Safety and protection boundaries

Evidence read this run (IDs as in J): [S27] ENTSO-E guidance on RfG Type A generators (text extracted and read); [S28] CENELEC EN 50549-1 catalogue entries (the standard text is paywalled and was NOT read); [S29] vendor declarations that quote UK ENA EREC G100 on export-limiting schemes (via search summary; G100 itself not read); [S30] EASE battery-storage safety guidelines, May 2025 (via search summary); vendor documents already read in C3 ([S9] SMA, [S11] Sungrow, [S12] Fronius notes); [S4] Regulation (EU) 2023/1542; earlier-run files 04-security-safety.md (command classes B1, lease B7, wording rules) and 05-legal.md (F liability, G energy law). **Could not find:** the Albanian Distribution Grid Code and any OSHEE/OST technical connection requirement for generators (one English and one Albanian search returned nothing relevant); the texts of IEC 62116 (anti-islanding test), IEC 63027 (DC arc detection and interruption), IEC 62619 and UL 9540A (battery safety), HD 60364-7-712 and EN 50110-1 (installations and work on them). Statements about those texts are [UNVERIFIED] recall. **Principle (founder brief and 04-security-safety.md):** the cloud is never required for hard safety; GAIA's top tier is an "operational safety priority (non-SIL)", never a safety function.

**F1. What must stay in the inverter, BMS and protection relays**

| Function | Where it must live | Evidence | Why not in the platform | Conf. |
|---|---|---|---|---|
| Anti-islanding (loss of mains), over/under voltage and frequency trips, ROCOF withstand | Certified inverter and/or the interface-protection relay the DSO requires | EN 50549-1:2019 + A1:2023 covers generating plants up to Type B on LV and replaced EN 50438 (withdrawn 1 Feb 2022) [S28]. ENTSO-E: Type A compliance by "simple equipment certification" plus site data, "a rigorous on-site installation compliance process and test is not appropriate"; standards set the frequency range and ROCOF withstand 2.5 Hz/s [S27]. Clause numbers and trip settings: NOT read, UNVERIFIED | Trip timing is a property of the type-tested device at the grid terminals. A Modbus polling loop cannot match it (INFERENCE; Sungrow's external-EMS heartbeat default is 20 s [S11]) and the platform cannot type-test its software | High (principle), Low (numbers) |
| Frequency-dependent power reduction (LFSM-O), reconnection after a trip | Inverter, with settings fixed by the system operator | ENTSO-E: the standards give the LFSM-O range but "no standards exist for their settings. These are the responsibility of each Transmission System Operator"; RfG Art 13.2(a),(f), 13.4, 13.7; re-connection "permissible at elevated frequencies below 50.2Hz, at which point over-frequency LFSM operates" [S27] | Settings are coordinated per synchronous area; one wrong write repeated on many sites would act like a correlated frequency event (INFERENCE) | High |
| DC arc-fault detection and interruption | Inverter or a dedicated arc-fault device | IEC 63027 (title recalled: DC arc detection and interruption in PV power systems), not fetched [UNVERIFIED] | The platform can only display the device alarm and fault code (INFERENCE) | Low (no source) |
| Battery cell and pack protection: over/under voltage, over-current, over/under temperature, thermal-runaway detection, contactors, venting, suppression | BMS and battery-system hardware (fuses, contactors, gas or smoke detection, suppression), not an EMS | EASE (May 2025): performance-based; early anomaly detection "via the BMS and alarm systems"; validation by UL 9540A fire testing; a harmonised EU safety standard "expected from CENELEC by late 2026" [S30]. Reg. (EU) 2023/1542 requires the BMS of stationary storage to hold state-of-health and lifetime data from 18 Aug 2024, readable by the purchaser and third parties acting for him (B1) [S4]. No source states that the BMS must be independent of the EMS: that is INFERENCE from vendor design | The battery's limits are enforced inside the battery system and the EMS only chooses within them; a platform writing beyond BMS-reported limits would remove the last independent layer | Medium (search summaries), Low (independence claim) |
| Over-current, short-circuit and earth-fault protection, DC isolation, surge protection | Electrical installation (fuses, breakers, RCD, isolators, SPD) | HD 60364-7-712 / IEC 62548 (recalled) [UNVERIFIED] | Hardware by nature | Low (no source) |
| Export-limit enforcement at the connection point (zero export or a DSO limit) | Meter plus inverter or certified controller, fail-safe | Vendor declarations quoting G100: "if the communication path fails the generation output should be reduced to a nominal value stipulated by the DNO within a set response time"; the scheme "must detect an excursion and reduce the export ... within 5 seconds"; settings "should only be changed with the written agreement of the DNO". A Victron forum post (unverified) reports export continuing for about 60 s after the grid meter was unplugged [S29] | Closed loop in seconds, fail-safe on loss of meter data; the DSO may require certification (UK source, not Albanian) | Medium |
| Grid profile of the inverter (country or grid-code selection, Q(U), cos phi, reactive-power limits) | Installer at commissioning, per DSO instruction | SMA lists OutPFSet, VArWMaxPct, VArMaxPct among the few registers it allows to be written cyclically [S9], so vendors do expose them; the values are set by the operator rules [S27] | They are legal parameters of the connection, not optimisation variables (INFERENCE) | Medium |

**F2. Command boundary: MAY / MAY ONLY WITH vendor API and written approval / MAY NOT**
Direction rule (04-security-safety.md B1): safe-direction commands (stop, disable, reduce) need no lease; hazard-direction commands (start, enable, increase) only as leases with a dead-man timer and a declared fallback (B7).

*MAY (no vendor approval needed):*
- Read everything the device exposes: status, alarm and fault codes, limit flags, counters, battery SoC and limits. Needs the customer's consent; SMA's Modbus is off by default and enabling it is a customer security decision [S9].
- Display, record, alert, report curtailed energy, compute the KPIs of B.
- Recommend an action and let the operator approve it (advisory tier).
- Later and supervised (D1: recommend first): switch loads the customer owns behind their own local interlocks (pump, water heater), as leases, under the customer's control addendum (05-legal.md F3).

*MAY ONLY WITH an inverter-vendor API and written approval (plus DSO consent where it touches connection conditions):*
- Write an active-power limit (SunSpec 123 WMaxLimPct; Sungrow feed-in limit 13074/13087/13088; Fronius dynamic power reduction), only through the documented external-control path, with the vendor's heartbeat or revert timer (Sungrow 13080, default 20 s; Fronius revert timer) and never as a periodic write to a register outside the vendor's cyclic-write list (SMA: Conn, WMaxLimPct, OutPFSet, VArWMaxPct, VArMaxPct) [S9, S11, S12].
- Change battery mode or charge/discharge power (Sungrow EMS mode 13050: 0 self-consumption, 2 forced, 3 external EMS, 4 VPP), inside BMS limits [S11].
- Raise an export limit or change reactive-power settings: only with the DSO's written agreement (connection conditions; DSO curtailment orders, Law 24/2023 Art 17, 05-legal.md G) and the installer's sign-off.
- Remote restart after a trip: only where the vendor documents it, and not after arc-fault, earth-fault or anti-islanding trips unless the vendor says remote reset is allowed [UNVERIFIED].

*MAY NOT:*
- Change or disable interface protection (voltage, frequency, ROCOF thresholds and delays), anti-islanding, arc-fault protection or grid-profile selection; change LFSM-O curves or reconnection conditions (system-operator responsibility [S27]).
- Override BMS limits, contactors or thermal protection; clear a BMS or safety fault remotely; command charge or discharge outside BMS-reported limits.
- Write cyclically to flash-limited registers, or poll and set read-write registers frequently through the Sungrow WiNet-S [S9, S11].
- Present any cloud function as a safety function: no "software E-stop", no "safety interlock" wording, no SIL claim, no "prevents damage" marketing (04-security-safety.md).
- Energise or restart an asset that may be under maintenance: software cannot know that a lockout is applied (F5).
- Pool customers' assets and dispatch them into a market or sell flexibility: Law 59/2026 reportedly makes storage operation and aggregation licensed activities [S31]; 05-legal.md G: not without counsel and ERE confirmation.

**F3. Zero export and export limiting: how it is done safely, and who is liable**
- *How (UK vendor and G100 documents, Medium):* grid-point meter or CT; inverter or controller cuts output so that net export stays within the agreed limit; fail-safe to a nominal value on loss of the measurement or the communication path; response within a stated time (5 s in the quoted G100 text); commissioning test by unplugging the CT or comms cable and timing the response; settings locked after commissioning [S29]. Vendors differ: one declaration says that on CT loss the inverters drop to 0 W; a forum report claims about 60 s before shutdown on another brand [S29]. So the fail-safe time is measured on site, never assumed from a datasheet.
- *In the platform (INFERENCE, consistent with D1):* the loop stays between meter and inverter. Greecon reads "limit active", the setpoint and the meter-link health, reports curtailed energy, and alerts when the fail-safe state is entered. It does not run the loop and does not edit the limit except under the F2 conditions.

| Party | Responsible for | Basis | Conf. |
|---|---|---|---|
| Facility owner (customer) | Compliance of the plant with connection conditions, permits and grid limits; engaging qualified people | RfG Art 40 "Responsibility of the power generating facility owner" (title as listed in [S27]); customer duties in 05-legal.md F4 | Medium |
| Installer or electrician | Installation, protection settings as the DSO instructs, commissioning tests including the export-limit fail-safe test | INFERENCE from G100 commissioning practice [S29]; Albanian installer licensing NOT verified | Low |
| Inverter and BMS manufacturer | Type-tested protective functions and firmware | Product Liability Directive (EU) 2024/2853 treats software as a product, transposition by 9 Dec 2026; Albania's Civil Code amendment, Law 82/2026 (secondary): 05-legal.md F1-F2 | Medium |
| DSO or TSO | Protection and LFSM-O settings; curtailment orders | [S27]; Law 24/2023 Art 17 (A1 row 3) | Medium |
| Greecon | Its own software defects and every command it sends. A contract can cap liability for lost yield but not for death, injury or gross negligence; insurers will ask whether the platform can actuate equipment | 05-legal.md F4 | Medium |

INFERENCE: Greecon's exposure moves from "reporting" to "causing" at the first write command. That is the reason for read-only first, a Control/Automation Addendum before commands go live (05-legal.md F3) and the F2 lists. OPEN: no Albanian rule or case found on liability when a third party changes setpoints on a customer's inverter.

**F4. Grid-code and DSO requirements when software changes setpoints**
- *EU frame (FACT, [S27], guidance dated 16 Nov 2016):* RfG Type A starts above 800 W; the A/B boundary is 1 MW in Continental Europe (100 kW in Ireland); Type A capabilities are in Article 13 (LFSM-O 13.2(a),(f); frequency-dependent power reduction 13.4; reconnection 13.7) and operational notification in Article 30; proof is an equipment certificate plus simple site data; the relevant system operator specifies the installation document. Whether the revised RfG changes this: not checked.
- *Albania (known):* Law 43/2015 Art 37(6)-(7): generators up to 1 MW need no generation licence but must follow market rules and grid codes (2015 text). Law 24/2023: up to 10.8 kW connects on notification (Art 18(4)); DSO curtailment orders (Art 17); a third party may operate and maintain a self-generator's installation while subject to his instructions (Art 20(5)) (05-legal.md G).
- *NOT known (searched, not found):* whether the Albanian Distribution Grid Code or OSHEE connection rules require EN 50549-1 or another certificate; which protection settings OSHEE prescribes; whether OSHEE requires an export-limiting scheme or accepts third-party remote setpoint changes; whether RfG is transposed in the OST and OSHEE codes. These go to I.

**F5. Electrical-work safety (lockout/tagout)**
- [UNVERIFIED recall, EN 50110-1 not fetched] European practice for work on installations uses five safety rules for dead working: disconnect completely, secure against reconnection, verify absence of voltage, earth and short-circuit, protect against adjacent live parts. In PV the DC side stays live whenever there is light; in a battery system the DC side stays live with the AC side off.
- INFERENCE: software cannot see a padlock. Therefore (a) a per-asset "maintenance / locked out" flag, set by a person, blocks every remote command and shows on every screen (seam, H(ii)); (b) "remote stop" is never described as isolation; (c) installation and commissioning only by qualified electricians; (d) any Greecon-supplied wiring (edge box, relays) is installed by a licensed electrician under the customer's lockout procedure.

## G. Market and programme context (Albania/Balkans)

Scope: Albania only (Kosovo, North Macedonia, Montenegro, Bosnia and Serbia were not researched). Licensing and prosumer law are in 05-legal.md G and only summarised here. Read this run: [S32] European Commission Albania 2025 Report SWD(2025) 750 (local copy, energy chapter); [S31] pv magazine, 27 Aug 2026 (fetched, one page); [S33] Albania IPARD III Programme (local copy, eligibility rules found by searching the text); notes 05-legal.md and 07-market-users.md. Search summaries only, articles not opened (Medium or Low): [S34]-[S40]. **Could not find:** the ERE net-billing formula and the Council of Ministers decision text; the 2026 regulated 0.4 kV business tariff in lek/kWh; any tariff specific to hotels, farms or irrigation pumping; curtailment or connection-queue figures for small PV; the OSHEE prosumer connection procedure; KfW or EU grant lines for on-site PV at hotels or small industry; any data on what Albanian hotels and farms actually install.

**G1. Market structure (who decides what)**

| Body | Role and facts | Source | Conf. |
|---|---|---|---|
| ERE (Energy Regulatory Authority) | Regulator: licences, tariffs, market rules. Restructured in Oct 2024 with new units for renewables and regulatory compliance; approved the capacity-allocation and congestion-management regulation in May 2025 | [S32] | High |
| OST | Transmission system operator (role recalled, UNVERIFIED). The Commission report describes the 400/220/150/110 kV grid linked to Greece, Montenegro and Kosovo, with the 400 kV Fier-North Macedonia line and the Fier-Elbasan link expected by mid-2026 and expropriation-compensation delays at Fier | [S32] | High (grid facts) |
| OSHEE | Distribution operator and supplier of the regulated customers; connects self-producers (as described in the sources below; formal designation not re-read this run). It "published a list of over 2,000 companies that moved to the free market from 1 January 2026"; prosumers on its grid 102 MW in 2023 (secondary) | [S35]; 07-market-users.md G | Medium |
| ALPEX | Power exchange: day-ahead since April 2023 [S17]; 2024 rules aligned with the EU market regulation and SDAC/SIDC, approved by ERE in Dec 2024; first intraday auction in Dec 2024 marked Albania-Kosovo market coupling | [S17], [S32] | High |
| Energy Community | Albania is a Contracting Party; the Secretariat reviewed the draft Power Sector Law in July 2025; "alignment with the Electricity Integration Package is yet to be completed" | [S32]; 05-legal.md G | High |
| Retail opening | 20, 35 and 110 kV customers are deregulated; 10 kV from Jan 2025; 6 kV from Jan 2026; "After this date, only low-voltage (0.4 kV) customers will remain regulated" [S32]. Italian trade agency, Jan 2026: more than 2,000 firms moved to the free market on 1 Jan 2026, regulated tariffs now apply to small businesses and households [S35] | [S32], [S35] | High, Medium |

INFERENCE: hotels, farms and small industry on 0.4 kV stay on regulated supply; larger sites (6 or 10 kV: some hotels, food processors, pumping stations) buy on the free market with a different price signal. Which of Greecon's targets sit at which voltage is unknown.

**G2. Prosumer and self-consumption rules**
- FACT (Law 24/2023 as read in 05-legal.md G): self-generators up to 500 kW (Art 20(1)); up to 10.8 kW connects on notification to the DSO (Art 18(4)); compensation by net invoicing under a Council of Ministers decision (Art 20(2)-(4)); DSO register (Art 20(6)); Art 20 applies from 1 Jan 2024, the monthly net-metering scheme being the earlier regime; a third party may operate and maintain the installation while subject to the self-generator's instructions (Art 20(5)). The Commission notes a Nov 2024 update of the renewables framework and plans to revise permitting rules by 2025, "the net billing support scheme" and the rights and responsibilities of self-producers [S32].
- REPORTED (Medium, [S31]): "rules from May" 2026 set grid-connection procedures and compensation for renewable self-producers under a net-billing methodology; Law 59/2026 (in force July 2026) creates "active clients" who can generate, consume, store and sell, and makes storage operation and aggregation licensed activities; agrivoltaics amendments were adopted in July 2026. The article gives no formula, billing period or grid fee. CONFLICT to resolve: 05-legal.md G still treats the Power Sector Law as pending; one secondary source says it is in force, text not read.
- REPORTED (Low-Medium, [S34], search summaries, articles not opened): a Council of Ministers decision moves self-producers from net metering to net billing from 1 Jan 2027, with "compensation ... no longer based on kilowatts, but on the financial value of the energy"; today surplus above monthly consumption is sold to the universal service supplier "according to the price set by ERE". Not reconciled with [S31], which says the May rules already set a net-billing methodology. The official decision is still not located (see also A1 row 6).
- NOT FOUND: price credited per exported kWh; settlement period; OSHEE connection steps and fees; any storage capacity cap.
- INFERENCE: if exports are credited at an ERE-set price below the retail price, a self-consumed kWh is worth more than an exported one, which raises the value of self-consumption figures and of the own-meter-against-bill check (A1 rows 6 and 8). The platform must hold the settlement period and prices as per-site data, never as constants.

**G3. Tariffs for hotels, farms and small industry**
- Households (secondary, 07-market-users.md G): base tariff 9.5 lek/kWh before VAT, 11.4 with VAT, with a 1 lek cut for households up to 700 kWh/month (2025). A 2025 news item says the cut covered only households and none was planned for businesses, public institutions or bakeries [S38] (Medium, summary only).
- Business at 0.4 kV: NOT FOUND for 2026. An undated Tirana Times item states "average tariffs for business consumers vary from 8.5 lek/ kWh to 10 lek kWh based on low or medium voltage power access" [S37] (Low: undated, not opened). ERE's board approved distribution-service tariffs for 1 May to 31 Dec 2026 (notice of 14 Apr 2026; rates not in the excerpt) [S36]. A Balkan Green Energy News headline reads, translated, "up to 35% higher electricity prices for companies in Albania" [S39] (headline only): free-market prices may differ from the old regulated ones.
- NOT FOUND: time-of-use or demand charges for small business (D1 needs one for peak shaving); the irrigation-pumping tariff (03-agriculture.md says the same); reactive-energy charges.
- INFERENCE: payback of PV and storage at hotels and farms depends on tariffs more than on any platform feature, so tariffs are a per-site setting filled from real bills, and a pilot should start by collecting 12 months of bills.

**G4. Solar and storage boom, curtailment and grid capacity**
- Installed base (reported): ERE puts cumulative solar capacity at 631 MW at end-2025, earlier estimates 600-650 MW [S31]; a search summary says "over 700 MW of private photovoltaic capacities in operation, as well as about another 400 MW of self-producers" [S34] (date and scope unclear, not reconciled with 631 MW). Non-hydro renewable output was 702 GWh in H1 2026, up 51% from 464 GWh in H1 2025, with a Q2 2026 record of 448 GWh (INSTAT, via [S31]).
- Pipeline: a Dec 2024 Ministerial Order plans at least 300 MW by 2027 on top of 860 MW allocated since 2019 through five auctions [S32]; ERE "continued to process new and modified PV licences during H1" 2026 [S31].
- Constraints (reported): an interviewee calls integration "the biggest challenge", citing grid capacity, balancing, flexibility and bankability [S31]. The Commission notes incomplete alignment with the Electricity Integration Package and delayed grid projects [S32]. **No curtailment data, connection-queue figures or hosting-capacity numbers found for distribution-connected PV.**
- Storage: Law 59/2026 makes storage operation a licensed activity and ERE is working on registering storage operators [S31]; no installed battery capacity found.
- INFERENCE: the DSO's legal power to order curtailment (Law 24/2023 Art 17) plus fast growth makes "limit active" and curtailed energy worth recording from day one; there is no evidence yet that small sites are curtailed, so nothing beyond recording and display (H(i), H(iii)).

**G5. Programmes and financing**

| Programme | Facts (as stated) | Fit for hotels, farms, small industry | Conf. |
|---|---|---|---|
| IPARD III, Albania 2021-2027 (EU pre-accession) [S33] | Renewable plants for own consumption are eligible under measures 1 and 3; selling to the grid is allowed "as far as the self-consumption limit is respected (i.e. electricity sold into the grid equals on average the electricity taken out)"; "The investment is considered eligible when the (theoretical) power capacity of the renewable energy plant does not exceed 120% of the 3 years-average (self-) consumption of the farm"; self-consumption "should be checked at the stage at which a project is submitted"; priority to "investments in production of renewable energy for own consumption and waste treatment"; irrigation investments need water metering; the IPARD Agency checks costs and publishes the recipients' guidelines | Farms and processors. INFERENCE: applicants need a metered consumption history and later proof of self-consumption, which a monitoring report could supply if the Agency accepts it (OPEN, see I2). Grant rates and ceilings not read | High (text), Low (fit) |
| EBRD Western Balkans GEFF (EU, Austria, WBIF) [S40] | Albania: first partner banks Union Bank and Fondi BESA, credit lines of EUR 9 million in total (EUR 6 million to Union Bank, 2018); on-lending for energy-efficiency work in privately owned residential buildings, including insulation and solar panels; homeowners may receive incentives of up to 20% of the loan; Intesa Sanpaolo Bank Albania says it supports residents, housing collectives, construction companies and the public sector; programme EUR 85 million regionally | Households and housing; no hotel or SME line found. Current status not checked | Medium |
| KfW, EU grants, other credit lines for on-site PV at hotels or small industry | Not found | Unknown | n/a |
| Buildings efficiency [S32] | Law on energy performance of buildings approved June 2025; the Commission says financing incentives for annual renovation of public buildings are still needed | Not a business-site programme | High |

**G6. What hotels and farms actually buy: NOT FOUND.** No source on brands, sizes, battery share or monitoring tools used by Albanian hotels and farms. Adjacent facts: hotel occupancy 61.5% in Aug 2025 against 20.4% in Dec 2025 (07-market-users.md G), so seasonal sites run unattended for months (INFERENCE: "is it all right while I am away" has year-round value); IPARD puts on-farm PV for own consumption in scope [S33]; global inverter leaders are Huawei and Sungrow [S7] but no Albanian share data exist in what I found. Replace this inference with a short survey of installers, hotel managers and farmers (see I3, C1).

## H. Implications
### H(i) MUST EXIST FROM DAY ONE
Proven need, one line each, with the evidence section in brackets.
1. A home screen that answers four questions (running, made what it should, what is wrong, what next), with "last seen" age on every source and a grace period before any comms-loss alert. [A1 rows 1-3, A2, E3]
2. Energy from counters (never integrated power), separate import and export counters, and a view that reconciles the own meter with the bill. [A1 rows 2 and 6, B1, G2]
3. Device-reported status, alarm and fault codes, and limit or curtailment flags, labelled "reported by inverter"; curtailed energy recorded. [A1 row 3, C3, E2 rows 2 and 7, G4]
4. A semantic layer: per-device profile (scale, sign, word order, address base), "not available" as null never zero, quality and age on every point, commissioning plausibility test. [C2, C4]
5. Read-only drivers in this order: SunSpec discovery, Huawei SUN2000, Sungrow, Modbus meter profiles, Victron for hybrid sites; the order is an inference to confirm with installers. [C1-C3]
6. Wave-1 checks only: stale data, inverter not producing at high sun after a grace period, limit or clipping explanation, meter sanity, sensor sanity, weekly expected band at Level 1. [E3]
7. Claims worded to the ladder (Level 0, 1, 2); no PR, PI, soiling percentage or degradation rate without the sensors. [B2, B3, E2]
8. No write path to inverters or batteries; every flag stores the operator's answer (useful, not useful, already known). [F2, E1, E3]
9. Gaps tolerated and backfilled, cellular backhaul assumed, local retention of at least 6 months of logger data. [A2, C4]
10. Site parameters held as data, not constants: tariff, settlement rule, AC or DC capacity basis, time zone, load start and stop thresholds. [G2, G3, B1, D3]
11. "Not a safety system" wording and the terms "operating guards" and "limits" in product and contracts. [F2, 05-legal.md F4]

### H(ii) SEAMS for later
Each seam: the extension point to leave, and the evidence that would prove the need.

| Seam | Extension point to leave | Evidence that would prove the need | Section |
|---|---|---|---|
| Peer comparison across same-orientation inverters or MPPT inputs | Normalised-yield series per unit in the data model | Pilot site with two or more comparable units and a technician-confirmed fault it would have caught | E3 |
| Soiling reminder with rain reset | Dry-spell counter and ratio-trend table | One year at three or more sites with cleaning dates logged | E3, A2 |
| Per-MPPT or string diagnostics | Store per-input points (SunSpec 160, vendor per-PV registers) from day one | Pilot inverters expose per-input data and confirmed string faults appear | E2 row 3 |
| Sensor registry and Level 2 KPIs (PR, temperature-corrected PR) | Sensor metadata with calibration dates; weather-source slot | A lender or customer asks for PR with a documented class | B3, E2 row 10 |
| Setpoint write path (active-power limit, battery mode) | Allow-listed register map per profile, lease with heartbeat, rate limit, approval step, record of vendor approval | Customers repeatedly ask for remote limit changes AND written vendor approval AND DSO consent | F2, F3, F4 |
| Solar-window load commands | Per-load rule: start and stop thresholds and delays, the load's own draw added back | Pilot where recommendations were accepted repeatedly | D1, D3 |
| Per-asset "maintenance / locked out" flag | Command gate checked by the edge before any command | Required before the first remote command goes live | F5 |
| Tariff-aware dispatch and peak shaving | Tariff table (time-of-use, demand charge) as data | Real Albanian business bills show a time-varying or demand component | D1, G3 |
| Forecast layer | Provider interface with licence-aware adapters | A decision that hinges on a forecast (flexible load or battery); decide Open-Meteo plan or self-hosting first | D2 |
| Net-billing settlement engine | Period and price tables per site | ERE publishes the formula and a first customer is on net billing | G2 |
| "Active client", storage-operator and aggregation roles | Ownership and role model in the account and asset schema | ERE licence terms under Law 59/2026 plus paying demand | G2, F2 |
| Grant and lender evidence report | Signed monthly meter-based report | IPARD Agency or a lender states which evidence it accepts | G5 |
| More protocols (DLMS/COSEM, IEEE 2030.5, IEC 61850-7-420) | Protocol-neutral driver interface | DSO grants meter read access or requires a protocol | C1, G2 |
| Battery health and third-party read access (Reg. 2023/1542) | BMS data registry | EU customers with batteries placed on the EU market | B1 |
| More vendor drivers (Growatt, Solis, GoodWe, Deye, SolarEdge) | One driver per profile | Installer survey shows the share | C1 |

### H(iii) THINGS TO AVOID
1. A fixed "surplus above 1.5 kW" or "battery constrained below 25 % SoC" state. [D3]
2. Showing PR, PI, soiling percentage or degradation rate without sensors or ground truth. [B2, E2]
3. Selling "AI fault detection": the best field result found is 19-30% of faults with 12-16% false alerts. [E1]
4. Instant comms-loss alerts and sub-weekly underperformance alarms. [A1, A2, E1]
5. Hard-coded register offsets, word order or units; zero for "not implemented". [C3, C4]
6. Periodic writes to flash-limited registers, or frequent polling of read-write registers. [C3, F2]
7. Calling any cloud function a safety function ("software E-stop", "safety interlock", SIL, "prevents damage"). [F2, 04-security-safety.md]
8. Changing protection settings, grid profile or BMS limits, or remotely resetting protection trips. [F1, F2]
9. Running export-limit loops in the cloud. [F3, D1]
10. Pooling customers' assets, dispatching into markets or selling flexibility without ERE and counsel. [D1, F2, G2]
11. Building a paid SaaS on Open-Meteo's free tier; shipping vendor Modbus maps without checking redistribution terms. [D2, C3]
12. Assuming access to DSO billing-meter data. [C1, G2]
13. Hard-coding Albanian tariff or net-billing rules: the regime is in transition. [G2, G3]
14. Claiming grant or programme fit (IPARD, GEFF) beyond what the texts say. [G5]
15. Treating EU standards or RfG as the Albanian rule before OSHEE confirms. [F4]

## I. Open questions for a licensed electrical engineer
Each question names the section whose gap it closes. A good answer is a document, standard clause or number that can be cited.

**I1. For a licensed electrical engineer in Albania**
1. Which standards or certificates does OSHEE accept as proof of grid-interface protection for PV inverters up to 10.8 kW and up to 500 kW (EN 50549-1, VDE-AR-N 4105, IEC 62116, other)? Is a separate interface relay required above some size? [F1, F4]
2. Is a read-only Modbus TCP or RS-485 connection to an inverter, meter or battery acceptable to the installer, the warranty and OSHEE, and does adding a gateway need a signed change to the installation file? [F2, C3]
3. For an export-limited or zero-export plant: which commissioning test is standard (CT or comms cable unplugged, response time measured), what response time is accepted in Albania, and who signs it? [F3]
4. Which commands may a third party send without affecting the inverter's conformity or warranty (active-power limit, battery mode, reconnect), and how do Huawei, Sungrow, SMA, Fronius and Victron grant written approval for an external EMS? [F2]
5. Which rules govern battery rooms and cabinets in hotels and farms (detection, ventilation, separation, signage, cell standard such as IEC 62619, fire testing such as UL 9540A), who inspects, and who is liable? [F1]
6. Which lockout/tagout procedure applies (EN 50110-1 or an Albanian equivalent), and may a mains-powered gateway sit in a lockable enclosure with a labelled isolator without counting as a modification of the installation? [F5]
7. How large a gap between inverter AC energy and a Class 1 or MID check meter is normal, and what tolerance should the meter-sanity check use? [E2 row 9]
8. What share of the inverters actually installed in Albania expose per-MPPT or per-string current over Modbus, and which brands lock it to the cloud? [E2 row 3, C1]
9. Is DC arc-fault protection required or common in Albanian PV installations, and can a trip be reset only locally on the common brands? [F1, F2]
10. For hybrid or off-grid hotel sites: who owns protection settings, transfer to backup and generator interlocks, and what must a monitoring box never touch? [F1, F2]

**I2. For the regulator and operators (ERE, OSHEE, OST, IPARD Agency)**
1. ERE: what is the net-billing compensation formula and the price per exported kWh under the May 2026 rules, which decision numbers apply, does the 1 Jan 2027 transition cover existing net-metering self-producers, and what is the settlement period? [G2]
2. OSHEE: do customers or authorised third parties get read access to billing-meter data (port, file, API, monthly readings), and under which procedure? [G2, 05-legal.md G]
3. ERE and OSHEE: does a service that monitors and operates a self-producer's plant on his instruction (Law 24/2023 Art 20(5)) need any registration or notice to the DSO register (Art 20(6))? [F4]
4. ERE: under Law 59/2026, what are the licence terms and dates for aggregation and storage operation, and does a platform that only recommends (no dispatch) need any status? [G2, F2]
5. OST and OSHEE: do the transmission and distribution codes implement the RfG Type A and Type B requirements, in which document and version, and do they accept equipment certificates? [F4]
6. OSHEE: how are curtailment orders under Law 24/2023 Art 17 sent to small self-producers, are they logged, is compensation due, and how often did they occur in 2025-2026? [G4]
7. OSHEE: is an export-limiting scheme required or accepted for plants without an export permit, which certificate or test applies, and is third-party control of the limit accepted? [F3, F4]
8. ERE: where is the 2026 regulated tariff for 0.4 kV business customers (energy, distribution, time-of-use, demand and reactive charges) and the irrigation-pumping tariff published? [G3]
9. ERE and OSHEE: which licensing, technical and fire-safety rules apply to behind-the-meter batteries, and may they charge from the grid or export? [G4, F1]
10. IPARD Agency: which evidence of metering and self-consumption does it accept for on-farm PV under the 120% rule, and would a monthly meter-based report from a monitoring platform be accepted? [G5]

**I3. For installers, hotel managers and farmers (market, not engineering)**
1. Which inverter and meter brands, sizes and battery shares do you install or own, and who reads the monitoring today? [G6, C1]
2. Can you share 12 months of electricity bills and the inverter export history for one site? [G3]
3. What happens today when production drops: who notices, how, and what does it cost? [A1, E1]

## J. Source list
IDs S1-S18 are the sources cited by name in A to D (those sections carry no IDs, so they were assigned here in order of first appearance); S19-S40 are new in E to G. "Accessed" is the date the page was opened by this or the earlier run; entries marked "via search summary" were NOT opened and carry Medium or Low confidence.

| ID | Publisher, title | URL | Accessed | Used in | Status |
|---|---|---|---|---|---|
| S1 | NREL, Best Practices for O&M of PV and Energy Storage Systems, 3rd ed. | https://docs.nlr.gov/docs/fy19osti/73822.pdf | 2026-10-13 (A-D run) | A, E | read |
| S2 | NREL (Dierauf et al.), Weather-Corrected Performance Ratio, NREL/TP-5200-57991 | https://docs.nlr.gov/docs/fy13osti/57991.pdf | 2026-10-13 | B | read |
| S3 | Hukx, application notes on IEC 61724-1:2021 (vendor) | URL not recorded in A-D | 2026-10-13 | B | read, vendor |
| S4 | EU, Regulation (EU) 2023/1542 (Batteries Regulation), EUR-Lex | URL not recorded; pattern https://eur-lex.europa.eu/eli/reg/2023/1542/oj (from memory, not opened) | earlier run | B1, F1 | read in earlier run |
| S5 | IEC webstore, IEC 61724-1:2021 abstract (publication 65561) | https://webstore.iec.ch/en/publication/65561 (reconstructed, not re-opened) | earlier run | B | abstract only; standard paywalled |
| S6 | Luthander et al., Applied Energy 142 (2015), PV self-consumption definitions | URL not recorded | not re-fetched | B1 | recalled |
| S7 | pv magazine USA, 2026-01-05, Huawei and Sungrow lead Wood Mackenzie's inverter ranking | https://pv-magazine-usa.com/2026/01/05/huawei-sungrow-lead-wood-mackenzies-inverter-market-ranking/ | 2026-10-13 | C1, G6 | secondary |
| S8 | SunSpec Alliance, pysunspec2 (sunspec2/mb.py) and models repository | https://github.com/sunspec/pysunspec2 ; https://github.com/sunspec/models/tree/master/json | 2026-10-13 | C2 | read |
| S9 | SMA Solar Technology, Technical Information SunSpec Modbus (SunSpecModbus-TI-en-11.pdf) | URL not recorded | 2026-10-13 | C2, C3, F | read |
| S10 | Huawei, SUN2000 Modbus Interface Definitions V3.0 Issue 01, 2023-01-17 (mirror) | URL not recorded | 2026-10-13 | C3 | read |
| S11 | Sungrow, residential hybrid inverter communication protocol V1.1.11, 2025-11-17 (mirror) | URL not recorded | 2026-10-13 | C3, D1, F | read; document says not for third-party distribution |
| S12 | Fronius, Modbus manual | URL not recorded | earlier run | C3, F | notes only |
| S13 | Victron Energy, dbus_modbustcp register list | https://github.com/victronenergy/dbus_modbustcp | earlier run | C3 | notes only |
| S14 | evcc, Solar charging documentation | https://docs.evcc.io/en/features/solar-charging | 2026-10-13 | D1, D3 | via search summary |
| S15 | Open-Meteo, Terms | https://open-meteo.com/en/terms | 2026-10-13 | D2 | read |
| S16 | EC Joint Research Centre, PVGIS entry in the JRC data catalogue | https://data.jrc.ec.europa.eu (entry URL not recorded) | 2026-10-13 | D2 | via search summary |
| S17 | ERE / ERRA presentation, ALPEX day-ahead since April 2023 | URL not recorded | earlier run | D1, G1 | notes only |
| S18 | Albania, Law 24/2023 and Law 43/2015 (ERE copies), as read in 05-legal.md G | https://ere.gov.al/media/files/2024/01/31/Law_no._24_2023_On_the_promotion_of_the_use_of_energy_from_renewable_sources.pdf ; https://www.ere.gov.al/doc/Law_on_energy_sector_approved_on_43.2015.pdf | earlier run | A1, D1, F, G | read in earlier run |
| S19 | IEA PVPS Task 13, T13-19:2021, The Use of Advanced Algorithms in PV Failure Monitoring (executive summary) | https://iea-pvps.org/wp-content/uploads/2021/10/Final-Executive-Summary-IEA-PVPS-T13-19_2021_PV-Failure-Monitoring.pdf | 2026-10-18 | E1, E2 | read (summary only) |
| S20 | IEA PVPS Task 13, T13-07:2017, Improving Efficiency of PV Systems Using Statistical Performance Monitoring | https://iea-pvps.org/wp-content/uploads/2020/01/Report_IEA-PVPS_T13-07_2017_Improving_Efficiency_of_PV_Systems_Using_Statistical__Performance_Monitoring.pdf | 2026-10-18 | E1, E2, E3 | read (text extracted) |
| S21 | Fraunhofer ISE, EU PVSEC 2021 field study of automatic fault detection on 85 rooftop systems | https://doi.org/10.24406/publica-2858 (redirects to https://publica.fraunhofer.de/handle/publica/464569, blocked by bot protection) | 2026-10-18 | E1, E3 | via search summary, Medium |
| S22 | Fraunhofer ISE (Kroeger-Vodde), General yield monitoring and performance evaluation, OTTI seminar, 6 Jun 2011 | https://publica-rest.fraunhofer.de/server/api/core/bitstreams/65e61500-adf1-46fe-83df-07ad5ce2deb8/content | 2026-10-18 | E2 | read (slides, dated) |
| S23 | NREL pvanalytics, API reference | https://pvanalytics.readthedocs.io/en/stable/api.html | 2026-10-18 | E2 | read (listing only; function inputs not checked) |
| S24 | B. Meyers (SLAC, Stanford), Estimation of Soiling Losses in Unlabeled PV Data, arXiv:2209.09457, 20 Sep 2022 | https://arxiv.org/abs/2209.09457 | 2026-10-18 | E2 | read |
| S25 | A. Skomedal and M. G. Deceglie, Combined Estimation of Degradation and Soiling Losses in PV Systems, IEEE J. Photovoltaics 10(6):1788-1796, Nov 2020 | https://research-hub.nrel.gov/en/publications/combined-estimation-of-degradation-and-soiling-losses-in-photovol-2/ | 2026-10-18 | E2 | via search summary |
| S26 | DuraMAT Data Hub, soiling data v2 | https://datahub.duramat.org/dataset/metadata/soiling-data-v2 | 2026-10-18 | E2 | via search summary |
| S27 | ENTSO-E, Special issues associated with type A generators (guidance for national implementation of RfG), 16 Nov 2016 | https://eepublicdownloads.entsoe.eu/clean-documents/Network%20codes%20documents/NC%20RfG/161116_IGD_Special%20issues%20associated%20with%20type%20A%20generators_for%20publication.pdf?Web=1 | 2026-10-18 | F1, F3, F4 | read (first part of text) |
| S28 | CENELEC EN 50549-1:2019 + A1:2023 and withdrawn EN 50438:2013, catalogue entries | https://store.sfs.fi/en/sfs-en-50549-1-2019a1-2023 ; https://genorma.com/en/standards/en-50438-2013 | 2026-10-18 | F1 | via search summary; standard text paywalled |
| S29 | Vendor declarations quoting ENA EREC G100 (export limiting) and a Victron community thread | https://midsummer.ie/pdfs/solaredge-g100-cert.pdf ; https://portal.segen.co.uk/reseller/docs/se-g100-export-limitation-uk.pdf ; https://communityarchive.victronenergy.com/questions/181563/g100-testing-uk | 2026-10-18 | F1, F3 | via search summary; G100 itself not read; forum post unverified |
| S30 | EASE, Guidelines on Safety Best Practices for BESS (May 2025), as described by ess-news.com | https://www.ess-news.com/2025/05/16/a-safer-energy-future-depends-on-smarter-storage-why-we-need-a-holistic-approach-to-battery-energy-storage-system-fire-safety/ | 2026-10-18 | F1 | via search summary |
| S31 | pv magazine, 2026-08-27, Albania's solar market shifts toward storage, market integration | https://www.pv-magazine.com/2026/08/27/albanias-solar-market-shifts-toward-storage-market-integration/ | 2026-10-18 | F2, G2, G4 | read (via fetch summary) |
| S32 | European Commission, Albania 2025 Report, SWD(2025) 750 (Chapters 15 and 21) | local copy research/al2025.txt (original URL not recorded in 00-manifest.md) | downloaded 2026-10-12, read 2026-10-18 | G1-G5 | read |
| S33 | Albania, IPARD III Programme 2021-2027 | local copy research/ipard3_al.txt (original URL not recorded) | downloaded 2026-10-12, searched 2026-10-18 | G5, G6 | read (eligibility passages) |
| S34 | News on net billing and capacity: exit.al, Tirana Times, Albanian Daily News, Balkan Green Energy News, ERE decisions page | https://exit.al/en/?p=161011 ; https://www.tiranatimes.com/?p=142273 ; https://albaniandailynews.com/news/solar-power-up-by-44-changes-in-compensation ; https://balkangreenenergynews.com/?p=54107 ; https://www.ere.gov.al/en/publications/decisions/2026 | 2026-10-18 | G2, G4 | via search summary; none opened |
| S35 | ICE (Italian Trade Agency), news on Albania's 2026 electricity market opening | https://www.ice.it/it/news/notizie-dal-mondo/297847 | 2026-10-18 | G1 | via search summary |
| S36 | ERE, notice of board meeting 14 Apr 2026 (distribution tariffs 1 May to 31 Dec 2026) | https://mail.ere.gov.al/media/files/2026/04/14/Njoftim_Mbledhje_14_Prill_web.pdf | 2026-10-18 | G3 | via search summary; rates not seen |
| S37 | Tirana Times, undated item on business tariffs (one of ?p=117062, ?p=110669, ?p=117335) | https://www.tiranatimes.com/?p=117062 | 2026-10-18 | G3 | via search summary; which item not confirmed |
| S38 | Gazeta Tema (English), Albania to cut electricity tariffs for low-use households from February (2025) | https://english.gazetatema.net/economy/albania-to-cut-electricity-tariffs-for-low-use-households-from-february-i338030 | 2026-10-18 | G3 | via search summary |
| S39 | Balkan Green Energy News (Serbian edition), headline on higher electricity prices for companies in Albania | https://balkangreenenergynews.com/rs/i-do-35-vece-cene-elekticne-energije-za-kompanije-u-albaniji | 2026-10-18 | G3 | headline only |
| S40 | EBRD GEFF Albania pages, EBRD news 2018, Intesa Sanpaolo Bank Albania | https://ebrdgeff.com/albania/?p=2634 ; https://ebrdgeff.com/albania/?p=2581 ; https://ebrdgeff.com/albania/?p=2576 ; https://www.ebrd.com/news/2018/ebrd-lends-6-million-to-union-bank-to-boost-green-energy-investments-in-albania.html ; https://www.intesasanpaolobank.al/en/retail/lajme/berzh-geff-investime-te-gjelbra.html | 2026-10-18 | G5 | via search summary |

Internal files (research directory, earlier run 2026-10-13, read 2026-10-18): 04-security-safety.md (command classes B1, lease B7, wording rules: used in F, H); 05-legal.md (F liability, G energy law: used in A1, F, G); 07-market-users.md (G: tourism seasonality, household tariff, prosumer capacity: used in G); 03-agriculture.md (IPARD and farm-pumping tariff notes: used in G3); 00-manifest.md (local source copies).

Status of this file: sections A to J complete as of 2026-10-18. Largest evidence gaps, in order of cost to the product: no field detection rate for power-only checks (E); no Albanian grid code or OSHEE technical requirements (F4); no net-billing formula and no 2026 business tariff (G2, G3); nothing on what hotels and farms buy (G6).
