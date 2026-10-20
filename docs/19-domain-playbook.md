# 19. Domain playbook: water, agriculture and energy

Status: written 2026-10-18 from desk research (`docs/research/01-energy.md`, `02-water.md`,
`03-agriculture.md`). No expert has reviewed it and no customer has used it. Where a sentence is an
inference rather than a fact, the research report says so; the open questions for a licensed
engineer, agronomist or regulator are listed in each report and summarised in section 6.

The platform serves three sectors with one model. This document says, for each, what the person on
site actually does, what the platform does for them today, what must exist from day one, what is
left as a seam with the evidence that would justify building it, and what we will not do.

## 1. What is the same in all three

- **One answer first.** Each sector's home question is the same: is it running, did it do what it
  should, is anything wrong, what do I do next? (`docs/17-constitution.md`.)
- **A reading is a value, a time and a quality.** Never a bare number. Not available is empty, never
  zero. Energy comes from counters, never from adding up power samples.
- **Records are not readings.** A laboratory result, a desludging, a calibration, a hand check are
  events with a date, a person and a document. They are kept as records, not forced into a time
  series.
- **A site states its own limits** (`pointLimitDefinitions`; Principle R9). What counts as low,
  dry or surplus depends on the tank, the soil and the plant. The platform has a standard only where
  one is safe, and says so.
- **Advisory first.** Nothing here sends a command to equipment today, and the first real commands
  need the release gate in `docs/23-safety-and-security-case.md`.
- **The vocabulary is closed on purpose.** The sixteen canonical readings are enough to learn from.
  Opening it is a seam: a customer-defined reading kind is a namespaced registry entry that is
  monitored but never feeds the hard rules. The proof trigger is three sites asking in one quarter
  (`docs/24-architecture-seams.md`).

## 2. Water and wastewater: the hotel plant room

### What the person does and must prove

Normative Act no. 8 of 28 December 2023 covers hotels of at least six rooms and similar
accommodation, with restaurants and bars, in coastal, lake-side and river-side zones that were
discharging untreated wastewater near bathing water. They had to have a plant or individual
treatment system, and a task force inspects and samples. Fines are by pollution load (category I up
to 50 population equivalents, 1.5 to 1.85 million lek; category II up to 180, 1.9 to 2.2 million;
category III above 180, 2.4 to 2.65 million), with 60 days to comply, then double. Whether the Act
was converted into law, and whether the task force mandate was extended past one year, is not
verified.

What an inspector can ask to see (`research/02-water.md` A2): a real plant connected through an
inspection manhole; effluent values for the site's category at the outlet manhole, with at least the
minimum samples, in a monitoring register; sludge hauled by a licensed operator under contract; and,
under Law 9115/2003, staff training, operating documents, registers and a self-monitoring
programme. Where there is no sewer and no irrigation reuse, treated water is stored five to seven
days and emptied by licensed vacuum operators: for 60 rooms that is about 180 to 252 cubic metres,
so the storage level is a first-order operating signal and a cost driver.

### What the platform does today

Tank level, flow, pressure and pump status are readings. Tank low and critical are derived (standard
levels, or the site's own), "pump running with no flow" is derived only when the pump is confirmed
running, readings that go quiet are shown as out of date, and an alert opens for a critical tank, a
low tank, a dry-running pump and a lost connection. Nothing about effluent quality, laboratory
results or blowers exists yet.

### From day one, not built yet

1. **A laboratory-result register** as a record type: parameter, value, comparator, limit of
   quantification, sample type and point, laboratory and method, the report attached, append-only
   with corrections as new versions. Parameters preloaded from the regulation (BOD5, COD, suspended
   solids, total nitrogen, total phosphorus, fats, E. coli, intestinal enterococci) plus pH and
   temperature in the field. Show "samples this year against the minimum" and the reference limit
   with its article, with a standing line that it is a reference and the platform does not certify
   compliance.
2. **A site profile**: discharge category from rooms (rooms times three is population
   equivalent), discharge route, sensitive-zone flag, plant type, permit references. Limits live in a
   versioned table with the source article, because the regulation has numbering errors and may
   change.
3. **Operating records**: desludging (date, volume, licensed hauler, receipt), sample taken, sensor
   calibration, sensor replaced.
4. **Existing readings with a role**, not new names: tank level for the influent sump, the aeration
   tank and the treated-water storage; flow for effluent and inflow; pump status and command for lift
   pumps where the integrator enabled remote control.
5. **Three new readings only**, as proposals to confirm with an engineer: blower status, blower
   power, and dissolved oxygen where a probe is already fitted. Aeration is the largest energy use
   and the main failure point; status and power are the cheapest trustworthy evidence.
6. **Five alerts only**, decided at the edge: blower stopped while the plant should be aerating;
   treated-water storage high, with days to full; sump high-high (a hard-wired float read as status);
   sustained low oxygen while the reading is good; a sample due before and during the summer.
7. **Honest wording in the hotel guide**: records laboratory results and operating evidence; online
   sensors are indicators, not proof; does not certify compliance.

### Seams (extension point, and the evidence that would prove the need)

| Seam | Evidence that would prove the need |
|---|---|
| Online pH, turbidity, ORP, conductivity | A permit or customer with a membrane plant or reuse requires them, and sites log calibrations on time |
| Oxygen-based blower control | A variable-speed blower and a clean probe on site, a season of kWh and oxygen data, engineer-approved set-points |
| Reuse records (reuse-class validation and risk plan) | Albania adopts reuse classes, or a permit requires them, and hotels irrigate with effluent |
| Laboratory import | Two or more laboratories deliver structured results |
| Authority export | The environment agency or ministry publishes a template or portal |
| Anomaly detection on blower power, oxygen, turbidity | A full season from about ten plants, maintenance logs as labels, a measured false-alarm rate |

### Never

A compliant or non-compliant badge, or a "predicted breach", computed from sensor data. Remote
commands on blowers, dosing, valves or bypass gates. Automatic restart after a fault. Cloud-dependent
safety. A "safe to enter" or entry-permit function: sumps and tanks are confined spaces and hydrogen
sulphide numbs the sense of smell. Remote dosing or chlorination set-points. Treating a turbidity or
UV proxy as the legal parameter. Hard-coding Albanian limits. Alarm floods and plant-graphics: one
"plant fine or needs a person" status and five alerts are enough.

## 3. Agriculture: irrigation decision support

### What the person does and must get right

Irrigation advice rests on crop water use (FAO-56: crop evapotranspiration is the reference value
times a crop coefficient, which needs radiation and wind that the sixteen readings do not include),
and on soil water, which depends on soil texture, root depth, the sensor and its depth. The FAO-56
worked example shows why a single built-in percentage is unsound: the same 28% volumetric content is
above field capacity in a loamy sand, leaves 76% of available water in a silt, and leaves only 42%
(58% depleted) in a silty clay. A fixed trigger would waterlog one field and starve another.

Farmers do not want data. In the studies the research drew on, they want one quick answer, to see
why, to stay in charge, a person they trust behind it, and records produced as a by-product. "All
farmers said they would not use technology to replace field measurements and experience."
Set-up time was the main reason a free service went unused. No source supports a savings percentage
before measured pilots: do not promise one.

### What the platform does today

Soil moisture is a reading. "Irrigation required" is derived only where the site has set this
field's own start-at limit; without it the platform says nothing, and the site page explains how to
set it. The alert engine never raises an alert for needing irrigation: it is ordinary operation.

### From day one, not built yet

1. **Per-zone configuration**: crop, soil class, root depth, a depth-averaged start-at and stop-at
   band in the sensor's own unit, the source of the limit, and "starting value" against "confirmed on
   (date)". Defaults from FAO-56 shown as starting values only.
2. **Sensor metadata**: type, unit, depth in centimetres, position, soil, calibration, install date,
   last seen, battery.
3. **Plain advice** (irrigate now, wait, for how long) with the reason, the data age and where the
   threshold came from; one answer per field, visual, tolerant of poor signal.
4. **Data-quality gates**: stale, out of range, flat-lined or disagreeing sensors give "cannot
   advise", never a guess.
5. **Human approval, manual override and an event log** of what was irrigated, when, by whom.
6. **A water-use record per field, exportable**: the IPARD III programme requires metering and
   seven-year records for irrigation investments.

### Seams

| Seam | Evidence that would prove the need |
|---|---|
| ET-based advice (crop coefficients by stage, reference ET from radiation and wind) | Farmers with few or no sensors; disagreement between ET and soil trends logged over a season; requests for "how much" |
| Rain forecast | A back-test against a rain gauge at pilots; farmers already delaying irrigation for rain. The free weather API used by many examples allows non-commercial use only, so a licence or self-hosting must be decided first |
| Fertigation (read-only first) | Greenhouse customers with injectors and an agronomist to set limits |
| Per-zone valves | A pilot with controllable valves and hard interlocks, and high agreement between advice and hand checks over a season |
| Greenhouse climate (vapour-pressure deficit, ventilation, frost) | Growers asking, with agronomist-set targets |
| Compliance exports (IPARD, GlobalG.A.P.) | The agency or certifier confirms the format it accepts |

### Never

One global percentage; capacitance readings presented as absolute; ET from temperature alone without
saying so; automatic action from a forecast; automated acid or fertiliser injection; any command
without approval and limits enforced at the edge; many numbers and charts per field; savings figures
not measured on pilots (the sourced trials show 5 to 25%, and "30 to 50%" could not be traced); "AI"
framing (trust in the studies came from a visible evidence base); treating silence as "dry" or
"fine".

## 4. Energy: solar, battery and grid

### What the person does and must get right

The four answers: is it running, did it make what it should, what is wrong, what next? NREL's
operations guidance is clear that shorter than weekly comparisons produce false alarms and that
loss of communication alerts must wait a grace period. The honest strength of each answer differs:
energy produced, from the energy counter, is strong; whether it made what it should needs
irradiance and is weak without it; soiling is a trend, never a percentage.

Performance ratio and similar indicators need an irradiance sensor and a stated class. The claims
ladder: Level 0, meters only (energy delivered, specific yield, time-based availability); Level 1,
plus modelled weather (indicative ratio with a range and a named weather source); Level 2, plus an
on-site irradiance and module-temperature sensor with documented calibration (the ratio, "per the
relevant IEC class"). Nothing is worded above its level.

### What the platform does today

Solar power, consumption, battery charge and power, and grid import and export are readings.
Battery "low" is derived (standard 25%, or the site's own). "Solar surplus" is derived only where
the site has said what a useful surplus is. Nothing yet computes energy from counters, and there are
no inverter profiles beyond the generic Modbus driver.

### From day one, not built yet

1. A home answer for the four questions, with the age of every source and a grace period before any
   "connection lost" alert.
2. Energy from counters, with separate import and export counters, and a view that lets the owner
   reconcile their own meter with the bill (the distribution operator's meter stays the legal
   reference).
3. Device-reported status, alarm and limit flags, labelled "reported by inverter"; curtailed energy
   recorded.
4. A semantic layer per device profile (scale, sign, word order, address base; "not available" as
   empty), and a commissioning plausibility test.
5. **Read-only** drivers in this proposed order: SunSpec discovery, Huawei SUN2000, Sungrow, Modbus
   meter profiles, Victron for hybrid sites (to confirm with installers).
6. Six deterministic checks only: stale data; inverter not producing at high sun after a grace
   period; "limited by export limit or rated power" instead of "underperforming"; meter sanity
   (counters never decrease, energy balance); sensor sanity; a weekly expected-against-actual band
   with the weather source shown and no alarm.
7. Every flag stores the operator's answer (useful, not useful, already known), so the platform
   measures its own precision before adding checks.
8. Site parameters as data, never constants: tariff, settlement rule, capacity basis, time zone,
   each load's start and stop thresholds.

The evidence for restraint is strong. The only large independent field test found (85 systems, 46
months, summary only) caught 19 to 30% of faults with 12 to 16% false alerts. No published rate
exists for checks that use only power and a clear-sky model. Do not sell "intelligent fault
detection".

### Why "surplus" has no built-in number

A surplus means something only relative to a load that can use it. A fixed 1.5 kW is 30% of a 5 kW
farm plant and 0.3% of a 500 kW plant; it ignores that starting the pump removes the surplus; it
flaps on every cloud edge. The defensible definition is per load: smoothed export plus the load's
own draw, at or above its minimum operating power for a set time, ending below it for a set time.
Without a grid-point meter surplus is not defined and the platform says so.

### Safety and liability

Protection stays in the inverter, the battery management system and the protection relays. The
platform may read everything, display, record and recommend. It may write an active-power limit or a
battery mode only through the inverter vendor's documented external-control path, with the vendor's
written approval and, where connection conditions are touched, the distribution operator's consent.
It may not change interface protection, grid profile or battery limits, clear a battery fault
remotely, or present any function as a safety function. Greecon's exposure moves from "reporting" to
"causing" at the first write command: that is why day one is read-only. Software cannot see a
padlock, so a per-asset "maintenance, locked out" flag, set by a person, will block every remote
command before the first one is allowed.

### Albanian context to hold as data

The prosumer regime is in transition: net-metering rules, a net-billing methodology reported from
May 2026, Law 59/2026 reported in force from July 2026 (which makes storage operation and
aggregation licensed activities), and a switch to net billing reported for 1 January 2027. The
sources conflict and the official decisions were not located, so tariffs and settlement are per-site
data and nothing is hard-coded. Do not pool customers' assets or dispatch into a market without the
regulator and counsel. IPARD III treats on-farm solar for own consumption as eligible up to 120% of
the three-year average consumption, so metered evidence has value.

### Seams

| Seam | Evidence that would prove the need |
|---|---|
| Peer comparison across same-orientation inverters | A pilot site with comparable units and a technician-confirmed fault it would have caught |
| Soiling reminder with rain reset | One year at three or more sites with cleaning dates logged |
| Per-input diagnostics | Pilot inverters expose per-input data and confirmed string faults appear |
| Setpoint write path | Repeated customer requests, and written vendor approval, and distribution-operator consent |
| Solar-window load commands | A pilot where recommendations were accepted repeatedly |
| Tariff-aware dispatch, peak shaving | Real bills show a time-varying or demand charge |
| Forecast layer | A decision that hinges on a forecast; settle the data licence first |
| Net-billing settlement engine | The regulator publishes the formula and a first customer is on it |

### Never

A built-in surplus or battery constant; a performance ratio or soiling percentage without sensors;
instant connection-lost alerts; register offsets hard-coded; zero standing for "not implemented";
periodic writes to flash-limited registers; running an export-limit loop in the cloud; any claim
about grants beyond what the programme texts say.

## 5. Where the sectors meet

A pump that waters a field at the solar window is one decision across three sectors. The rule that
joins them: energy optimisation moves irrigation inside the agronomically acceptable window and the
licensed water allocation, and never defers it beyond the allowable depletion. It stays advisory
until the seams above are proven.

## 6. Open questions that need a person, not a document

The full lists are in each report. The most decision-relevant:

- **Regulator and counsel (water):** was the Normative Act converted into law, which limits apply by
  discharge route, who may take the samples, and are online data accepted as supporting evidence?
- **Process engineer:** can small package plants hold the stated limits under seasonal loading, and
  what is the minimum instrumentation worth installing?
- **Agronomist:** local field capacity and wilting point by soil class, crop and method, and which
  sensor suits the local water salinity?
- **Electrical engineer and the distribution operator:** which certificates prove grid-interface
  protection, is a read-only connection acceptable to the installer, the warranty and the operator,
  and which commissioning test proves an export-limit fail-safe?
- **ERE and the IPARD Agency:** the net-billing formula, and what metering evidence is accepted for
  on-farm solar.
