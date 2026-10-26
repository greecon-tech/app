// The guides' diagrams, drawn as inline SVG in one style (lib/svg-kit.mjs).
//
// Every diagram is derived from docs/launch/03-hardware-and-wiring.md (and, for where things go and who does what, from 02). Where
// those documents are silent about a detail (a terminal number, a cable's colour, a maker's wiring), the diagram draws the block-level
// connection only and says "follow the maker's manual for terminal numbers": nothing here guesses a wiring detail.
//
// Usage:  import { buildDiagrams } from "./diagrams.mjs"; const map = buildDiagrams();   // id -> { svg, caption, label, warnings }
//         node scripts/docs/diagrams.mjs --preview <dir>                              // writes a contact sheet to look at

import { COLOURS, Svg, swatch } from "./lib/svg-kit.mjs";
import { measure } from "./lib/metrics.mjs";

const MANUAL = "Terminal numbers are not drawn: follow the maker's manual for terminal numbers.";
const W = 760;

const mistBox = { fill: COLOURS.mist, stroke: COLOURS.forest, sw: 1.8 };
const siteBox = { fill: "#fff", stroke: COLOURS.forest, sw: 1.5 };
const cloudBox = { fill: COLOURS.cream, stroke: COLOURS.forest, sw: 1.5 };
const optional = { dash: "5 3" };

const swatches = {
  greecon: swatch("Greecon's own parts (read only)", (x, y) => `<rect x="${x}" y="${y - 4}" width="30" height="14" rx="4" fill="${COLOURS.mist}" stroke="${COLOURS.forest}" stroke-width="1.6"/>`),
  site: swatch("The customer's equipment", (x, y) => `<rect x="${x}" y="${y - 4}" width="30" height="14" rx="4" fill="#fff" stroke="${COLOURS.forest}" stroke-width="1.4"/>`),
  optional: swatch("Optional (dashed outline)", (x, y) => `<rect x="${x}" y="${y - 4}" width="30" height="14" rx="4" fill="#fff" stroke="${COLOURS.forest}" stroke-width="1.4" stroke-dasharray="5 3"/>`)
};

/** The numbered list of readings under a system drawing. */
function readingsList(d, y, items, { columns = 2, title = "What Greecon reads here" } = {}) {
  d.text(18, y + 4, title, { size: 8.4, weight: 700, fill: COLOURS.faint, spacing: "0.12em", upper: true });
  const colWidth = (W - 36) / columns;
  const perCol = Math.ceil(items.length / columns);
  items.forEach(([n, name, detail], index) => {
    const col = Math.floor(index / perCol);
    const row = index % perCol;
    const x = 18 + col * colWidth;
    const rowY = y + 26 + row * 22;
    d.marker(x + 10, rowY - 4, n);
    d.text(x + 26, rowY, name, { size: 10.4, weight: 700 });
    if (detail) d.text(x + 26 + measure(name, 10.4, 700) + 6, rowY, detail, { size: 9.4, fill: COLOURS.muted, maxWidth: colWidth - 34 - measure(name, 10.4, 700) });
  });
  d.bottom = y + 26 + (perCol - 1) * 22 + 12;
}

/** The pipe of a water site with the pressure gauge and, if wanted, the flow meter on it. */
function pipeWithSensors(d, { from, to, y, pressureAt, flowAt, markers }) {
  d.wire("water", [[from, y], [to, y]]);
  const sensor = (x, icon, name, marker, dash) => {
    d.rect(x - 17, y - 58, 34, 34, { fill: COLOURS.mist, stroke: COLOURS.forest, sw: 1.7, rx: 8, dash });
    d.icon(icon, x - 11, y - 52, 22);
    d.plain([[x, y - 24], [x, y - 4]], { sw: 2.2 });
    d.marker(x + 20, y - 58, marker);
    d.text(x, y + 26, name, { size: 9, weight: 600, anchor: "middle" });
  };
  sensor(pressureAt, "gauge", "Pressure transmitter", markers.pressure, null);
  if (flowAt) sensor(flowAt, "flow", "Flow meter (optional)", markers.flow, "4 3");
}

const terminatorPills = (d, top, h, { both = true } = {}) => {
  d.pill(26, top + h + 6, "120 ohm*", { fill: "#fff", colour: COLOURS.forest, stroke: COLOURS.forest, weight: 600 });
  if (both) d.pill(604, top + h + 6, "120 ohm*", { fill: "#fff", colour: COLOURS.forest, stroke: COLOURS.forest, weight: 600 });
};

// ---------------------------------------------------------------------------------------------------------------------------
// All kits: the whole chain, and the order of things
// ---------------------------------------------------------------------------------------------------------------------------

function howItWorks() {
  const d = new Svg(W, 330, { kit: "ALL KITS", title: "How Greecon works, from the meter to the owner's phone", label: "THE WHOLE CHAIN" });
  d.zone(10, 54, 390, 168, "At the site");
  d.zone(408, 54, 342, 168, "Greecon's platform");
  const y = 82;
  const h = 128;
  d.box(22, y, 100, h, { title: "Meters and sensors", body: "They only measure", icon: "meter", ...mistBox, titleSize: 11.4, bodySize: 9.6 });
  d.box(166, y, 92, h, { title: "Converter", body: "Puts the data cable on the network", icon: "converter", ...mistBox, titleSize: 11.4, bodySize: 9.6 });
  d.box(302, y, 86, h, { title: "Box", body: "A small computer that reads and reports", icon: "pc", ...mistBox, titleSize: 11.4, bodySize: 9.6 });
  d.box(422, y, 136, h, { title: "The platform", body: "Receives the readings and works out what needs a person", icon: "cloud", ...cloudBox, titleSize: 11.4, bodySize: 9.6 });
  d.box(602, y, 136, h, { title: "People", body: "The owner's screen. Email and text to the people chosen", icon: "person", ...cloudBox, titleSize: 11.4, bodySize: 9.6 });
  const mid = y + 40;
  d.wire("rs485", [[122, mid], [166, mid]], { arrow: "end" });
  d.wire("eth", [[258, mid], [302, mid]], { arrow: "end" });
  d.wire("inet", [[388, mid], [422, mid]], { arrow: "end" });
  d.wire("inet", [[558, mid], [602, mid]], { arrow: "end" });
  d.text(144, mid + 18, "RS-485", { size: 8.4, weight: 600, anchor: "middle", fill: COLOURS.muted });
  d.text(280, mid + 18, "network", { size: 8.4, weight: 600, anchor: "middle", fill: COLOURS.muted });
  d.text(405, mid + 18, "internet", { size: 8.4, weight: 600, anchor: "middle", fill: COLOURS.muted });
  d.text(580, mid + 18, "email, text", { size: 8.4, weight: 600, anchor: "middle", fill: COLOURS.muted });
  d.rect(14, 238, 732, 62, { fill: COLOURS.cream, stroke: COLOURS.forest, sw: 1.4, rx: 10 });
  d.pill(28, 252, "READ ONLY", { fill: COLOURS.forest });
  d.text(118, 262, "Greecon only reads. Nothing in this chain can switch, start or stop equipment.", { size: 11.2, weight: 700 });
  d.paragraph(118, 279, "The arrows only point towards the platform. Greecon is not a safety system: the protection in the customer's equipment stays the safety layer.", { maxWidth: 610, size: 9.6, fill: COLOURS.muted });
  d.bottom = 312;
  return d.finish({ legendKinds: ["rs485", "eth", "inet"] });
}

function customerPath() {
  const d = new Svg(W, 420, { kit: "ALL KITS", title: "The order of things: from the first call to day 90", label: "THE WHOLE JOB" });
  const stages = [
    ["1", "First call", "Project manager", "20 min"],
    ["2", "Survey visit", "Project manager", "1 hour"],
    ["3", "Order form", "Founder or PM", "signed, fee paid"],
    ["4", "Prepare in Greecon", "Project manager", "30 min"],
    ["5", "Prepare the kit", "Project manager", "2 hours"],
    ["6", "Install day", "PM and electrician", "4 to 6 hours"],
    ["7", "Commission", "Project manager", "1 hour"],
    ["8", "Handover", "Project manager", "30 min"],
    ["9", "Look after it", "Project manager", "days 1, 3, 7"],
    ["10", "Day 60", "Founder and PM", "decision meeting"],
    ["11", "Day 90", "Founder", "convert or remove"]
  ];
  const cols = 4;
  const bw = 168;
  const gap = 20;
  const bh = 78;
  const rowGap = 34;
  const x0 = 14;
  const y0 = 56;
  stages.forEach(([n, name, who, time], index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = x0 + col * (bw + gap);
    const y = y0 + row * (bh + rowGap);
    const fill = ["6", "7"].includes(n) ? COLOURS.mist : "#fff";
    d.rect(x, y, bw, bh, { fill, stroke: COLOURS.forest, sw: 1.6, rx: 10 });
    d.add(`<circle cx="${x + 20}" cy="${y + 22}" r="11" fill="${COLOURS.forest}"/>`);
    d.text(x + 20, y + 26.2, n, { size: 11.4, weight: 800, fill: "#fff", anchor: "middle" });
    d.text(x + 38, y + 26, name, { size: 12, weight: 700, maxWidth: bw - 46 });
    d.text(x + 14, y + 50, who, { size: 9.8, fill: COLOURS.muted, maxWidth: bw - 24 });
    d.text(x + 14, y + 66, time, { size: 9.8, weight: 700, fill: COLOURS.action, maxWidth: bw - 24 });
    if (col < cols - 1 && index < stages.length - 1) d.wire("inet", [[x + bw, y + 39], [x + bw + gap, y + 39]], { arrow: "end" });
    if (col === cols - 1 && index < stages.length - 1) d.wire("inet", [[x + bw / 2, y + bh], [x + bw / 2, y + bh + 10], [x0 + bw / 2, y + bh + 10], [x0 + bw / 2, y + bh + rowGap]], { arrow: "end", radius: 7 });
  });
  d.bottom = y0 + 3 * (bh + rowGap) - rowGap + 12;
  return d.finish({
    legendKinds: [],
    extraLegend: [swatch("The days on site (highlighted)", (x, y) => `<rect x="${x}" y="${y - 4}" width="30" height="14" rx="4" fill="${COLOURS.mist}" stroke="${COLOURS.forest}" stroke-width="1.6"/>`)],
    note: "Before the first customer: the founder puts the platform on the internet, and the project manager does the whole job once on a desk (the rehearsal)."
  });
}

// ---------------------------------------------------------------------------------------------------------------------------
// Generic pictures, drawn once per kit that uses them (and once for the hardware reference)
// ---------------------------------------------------------------------------------------------------------------------------

function ctFitting({ kit, label }) {
  const d = new Svg(W, 420, { kit, title: "Fitting a three-phase meter: voltage taps and current clamps", label });
  d.rect(14, 50, 732, 206, { fill: "#fbf3f1", stroke: COLOURS.critical, sw: 1.4, rx: 12, dash: "6 4" });
  d.text(28, 68, "Inside the board: electrician only, with the lock-out on", { size: 8.6, weight: 800, fill: COLOURS.critical, spacing: "0.1em", upper: true });
  const lines = [["L1", 100], ["L2", 120], ["L3", 140], ["N", 160]];
  lines.forEach(([name, y]) => {
    d.wire("mains", [[56, y], [716, y]], { radius: 0 });
    d.text(46, y + 3.4, name, { size: 9, weight: 700, anchor: "end" });
  });
  d.rect(124, 86, 74, 88, { fill: "#fff", stroke: COLOURS.forest, sw: 1.6, rx: 8 });
  d.text(161, 126, "Main", { size: 9.6, weight: 700, anchor: "middle" });
  d.text(161, 138, "breaker", { size: 9.6, weight: 700, anchor: "middle" });
  d.text(60, 84, "From the supply", { size: 8.8, weight: 700, fill: COLOURS.muted });
  d.text(716, 84, "To the site", { size: 8.8, weight: 700, fill: COLOURS.muted, anchor: "end" });
  [["L1", 100, 440], ["L2", 120, 480], ["L3", 140, 520]].forEach(([, y, x]) => {
    d.add(`<circle cx="${x}" cy="${y}" r="9.4" fill="#fff" stroke="${COLOURS.forest}" stroke-width="2.6"/>`);
    d.path(`M${x - 6} ${y - 15} h12 m-4.4 -3.6 l4.4 3.6 l-4.4 3.6`, { stroke: COLOURS.forest, sw: 1.8 });
    d.plain([[x, y + 9.4], [x, 272]], { sw: 1.6, stroke: COLOURS.faint, dash: "3 3" });
  });
  d.text(480, 76, "The arrow on each clamp points towards the site", { size: 9.2, weight: 700, anchor: "middle" });
  [["L1", 100, 260], ["L2", 120, 290], ["L3", 140, 320], ["N", 160, 350]].forEach(([, y, x]) => {
    d.dot(x, y, 3.4);
    d.plain([[x, y], [x, 190]], { sw: 2 });
    d.rect(x - 5, 190, 10, 22, { fill: "#fff", stroke: COLOURS.forest, sw: 1.5, rx: 2 });
    d.plain([[x, 212], [x, 272]], { sw: 2 });
  });
  d.text(240, 234, "Small fuses or 2 A breakers on", { size: 9, fill: COLOURS.muted, anchor: "end" });
  d.text(240, 246, "each voltage tap, as the meter's", { size: 9, fill: COLOURS.muted, anchor: "end" });
  d.text(240, 258, "manual says", { size: 9, fill: COLOURS.muted, anchor: "end" });
  d.box(240, 272, 330, 84, { title: "Eastron SDM630", body: "Voltage inputs at the top, clamp wires at the bottom, RS-485 on the right", icon: "meter", ...mistBox, titleSize: 12, bodySize: 9.4 });
  d.wire("rs485", [[570, 314], [716, 314]], { label: "RS-485: A, B, ground", labelSide: "above", at: [643, 314] });
  d.port(570, 314, null);
  d.text(716, 332, "to the data cable", { size: 9, weight: 600, anchor: "end" });
  d.bottom = 372;
  return d.finish({ legendKinds: ["mains", "rs485"], noteLines: ["Never open the secondary of a 5 A current transformer while current flows: it can produce a dangerous voltage. Short it before disconnecting. " + MANUAL] });
}

function loopFigure({ kit, label }) {
  const d = new Svg(W, 330, { kit, title: "A 4 to 20 mA loop: the 24 V supply is in series with the module's input", label });
  d.box(28, 66, 168, 104, { title: "24 V DC supply", body: "In series with the module's input, as the module's manual draws it. Some modules supply the loop, some do not", icon: "psu", ...mistBox, titleSize: 11.6, bodySize: 8.8 });
  d.box(318, 66, 140, 104, { title: "Two-wire transmitter", body: "Level or pressure. It takes its power from the loop", icon: "level", ...siteBox, titleSize: 11.4, bodySize: 9 });
  d.box(580, 66, 154, 104, { title: "Module input channel", body: "Set the channel to 4 to 20 mA", icon: "converter", ...mistBox, titleSize: 11.4, bodySize: 9 });
  d.wire("ma", [[196, 100], [318, 100]], { label: ["24 V + to", "transmitter (+)"], labelSide: "above", at: [257, 100] });
  d.wire("ma", [[458, 100], [580, 100]], { label: ["transmitter (-)", "to channel (+)"], labelSide: "above", at: [519, 100] });
  d.wire("ma", [[657, 170], [657, 214], [112, 214], [112, 170]], { radius: 10, label: "channel (-) back to the 24 V supply (-)", labelSide: "below", at: [384, 214] });
  const y = 260;
  d.rect(28, y - 12, 706, 60, { fill: COLOURS.cream, stroke: COLOURS.rule, sw: 1.2, rx: 10 });
  d.text(44, y + 6, "Check the channel with a loop calibrator", { size: 10.6, weight: 700 });
  d.paragraph(44, y + 22, "Send 4, 12 and 20 mA. Read the register with greecon-edge modbus-test and write the numbers down: they are the signal at the bottom and at the top.", { maxWidth: 674, size: 9.4, fill: COLOURS.muted });
  d.bottom = 322;
  return d.finish({ legendKinds: ["ma"], noteLines: [MANUAL] });
}

function powerFigure({ kit, label, feeds, feedsNote }) {
  const d = new Svg(W, 330, { kit, title: "Power: one clean place, on a UPS", label });
  d.box(24, 74, 150, 76, { title: "Mains supply", body: "A socket that stays on, or a feed from the electrician", icon: "pylon", ...siteBox, titleSize: 11.6, bodySize: 9 });
  d.box(244, 74, 150, 76, { title: "UPS", body: "A 12 V DC UPS, or a 600 VA line-interactive UPS", icon: "ups", ...mistBox, titleSize: 11.6, bodySize: 9 });
  d.wire("mains", [[174, 112], [244, 112]]);
  d.tag(209, 112, "mains", { size: 8.6, side: "above" });
  const outs = [
    { y: 50, title: "24 V DIN supply", body: feeds, icon: "psu" },
    { y: 124, title: "Box", body: "Takes 24 V directly if it accepts 9 to 36 V", icon: "pc" },
    { y: 198, title: "Converter", body: "9 to 36 V DC", icon: "converter" }
  ];
  outs.forEach((out) => {
    d.box(520, out.y, 216, 64, { title: out.title, body: out.body, icon: out.icon, ...mistBox, titleSize: 11, bodySize: 8.8 });
    d.plain([[394, 112], [456, 112], [456, out.y + 32], [520, out.y + 32]], { sw: 2.4, radius: 8 });
  });
  d.tag(425, 112, "UPS output", { size: 8.6, side: "above" });
  d.rect(24, 214, 410, 74, { fill: COLOURS.cream, stroke: COLOURS.rule, sw: 1.2, rx: 10 });
  d.paragraph(38, 234, "When the grid is down, a meter that takes its power from the grid dies with it. That is expected: the box is alive and says the devices do not answer. That is the honest picture, not a fault in Greecon.", { maxWidth: 384, size: 9.4, fill: COLOURS.muted });
  d.bottom = 302;
  return d.finish({ legendKinds: ["mains"], noteLines: [feedsNote ?? "", "The UPS output is 230 V AC from a line-interactive UPS and 12 V DC from a DC UPS: work on the 230 V side is the electrician's. If a part takes 12 V, use a small DC adapter. The box's BIOS setting power on after power loss is what brings it back after the UPS runs flat. " + MANUAL].filter(Boolean) });
}

function rs485Rules({ kit, label }) {
  const d = new Svg(W, 330, { kit, title: "The RS-485 data cable: one cable, a daisy chain, no branches", label });
  d.zone(14, 50, 360, 196, "Right: a daisy chain", { stroke: COLOURS.leaf, sw: 2 });
  d.zone(386, 50, 360, 196, "Wrong: stars and tees", { stroke: COLOURS.critical, sw: 1.6, dash: "6 4", labelFill: COLOURS.critical });
  const node = (x, y, text, fill = COLOURS.mist) => {
    d.rect(x, y, 66, 40, { fill, stroke: COLOURS.forest, sw: 1.6, rx: 8 });
    d.text(x + 33, y + 24.4, text, { size: 9.6, weight: 700, anchor: "middle" });
  };
  node(26, 110, "Converter");
  node(122, 110, "Meter 1");
  node(218, 110, "Meter 2");
  node(298, 110, "Module 3");
  d.plain([[51, 150], [51, 158]], { sw: 1.6 });
  d.plain([[331, 150], [331, 158]], { sw: 1.6 });
  d.wire("rs485", [[92, 130], [122, 130]], { radius: 0 });
  d.wire("rs485", [[188, 130], [218, 130]], { radius: 0 });
  d.wire("rs485", [[284, 130], [298, 130]], { radius: 0 });
  d.terminator(51, 158, { vertical: true });
  d.terminator(331, 158, { vertical: true });
  d.text(61, 188, "120 ohm", { size: 8.4, fill: COLOURS.muted, anchor: "middle" });
  d.text(341, 188, "120 ohm", { size: 8.4, fill: COLOURS.muted, anchor: "middle" });
  d.text(26, 214, "Shield to ground at one end only.", { size: 9, fill: COLOURS.muted });
  d.text(26, 227, "Keep it away from power cables.", { size: 9, fill: COLOURS.muted });
  node(400, 110, "Converter", "#fff");
  node(560, 70, "Meter 1", "#fff");
  node(560, 150, "Meter 2", "#fff");
  node(660, 110, "Module 3", "#fff");
  d.wire("rs485", [[466, 130], [513, 130], [513, 90], [560, 90]], { radius: 7 });
  d.wire("rs485", [[513, 130], [513, 170], [560, 170]], { radius: 7 });
  d.wire("rs485", [[513, 130], [660, 130]], { radius: 0 });
  d.dot(513, 130, 4);
  d.text(400, 214, "Branches cause the errors that look like", { size: 9, fill: COLOURS.muted });
  d.text(400, 227, "random failures.", { size: 9, fill: COLOURS.muted });
  d.bottom = 262;
  return d.finish({ legendKinds: ["rs485"], noteLines: ["A resistor of 120 ohm across A and B at each end of the cable, only for runs longer than about 50 m or if readings are unreliable at 9600 baud. A and B swapped is the commonest mistake: if nothing answers, swap the two wires at the converter. Every device its own unit number, the same speed and parity."] });
}

// ---------------------------------------------------------------------------------------------------------------------------
// Network and enclosure, parameterised by kit
// ---------------------------------------------------------------------------------------------------------------------------

function networkDiagram({ kit, label, badgeA, badgeB, behind }) {
  const d = new Svg(W, 480, { kit, title: "Network: how the box and the converter reach the internet", label });
  d.zone(14, 50, 358, 306, "A. The customer's network", { stroke: badgeA ? COLOURS.leaf : COLOURS.rule, sw: badgeA ? 2 : 1.2 });
  d.zone(388, 50, 358, 306, "B. No usable internet: cellular", { stroke: badgeB ? COLOURS.leaf : COLOURS.rule, sw: badgeB ? 2 : 1.2 });
  if (badgeA) d.pill(360, 56, badgeA, { fill: COLOURS.action, anchor: "end" });
  if (badgeB) d.pill(734, 56, badgeB, { fill: COLOURS.action, anchor: "end" });

  d.box(104, 78, 178, 52, { title: "The internet", icon: "cloud", ...cloudBox, titleSize: 11.4 });
  d.box(94, 170, 198, 64, { title: "The customer's router", body: "Ask for a fixed address for the converter", icon: "router", ...siteBox, titleSize: 11.4, bodySize: 9.2 });
  d.wire("inet", [[193, 130], [193, 170]], { label: "HTTPS, port 443, outgoing", at: [193, 150], labelSide: "right" });
  d.box(32, 276, 140, 66, { title: "Box", body: "Can take any address", icon: "pc", ...mistBox, titleSize: 11.4, bodySize: 9.2 });
  d.box(214, 276, 140, 66, { title: "Converter", body: "A fixed address", icon: "converter", ...mistBox, titleSize: 11.4, bodySize: 9.2 });
  d.wire("eth", [[130, 234], [130, 254], [102, 254], [102, 276]], { radius: 6 });
  d.wire("eth", [[256, 234], [256, 254], [284, 254], [284, 276]], { radius: 6 });

  d.box(480, 78, 178, 52, { title: "Mobile network", icon: "tower", ...cloudBox, titleSize: 11.4 });
  d.box(468, 170, 202, 64, { title: "4G router with a data SIM", body: "From the kit. Greecon supplies the SIM, charged at cost", icon: "router", ...mistBox, titleSize: 11.4, bodySize: 9.2 });
  d.wire("radio", [[569, 130], [569, 170]], { label: "radio", at: [569, 150], labelSide: "right" });
  d.box(406, 276, 140, 66, { title: "Box", body: "Plugs into the router", icon: "pc", ...mistBox, titleSize: 11.4, bodySize: 9.2 });
  d.box(588, 276, 140, 66, { title: "Converter", body: "Plugs into the router", icon: "converter", ...mistBox, titleSize: 11.4, bodySize: 9.2 });
  d.wire("eth", [[506, 234], [506, 254], [476, 254], [476, 276]], { radius: 6 });
  d.wire("eth", [[632, 234], [632, 254], [658, 254], [658, 276]], { radius: 6 });

  d.rect(14, 368, 732, 54, { fill: COLOURS.cream, stroke: COLOURS.forest, sw: 1.3, rx: 10 });
  d.icon("converter", 26, 383, 22);
  d.wire("rs485", [[56, 394], [102, 394]], { radius: 0 });
  d.text(114, 391, "Behind the converter, on the RS-485 cable:", { size: 10, weight: 700 });
  d.paragraph(114, 406, behind, { maxWidth: 620, size: 9.4, fill: COLOURS.muted });
  d.bottom = 436;
  return d.finish({
    legendKinds: ["inet", "radio", "eth", "rs485"],
    noteLines: [
      "The box needs only outgoing HTTPS (port 443) to api.greecon.earth and, when it is installed, to nodejs.org, and a time service (UDP port 123). Nothing needs to come in. Never put the box or the converter on a guest network.",
      "Cellular: plan for about 1.5 GB a month for a hotel-size site (a site with more devices sends more) and choose a plan of 5 GB or more; read the router's counter after a week."
    ]
  });
}

function enclosureDiagram({ kit, label, rail1, rail2, extraNote }) {
  const d = new Svg(W, 360, { kit, title: "The enclosure: recommended order on the DIN rail", label });
  d.rect(24, 54, 712, 262, { fill: "#fbfaf7", stroke: COLOURS.forest, sw: 2.4, rx: 16 });
  d.text(40, 76, "IP54 enclosure (IP65 outdoors), seen from the front", { size: 8.8, weight: 700, fill: COLOURS.faint, spacing: "0.1em", upper: true });
  d.rect(40, 88, 188, 212, { fill: "#fbf3f1", stroke: COLOURS.critical, sw: 1.3, rx: 10, dash: "6 4" });
  d.text(52, 104, "Mains side", { size: 8.6, weight: 800, fill: COLOURS.critical, spacing: "0.12em", upper: true });
  d.text(52, 116, "electrician connects", { size: 8.6, fill: COLOURS.critical });
  d.rect(244, 88, 476, 212, { fill: "#f3f7f4", stroke: COLOURS.leaf, sw: 1.3, rx: 10, dash: "6 4" });
  d.text(256, 104, "Low-voltage side", { size: 8.6, weight: 800, fill: COLOURS.action, spacing: "0.12em", upper: true });
  d.text(256, 116, "project manager connects", { size: 8.6, fill: COLOURS.action });
  const place = (items, y, h, startX, endX) => {
    if (!items.length) return;
    d.rect(startX - 6, y + h + 6, endX - startX + 12, 7, { fill: "#9aa39d", stroke: "#6b726d", sw: 1, rx: 2 });
    const total = items.reduce((sum, item) => sum + (item.w ?? 90), 0);
    const gap = Math.min(10, (endX - startX - total) / Math.max(1, items.length - 1));
    let x = startX;
    for (const item of items) {
      const w = item.w ?? 90;
      d.rect(x, y, w, h, { fill: item.fill ?? COLOURS.mist, stroke: COLOURS.forest, sw: 1.5, rx: 6, dash: item.dash ?? null });
      const next = d.paragraph(x + w / 2, y + 16, item.title, { maxWidth: w - 8, size: 9.4, weight: 700, anchor: "middle", gap: 1.22 });
      if (item.sub) d.paragraph(x + w / 2, next + 2, item.sub, { maxWidth: w - 8, size: 8.2, fill: COLOURS.muted, anchor: "middle", gap: 1.2 });
      x += w + gap;
    }
  };
  place(rail1.mains, 130, 68, 52, 220);
  place(rail1.low, 130, 68, 256, 712);
  place(rail2.mains ?? [], 228, 56, 52, 220);
  place(rail2.low, 228, 56, 256, 712);
  d.tag(100, 326, "mains in: electrician", { size: 8.4, side: "below" });
  d.tag(560, 326, "data and signal cables in at the bottom", { size: 8.4, side: "below" });
  d.bottom = 344;
  return d.finish({ legendKinds: [], noteLines: [extraNote ?? "", "The order is a recommendation, not a maker's drawing: the electrician may change it to suit the enclosure. Keep mains and low voltage apart, and label every wire at both ends. " + MANUAL].filter(Boolean) });
}

const sensorRow = (d, { y, bus, top, h, items }) => {
  items.forEach((sensor) => {
    d.box(sensor.x, y, 148, 80, { title: sensor.title, body: sensor.body, icon: sensor.icon, ...siteBox, dash: sensor.dash ?? null, titleSize: 11, bodySize: 8.8, iconPos: "top" });
    if (sensor.who) d.pill(sensor.x + 140, y + 7, sensor.who, { fill: "#fff", colour: COLOURS.forest, stroke: COLOURS.forest, anchor: "end", size: 7.2 });
  });
  d.wire("ma", [[items[0].x + 74, y], [items[0].x + 74, bus], [668, bus], [668, top + h]], { radius: 8 });
  items.filter((item) => item.kind !== "lv").slice(1).forEach((sensor) => d.wire("ma", [[sensor.x + 74, y], [sensor.x + 74, bus]], { radius: 0 }));
  const contact = items.find((item) => item.kind === "lv");
  if (contact) d.wire("lv", [[contact.x + 74, y], [contact.x + 74, bus + 16], [704, bus + 16], [704, top + h]], { radius: 8 });
  d.tag(380, bus - 1, "4 to 20 mA: two wires to each transmitter, powered from the 24 V supply", { size: 8.6, side: "above" });
  if (contact) d.tag(704, top + h + 70, "dry contact", { size: 8.2, side: "above" });
};

// ---------------------------------------------------------------------------------------------------------------------------
// Kit H: hotel or guesthouse
// ---------------------------------------------------------------------------------------------------------------------------

function kitHSystem() {
  const d = new Svg(W, 520, { kit: "KIT H", title: "System: what is measured where", label: "HOTEL OR GUESTHOUSE" });
  d.zone(14, 50, 732, 206, "Electricity");
  d.zone(14, 266, 732, 156, "Water");

  d.box(30, 80, 112, 72, { title: "The grid", body: "Where the supply enters", icon: "pylon", ...siteBox, titleSize: 11.6, bodySize: 9.4 });
  d.wire("mains", [[142, 116], [196, 116]]);
  d.box(196, 76, 150, 80, { title: "Grid meter", body: "Eastron SDM630", chip: "unit 1", icon: "meter", ...mistBox, titleSize: 11.8, bodySize: 9.6, iconPos: "left" });
  d.marker(196, 76, "1");
  d.wire("mains", [[346, 116], [398, 116]]);
  d.box(398, 80, 122, 72, { title: "Main board", body: "Distribution board", icon: "board", ...siteBox, titleSize: 11.6, bodySize: 9.4 });
  d.wire("mains", [[520, 116], [624, 116]]);
  d.box(624, 80, 108, 72, { title: "The hotel", body: "Everything it uses", icon: "building", ...siteBox, titleSize: 11.6, bodySize: 9.4 });
  d.tag(572, 116, "Import and export", { size: 8.8, side: "above" });

  d.box(30, 170, 112, 72, { title: "Solar panels", body: "On the roof", icon: "panel", ...siteBox, titleSize: 11.6, bodySize: 9.4 });
  d.wire("dc", [[142, 206], [196, 206]]);
  d.tag(169, 206, "DC", { size: 8.6, side: "above" });
  d.box(196, 170, 110, 72, { title: "Inverter", body: "AC output", icon: "sun", ...siteBox, titleSize: 11.6, bodySize: 9.4 });
  d.wire("mains", [[306, 206], [344, 206]]);
  d.box(344, 166, 156, 80, { title: "Solar meter", body: "Eastron SDM630", chip: "unit 2", icon: "meter", ...mistBox, titleSize: 11.8, bodySize: 9.6, iconPos: "left" });
  d.marker(344, 166, "2");
  d.wire("mains", [[460, 166], [460, 152]], { radius: 0 });
  d.paragraph(528, 190, "Both meters sit in the distribution board. Only the electrician works there.", { maxWidth: 200, size: 9.4, fill: COLOURS.muted });

  d.box(30, 296, 128, 100, { title: "Water tank", body: "Level transmitter hangs at the bottom", icon: "tank", ...siteBox, titleSize: 11.6, bodySize: 9.4 });
  d.marker(158, 296, "3");
  d.wire("water", [[158, 350], [220, 350]]);
  d.box(220, 316, 112, 68, { title: "Pump", body: "and its starter", icon: "pump", ...siteBox, titleSize: 11.6, bodySize: 9.4 });
  d.marker(332, 316, "6");
  d.text(222, 404, "Spare contact of the starter", { size: 9, weight: 600 });
  pipeWithSensors(d, { from: 332, to: 624, y: 350, pressureAt: 430, flowAt: 540, markers: { pressure: "4", flow: "5" } });
  d.box(624, 316, 108, 68, { title: "The hotel", body: "Taps and rooms", icon: "building", ...siteBox, titleSize: 11.6, bodySize: 9.4 });

  readingsList(d, 436, [
    ["1", "Grid import and export", "kW, from the grid meter"],
    ["2", "Solar production", "kW, from the solar meter"],
    ["3", "Tank level", "percent, level transmitter"],
    ["4", "Line pressure", "bar, pressure transmitter"],
    ["5", "Pump flow", "litres a minute, flow meter if fitted"],
    ["6", "Pump running", "on or off, spare contact"]
  ]);
  return d.finish({ legendKinds: ["mains", "water", "dc"], extraLegend: [swatches.greecon, swatches.site], note: "Greecon only reads. Each numbered point is a meter or a sensor; none can switch anything." });
}

function kitHWiring() {
  const d = new Svg(W, 600, { kit: "KIT H", title: "Wiring: the data cable, the signal wires and the mains side", label: "BUS AND SIGNALS" });
  d.box(24, 56, 150, 66, { title: "Router", body: "The customer's, or the 4G router", icon: "router", ...siteBox, titleSize: 11.6, bodySize: 9.4 });
  d.box(268, 56, 140, 66, { title: "Box", body: "The small computer", icon: "pc", ...mistBox, titleSize: 11.6, bodySize: 9.4 });
  d.wire("eth", [[174, 89], [268, 89]], { label: "Ethernet", labelSide: "above" });
  d.box(528, 56, 208, 66, { title: "24 V DIN supply", body: "Feeds the module and the loop transmitters", icon: "psu", ...mistBox, titleSize: 11.6, bodySize: 9.4 });

  const top = 176;
  const h = 96;
  d.box(24, top, 150, h, { title: "Converter", body: "Modbus TCP to RTU gateway mode. 9600 baud, no parity", icon: "converter", ...mistBox, titleSize: 11.6, bodySize: 9.2, iconPos: "top" });
  d.box(222, top, 140, h, { title: "Grid meter", body: "Eastron SDM630", chip: "unit 1", icon: "meter", ...mistBox, titleSize: 11.6, bodySize: 9.2, iconPos: "top" });
  d.box(410, top, 140, h, { title: "Solar meter", body: "Eastron SDM630", chip: "unit 2", icon: "meter", ...mistBox, titleSize: 11.6, bodySize: 9.2, iconPos: "top" });
  d.box(598, top, 138, h, { title: "Water I/O module", body: "Analog inputs and the pump contact", chip: "unit 3", icon: "level", ...mistBox, titleSize: 11.6, bodySize: 9.2, iconPos: "top" });
  const mid = top + 56;
  d.wire("eth", [[99, 122], [99, top]], { label: "Ethernet", labelSide: "right", at: [99, 150] });
  [[174, 222], [362, 410], [550, 598]].forEach(([a, b]) => {
    d.wire("rs485", [[a, mid], [b, mid]], { radius: 0 });
    d.port(a, mid, null);
    d.port(b, mid, null);
    d.tag((a + b) / 2, mid - 4, "A B GND", { size: 8.2, side: "above" });
  });
  terminatorPills(d, top, h);
  d.wire("lv", [[632, 122], [632, top]], { label: "24 V", labelSide: "left", at: [632, 150] });

  d.zone(204, 316, 358, 98, "", { fill: "#fbf3f1", stroke: COLOURS.critical, dash: "6 4" });
  d.pill(218, 407, "MAINS SIDE: ELECTRICIAN ONLY", { fill: COLOURS.critical, size: 7.6 });
  d.box(222, 328, 140, 62, { title: "Supply entry", body: "In the main board", icon: "board", ...siteBox, titleSize: 11, bodySize: 9 });
  d.box(410, 328, 140, 62, { title: "Inverter AC output", body: "In the board", icon: "board", ...siteBox, titleSize: 11, bodySize: 9 });
  d.wire("mains", [[292, 328], [292, top + h]], { radius: 0 });
  d.wire("mains", [[480, 328], [480, top + h]], { radius: 0 });
  d.tag(292, 304, ["fused voltage taps and", "3 clamps, arrows to the site"], { size: 8.2, side: "above" });
  d.tag(480, 304, ["fused voltage taps and", "3 clamps, arrows to the site"], { size: 8.2, side: "above" });

  sensorRow(d, {
    y: 466,
    bus: 442,
    top,
    h,
    items: [
      { x: 24, title: "Level transmitter", body: "At the bottom of the tank", icon: "level", who: "Electrician or plumber" },
      { x: 212, title: "Pressure transmitter", body: "On the pipe through an isolating valve", icon: "gauge", who: "Plumber" },
      { x: 400, title: "Flow meter", body: "Optional. In the pipe", icon: "flow", dash: "5 3" },
      { x: 588, title: "Pump starter", body: "A spare contact. It only reports", icon: "contact", kind: "lv", who: "Electrician" }
    ]
  });
  d.bottom = 560;
  return d.finish({ legendKinds: ["eth", "rs485", "ma", "lv", "mains"], noteLines: ["*Only for runs longer than about 50 m, or if readings are unreliable at 9600 baud. " + MANUAL] });
}

// ---------------------------------------------------------------------------------------------------------------------------
// Kit S: solar plant with grid connection
// ---------------------------------------------------------------------------------------------------------------------------

function kitSSystem() {
  const d = new Svg(W, 460, { kit: "KIT S", title: "System: what is measured where", label: "SOLAR PLANT WITH GRID CONNECTION" });
  d.zone(14, 50, 732, 228, "Electricity");

  d.box(28, 82, 100, 72, { title: "The grid", body: "Supply entry", icon: "pylon", ...siteBox, titleSize: 11.4, bodySize: 9.4, iconPos: "left" });
  d.wire("mains", [[128, 118], [168, 118]]);
  d.box(168, 78, 140, 80, { title: "Grid meter", body: "Eastron SDM630", chip: "unit 1", icon: "meter", ...mistBox, titleSize: 11.6, bodySize: 9.4, iconPos: "top" });
  d.marker(168, 78, "1");
  d.wire("mains", [[308, 118], [346, 118]]);
  d.box(346, 82, 100, 72, { title: "Main board", body: "Distribution board", icon: "board", ...siteBox, titleSize: 11.4, bodySize: 9.4, iconPos: "top" });
  d.wire("mains", [[446, 118], [486, 118]]);
  d.box(486, 78, 130, 84, { title: "Load meter", body: "Optional. Eastron SDM630", chip: "unit 4", icon: "meter", ...mistBox, ...optional, titleSize: 11.6, bodySize: 9.4, iconPos: "top" });
  d.marker(486, 78, "3");
  d.wire("mains", [[616, 118], [656, 118]]);
  d.box(656, 82, 82, 72, { title: "Site loads", body: "What it uses", icon: "building", ...siteBox, titleSize: 11, bodySize: 9, iconPos: "top" });

  d.box(28, 184, 100, 80, { title: "Solar panels", body: "DC side: never touched", icon: "panel", ...siteBox, titleSize: 11.4, bodySize: 9, iconPos: "top" });
  d.wire("dc", [[128, 224], [168, 224]]);
  d.box(168, 184, 110, 80, { title: "Inverter", body: "AC output", icon: "sun", ...siteBox, titleSize: 11.4, bodySize: 9.4, iconPos: "left" });
  d.wire("mains", [[278, 224], [326, 224]]);
  d.box(326, 184, 144, 80, { title: "Solar meter", body: "Eastron SDM630", chip: "unit 2", icon: "meter", ...mistBox, titleSize: 11.6, bodySize: 9.4, iconPos: "top" });
  d.marker(326, 184, "2");
  d.wire("mains", [[396, 184], [396, 154]], { radius: 0 });
  d.box(520, 184, 218, 80, { title: "Battery system", body: "Optional. Speaks Modbus itself: needs the maker's register table", icon: "battery", ...mistBox, ...optional, titleSize: 11.6, bodySize: 9.2 });
  d.marker(520, 184, "4");
  d.marker(544, 184, "5");

  readingsList(d, 292, [
    ["1", "Grid import and export", "kW, from the grid meter"],
    ["2", "Solar production", "kW, from the solar meter"],
    ["3", "Energy consumption", "kW, load meter if fitted"],
    ["4", "Battery charge", "percent, if there is a battery"],
    ["5", "Battery power", "kW, positive while charging"]
  ]);
  return d.finish({ legendKinds: ["mains", "dc"], extraLegend: [swatches.greecon, swatches.site, swatches.optional], note: "It works with any inverter brand, because it measures at the AC cable with its own meter. Greecon only reads." });
}

function kitSWiring() {
  const d = new Svg(W, 570, { kit: "KIT S", title: "Wiring: the data cable and the mains side", label: "BUS AND SIGNALS" });
  d.box(24, 56, 150, 66, { title: "Router", body: "The customer's, or the 4G router", icon: "router", ...siteBox, titleSize: 11.6, bodySize: 9.4 });
  d.box(268, 56, 140, 66, { title: "Box", body: "The small computer", icon: "pc", ...mistBox, titleSize: 11.6, bodySize: 9.4 });
  d.wire("eth", [[174, 89], [268, 89]], { label: "Ethernet", labelSide: "above" });
  d.box(528, 56, 208, 66, { title: "24 V DIN supply", body: "Feeds the converter, and the box if it takes 9 to 36 V", icon: "psu", ...mistBox, titleSize: 11.6, bodySize: 9 });

  const top = 176;
  const h = 96;
  d.box(24, top, 150, h, { title: "Converter", body: "Modbus TCP to RTU gateway mode. 9600 baud, no parity", icon: "converter", ...mistBox, titleSize: 11.6, bodySize: 9.2, iconPos: "top" });
  d.box(222, top, 140, h, { title: "Grid meter", body: "Eastron SDM630", chip: "unit 1", icon: "meter", ...mistBox, titleSize: 11.6, bodySize: 9.2, iconPos: "top" });
  d.box(410, top, 140, h, { title: "Solar meter", body: "Eastron SDM630", chip: "unit 2", icon: "meter", ...mistBox, titleSize: 11.6, bodySize: 9.2, iconPos: "top" });
  d.box(598, top, 138, h, { title: "Load meter", body: "Optional. Eastron SDM630", chip: "unit 4", icon: "meter", ...mistBox, ...optional, titleSize: 11.6, bodySize: 9.2, iconPos: "top" });
  const mid = top + 56;
  d.wire("eth", [[99, 122], [99, top]], { label: "Ethernet", labelSide: "right", at: [99, 150] });
  [[174, 222], [362, 410], [550, 598]].forEach(([a, b]) => {
    d.wire("rs485", [[a, mid], [b, mid]], { radius: 0 });
    d.port(a, mid, null);
    d.port(b, mid, null);
    d.tag((a + b) / 2, mid - 4, "A B GND", { size: 8.2, side: "above" });
  });
  terminatorPills(d, top, h, { both: false });
  d.wire("lv", [[632, 122], [632, 148], [150, 148], [150, top]], { radius: 8, label: "24 V", labelSide: "above", at: [390, 148] });

  d.zone(204, 316, 546, 98, "", { fill: "#fbf3f1", stroke: COLOURS.critical, dash: "6 4" });
  d.pill(218, 407, "MAINS SIDE: ELECTRICIAN ONLY", { fill: COLOURS.critical, size: 7.6 });
  d.box(222, 328, 140, 62, { title: "Supply entry", body: "In the main board", icon: "board", ...siteBox, titleSize: 11, bodySize: 9 });
  d.box(410, 328, 140, 62, { title: "Inverter AC output", body: "In the board", icon: "board", ...siteBox, titleSize: 11, bodySize: 9 });
  d.box(598, 328, 138, 62, { title: "Feed to the loads", body: "Optional", icon: "board", ...siteBox, ...optional, titleSize: 11, bodySize: 9 });
  [292, 480, 668].forEach((x) => d.wire("mains", [[x, 328], [x, top + h]], { radius: 0 }));
  [292, 480, 668].forEach((x) => d.tag(x, 304, ["fused voltage taps and", "3 clamps, arrows to the site"], { size: 8.2, side: "above" }));
  d.paragraph(222, 436, "On the solar meter the clamp arrows point away from the inverter, towards the board (towards the site).", { maxWidth: 520, size: 8.8, weight: 600 });

  d.box(24, 462, 420, 76, { title: "Battery system", body: "Optional. It speaks Modbus itself, on the site's network (its own address) or on its own RS-485 port (then it joins the cable with its own unit number).", icon: "battery", ...mistBox, ...optional, titleSize: 11.6, bodySize: 9 });
  d.paragraph(466, 484, "It needs the maker's register table. A battery without one is left out: do not guess registers.", { maxWidth: 270, size: 9.6, fill: COLOURS.muted });
  d.bottom = 550;
  return d.finish({ legendKinds: ["eth", "rs485", "lv", "mains"], noteLines: ["*A 120 ohm resistor across A and B at each end of the cable (the converter and the last device), only for runs longer than about 50 m or if readings are unreliable at 9600 baud. " + MANUAL] });
}

// ---------------------------------------------------------------------------------------------------------------------------
// Kit F: farm or greenhouse with irrigation
// ---------------------------------------------------------------------------------------------------------------------------

function kitFSystem() {
  const d = new Svg(W, 560, { kit: "KIT F", title: "System: what is measured where", label: "FARM OR GREENHOUSE" });
  d.zone(14, 50, 732, 156, "The field");
  d.zone(14, 216, 732, 168, "Pump house or water supply");

  d.rect(28, 76, 478, 118, { fill: "#f6f9f5", stroke: COLOURS.leaf, sw: 1.5, rx: 10, dash: "6 4" });
  d.text(42, 94, "Irrigation zone", { size: 10.6, weight: 700 });
  d.text(130, 94, "one soil probe for each zone", { size: 9.4, fill: COLOURS.muted });
  d.box(44, 104, 136, 80, { title: "Soil probe", body: "Depth and place written down", icon: "soil", ...mistBox, titleSize: 11.2, bodySize: 9, iconPos: "top" });
  d.marker(180, 104, "1");
  d.box(198, 104, 150, 80, { title: "Weather sensor", body: "Air temperature and humidity", icon: "thermo", ...mistBox, titleSize: 11.2, bodySize: 9, iconPos: "top" });
  d.marker(348, 104, "3");
  d.marker(326, 104, "2");
  d.box(366, 104, 126, 80, { title: "Another zone", body: "Another probe", icon: "soil", ...mistBox, ...optional, titleSize: 11.2, bodySize: 9, iconPos: "top" });
  d.box(560, 90, 170, 90, { title: "Irrigation lines", body: "The water goes to the crop", icon: "flow", ...siteBox, titleSize: 11.4, bodySize: 9.2, iconPos: "top" });

  d.box(30, 246, 128, 100, { title: "Water tank", body: "Level transmitter hangs at the bottom", icon: "tank", ...siteBox, titleSize: 11.6, bodySize: 9.4 });
  d.marker(158, 246, "4");
  d.wire("water", [[158, 300], [220, 300]]);
  d.box(220, 266, 112, 68, { title: "Pump", body: "and its starter", icon: "pump", ...siteBox, titleSize: 11.6, bodySize: 9.4 });
  d.marker(332, 266, "7");
  d.text(222, 354, "Spare contact of the starter, if there is a pump to watch", { size: 9, weight: 600 });
  d.wire("water", [[332, 300], [645, 300], [645, 180]], { radius: 14 });
  const sensor = (x, icon, name, marker, dash) => {
    d.rect(x - 17, 238, 34, 34, { fill: COLOURS.mist, stroke: COLOURS.forest, sw: 1.7, rx: 8, dash });
    d.icon(icon, x - 11, 244, 22);
    d.plain([[x, 272], [x, 296]], { sw: 2.2 });
    d.marker(x + 20, 238, marker);
    d.text(x, 326, name, { size: 9, weight: 600, anchor: "middle" });
  };
  sensor(430, "gauge", "Pressure transmitter", "5", null);
  sensor(540, "flow", "Flow meter (optional)", "6", "4 3");

  readingsList(d, 400, [
    ["1", "Soil moisture", "percent, for each probe"],
    ["2", "Air temperature", "degrees Celsius"],
    ["3", "Humidity", "percent"],
    ["4", "Tank level", "percent, level transmitter"],
    ["5", "Line pressure", "bar, pressure transmitter"],
    ["6", "Pump flow", "litres a minute, if fitted"],
    ["7", "Pump running", "on or off, if there is a pump to watch"]
  ]);
  return d.finish({ legendKinds: ["water"], extraLegend: [swatches.greecon, swatches.site, swatches.optional], note: "Greecon gives no irrigation advice until the grower's own start-irrigating-below value is entered. Greecon only reads." });
}

function kitFWiring() {
  const d = new Svg(W, 520, { kit: "KIT F", title: "Wiring: the data cable and the signal wires", label: "BUS AND SIGNALS" });
  d.box(24, 56, 150, 66, { title: "4G router", body: "With a data SIM: the likelier case in a field", icon: "router", ...mistBox, titleSize: 11.6, bodySize: 9 });
  d.box(268, 56, 140, 66, { title: "Box", body: "The small computer", icon: "pc", ...mistBox, titleSize: 11.6, bodySize: 9.4 });
  d.wire("eth", [[174, 89], [268, 89]], { label: "Ethernet", labelSide: "above" });
  d.box(528, 56, 208, 66, { title: "24 V DIN supply", body: "Feeds the module and the loop transmitters", icon: "psu", ...mistBox, titleSize: 11.6, bodySize: 9.4 });

  const top = 176;
  const h = 96;
  d.box(24, top, 150, h, { title: "Converter", body: "Modbus TCP to RTU gateway mode. 9600 baud, no parity", icon: "converter", ...mistBox, titleSize: 11.6, bodySize: 9.2, iconPos: "top" });
  d.box(222, top, 140, h, { title: "Soil probe", body: "In the field. Its own unit number", icon: "soil", ...mistBox, titleSize: 11.6, bodySize: 9.2, iconPos: "top" });
  d.box(410, top, 140, h, { title: "Weather sensor", body: "In the field. Its own unit number", icon: "thermo", ...mistBox, titleSize: 11.6, bodySize: 9.2, iconPos: "top" });
  d.box(598, top, 138, h, { title: "Water I/O module", body: "Analog inputs (and the pump contact)", chip: "unit 3", icon: "level", ...mistBox, titleSize: 11.6, bodySize: 9.2, iconPos: "top" });
  const mid = top + 56;
  d.wire("eth", [[99, 122], [99, top]], { label: "Ethernet", labelSide: "right", at: [99, 150] });
  [[174, 222], [362, 410], [550, 598]].forEach(([a, b]) => {
    d.wire("rs485", [[a, mid], [b, mid]], { radius: 0 });
    d.port(a, mid, null);
    d.port(b, mid, null);
    d.tag((a + b) / 2, mid - 4, "A B GND", { size: 8.2, side: "above" });
  });
  terminatorPills(d, top, h);
  d.wire("lv", [[632, 122], [632, top]], { label: "24 V", labelSide: "left", at: [632, 150] });
  d.paragraph(222, top + h + 24, "Set each probe's unit number before it is buried or mounted. Write down its depth and where it is.", { maxWidth: 330, size: 9.2, fill: COLOURS.muted });

  sensorRow(d, {
    y: 366,
    bus: 340,
    top,
    h,
    items: [
      { x: 24, title: "Level transmitter", body: "At the bottom of the tank", icon: "level", who: "Electrician or plumber" },
      { x: 212, title: "Pressure transmitter", body: "On the pipe through an isolating valve", icon: "gauge", who: "Plumber" },
      { x: 400, title: "Flow meter", body: "Optional. In the pipe", icon: "flow", dash: "5 3" },
      { x: 588, title: "Pump starter", body: "Optional. A spare contact. It only reports", icon: "contact", kind: "lv", who: "Electrician", dash: "5 3" }
    ]
  });
  d.bottom = 462;
  return d.finish({ legendKinds: ["eth", "rs485", "ma", "lv"], noteLines: ["*Only for runs longer than about 50 m, or if readings are unreliable at 9600 baud. The soil probe and the weather sensor need a published register table. " + MANUAL] });
}

// ---------------------------------------------------------------------------------------------------------------------------
// Kit W: water tank and pump station
// ---------------------------------------------------------------------------------------------------------------------------

function kitWSystem() {
  const d = new Svg(W, 520, { kit: "KIT W", title: "System: what is measured where", label: "WATER TANK AND PUMP STATION" });
  d.zone(14, 50, 732, 196, "Water");
  d.zone(14, 256, 732, 126, "The pump's electricity (optional)");

  d.box(30, 84, 128, 100, { title: "Water tank", body: "Level transmitter hangs at the bottom", icon: "tank", ...siteBox, titleSize: 11.6, bodySize: 9.4 });
  d.marker(158, 84, "1");
  d.wire("water", [[158, 138], [208, 138]]);
  d.box(208, 104, 112, 68, { title: "Pump", body: "and its starter", icon: "pump", ...siteBox, titleSize: 11.6, bodySize: 9.4 });
  d.marker(320, 104, "4");
  d.text(276, 200, "Spare contact of the starter", { size: 9, weight: 600 });
  pipeWithSensors(d, { from: 320, to: 624, y: 138, pressureAt: 420, flowAt: 530, markers: { pressure: "2", flow: "3" } });
  d.box(624, 102, 108, 72, { title: "The pipe it feeds", body: "Where the water goes", icon: "building", ...siteBox, titleSize: 11, bodySize: 9.4 });

  d.box(30, 292, 128, 74, { title: "Pump's supply", body: "Where its feed comes from", icon: "pylon", ...siteBox, titleSize: 11.4, bodySize: 9.2 });
  d.wire("mains", [[158, 329], [226, 329]]);
  d.box(226, 290, 152, 80, { title: "Pump meter", body: "Optional. Eastron SDM230", chip: "unit 4", icon: "meter", ...mistBox, ...optional, titleSize: 11.6, bodySize: 9.4, iconPos: "top" });
  d.marker(226, 290, "5");
  d.wire("mains", [[264, 290], [264, 172]], { radius: 0 });
  d.paragraph(420, 312, "The meter goes on the pump's own feed, in the board, fitted by the electrician.", { maxWidth: 300, size: 9.6, fill: COLOURS.muted });

  readingsList(d, 394, [
    ["1", "Tank level", "percent, level transmitter"],
    ["2", "Line pressure", "bar, pressure transmitter"],
    ["3", "Pump flow", "litres a minute, flow meter if fitted"],
    ["4", "Pump running", "on or off, spare contact"],
    ["5", "Energy consumption", "kW, the pump's own electricity"]
  ]);
  return d.finish({ legendKinds: ["mains", "water"], extraLegend: [swatches.greecon, swatches.site, swatches.optional], note: "The simplest site, and a good first rehearsal. Greecon only reads." });
}

function kitWWiring() {
  const d = new Svg(W, 520, { kit: "KIT W", title: "Wiring: the data cable and the signal wires", label: "BUS AND SIGNALS" });
  d.box(24, 56, 150, 66, { title: "Router", body: "The customer's, or the 4G router", icon: "router", ...siteBox, titleSize: 11.6, bodySize: 9.4 });
  d.box(268, 56, 140, 66, { title: "Box", body: "The small computer", icon: "pc", ...mistBox, titleSize: 11.6, bodySize: 9.4 });
  d.wire("eth", [[174, 89], [268, 89]], { label: "Ethernet", labelSide: "above" });
  d.box(528, 56, 208, 66, { title: "24 V DIN supply", body: "Feeds the module and the loop transmitters", icon: "psu", ...mistBox, titleSize: 11.6, bodySize: 9.4 });

  const top = 176;
  const h = 96;
  d.box(24, top, 150, h, { title: "Converter", body: "Modbus TCP to RTU gateway mode. 9600 baud, no parity", icon: "converter", ...mistBox, titleSize: 11.6, bodySize: 9.2, iconPos: "top" });
  d.box(222, top, 140, h, { title: "Pump meter", body: "Optional. Eastron SDM230", chip: "unit 4", icon: "meter", ...mistBox, ...optional, titleSize: 11.6, bodySize: 9.2, iconPos: "top" });
  d.box(598, top, 138, h, { title: "Water I/O module", body: "Analog inputs and the pump contact", chip: "unit 3", icon: "level", ...mistBox, titleSize: 11.6, bodySize: 9.2, iconPos: "top" });
  const mid = top + 56;
  d.wire("eth", [[99, 122], [99, top]], { label: "Ethernet", labelSide: "right", at: [99, 150] });
  d.wire("rs485", [[174, mid], [222, mid]], { radius: 0 });
  d.wire("rs485", [[362, mid], [598, mid]], { radius: 0 });
  [174, 222, 362, 598].forEach((x) => d.port(x, mid, null));
  d.tag(198, mid - 4, "A B GND", { size: 8.2, side: "above" });
  d.tag(480, mid - 4, "A B GND", { size: 8.2, side: "above" });
  terminatorPills(d, top, h);
  d.wire("lv", [[632, 122], [632, top]], { label: "24 V", labelSide: "left", at: [632, 150] });
  d.paragraph(24, top + h + 40, "If the pump meter is not fitted, the converter goes straight to the module.", { maxWidth: 172, size: 9, fill: COLOURS.muted });

  d.zone(204, 316, 170, 98, "", { fill: "#fbf3f1", stroke: COLOURS.critical, dash: "6 4" });
  d.pill(212, 407, "MAINS SIDE: ELECTRICIAN ONLY", { fill: COLOURS.critical, size: 7.6 });
  d.box(214, 328, 150, 62, { title: "The pump's feed", body: "In its board", icon: "board", ...siteBox, ...optional, titleSize: 11, bodySize: 9 });
  d.wire("mains", [[292, 328], [292, top + h]], { radius: 0 });
  d.tag(292, 304, ["connected as the", "maker's manual shows"], { size: 8.2, side: "above" });

  sensorRow(d, {
    y: 466,
    bus: 442,
    top,
    h,
    items: [
      { x: 24, title: "Level transmitter", body: "At the bottom of the tank", icon: "level", who: "Electrician or plumber" },
      { x: 212, title: "Pressure transmitter", body: "On the pipe through an isolating valve", icon: "gauge", who: "Plumber" },
      { x: 400, title: "Flow meter", body: "Optional. In the pipe", icon: "flow", dash: "5 3" },
      { x: 588, title: "Pump starter", body: "A spare contact. It only reports", icon: "contact", kind: "lv", who: "Electrician" }
    ]
  });
  d.bottom = 560;
  return d.finish({ legendKinds: ["eth", "rs485", "ma", "lv", "mains"], noteLines: ["*Only for runs longer than about 50 m, or if readings are unreliable at 9600 baud. The pump meter is connected as its maker's manual shows. " + MANUAL] });
}

// ---------------------------------------------------------------------------------------------------------------------------

const registry = [];

function register(id, { kit, label, caption, draw }) {
  registry.push({ id, kit, label, caption, draw });
}

register("how-it-works", { kit: "ALL KITS", label: "1-1", caption: "How Greecon works: meters and sensors, the converter, the box, the internet, the platform and the people who are told. Everything points one way.", draw: howItWorks });
register("order-of-things", { kit: "ALL KITS", label: "1-2", caption: "The order of things: eleven stages from the first call to day 90. The two highlighted stages are the days on site.", draw: customerPath });

register("ref-rs485", { kit: "ALL KITS", label: "4-1", caption: "The RS-485 data cable: one cable and a daisy chain, never branches.", draw: () => rs485Rules({ kit: "ALL KITS", label: "DATA CABLE" }) });
register("ref-ct", { kit: "ALL KITS", label: "4-2", caption: "Fitting a three-phase meter: fused voltage taps and three current clamps, arrows towards the site. The electrician's work.", draw: () => ctFitting({ kit: "ALL KITS", label: "METERS" }) });
register("ref-loop", { kit: "ALL KITS", label: "4-3", caption: "A 4 to 20 mA loop: the 24 V supply in series with the module's input.", draw: () => loopFigure({ kit: "ALL KITS", label: "SIGNALS" }) });
register("ref-power", { kit: "ALL KITS", label: "4-4", caption: "Power: everything from one clean place, on a UPS.", draw: () => powerFigure({ kit: "ALL KITS", label: "POWER", feeds: "Feeds the input module and the loop transmitters" }) });
register("ref-network", { kit: "ALL KITS", label: "4-5", caption: "The network: the customer's router (best), or a 4G router with a data SIM.", draw: () => networkDiagram({ kit: "ALL KITS", label: "NETWORK", badgeA: "Best", badgeB: null, behind: "the meters and the input modules, each with its own unit number." }) });

const rail = (mains, low, rail2Low, extraNote) => ({ rail1: { mains, low }, rail2: { mains: [], low: rail2Low }, extraNote });
const fuses = { title: "Fuses or small breakers", sub: "voltage taps", w: 80, fill: "#fff" };
const fusesAsNeeded = { title: "Fuses or small breakers", sub: "as needed", w: 80, fill: "#fff" };
const psu = { title: "24 V DIN supply", sub: "mains in", w: 80 };
const terminals = { title: "Terminal blocks", sub: "RS-485, 4 to 20 mA, 24 V", w: 160, fill: "#fff" };
const theBox = { title: "Box", sub: "if there is room, else on a shelf beside it", w: 190 };

// kit H
register("kit-h-system", { kit: "KIT H", label: "H-1", caption: "Kit H, hotel or guesthouse. System: what is measured where. The numbers mark what Greecon reads; they are listed under the drawing.", draw: kitHSystem });
register("kit-h-wiring", { kit: "KIT H", label: "H-2", caption: "Kit H. Wiring: one RS-485 cable from the converter through the grid meter and the solar meter to the water module, with the 4 to 20 mA loops and the pump contact into the module. Mains work is inside the dashed box.", draw: kitHWiring });
register("kit-h-network", { kit: "KIT H", label: "H-3", caption: "Kit H. Network: the box and the converter on the customer's router (best) or on a 4G router.", draw: () => networkDiagram({ kit: "KIT H", label: "NETWORK", badgeA: "Best", badgeB: null, behind: "the grid meter (unit 1), the solar meter (unit 2) and the water module (unit 3)." }) });
register("kit-h-enclosure", {
  kit: "KIT H",
  label: "H-4",
  caption: "Kit H. The enclosure: the recommended order of the parts on the DIN rail, mains side on the left.",
  draw: () => enclosureDiagram({ kit: "KIT H", label: "ENCLOSURE", ...rail([fuses, psu], [{ title: "Converter", sub: "9600 baud, gateway mode", w: 122 }, { title: "Analog input module", sub: "unit 3", w: 122 }, { title: "Pump run input", sub: "only if a separate module", w: 122, dash: "5 3" }], [terminals, theBox], "The meters are not in this enclosure: they sit in the distribution board at the point they measure.") })
});
register("kit-h-ct", { kit: "KIT H", label: "H-5", caption: "Kit H. Fitting the grid meter and the solar meter: fused voltage taps and three clamps each, arrows towards the site.", draw: () => ctFitting({ kit: "KIT H", label: "METERS" }) });
register("kit-h-loop", { kit: "KIT H", label: "H-6", caption: "Kit H. One 4 to 20 mA loop; the level, the pressure and the flow transmitter are each wired this way.", draw: () => loopFigure({ kit: "KIT H", label: "SIGNALS" }) });
register("kit-h-power", { kit: "KIT H", label: "H-7", caption: "Kit H. Power: the UPS feeds the box, the converter and the 24 V supply.", draw: () => powerFigure({ kit: "KIT H", label: "POWER", feeds: "Feeds the water module and the loop transmitters" }) });

// kit S
register("kit-s-system", { kit: "KIT S", label: "S-1", caption: "Kit S, solar plant with grid connection. System: what is measured where. The dashed boxes are optional.", draw: kitSSystem });
register("kit-s-wiring", { kit: "KIT S", label: "S-2", caption: "Kit S. Wiring: one RS-485 cable from the converter through the grid meter, the solar meter and, if fitted, the load meter. Mains work is inside the dashed box.", draw: kitSWiring });
register("kit-s-network", { kit: "KIT S", label: "S-3", caption: "Kit S. Network: the box and the converter on the customer's router (best) or on a 4G router.", draw: () => networkDiagram({ kit: "KIT S", label: "NETWORK", badgeA: "Best", badgeB: null, behind: "the grid meter (unit 1), the solar meter (unit 2) and, if fitted, the load meter (unit 4). A battery that speaks Modbus on its own network address does not need the converter." }) });
register("kit-s-enclosure", {
  kit: "KIT S",
  label: "S-4",
  caption: "Kit S. The enclosure: the recommended order of the parts on the DIN rail, mains side on the left.",
  draw: () => enclosureDiagram({ kit: "KIT S", label: "ENCLOSURE", ...rail([fuses, psu], [{ title: "Converter", sub: "9600 baud, gateway mode", w: 150 }, { title: "Terminal blocks", sub: "RS-485 and 24 V", w: 150, fill: "#fff" }], [{ title: "Box", sub: "if there is room, else on a shelf beside it", w: 220 }], "The meters are not in this enclosure: they sit in the distribution board at the point they measure.") })
});
register("kit-s-ct", { kit: "KIT S", label: "S-5", caption: "Kit S. Fitting the grid meter and the solar meter (and the load meter): fused voltage taps and three clamps each, arrows towards the site.", draw: () => ctFitting({ kit: "KIT S", label: "METERS" }) });
register("kit-s-power", { kit: "KIT S", label: "S-6", caption: "Kit S. Power: the UPS feeds the box, the converter and the 24 V supply.", draw: () => powerFigure({ kit: "KIT S", label: "POWER", feeds: "Feeds the converter (and the box if it takes 9 to 36 V)" }) });

// kit F
register("kit-f-system", { kit: "KIT F", label: "F-1", caption: "Kit F, farm or greenhouse with irrigation. System: what is measured where. The dashed parts are optional.", draw: kitFSystem });
register("kit-f-wiring", { kit: "KIT F", label: "F-2", caption: "Kit F. Wiring: one RS-485 cable from the converter through the soil probe and the weather sensor to the water module, with the 4 to 20 mA loops into the module.", draw: kitFWiring });
register("kit-f-network", { kit: "KIT F", label: "F-3", caption: "Kit F. Network: a 4G router with a data SIM is the likelier case in a field; the customer's router is better where there is one.", draw: () => networkDiagram({ kit: "KIT F", label: "NETWORK", badgeA: null, badgeB: "Likelier in a field", behind: "the soil probe(s) and the weather sensor, each with its own unit number, and the water module (unit 3)." }) });
register("kit-f-enclosure", {
  kit: "KIT F",
  label: "F-4",
  caption: "Kit F. The enclosure: the recommended order of the parts on the DIN rail, mains side on the left.",
  draw: () => enclosureDiagram({ kit: "KIT F", label: "ENCLOSURE", ...rail([fusesAsNeeded, psu], [{ title: "Converter", sub: "9600 baud, gateway mode", w: 110 }, { title: "Analog input module", sub: "unit 3", w: 110 }, { title: "4G router", sub: "DIN rail, with SIM", w: 110 }, { title: "Pump run input", sub: "if there is a pump", w: 110, dash: "5 3" }], [terminals, theBox], "The probes and the weather sensor are in the field, on the data cable. Check the signal where the router sits.") })
});
register("kit-f-loop", { kit: "KIT F", label: "F-5", caption: "Kit F. One 4 to 20 mA loop; the level, the pressure and the flow transmitter are each wired this way.", draw: () => loopFigure({ kit: "KIT F", label: "SIGNALS" }) });
register("kit-f-power", { kit: "KIT F", label: "F-6", caption: "Kit F. Power. The hardware guide's standard list for this kit has no UPS: decide at the survey and write it down.", draw: () => powerFigure({ kit: "KIT F", label: "POWER", feeds: "Feeds the water module and the loop transmitters", feedsNote: "The hardware guide's standard list for Kit F has no UPS row. If the site has one, it sits between the mains and the supplies as drawn." }) });

// kit W
register("kit-w-system", { kit: "KIT W", label: "W-1", caption: "Kit W, water tank and pump station. System: what is measured where. The dashed parts are optional.", draw: kitWSystem });
register("kit-w-wiring", { kit: "KIT W", label: "W-2", caption: "Kit W. Wiring: one RS-485 cable from the converter to the water module (and to the pump meter, if fitted), with the 4 to 20 mA loops and the pump contact into the module.", draw: kitWWiring });
register("kit-w-network", { kit: "KIT W", label: "W-3", caption: "Kit W. Network: the box and the converter on the customer's router (best) or on a 4G router.", draw: () => networkDiagram({ kit: "KIT W", label: "NETWORK", badgeA: "Best", badgeB: null, behind: "the water module (unit 3) and, if fitted, the pump meter (unit 4)." }) });
register("kit-w-enclosure", {
  kit: "KIT W",
  label: "W-4",
  caption: "Kit W. The enclosure: the recommended order of the parts on the DIN rail, mains side on the left.",
  draw: () => enclosureDiagram({ kit: "KIT W", label: "ENCLOSURE", ...rail([fusesAsNeeded, psu], [{ title: "Converter", sub: "9600 baud, gateway mode", w: 122 }, { title: "Analog input module", sub: "unit 3", w: 122 }, { title: "Pump run input", sub: "only if a separate module", w: 122, dash: "5 3" }], [terminals, theBox], "The optional pump meter sits in the board that feeds the pump, not in this enclosure.") })
});
register("kit-w-loop", { kit: "KIT W", label: "W-5", caption: "Kit W. One 4 to 20 mA loop; the level, the pressure and the flow transmitter are each wired this way.", draw: () => loopFigure({ kit: "KIT W", label: "SIGNALS" }) });
register("kit-w-power", { kit: "KIT W", label: "W-6", caption: "Kit W. Power: the UPS feeds the box, the converter and the 24 V supply.", draw: () => powerFigure({ kit: "KIT W", label: "POWER", feeds: "Feeds the water module and the loop transmitters" }) });

export function buildDiagrams() {
  const out = {};
  for (const entry of registry) {
    const svg = entry.draw();
    out[entry.id] = { id: entry.id, kit: entry.kit, label: entry.label, caption: entry.caption, svg: svg.toString(), warnings: svg.warnings, height: svg.height };
  }
  return out;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const args = process.argv.slice(2);
  const at = args.indexOf("--preview");
  const dir = at >= 0 ? args[at + 1] : null;
  const diagrams = buildDiagrams();
  let warnings = 0;
  for (const diagram of Object.values(diagrams)) {
    for (const warning of diagram.warnings) {
      warnings += 1;
      console.warn(`[${diagram.id}] ${warning}`);
    }
  }
  console.log(`${Object.keys(diagrams).length} diagrams, ${warnings} warnings`);
  if (dir) {
    mkdirSync(dir, { recursive: true });
    const sheet = Object.values(diagrams)
      .map((diagram) => `<section style="width:680px;margin:0 auto 24px;font:12px Inter"><b>${diagram.id}</b> (${diagram.label}) ${diagram.svg}</section>`)
      .join("\n");
    writeFileSync(`${dir}/diagrams.html`, `<!doctype html><meta charset="utf-8"><body style="margin:20px;background:#eee">${sheet}</body>`);
    console.log(`Preview written to ${dir}/diagrams.html`);
  }
}
