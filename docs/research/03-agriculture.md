# 03 - Agriculture desk research for the Greecon Platform (irrigation decision support)

> **Desk research, October 2026. Not reviewed by a licensed expert, and not legal, engineering, agronomic or safety advice.**
> Written from public sources on the dates inside. Facts are separated from inferences in the text, and
> anything marked UNVERIFIED, recalled or "search summary" was not confirmed from a primary source. File
> names such as `src/law124.txt` refer to the researcher's working folder, not to this repository. The
> decision-ready summary of all nine reports is `docs/17-constitution.md` to `docs/26-research-register.md`.

Status: COMPLETE draft, 2026-10-13. All sections A-J filled; confidence marked per claim (High = source read directly; Medium = secondary or search synopsis; Low = inference or single weak source). "(inference)" = my reasoning, not a source statement.
Confidence key: High = primary/standards source read directly; Medium = reputable secondary or partly verified; Low = single weak source / inference / unverified.

## A) What decision support must get right (agronomic science)

### A1. Crop water requirement (FAO-56)
- **ETc = Kc x ETo** (ETo: grass-reference evapotranspiration, "quantifies the effect of climate"; Kc: crop species and stage). FAO 217 ch.6 p.113; FAO-56 ch.2/6 (fao.org/4/x0490e). High.
- **FAO-56 Penman-Monteith**: ETo = [0.408 D (Rn - G) + g (900/(T+273)) u2 (es - ea)] / [D + g (1 + 0.34 u2)] (mm/day). Inputs: net radiation Rn (from shortwave radiation or sunshine hours), soil heat flux G (about 0 daily), mean air temperature T at 2 m (Tmax/Tmin preferred), wind speed u2 at 2 m, vapour-pressure deficit es-ea (from humidity/dewpoint), plus altitude and latitude (for the psychrometric constant g and slope D). High (fao.org x0490e06; the equation image did not render, standard form confirmed against its symbol list).
- **Consequence:** the canonical points (soil moisture, air temperature, humidity) cannot produce ETo: radiation and wind are missing. FAO 217 (Table 3, p.114) recommends, for plastic greenhouses with limited data, Hargreaves (temperature range + radiation-based) or the Almeria radiation method (external solar radiation x cover transmissivity); full Penman-Monteith works inside plastic with fixed aerodynamic resistance 295 s/m. High.
- **Kc values that matter** (FAO-56 Table 12 via fao.org x0490e0b; blank cells not captured; FAO 217 Table 4 for greenhouse):

| Crop | Kc ini / mid / end | Note |
|---|---|---|
| Tomato / pepper (field) | - / 1.15 / 0.70-0.90 ; - / 1.05 / 0.90 | staked crops need higher Kc (FAO-56 fn 2) |
| **Tomato greenhouse, supported (Almeria)** | 0.2 / 1.4 / 1.0 | pepper 0.2/1.3/0.9; cucumber 0.2/1.2; melon 0.2/1.3/1.1; eggplant 0.2/1.2/0.9 |
| Olives (40-60% cover) | 0.65 / 0.70 / 0.70 | |
| Grapes table / wine | 0.30 / 0.85 / 0.45 ; 0.30 / 0.70 / 0.45 | |
| Citrus (70% canopy, no ground cover) | 0.70 / 0.65 / 0.70 | +0.1-0.2 in humid climates (fn 21) |
| Apple/pear/cherry, no ground cover, frost | 0.45 / 0.95 / 0.70 | active ground cover: 0.50/1.20/0.95 |
| Stone fruit, no ground cover, frost | 0.45 / 0.90 / 0.65 | |

FAO 217 ch.6 conclusions: "The standard values of Kc reported by FAO for outdoor vegetables are not suitable for the tall canopies of supported crops grown in greenhouses." Illustration (mine): greenhouse tomato, mid-season, ETo inside = 3 mm/day gives ETc = 1.4 x 3 = 4.2 mm/day = 4.2 L/m2/day net; gross is higher for salinity leaching and emitter non-uniformity (FAO 217 p.121). High for the sourced numbers.

### A2. Soil water
- **TAW = 1000 (thetaFC - thetaWP) Zr** (mm); **RAW = p x TAW**; stress begins when depletion exceeds RAW (FAO-56 ch.8, Eq. 82-83). p falls with high demand: p = p_table + 0.04 (5 - ETc), limited to 0.1-0.8. High.
- **p at ETc ~5 mm/day (Zr, m)**: tomato 0.40 (0.7-1.5); cucumber 0.50 (0.7-1.2); potato 0.35 (0.4-0.6); maize 0.55 (1.0-1.7); olive 0.65 (1.2-1.7); table grape 0.35, wine grape 0.45 (1.0-2.0); citrus 0.50 (1.2-1.5); apple/pear/cherry and stone fruit 0.50 (1.0-2.0); watermelon 0.40. High.
- **Soil texture changes TAW by more than 2x**: FAO-56 Example 36: loamy sand 90, silt 170, silty clay 120 mm/m; FSA58 Table 2 (Arkansas soils): sand 1.0, sandy loam 1.4, clay 1.6, silt loam 2.37 in/ft (about 83 / 117 / 133 / 197 mm/m). High.
- **Matric-potential anchors** (FSA58 p.1-3): field capacity "typically around 15-35 centibars, dependent on soil type"; permanent wilting 1500 cb; "at least half of the total plant available water is held as a reserve"; **allowable depletion 30-50% of TAW**: 30-35% for pivots (small applications, margin for delay), 40-50% for furrow (large applications), 50% for the last irrigation of the season. High.

### A3. Scheduling approaches proven in practice
| Approach | Trigger / volume | Needs | Limits | Source |
|---|---|---|---|---|
| Soil-moisture (matric potential or VWC) | start at a **lower limit**, stop at an **upper limit**; the gap sets the volume | sensors at root depth | VWC limits must be found per crop and soil; matric limits are standard | FAO 217 p.123 |
| ET-based water balance | one irrigation = cumulative ETc since the last one (+ salinity/uniformity allowance); daily in warm weather, every 3-4 days when cool | ETo, Kc by stage, area, system | drifts without soil checks; Kc differs for staked greenhouse crops | FAO 217 p.121 |
| **Hybrid (plan from ETc + sensors)** | plan from ETc, sensors set frequency and adjust volume | both | more set-up | FAO 217 p.122: "an effective way to ensure optimal irrigation" |
| Deficit irrigation | raise the lower limit's dryness on purpose for quality or scarcity | agronomist | yield risk; needs crop knowledge | FAO 217 p.123 |
| Look-up tables (historical ETc) | Almeria tables of daily net requirement by crop and period | crop, planting date | historical ETc was "generally very similar" to real-time ETc in Almeria's stable climate | FAO 217 p.121-122 |

Greenhouse matric-potential guideline for high-frequency irrigation (FAO 217 p.124, citing Thompson & Gallardo 2003): coarse soil -10 to -20 kPa, medium -10 to -30, fine -20 to -40; first-stress lower limits -35 to -58 kPa for sandy loam (Thompson 2007b). A simple "when": days to irrigation = (plant-available water + effective rain) / daily crop use - irrigation duration (FSA58 p.4). High.

### A4. Fertigation EC and pH (FAO 217 ch.9, water quality)
- Irrigation-water pH 6.0-8.5 usable; below 5 or above 8.5 "anomalous"; fertigation/substrate pH target **5.5-6.5 (<7.0)**, achieved by acid injection (nitric, phosphoric, sulphuric acids are also fertilisers); alkalinity matters more than pH; water with EC < 0.2 dS/m is poorly buffered. 1 dS/m = 1 mS/cm = 1000 uS/cm; high-salinity class from 3.0 dS/m.
- Salinity thresholds, irrigation-water EC (mS/cm) at 0% / 10% / 25% yield loss (FAO 217 Table 6): tomato 0.5/2.3/4.4; cucumber 1.7/2.2/2.9; capsicum 1.0/1.5/2.2; lettuce 0.9/1.4/2.1; bean 0.7/1.0/1.5; potato 1.1/1.7/2.5; watermelon 1.5/2.4/3.8. The text stresses these vary with genotype, soil and climate. Leaching fractions of 20-40% are used in substrate culture. High (sourced), but crop-specific recipes need an agronomist.

### A5. Greenhouse climate (FAO 217 early chapters citing Nisen et al. 1988; RH and VPD from ch.4 p.63-65)
- The warm-season species FAO 217 indicates (list not re-checked; presumably tomato, pepper, eggplant, cucurbits): average 17-28 C, limits 12 C min / 32 C max; several days below 10-12 C, or above 30 C in dry air (30-35 C in humid air), cut productivity; a 5-7 C day/night difference is needed; frost causes irreversible damage.
- RH 60-90% "has little effect"; below 60% (ventilating in arid weather, young plants) can cause water stress; above 95% for long periods, especially at night, drives Botrytis. VPD is the transpiration-linked form of humidity; keeping it above a minimum supports calcium transport (blossom-end rot) and limits disease. The extracted text gives no numeric VPD target (needs agronomist). VPD = es(T) x (1 - RH/100), es = 0.6108 exp(17.27 T/(T+237.3)) kPa (FAO-56 Eq. 11-12 standard form; not re-fetched, Medium-High); e.g. 25 C and 70% RH gives about 0.95 kPa (my arithmetic).
- Ventilation is the first line of heat control; sprinkler frost protection in open crops works only if "the irrigation system is automated" (FAO 217 ch.8, microirrigation) and carries its own risks: not a v1 function.


## B) Sensors and their limits

### B1. Sensor types (FSA58 = Univ. of Arkansas fact sheet; FAO 217 ch.6 p.123-127; web = search synopsis, pages not opened, Medium)
| Sensor | Reports | Range / response | Calibration | Salinity | Failure modes and upkeep |
|---|---|---|---|---|---|
| Granular matrix (Watermark) | matric potential from electrical resistance of a ceramic/granular matrix, "not a direct measure like a tensiometer" (FSA58) | 0-239 kPa (FSA58); FAO 217: -10 to -200 kPa, "less reliable in wet soils (0 to -10 kPa)", slow in fast-drying soils; settles about a day after install | factory resistance-to-kPa curve; kPa limits are standard across soils, but kPa-to-water-amount is soil-specific (FSA58 Tables 2-4) | not addressed in the local sources (unverified) | "somewhat less accurate than tensiometers but require appreciably less attention"; life 5-7 years; needs sealed installation |
| Tensiometer | direct matric potential | usually 0 to -80 kPa; reduced-range 0 to -40 kPa for coarse soil/substrate; fast | none per soil | "not affected by salinity" | "require preparation and proper maintenance"; very suitable for drip greenhouse soils kept moist |
| Capacitance / FDR | volumetric water content (VWC) | continuous, multi-depth probes common | FSA58: "report relative values...not absolute...require calibration at every location and soil type"; FAO 217: VWC limits "have to be determined for each combination of crops and soil" | FAO 217: some models sensitive to salinity; web: eight dielectric sensors over-read more as salinity rose, all "reasonable" at EC1:5 <= 1.0 dS/m, about +-0.02 cm3/cm3 after calibration (PMC11478466); fertiliser/biochar shifted a sandy-loam calibration by up to 30% (PMC11436195) | cost; per-soil calibration; salinity drift; bulk EC is hard to interpret |
| TDR / TDT | VWC from signal travel time | research-grade; TDT cheaper | standard curves exist, in-situ calibration advised (web) | better but not immune | FAO 217: TDR "not widely used for irrigation management"; cost |

### B2. Installation, number of sensors, representativeness
- Row crops (FSA58 p.2): sensors glued to PVC at **6, 12, 18, 30 in (15/30/45/75 cm)** in the plant row; a rubber washer and soil seal stop water running down the pipe to the sensor; "Scheduling irrigation with only two sensors is not recommended"; four depths give redundancy if one fails; the 12-in sensor may sit on a tillage pan and mislead; interpret 30 in with caution; early season use 18-24 in. Rooting depth must be known (FSA58 Table 1).
- Greenhouse drip (FAO 217 p.123): one sensor in the zone of maximum roots, optionally deeper ones to detect drainage and side ones to size the wetting bulb.
- **Representativeness:** "Soil moisture within a field can be variable and placement of the soil sensors cannot always be assumed to be representative of the field...Confirm readings by sampling the soil profile...and the feel method when in doubt" (FSA58 p.3). No sourced count of stations per hectare was found: treat one station per uniform block (same soil, crop, emitter) as the minimum and ask an agronomist (my inference; Low).
- **Diagnostics a platform can use** (FSA58 p.3): "as long as sensors are showing movement, plants are extracting water"; a flat line means no uptake (stress or saturation); readings that level out after irrigation instead of falling to ~0 kPa suggest a sealing soil; unchanged deep readings suggest a pan or over-irrigation; above field capacity air is displaced, roots lack oxygen and readings flat-line. Tension changes only a few kPa/day near field capacity but 5-10 kPa/day above 90 kPa at peak demand.
- **Connectivity and reporting:** farmers preferred hourly (6 of 22) or daily (9 of 22) remote-sensing data (dW21). EU868 LoRa duty cycle is 1% in most sub-bands (0.1% in two) and The Things Network's shared sandbox allows 30 s uplink airtime and 10 downlinks per node per day; private networks avoid the TTN limit but not the regulation (thethingsnetwork.org duty-cycle page, High). Report every 15-60 min and send a heartbeat so silence is visible (my inference). No sourced battery-life figures: unverified.

### B3. What the platform must record (metadata, none of it in the current vocabulary)
Per sensor: type/model, native unit and raw value, calibration (factory or soil-specific curve, date, who), install date, **depth (cm)**, position (in row, distance to emitter or trunk, inside/outside wetting bulb), field/block/zone, battery, last-seen. Per zone: soil texture and any pan, assumed root depth, crop/variety/stage, irrigation method and emitter spacing, field capacity, wilting point, TAW, MAD with source ("starting value" vs "confirmed on date"), last hand check (feel/gravimetric). Per event: irrigation start/stop and volume or duration, who approved, rain, advice issued/accepted/declined.

### B4. Why a single fixed 28% trigger is not sound
1. The same VWC means different things in different soils. FAO-56 Example 36 (loamy sand FC 0.15, WP 0.06; silt FC 0.32, WP 0.15; silty clay FC 0.35, WP 0.23): 28% is **above field capacity** in loamy sand (the rule would fire continuously: waterlogging, leaching), leaves **76% of available water** in silt (early), and only **42%** in silty clay (58% depleted, beyond the 30-50% allowable depletion). My arithmetic on sourced values; High.
2. Capacitance "%" is relative and sensor-, soil-, salinity- and temperature-dependent (FSA58; FAO 217; web).
3. It names no depth or root zone, no crop stage (p ranges 0.35-0.65 by crop), no ETc effect on p, no irrigation method (pivot 30-35% vs furrow 40-50% allowable depletion), no stop level, so it cannot say "for how long" (FAO 217: the gap between lower and upper limit sets the volume) and invites on/off chatter.
4. It ignores rain, last irrigation, water-allocation windows and sensor health.

**Defensible per-field configuration (minimum):** zone with soil class, crop and root depth; limits in the sensor's native unit (kPa for matric sensors, calibrated VWC otherwise) as a **start-at / stop-at band** over a depth-averaged profile (2+ depths, 3-4 preferred); defaults from FAO-56 p and TAW shown as "starting values, confirm after first season"; observed field capacity and stress points recorded from trends and hand checks (FSA58: "Users should monitor trends to...establish acceptable thresholds"); data-quality gates (fresh, in range, not flat-lined); minimum interval and maximum volume; who set the numbers and when. The seeded 28% should be labelled a demo placeholder, not advice.


## C) What farmers want and distrust

Evidence (both files read directly; neither is Albanian, so transfer to Albania is an assumption, Medium-Low): [R16] Rose et al. 2016, Agricultural Systems 149:165-174 (UK; farmer and adviser interviews and surveys; 15 factors); [dW21] de Witt et al. 2021, Outlook on Agriculture (29 commercial irrigators, South Africa; free FruitLook remote sensing vs soil probes). Quotes are exact: High.

### C1. Why tools fail or succeed
| Finding | Source | Evidence |
|---|---|---|
| Uptake is low despite many tools; usability, cost-effectiveness, performance, relevance and "compatibility with compliance demands" matter | R16 abstract | "uptake to be disappointingly low"; 15 influential factors |
| Simplicity and speed decide use | R16 s.3.2 | a tool "has got to be really simple and user-friendly" with "instantaneous information"; adviser: "a heap of information and figures and it's just too much. They want something quick, easy to look at."; visuals preferred |
| Trust needs a visible evidence base | R16 s.3.2 | "You have to know where the algorithms are coming from...otherwise we simply wouldn't use it." |
| Peers and habit | R16 s.3.2 | "put ten farmers together [to] share their experiences"; habit is "one of the most difficult factors to overcome" |
| Field-specific and usable in the field | R16 s.3.2 | advice "tailored to your situation, rather than just be generic"; mobile signal "a real issue"; "my iPhone isn't waterproof" |
| Compliance can outweigh usability | R16 s.3.2.4, s.3.3 | a tool called "a beast" was kept because "if you have an inspection and you've got it...it takes a lot of weight off" |
| Grants help, coercion alienates | R16 s.4 | subsidies helped cash-constrained farmers; forced use is "draconian" |
| Probes are used, extra data streams are not | dW21 abstract | 83% used technology but "only one type - soil water measurement"; 78% on one probe provider for "perceived accuracy and ease of use, as well as personalised after-sales service"; 86% knew FruitLook, one used it: "time cost"; "too much information in different formats is too time-costly" |
| Judgement stays with the farmer | dW21 Results, Conclusions | "All farmers said they would not use technology to replace field measurements and experience"; probes trusted "after they have been adjusted and calibrated over two to three seasons"; prefer "personal telephonic advice from an advisor they know and trust"; would adopt if "a consultant did the preparation and interpretation" or it "linked to the technology they currently use" |
| Cadence and water rules | dW21 Results, Discussion | preferred cadence for remote-sensing data: hourly 6, daily 9, weekly 5, rarer 2 (n=22), weekly is "too late"; with fixed scheme allocations and no storage farmers "irrigate as and when they receive water" and more efficiency technology "will therefore not be of any use to them" |
| Age: mixed | R16 s.3.3 vs dW21 | R16 lists age; dW21 found no significant age-uptake relationship (n=29) |

### C2. What "good" looks like (my synthesis of the findings above)
1. One answer per field: "Irrigate now / Wait / Irrigate for N minutes", one plain-language reason, visual, readable in the field.
2. Reasons and provenance on tap: which sensor and depth, which limit, who set it, when last confirmed (no black box).
3. Works with poor signal (last-known state cached); one screen, no second data stream beside the probe farmers already trust.
4. Farmer in charge: approve, decline or snooze in one tap; "I checked by hand: agrees/disagrees" feeds threshold tuning; a named human (installer or agronomist) stands behind it.
5. Records as a by-product (irrigation and advice logs exportable), and thresholds shown as "starting values, to be confirmed after the first season".

### C3. ROI evidence
Neither local source quantifies water, energy, labour or yield returns (both treat cost-benefit qualitatively; dW21: include time in cost-benefit). The only sourced savings figures are water-use trial results in F (Medium); none exist here for labour or yield. Do not promise a percentage before pilots.

## D) Albania / Balkans context (incl. IPARD III)
Sources: [IP3] = ipard3_al.txt (IPARD III Albania programme; figures quoted from MARD/INSTAT inside it); [MC5] = ipard_mc5.txt; web items are search synopses, Medium.

### D1. Farms, crops, water
- **Land:** UAA 1,174,081 ha (MARD 2018): arable 52.1%, permanent grassland 40.7%, permanent crops 84,654 ha (7.2%); **irrigated land 175,926 ha = 15.0% of UAA** (IP3 context indicators 17-18). High.
- **Fragmentation:** "dominated by a large number of very small and fragmented farms": about 45% of farms are 0-1 ha, 41% are 1.1-2 ha, 14% above 2 ha; average about 1.2 ha (IP3 sector analysis). High. Implication (inference): the typical buyer is a small farmer with several tiny parcels, so cost per monitored parcel decides adoption.
- **Crops and systems:** olive trees 10.3 million in 2019 (8.2 million in production; 98 kt; about 12 kg/tree), "more than 100,000 farmers" grow olives; grapes "widespread"; vegetables 1.17 Mt in 2018, yield 20.6 to 36.8 t/ha (2015-2018) through more greenhouses; greenhouses are "dominated by unheated (solar) greenhouses, most of which are simple plastic greenhouses", mainly tomato then cucumber, typically two cycles a year; citrus, potato and MAPs also present (IP3 Table 6, vegetable and fruit sections). High.
- **Water infrastructure:** 626 irrigation reservoirs designed for 560 million m3 now hold about 290 million m3; 410 of 626 dams have significant damage; about 200,000 ha of irrigated area need rehabilitation "including...replacement of almost all pumping stations used for irrigation" (IP3 environment chapter). High. Secondary (Medium): about 360,000 ha were equipped but about 80,000 ha irrigated in 2009 and about 100,000 ha in 2017; state-funded Drainage Boards run drainage and main canals; farmer WUAs (World Bank projects 1995-2010) mostly could not cover O&M and are being converted into Water Users Organisations (bujqesia.gov.al ToRs; World Bank P162786).
- **Not found (unverified):** shares of drip vs furrow vs sprinkler, and of well vs river vs canal sources. IPARD funds "on-farm drip-irrigation and water sprinkling systems and services for digging wells, when primary irrigation is not available", which suggests network water is primary and wells the fallback (inference, Low).
- **Digital context (IP3 SWOT, p.54):** strength "99% mobile connectivity (G4) nation-wide...relatively high internet usage rate and mobile applications among the rural population"; weakness "very weak digitalisation of the agriculture and rare investments in precision agriculture". High.
- **Implication from dW21:** where water arrives on a canal rota, the useful advice is often "how long to irrigate when your turn comes" and "this turn can be skipped", only if the farmer has storage or flexibility (inference).

### D2. IPARD III, Measure 1 "physical assets of agricultural holdings" (IP3 s.8.3.1, p.98-99)
- **Eligible (fruit, vegetables, olives, MAPs, vineyards):** greenhouses "including installations encompassing also renewable energy technologies for heating or watering systems"; "on-farm drip-irrigation and water sprinkling systems and services for digging wells"; "production of energy from renewable energy sources for on-farm consumption only - heating, cooling, ventilation, irrigation or water pumps (such as solar panels...)"; a plant is eligible if its capacity is at most **120% of the 3-year average on-farm consumption**. High.
- **Sensors / monitoring / ICT / precision:** no explicit line item found ("precision" occurs only in the SWOT weakness; "ICT" only for advisory and research capacity). The detailed "list of eligible expenditure" is a separate document not in the file: ask the IPARD Agency whether controllers and sensors count as part of an irrigation system. Unverified.
- **Rates:** project eligible cost EUR 10,000-500,000 (EUR 1.5m per recipient); public aid up to **60%**, 65% in mountain areas, 70% for young farmers or certified organic, +10 points for effluent/waste management and renewable energy (cumulative cap 75%); EU share 75% of public aid. High.
- **Evidence funders ask for:** water metering "enabling measurement of water use at the level of the supported investment"; a licence, authorisation or concession for water use before the payment claim (Law 111/2012, Arts. 38, 39, 41(1)(e)); land ownership or at least 10 years' use right; entry in the national farm register; a business plan (simplified for small projects); accounting records kept at least 7 years; invoices; cooperation with ministry, IPARD Agency and EC auditors. High.
- **Uptake context:** Measure 1 is 28.1% of Albania's IPARD III EU allocation (Measure 3: 27.1%); IPARD II absorption was 59.1% (EUR 41.9m of 71m) by end-2024 [MC5]; the SWOT says missing farm register and FADN "may be prohibitive" for access. Reading: paperwork is a bottleneck (inference, Medium).
- **Records:** IP3 mentions support for GlobalG.A.P., organic and ISO certification but no record rules; GlobalG.A.P. irrigation/fertiliser record requirements were not verified here. Platform logs (water per field, pump energy, irrigation events) can support, never replace, invoices and accounting.

## E) Weather and forecast inputs
| Source | Terms | Notes |
|---|---|---|
| Open-Meteo | free API: "You may only use the free API services for non-commercial purposes."; building it into a commercial product counts as commercial; <10,000 calls/day, 5,000/h, 600/min; data CC BY 4.0; "We do not guarantee the accuracy, completeness, or reliability" (open-meteo.com/en/terms, High) | Greecon needs a paid plan; self-hosting not addressed on the page (unverified) |
| ECMWF open data (IFS, AIFS) | CC-BY-4.0, "may be redistributed and used commercially, subject to appropriate attribution"; 0.25 degree GRIB2; IFS runs 00/06/12/18 UTC, 3-hourly to 144 h; AIFS 6-hourly to 360 h; only the latest 12 runs kept (ecmwf.int open-data page, High) | about 25 km grid: too coarse for showers at field scale (inference); heavy GRIB processing belongs in the cloud, not the edge |
| Albanian hydromet (IGEUM, Polytechnic Univ. Tirana) | no open API found; 10-day agro-meteorological bulletins by subscription; documented resource constraints (search synopsis, Medium-Low) | ask for a data agreement; use as a validation source, not a dependency |
| Own station / rain gauge | n/a | the only field truth; R16: rainfall "between our three farms...vastly different"; a rain-gauge point is not in the vocabulary today |
Not checked here: MET Norway, DWD, NOAA licences.

**How rain forecasts should and should not influence irrigation.** Effective rain is not forecast rain: FSA58 assumes storms under half an inch are "completely retained" and heavier, intense storms lose more to runoff; for soil-grown greenhouse crops rain does not enter the water balance (FAO 217 p.121). *Should:* advisory only, shown as "rain forecast X mm, probability Y%, forecast issued at T; soil is Z kPa above your start limit: waiting is safe/risky", with the soil margin deciding. *Should not:* auto-cancel or auto-start irrigation on a forecast; treat probability as amount; treat a grid cell as field rain; let a forecast override a stress limit; keep using a stale forecast. **Before it is trustworthy (inference):** field rain observation to compare; one season of forecast-vs-gauge backtests at pilot sites to set the delay rule; show source, age and uncertainty; fail-safe to "no forecast" when data is old; licence compliance. No sourced precipitation-skill figure was found in this run.

## F) Water-energy-food nexus
- **PV pumping (FAO solar-irrigation guidance via search synopsis, Medium):** storage in elevated tanks or ponds is "the most popular" application, releasing water by gravity so irrigation timing is independent of pumping; FAO warns that without allocation rules, regulation and enforcement, cheap solar pumping "can accelerate groundwater depletion", and that initial cost is high. IPARD makes on-farm PV for "irrigation or water pumps" eligible (D2).
- **Pumping energy** scales with volume and head, so saved water saves energy at the same head (physics; no sourced figure). Sourced savings exist only for water: 5-25% in orchard and vegetable trials, up to about 26% with sensors vs an FAO-56 schedule in Spanish citrus with no significant yield loss, apple orchard soil-moisture scheduling 10.8% below ET-based (Medium; search synopses of SARE/agronomy 11:732 and others, not opened). A "30-50%" claim could not be traced: do not quote it. Labour and yield ROI: no sourced figure.
- **Solar peak vs off-peak:** shifting pumping to PV hours is sensible where PV is direct-coupled; **Albanian tariff structure for farm pumping is unverified** (search found ERE decisions: a 2015 non-household table by voltage level with higher peak prices, and a 2025 household price cut; nothing for agriculture). Do not encode tariffs.
- **Rule:** energy optimisation moves irrigation inside the agronomically acceptable window and the canal/licence allocation; it never defers beyond the allowable depletion.

## G) Safety and liability boundaries
Costs are asymmetric: a wrong irrigation decision costs a season; fertigation injects acids and fertilisers (FAO 217 ch.9: nitric, phosphoric and sulphuric acids); pumps can run dry or over-pressure; valves can hammer.
1. **Advisory by default.** Commands are simulated today and should stay so until the pilot evidence in H.ii exists.
2. **Human approval per action or per bounded schedule**, with hard limits (maximum run time, maximum volume per day, minimum interval, licensed volume) enforced at the edge so a cloud or network failure cannot exceed them.
3. **Manual override always wins** and is visible; the platform never replaces hardware protection (dry-run, pressure relief, injection interlocks that stop injection when flow stops).
4. **Fail safe:** on stale, implausible or missing data, say "cannot advise"; on power or comms loss, stop or do nothing, never "repeat last command".
5. **No automated chemical injection** until a licensed agronomist and a safety review define limits.
6. **Log** every advice, approval, command and result; show provenance of thresholds.
7. Terms of service should state decision support, not guarantee; legal wording and liability exposure were not researched: counsel needed (I).

## H) Implications

### H.i) MUST EXIST FROM DAY ONE (proven need)
1. **Per-field/zone soil-moisture configuration:** crop, soil class, root depth, a depth-averaged **start-at / stop-at band in the sensor's native unit**, allowable-depletion source, and a "starting value / confirmed on date" flag (A2, B4: FSA58, FAO 217 p.123, FAO-56).
2. **Sensor metadata:** type, unit, depth, position, soil, calibration, install date, last-seen, battery (B3).
3. **Honest "irrigate now / wait / for how long" advice with reasons**, data age and threshold provenance; one answer per field, visual, tolerant of poor signal (C2: R16, dW21).
4. **Data-quality gates:** stale, out-of-range, flat-lined or disagreeing sensors give "cannot advise", never a guess (B2).
5. **Human approval, manual override and an event log** of what was irrigated, when, by whom (G; dW21: farmers "would not use technology to replace field measurements and experience").
6. **Edge-enforced limits** (maximum run time and volume, minimum interval) and "simulated" labelling until a real device path exists (G).
7. **Water-use record per field**, exportable: IPARD requires metering and 7-year records (D2).
8. **Relabel the seeded 28% rule** a demo default; real fields carry their own values (B4).

### H.ii) SEAMS for later (extension point / evidence that would prove the need)
| Seam | Extension point | Evidence needed |
|---|---|---|
| ET-based advice | derived ETc per zone (Kc table by crop and stage; ETo from radiation and wind or a labelled gridded estimate) shown beside the sensor | farmers with no or few sensors; ETc vs soil-trend disagreement logged over a season; requests for "how much" |
| Rain forecast | forecast adapter with source, age, licence; rain-gauge point | backtest vs gauge at pilots; farmers already delaying irrigation for rain |
| Fertigation (read-only first) | EC and pH points per injector/drain, agronomist limits | greenhouse customers with injectors and an agronomist to set limits |
| Per-zone valves | device-write adapter behind approval gate and edge limits | pilot with controllable valves and hardware interlocks; high advice acceptance and hand-check agreement over a season |
| Greenhouse climate | derived VPD, ventilation and frost alerts from temperature and humidity | growers asking; agronomist-set targets (none numeric in sources) |
| Energy | pump power/flow and PV production points; solar-window scheduling | customers with PV pumping; verified tariff |
| Crop models, yield | none now | a season of logged data and an agronomy partner |
| Compliance exports | IPARD / GlobalG.A.P. record formats | Agency or certifier confirms what is accepted |

### H.iii) THINGS TO AVOID
- One global % threshold; presenting capacitance % as absolute (B4).
- ETo/ETc without radiation and wind unless clearly labelled temperature-only or gridded; mixing outdoor and greenhouse Kc (A1).
- Auto-actuation from forecasts; automated acid or fertiliser injection; any command without approval and edge limits (G).
- Many numbers and charts per field, or a second data stream next to the probe the farmer trusts (R16, dW21).
- Quoting savings percentages not measured on pilots (sourced trials 5-25%; "30-50%" untraceable); tariff logic; assuming drip or private wells (D1).
- Treating silence as "dry" or "fine"; hiding sensor faults.
- Generic advice that ignores canal rotas and licensed volumes (dW21).
- "AI" framing: trust came from a visible evidence base (R16).

## I) Open questions for a licensed agronomist / user research
1. First segment: greenhouse tomato/cucumber, olives/vines or orchards (drives sensor type and thresholds)?
2. Local defaults: field capacity, wilting point and TAW by Albanian soil class; allowable depletion by crop and method; matric limits for local greenhouse soils; are Almeria Kc values transferable to Albanian plastic houses?
3. Sensor choice (tensiometer, Watermark, capacitance) given local water salinity; sensors per parcel; calibration protocol; battery life; LoRa vs cellular coverage.
4. Real shares of drip/furrow/sprinkler and well/river/canal; who controls timing (rota, storage)?
5. Water licences, volume caps and groundwater permits: will customers accept volume limits in the platform?
6. IPARD: are sensors and controllers eligible; what evidence do the Agency and auditors accept for metering and energy self-consumption?
7. GlobalG.A.P. and buyer irrigation-record requirements.
8. Access terms for Albanian hydromet data; local rainfall variability.
9. Verified agricultural electricity tariff and time-of-use structure (ERE, OSHEE).
10. ROI: pilot design for water, energy, labour and yield, plus time cost and willingness to pay (dW21).
11. Liability, consumer-protection and insurance rules for advisory output and remote actuation.
12. Does age, language or channel (SMS, voice, phone) change adoption in Albania? Evidence is mixed (R16 vs dW21).

## J) Source list
Local files (directory ); confidence in the text read:
1. fao_gap_greenhouse.txt: FAO Plant Production and Protection Paper 217, GAP for greenhouse vegetable crops (Mediterranean); ch.4 p.63-65, ch.6 p.113-127, ch.9 (Table 6, p.179). High.
2. fsa58.txt: Henry, Francis, Espinoza, Univ. of Arkansas FSA58 (2020), Watermark sensors for irrigation, p.1-4 (US row crops, Arkansas soils). High; transfer to Albanian soils and crops is an assumption.
3. rose2016.txt: Rose et al. 2016, Agricultural Systems 149:165-174 (UK). High.
4. sa_study.txt: de Witt et al. 2021, Outlook on Agriculture (29 South African commercial irrigators). High; small sample.
5. ipard3_al.txt: IPARD III Programme Albania 2021-2027 (s.8.3.1 p.98-99, SWOT p.54, context indicators). High.
6. ipard_mc5.txt: IPARD monitoring committee overview, June 2025 (Albania allocation and absorption lines only). High, narrow use.
7. wbiip.txt: WBIF entry; confirms IPARD III is a grant programme (Law 97/2022). High, minor.

Web, opened:
8. FAO-56 ch.2, https://www.fao.org/4/x0490e/x0490e06.htm (Penman-Monteith, ETc = Kc x ETo). High.
9. FAO-56 ch.6, https://www.fao.org/4/x0490e/x0490e0b.htm (Table 12 Kc; some "ini" cells not captured). High.
10. FAO-56 ch.8, https://www.fao.org/4/x0490e/x0490e0e.htm (TAW, RAW, p, Zr; Table 19 not captured). High.
11. https://open-meteo.com/en/terms. High.
12. https://www.ecmwf.int/en/forecasts/datasets/open-data. High.
13. https://www.thethingsnetwork.org/docs/lorawan/duty-cycle/ (EU868 duty cycle, TTN fair use). High.

Web, search synopses only (pages not opened; Medium or Low): sensor salinity and calibration, https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11478466/ and /PMC11436195/; Albania irrigation institutions, https://cesr.sesric.org/Presentations/Water_Management_Symposium/Albania/Albania.pdf, https://projects.worldbank.org/en/projects-operations/project-detail/P162786, bujqesia.gov.al ToRs; sensor-based irrigation trials, https://projects.sare.org/media/pdf/a/g/r/agronomy-11-00732.pdf and https://projects.sare.org/project-reports/lne19-378/; Albania hydromet, https://citizens.al/en/?p=4245, https://wamis.org/albania/; FAO solar irrigation, https://www.fao.org/3/cc4141en/cc4141en.pdf and the GACSA solar irrigation practice brief on fao.org; ERE tariff decisions, https://ere.gov.al/doc/DECISION_NO._148.pdf.

Not verified or not researched: GlobalG.A.P. record rules; MET Norway, DWD, NOAA licences; Albanian agricultural electricity tariff; drip/furrow and well/canal shares; sensor battery life; stations per hectare; precipitation forecast skill; liability law; ventilation sizing and VPD targets. Items marked "(inference)" are my reasoning, not source statements.
