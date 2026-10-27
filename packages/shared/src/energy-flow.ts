import { describeAge } from "./age";

// Where the energy at a site is going right now, worked out only from what is measured.
//
// The picture is a junction with four spokes: solar into it, the grid either way, the battery either
// way, and the site's own use out of it. Every spoke is one measured quantity, so nothing has to be
// guessed about which source fed which load. A spoke that is not measured is not drawn. A spoke whose
// reading has gone out of date is drawn as unknown, never as the last value still flowing.
//
// This is display logic only and lives here, not in gaia-core, so a screen can show it without
// carrying any of GAIA's rules.

/** Below this, a flow counts as "not flowing": meters have noise at zero. */
export const IDLE_BELOW_KW = 0.05;

/** Above this much export, energy really is going out (meters have noise at zero). */
const GRID_DIRECTION_NOISE_KW = 0.3;

/**
 * Energy cannot leave a site that nothing is producing for: a grid meter that says it does is fitted the wrong way round. Judged from
 * what is measured and current, and only when it can be told: not while a battery that could be feeding the grid has no power
 * reading. Returns undefined when it cannot be told, so "not judged" is never mistaken for "fine".
 */
export function gridDirectionSuspect(input: { exportKw?: number; solarKw?: number; batteryKw?: number; hasBattery: boolean }): boolean | undefined {
  if (input.exportKw === undefined || input.solarKw === undefined) return undefined;
  if (input.hasBattery && input.batteryKw === undefined) return undefined;
  const batteryGivingKw = input.batteryKw !== undefined && input.batteryKw < 0 ? -input.batteryKw : 0;
  return input.solarKw <= IDLE_BELOW_KW && input.exportKw > GRID_DIRECTION_NOISE_KW && batteryGivingKw < input.exportKw * 0.5;
}

export interface FlowReading {
  /** kW for the power points, percent for state of charge. */
  value: number;
  /** False once the reading is older than it can be relied on. */
  fresh: boolean;
  ageSeconds?: number;
  /** True for demo and simulator data, so a screen can say so. */
  simulated?: boolean;
}

export interface EnergyFlowInput {
  solarKw?: FlowReading;
  consumptionKw?: FlowReading;
  gridImportKw?: FlowReading;
  gridExportKw?: FlowReading;
  /** Positive while the battery is charging (energy going into it), negative while discharging. */
  batteryKw?: FlowReading;
  batterySocPercent?: FlowReading;
}

export type FlowSpoke = "solar" | "grid" | "battery" | "site";

/** Relative to the junction. "to_hub": energy arriving (solar producing, grid importing, battery
 * discharging). "from_hub": energy leaving (grid exporting, battery charging, the site using it). */
export type FlowDirection = "to_hub" | "from_hub" | "idle" | "unknown";

export interface FlowLink {
  spoke: FlowSpoke;
  direction: FlowDirection;
  /** "current": measured and recent. "out_of_date": measured, but not recently enough to say. "not_measured": this site has no such reading. */
  status: "current" | "out_of_date" | "not_measured";
  /** Size of the flow in kW. Present when the direction is known and not idle. */
  kw?: number;
  /** Battery state of charge, on the battery spoke, when it is known. */
  socPercent?: number;
  /** How old the reading is, for an out-of-date spoke. */
  ageSeconds?: number;
}

export interface EnergyFlowView {
  /** "live": what is measured is current. "partial": some measured spoke is out of date. "unknown": nothing measured is current. */
  state: "live" | "partial" | "unknown";
  /** False when the site measures no energy flow at all (a battery level on its own is not a flow), so there is nothing to draw. */
  hasEnergy: boolean;
  /** The answer in one sentence. */
  headline: string;
  detail?: string;
  links: Record<FlowSpoke, FlowLink>;
  /** True when any reading behind this is simulated. */
  simulated: boolean;
  /** Supply minus use in kW, when every power flow is measured and current. Near zero when the readings agree. */
  unaccountedKw?: number;
  /** Things worth a look: readings that do not add up, a negative production reading, an unmeasured side. */
  notes: string[];
}

const SPOKE_LABEL: Record<FlowSpoke, string> = { solar: "Solar", grid: "Grid", battery: "Battery", site: "Site" };

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatKw(kw: number): string {
  return `${kw >= 100 ? Math.round(kw) : kw.toFixed(1)} kW`;
}

type Presence = "current" | "out_of_date" | "not_measured";

function presence(reading: FlowReading | undefined): Presence {
  if (reading === undefined || !Number.isFinite(reading.value)) return "not_measured";
  return reading.fresh ? "current" : "out_of_date";
}

export function deriveEnergyFlow(input: EnergyFlowInput): EnergyFlowView {
  const notes: string[] = [];

  // Solar, consumption, import and export cannot be negative. A negative reading usually means a
  // sensor wired the wrong way round; it is shown as not flowing, and said.
  const nonNegative = (reading: FlowReading | undefined, label: string): number | undefined => {
    if (presence(reading) !== "current") return undefined;
    const value = (reading as FlowReading).value;
    if (value < -IDLE_BELOW_KW) notes.push(`${label} reads ${value.toFixed(1)} kW, which cannot be negative. Check which way the sensor is wired.`);
    return Math.max(0, value);
  };

  const solar = nonNegative(input.solarKw, "Solar production");
  const site = nonNegative(input.consumptionKw, "Energy consumption");
  const imported = nonNegative(input.gridImportKw, "Grid import");
  const exported = nonNegative(input.gridExportKw, "Grid export");
  const battery = presence(input.batteryKw) === "current" ? (input.batteryKw as FlowReading).value : undefined;
  const soc = presence(input.batterySocPercent) === "current" ? (input.batterySocPercent as FlowReading).value : undefined;

  const solarLink: FlowLink = unitLink("solar", input.solarKw, solar, "to_hub");
  const siteLink: FlowLink = unitLink("site", input.consumptionKw, site, "from_hub");
  const batteryLink = batterySpoke(input, battery, soc);
  const gridLink = gridSpoke(input, imported, exported, solar, notes);

  const hasBattery = presence(input.batteryKw) !== "not_measured" || presence(input.batterySocPercent) !== "not_measured";
  if (gridDirectionSuspect({ exportKw: exported, solarKw: solar, batteryKw: battery, hasBattery })) {
    notes.push(
      `${formatKw(exported ?? 0)} is reported going out to the grid while nothing here is producing it. The grid meter's clamps may be the wrong way round: see "Grid meter direction checked" on the setup list.`
    );
  }

  const links: Record<FlowSpoke, FlowLink> = { solar: solarLink, grid: gridLink, battery: batteryLink, site: siteLink };
  const all = Object.values(links);
  // A battery's level on its own says nothing about where energy is going.
  const hasEnergy = [input.solarKw, input.consumptionKw, input.gridImportKw, input.gridExportKw, input.batteryKw].some((reading) => presence(reading) !== "not_measured");
  const known = all.filter((link) => link.direction !== "unknown").length;
  const anyOutOfDate = all.some((link) => link.status === "out_of_date");
  const state: EnergyFlowView["state"] = known === 0 ? "unknown" : anyOutOfDate ? "partial" : "live";

  const unaccountedKw = accountFor(solar, site, imported, exported, battery, input, notes);
  const { headline, detail } = explain(state, hasEnergy, links);

  const simulated = Object.values(input).some((reading) => (reading as FlowReading | undefined)?.simulated === true);
  return { state, hasEnergy, headline, detail, links, simulated, unaccountedKw, notes };
}

function unitLink(spoke: FlowSpoke, reading: FlowReading | undefined, value: number | undefined, direction: "to_hub" | "from_hub"): FlowLink {
  const status = presence(reading);
  if (status === "not_measured") return { spoke, direction: "unknown", status };
  if (status === "out_of_date") return { spoke, direction: "unknown", status, ageSeconds: reading?.ageSeconds };
  return (value as number) > IDLE_BELOW_KW ? { spoke, direction, status, kw: value } : { spoke, direction: "idle", status };
}

function batterySpoke(input: EnergyFlowInput, power: number | undefined, soc: number | undefined): FlowLink {
  const status = presence(input.batteryKw);
  const socPercent = soc;
  if (status === "not_measured") {
    // A battery whose level is known but whose power is not: the level is worth showing, the flow is not known.
    return { spoke: "battery", direction: "unknown", status: soc !== undefined ? "current" : presence(input.batterySocPercent), socPercent };
  }
  if (status === "out_of_date") return { spoke: "battery", direction: "unknown", status, ageSeconds: input.batteryKw?.ageSeconds, socPercent };
  const kw = power as number;
  if (kw > IDLE_BELOW_KW) return { spoke: "battery", direction: "from_hub", status, kw, socPercent };
  if (kw < -IDLE_BELOW_KW) return { spoke: "battery", direction: "to_hub", status, kw: -kw, socPercent };
  return { spoke: "battery", direction: "idle", status, socPercent };
}

function gridSpoke(input: EnergyFlowInput, imported: number | undefined, exported: number | undefined, solar: number | undefined, notes: string[]): FlowLink {
  const importStatus = presence(input.gridImportKw);
  const exportStatus = presence(input.gridExportKw);

  if (imported !== undefined && exported !== undefined) {
    const net = round2(imported - exported);
    if (net > IDLE_BELOW_KW) return { spoke: "grid", direction: "to_hub", status: "current", kw: net };
    if (net < -IDLE_BELOW_KW) return { spoke: "grid", direction: "from_hub", status: "current", kw: -net };
    return { spoke: "grid", direction: "idle", status: "current" };
  }

  // One side current and the other side not even measured: what is measured is enough to say
  // which way it flows when it flows, and "not flowing" is believable for the unmeasured side.
  if (imported !== undefined && exportStatus === "not_measured") {
    if (imported > IDLE_BELOW_KW) return { spoke: "grid", direction: "to_hub", status: "current", kw: imported };
    if ((solar ?? 0) > IDLE_BELOW_KW) notes.push("Grid export is not measured here, so exporting cannot be ruled out.");
    return { spoke: "grid", direction: "idle", status: "current" };
  }
  if (exported !== undefined && importStatus === "not_measured") {
    if (exported > IDLE_BELOW_KW) return { spoke: "grid", direction: "from_hub", status: "current", kw: exported };
    notes.push("Grid import is not measured here, so importing cannot be ruled out.");
    return { spoke: "grid", direction: "idle", status: "current" };
  }

  // One side current and non-zero while the other side is out of date still says which way it flows.
  if (imported !== undefined && imported > IDLE_BELOW_KW) return { spoke: "grid", direction: "to_hub", status: "current", kw: imported };
  if (exported !== undefined && exported > IDLE_BELOW_KW) return { spoke: "grid", direction: "from_hub", status: "current", kw: exported };

  if (importStatus === "not_measured" && exportStatus === "not_measured") return { spoke: "grid", direction: "unknown", status: "not_measured" };
  // Something is measured but cannot be relied on now.
  const stale = [input.gridImportKw, input.gridExportKw].filter((reading) => presence(reading) === "out_of_date");
  const ageSeconds = stale.length > 0 ? Math.min(...stale.map((reading) => reading?.ageSeconds ?? Number.POSITIVE_INFINITY)) : undefined;
  return { spoke: "grid", direction: "unknown", status: "out_of_date", ageSeconds: Number.isFinite(ageSeconds) ? ageSeconds : undefined };
}

// When every power flow is measured and current, supply and use must balance. When they do not, the
// likely causes are a meter on the wrong side of the junction, a wrong unit or a missing battery
// reading, and that is exactly what someone commissioning a site needs to be told.
function accountFor(
  solar: number | undefined,
  site: number | undefined,
  imported: number | undefined,
  exported: number | undefined,
  battery: number | undefined,
  input: EnergyFlowInput,
  notes: string[]
): number | undefined {
  if (solar === undefined || site === undefined || imported === undefined || exported === undefined) return undefined;
  const batteryStatus = presence(input.batteryKw);
  if (batteryStatus === "out_of_date") return undefined;

  const charging = battery ?? 0;
  const unaccounted = solar + imported - exported - charging - site;
  const tolerance = Math.max(0.5, 0.1 * Math.max(solar, site, imported, exported));
  if (Math.abs(unaccounted) > tolerance) {
    const maybeBattery = batteryStatus === "not_measured" ? "A battery or load that is not measured could explain it. Otherwise check " : "Check ";
    notes.push(`Supply and use differ by ${formatKw(Math.abs(unaccounted))}. ${maybeBattery}where each meter sits and its units.`);
  }
  return round2(unaccounted);
}

function explain(state: EnergyFlowView["state"], hasEnergy: boolean, links: Record<FlowSpoke, FlowLink>): { headline: string; detail?: string } {
  if (!hasEnergy) return { headline: "No energy flow is measured at this site." };

  if (state === "unknown") {
    const ages = Object.values(links)
      .map((link) => link.ageSeconds)
      .filter((age): age is number => age !== undefined);
    const newest = ages.length > 0 ? Math.min(...ages) : undefined;
    return {
      headline: "Energy flow is not known right now.",
      detail: newest !== undefined ? `The newest energy reading is ${describeAge(newest)} old.` : "No current energy reading has arrived."
    };
  }

  const { solar, grid, battery, site } = links;
  let headline: string;
  if (grid.direction === "from_hub") headline = `Exporting ${formatKw(grid.kw as number)} to the grid.`;
  else if (grid.direction === "to_hub") headline = `Importing ${formatKw(grid.kw as number)} from the grid.`;
  else if (grid.direction === "idle" && solar.direction === "to_hub") headline = "Solar is supplying the site on its own.";
  else if (grid.direction === "idle" && battery.direction === "to_hub") headline = "The battery is supplying the site.";
  else if (grid.direction === "idle") headline = "Nothing is being imported or exported.";
  else if (solar.direction === "to_hub") headline = `Solar is producing ${formatKw(solar.kw as number)}.`;
  else if (solar.direction === "idle") headline = "No solar production.";
  else headline = "Energy is flowing, but the grid is not known right now.";

  const parts: string[] = [];
  if (solar.direction === "to_hub") parts.push(`Solar is producing ${formatKw(solar.kw as number)}`);
  else if (solar.direction === "idle") parts.push("No solar production");
  if (site.direction === "from_hub") parts.push(`the site is using ${formatKw(site.kw as number)}`);
  if (battery.direction === "from_hub") parts.push(`the battery is charging at ${formatKw(battery.kw as number)}${socText(battery)}`);
  else if (battery.direction === "to_hub") parts.push(`the battery is discharging at ${formatKw(battery.kw as number)}${socText(battery)}`);
  else if (battery.direction === "idle") parts.push(`the battery is idle${socText(battery)}`);
  else if (battery.socPercent !== undefined) parts.push(`the battery is at ${Math.round(battery.socPercent)}%`);

  const stale = (Object.values(links) as FlowLink[]).filter((link) => link.status === "out_of_date");
  for (const link of stale) {
    parts.push(`${SPOKE_LABEL[link.spoke].toLowerCase()} readings are out of date${link.ageSeconds !== undefined ? ` (${describeAge(link.ageSeconds)} old)` : ""}`);
  }

  const text = parts.join("; ");
  return { headline, detail: text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}.` : undefined };
}

function socText(link: FlowLink): string {
  return link.socPercent === undefined ? "" : ` (${Math.round(link.socPercent)}%)`;
}
