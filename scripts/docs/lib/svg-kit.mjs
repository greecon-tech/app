// A small toolkit for the guides' diagrams: rounded boxes, forest-green lines, labelled ports and cables, one style.
//
// Every diagram is drawn from here so they look like one family. Line kinds read in black and white as well as in colour:
// mains is the thickest solid line, low voltage a thin solid one, RS-485 dashed, Ethernet dotted, 4 to 20 mA dash-dot.

import { measure, wrapText } from "./metrics.mjs";

export const COLOURS = {
  cream: "#f7f1e9",
  sand: "#e8e0d3",
  forest: "#2f3d35",
  mist: "#d8e2dc",
  leaf: "#448561",
  night: "#1a211d",
  action: "#2f6b4a",
  critical: "#8e3c35",
  warning: "#6d5424",
  watch: "#3f5c56",
  muted: "#4a524d",
  faint: "#6b726d",
  rule: "#cdc7ba"
};

/** How each kind of line is drawn, and what the legend calls it. */
export const WIRES = {
  mains: { stroke: "#1a211d", width: 4.4, dash: null, cap: "butt", name: "Mains (230/400 V): electrician only" },
  lv: { stroke: "#8e3c35", width: 2.3, dash: null, cap: "butt", name: "Low voltage: power and dry contacts" },
  rs485: { stroke: "#2f6b4a", width: 2.7, dash: "8 4", cap: "butt", name: "RS-485 data cable (A, B, ground)" },
  eth: { stroke: "#3f5c56", width: 3.2, dash: "0.1 5.6", cap: "round", name: "Ethernet network cable" },
  ma: { stroke: "#6d5424", width: 2.5, dash: "11 3.5 2.5 3.5", cap: "butt", name: "4 to 20 mA signal wire" },
  inet: { stroke: "#6b726d", width: 1.9, dash: null, cap: "butt", name: "Internet (HTTPS, port 443)" },
  radio: { stroke: "#6b726d", width: 1.9, dash: "3 3", cap: "butt", name: "Cellular (radio)" },
  water: { stroke: "#3f5c56", width: 8, dash: null, cap: "butt", name: "Water pipe", outline: true },
  dc: { stroke: "#8b928d", width: 1.9, dash: "2 4.5", cap: "round", name: "Solar panel wiring (DC): never touched" }
};

const ICONS = {
  panel: "M3 17l3-9h15l-3 9z M6.4 12.5h14.2 M10.6 8l-1.4 9 M15.6 8l-1 9 M12 17v3.4 M8 20.4h8",
  pylon: "M12 2.6l-5 18.6 M12 2.6l5 18.6 M8.4 9.2h7.2 M7.2 14.4h9.6 M5.6 21.2h12.8 M8.4 9.2l7.2 5.2 M15.6 9.2l-7.2 5.2 M9.8 4.6h4.4",
  tank: "M5 6.2c0-1.5 3.1-2.6 7-2.6s7 1.1 7 2.6v11.6c0 1.5-3.1 2.6-7 2.6s-7-1.1-7-2.6z M5 6.2c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6 M5 12.2c2 1.3 4 1.4 7 .9 3-.5 5-.6 7 .5",
  pump: "M10.5 7.8a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z M8.6 10.8l4.2 2.5-4.2 2.5z M10.5 7.8V4.6h5.2 M16 13.3h5.6v3 M10.5 19v2 M6.6 21h8",
  meter: "M4.4 3.6h15.2v16.8H4.4z M7.4 7.2h9.2v4.4H7.4z M8 15.6h.1 M12 15.6h.1 M16 15.6h.1",
  pc: "M3 8.2h18v8.6H3z M6.4 12.5h.1 M9.4 12.5h6.4 M7 16.8v2.2 M17 16.8v2.2",
  router: "M3 14.4h18v5.2H3z M7 17h.1 M11 17h.1 M7.2 14.4L5 7.6 M16.8 14.4L19 7.6 M12 14.4V6.4",
  ups: "M3 8h16v8.4H3z M19 10.6h2.2v3.2H19z M7.4 12.2h4.6 M9.7 9.9v4.6",
  psu: "M3 5.6h18v12.8H3z M6.4 12c1.4-2.4 2.8 2.4 4.2 0 M13.6 10h4.2 M13.6 13.6h4.2",
  soil: "M12 2.8v12.6 M9 15.4l3 6 3-6z M3.6 17.4h4 M16.4 17.4h4 M2.6 20.4h18.8 M16.8 5.4c1 1.5 1.6 2.4 1.6 3.4a1.6 1.6 0 0 1-3.2 0c0-1 .6-1.9 1.6-3.4z",
  thermo: "M9.8 4.4a2.2 2.2 0 0 1 4.4 0v8.8a4.2 4.2 0 1 1-4.4 0z M12 9v6.6 M17.6 6c.9 1.3 1.4 2.1 1.4 3a1.4 1.4 0 0 1-2.8 0c0-.9.5-1.7 1.4-3z",
  cloud: "M7 18.4a4.2 4.2 0 0 1-.5-8.4 5.7 5.7 0 0 1 10.9 1.4 3.6 3.6 0 0 1-.2 7z",
  person: "M12 11.8a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4z M4.8 20.4c0-3.7 3.2-6.1 7.2-6.1s7.2 2.4 7.2 6.1",
  building: "M5 21V6.4l7-3.2 7 3.2V21 M9 9.4h.1 M12 9.4h.1 M15 9.4h.1 M9 13.2h.1 M12 13.2h.1 M15 13.2h.1 M10.4 21v-4.2h3.2V21",
  tower: "M12 12.4V21 M8 21h8 M8.8 9.4a4.2 4.2 0 0 1 6.4 0 M6.2 6.8a8 8 0 0 1 11.6 0 M12 12.4h.1",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2.6v2.4 M12 19v2.4 M2.6 12H5 M19 12h2.4 M5.4 5.4l1.7 1.7 M16.9 16.9l1.7 1.7 M18.6 5.4l-1.7 1.7 M7.1 16.9l-1.7 1.7",
  gauge: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M12 12l3.6-3.8 M7.2 15.2h.1 M6.6 11h.1 M9 7.4h.1 M15 7.4h.1",
  flow: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M7.4 12h8.6 M13.2 9l3 3-3 3",
  level: "M8 3.4h8v17.2H8z M8 9.4h8 M8 14.6h8 M4.6 9.4l1.8 1.8L4.6 13 M19.4 9.4l-1.8 1.8 1.8 1.8",
  contact: "M3 12h5.4 M15.6 12H21 M8.4 12l6.6-4.4",
  converter: "M3.4 6.4h7.4v11.2H3.4z M13.2 6.4h7.4v11.2h-7.4z M10.8 10h2.4 M10.8 14h2.4",
  laptop: "M5 6h14v9.4H5z M2.6 18.4h18.8 M9.4 15.4v3",
  house: "M3.6 11L12 3.8 20.4 11 M6 9.4V20h12V9.4 M10.4 20v-5.4h3.2V20",
  board: "M4.4 3.6h15.2v16.8H4.4z M7.6 7.4h3 M13.4 7.4h3 M7.6 11.4h3 M13.4 11.4h3 M7.6 15.4h3 M13.4 15.4h3",
  battery: "M3 8h16v8.4H3z M19 10.6h2.2v3.2H19z M6.4 10.4v3.6 M9.6 10.4v3.6 M12.8 10.4v3.6",
  wifi: "M12 18.6h.1 M8.6 15.2a4.8 4.8 0 0 1 6.8 0 M5.8 12.2a8.8 8.8 0 0 1 12.4 0 M3 9.2a12.8 12.8 0 0 1 18 0",
  lock: "M6.4 10.6h11.2V20H6.4z M8.8 10.6V7.8a3.2 3.2 0 0 1 6.4 0v2.8",
  scissors: "M6 6.4a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z M6 14.8a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z M8 10.4L20 18 M8 15.6L20 8"
};

function esc(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function num(value) {
  return Number(value.toFixed(2));
}

export const textWidth = measure;

export class Svg {
  constructor(width, height, { kit, title, label }) {
    this.width = width;
    this.height = height;
    this.kit = kit;
    this.title = title;
    this.label = label;
    this.body = [];
    this.warnings = [];
    this.usedWires = new Set();
    this.bottom = height;
  }

  add(markup) {
    this.body.push(markup);
    return this;
  }

  warn(message) {
    this.warnings.push(message);
  }

  rect(x, y, w, h, { fill = "#fff", stroke = COLOURS.forest, sw = 1.5, rx = 9, dash = null, opacity = null } = {}) {
    return this.add(
      `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ""}${opacity ? ` opacity="${opacity}"` : ""}/>`
    );
  }

  text(x, y, content, { size = 12, weight = 400, anchor = "start", fill = COLOURS.forest, italic = false, mono = false, spacing = null, maxWidth = null, upper = false } = {}) {
    const string = upper ? String(content).toUpperCase() : String(content);
    if (maxWidth && measure(string, size, weight) > maxWidth + 0.5) {
      this.warn(`"${string}" is about ${Math.round(measure(string, size, weight))} wide in a space of ${Math.round(maxWidth)}`);
    }
    return this.add(
      `<text x="${num(x)}" y="${num(y)}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}"${italic ? ' font-style="italic"' : ""}${mono ? ' font-family="DejaVu Sans Mono, monospace"' : ""}${spacing ? ` letter-spacing="${spacing}"` : ""}>${esc(string)}</text>`
    );
  }

  /** A paragraph wrapped to a width. Returns the y of the line after the last. */
  paragraph(x, y, content, { maxWidth, size = 10.4, weight = 400, gap = 1.32, ...rest }) {
    const rows = wrapText(content, maxWidth, size, weight);
    rows.forEach((row, index) => this.text(x, y + index * size * gap, row, { size, weight, ...rest }));
    return y + rows.length * size * gap;
  }

  path(d, { stroke = COLOURS.forest, sw = 1.5, fill = "none", dash = null, cap = "round", join = "round" } = {}) {
    return this.add(`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="${cap}" stroke-linejoin="${join}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`);
  }

  icon(name, x, y, size = 22, { stroke = COLOURS.forest, sw = 1.5 } = {}) {
    const d = ICONS[name];
    if (!d) throw new Error(`No icon called ${name}`);
    const scale = size / 24;
    return this.add(`<g transform="translate(${num(x)} ${num(y)}) scale(${num(scale)})" fill="none" stroke="${stroke}" stroke-width="${num(sw / scale)}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></g>`);
  }

  /** A line from point to point with square corners rounded. kind is a key of WIRES. */
  wire(kind, points, { radius = 9, arrow = null, label = null, at = null, labelSide = "above", labelSize = 9.4, labelFill = COLOURS.forest } = {}) {
    const style = WIRES[kind];
    if (!style) throw new Error(`No wire kind ${kind}`);
    this.usedWires.add(kind);
    let d = `M${num(points[0][0])} ${num(points[0][1])}`;
    for (let index = 1; index < points.length; index += 1) {
      const [x, y] = points[index];
      if (index === points.length - 1) {
        d += ` L${num(x)} ${num(y)}`;
        continue;
      }
      const [px, py] = points[index - 1];
      const [nx, ny] = points[index + 1];
      const before = Math.hypot(x - px, y - py);
      const after = Math.hypot(nx - x, ny - y);
      const r = Math.min(radius, before / 2, after / 2);
      const sx = x - ((x - px) / before) * r;
      const sy = y - ((y - py) / before) * r;
      const ex = x + ((nx - x) / after) * r;
      const ey = y + ((ny - y) / after) * r;
      d += ` L${num(sx)} ${num(sy)} Q${num(x)} ${num(y)} ${num(ex)} ${num(ey)}`;
    }
    if (style.outline) {
      this.path(d, { stroke: style.stroke, sw: style.width, cap: style.cap, join: "round" });
      this.path(d, { stroke: "#fff", sw: style.width - 3.6, cap: style.cap, join: "round" });
    } else {
      this.path(d, { stroke: style.stroke, sw: style.width, dash: style.dash, cap: style.cap, join: "round" });
    }
    if (arrow) {
      const heads = arrow === "both" ? ["start", "end"] : [arrow];
      for (const head of heads) {
        const [tip, from] = head === "end" ? [points[points.length - 1], points[points.length - 2]] : [points[0], points[1]];
        this.arrowHead(tip, from, style.stroke);
      }
    }
    if (label) {
      const [lx, ly] = at ?? midpoint(points);
      this.tag(lx, ly, label, { side: labelSide, size: labelSize, fill: labelFill });
    }
    return this;
  }

  /** A thin plain line for things that are mounted rather than wired (not in the legend). */
  plain(points, { sw = 2, stroke = COLOURS.forest, dash = null, radius = 6 } = {}) {
    let d = `M${num(points[0][0])} ${num(points[0][1])}`;
    for (let index = 1; index < points.length; index += 1) {
      const [x, y] = points[index];
      if (index === points.length - 1) {
        d += ` L${num(x)} ${num(y)}`;
        continue;
      }
      const [px, py] = points[index - 1];
      const [nx, ny] = points[index + 1];
      const before = Math.hypot(x - px, y - py);
      const after = Math.hypot(nx - x, ny - y);
      const r = Math.min(radius, before / 2, after / 2);
      d += ` L${num(x - ((x - px) / before) * r)} ${num(y - ((y - py) / before) * r)} Q${num(x)} ${num(y)} ${num(x + ((nx - x) / after) * r)} ${num(y + ((ny - y) / after) * r)}`;
    }
    return this.path(d, { stroke, sw, dash, cap: "round" });
  }

  arrowHead(tip, from, colour) {
    const angle = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
    const size = 8;
    const a1 = angle + Math.PI - 0.5;
    const a2 = angle + Math.PI + 0.5;
    this.path(`M${num(tip[0])} ${num(tip[1])} L${num(tip[0] + Math.cos(a1) * size)} ${num(tip[1] + Math.sin(a1) * size)} L${num(tip[0] + Math.cos(a2) * size)} ${num(tip[1] + Math.sin(a2) * size)}z`, { stroke: colour, fill: colour, sw: 1 });
  }

  /** A small label with a white backing so a line behind it stays readable. */
  tag(x, y, content, { side = "above", size = 9.4, fill = COLOURS.forest, weight = 600, anchor = "middle" } = {}) {
    const rows = Array.isArray(content) ? content : [content];
    const w = Math.max(...rows.map((row) => measure(row, size, weight))) + 8;
    const h = rows.length * size * 1.25 + 3;
    let top;
    if (side === "above") top = y - h - 2;
    else if (side === "below") top = y + 2;
    else top = y - h / 2;
    const left = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
    this.add(`<rect x="${num(left)}" y="${num(top)}" width="${num(w)}" height="${num(h)}" rx="3" fill="#fff" opacity="0.94"/>`);
    rows.forEach((row, index) => {
      this.text(left + w / 2, top + 1.5 + size * 0.98 + index * size * 1.25, row, { size, weight, fill, anchor: "middle" });
    });
    return this;
  }

  /** Works out how the text of a box would be laid out with the icon at the left or at the top, without drawing it. */
  boxLayout(w, { title, body, icon, chip, titleSize, bodySize }, position) {
    const padX = 10;
    const iconSize = 22;
    const chipWidth = chip ? measure(chip, 8, 700) + 14 + chip.length * 0.32 : 0;
    let textX = padX;
    let textW = w - padX * 2;
    let cursor = 9;
    if (position === "left") {
      textX = padX + iconSize + 7;
      textW = w - padX - iconSize - 7 - padX - (chip ? chipWidth + 2 : 0);
    } else if (position === "top") {
      cursor = 8 + iconSize + 3;
    }
    const titleRows = [];
    for (const row of Array.isArray(title) ? title : [title]) titleRows.push(...wrapText(row, textW, titleSize, 700));
    const bodyRows = [];
    for (const row of Array.isArray(body) ? body : [body]) bodyRows.push(...wrapText(row, textW, bodySize, 400));
    const firstBaseline = cursor + (position === "top" ? titleSize + 1 : titleSize + 3);
    const bodyStart = firstBaseline + (titleRows.length - 1) * titleSize * 1.2 + titleSize * 1.2 + 1;
    const used = bodyRows.length ? bodyStart + (bodyRows.length - 1) * bodySize * 1.3 + 6 : firstBaseline + (titleRows.length - 1) * titleSize * 1.2 + 8;
    const widest = Math.max(...titleRows.map((row) => measure(row, titleSize, 700)), ...bodyRows.map((row) => measure(row, bodySize, 400)), 0);
    return { position, textX, textW, titleRows, bodyRows, firstBaseline, bodyStart, used, widest, chipWidth };
  }

  /**
   * A piece of equipment: a rounded box with an icon, a title and some lines of text (wrapped to fit).
   * With iconPos "auto" the icon goes beside the text if that fits the height given, else above it.
   * Returns the y just below the last line, so a caller can see how much room was used.
   */
  box(x, y, w, h, { title, body = [], icon = null, fill = "#fff", stroke = COLOURS.forest, sw = 1.6, dash = null, titleSize = 12.2, bodySize = 10, chip = null, chipFill = COLOURS.forest, chipColour = "#fff", iconPos = "auto", align = "left" } = {}) {
    this.rect(x, y, w, h, { fill, stroke, sw, dash });
    const iconSize = 22;
    const settings = { title, body, icon, chip, titleSize, bodySize };
    const candidates = icon ? (iconPos === "auto" ? ["left", "top"] : [iconPos]) : ["none"];
    let layout = null;
    for (const position of candidates) {
      const trial = this.boxLayout(w, settings, position);
      if (!layout || (layout.used > h - 3 && trial.used < layout.used)) layout = trial;
      if (trial.used <= h - 3) {
        layout = trial;
        break;
      }
    }
    const { position, textX, titleRows, bodyRows, firstBaseline, bodyStart } = layout;
    const stroke2 = stroke === "#fff" ? COLOURS.forest : stroke;
    if (position === "left") this.icon(icon, x + 10, y + 9, iconSize, { stroke: stroke2 });
    else if (position === "top") this.icon(icon, x + 10, y + 8, iconSize, { stroke: stroke2 });
    if (chip) this.pill(x + w - 8, y + 8, chip, { fill: chipFill, colour: chipColour, anchor: "end" });
    const anchor = align === "center" ? "middle" : "start";
    const originX = align === "center" ? x + w / 2 : x + textX;
    titleRows.forEach((row, index) => this.text(originX, y + firstBaseline + index * titleSize * 1.2, row, { size: titleSize, weight: 700, anchor }));
    bodyRows.forEach((row, index) => this.text(originX, y + bodyStart + index * bodySize * 1.3, row, { size: bodySize, fill: COLOURS.muted, anchor }));
    if (layout.used > h - 2) this.warn(`box "${titleRows.join(" ")}" needs ${Math.ceil(layout.used)} but has ${h}`);
    return y + layout.used;
  }

  /** A small rounded tag such as "unit 1" or "Electrician". Returns its width. */
  pill(x, y, content, { fill = COLOURS.forest, colour = "#fff", size = 8, anchor = "start", stroke = null, dash = null, weight = 700 } = {}) {
    const w = measure(content, size, weight) + 12 + content.length * 0.32;
    const h = size + 7.5;
    const left = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
    this.add(`<rect x="${num(left)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="${num(h / 2.4)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="1"` : ""}${dash ? ` stroke-dasharray="${dash}"` : ""}/>`);
    this.text(left + w / 2, y + h / 2 + size * 0.36, content, { size, weight, fill: colour, anchor: "middle", spacing: "0.04em" });
    return w;
  }

  /** A connection point on a box edge, with its name beside it. */
  port(x, y, name = null, { side = "right", size = 8.6 } = {}) {
    this.add(`<circle cx="${num(x)}" cy="${num(y)}" r="3.6" fill="#fff" stroke="${COLOURS.forest}" stroke-width="1.5"/>`);
    if (name) {
      const dx = side === "right" ? 8 : side === "left" ? -8 : 0;
      const dy = side === "up" ? -7 : side === "down" ? 13 : 3;
      this.text(x + dx, y + dy, name, { size, weight: 600, anchor: side === "left" ? "end" : side === "right" ? "start" : "middle" });
    }
    return this;
  }

  dot(x, y, r = 3.2, fill = COLOURS.forest) {
    return this.add(`<circle cx="${num(x)}" cy="${num(y)}" r="${r}" fill="${fill}"/>`);
  }

  /** A numbered badge for a measuring point. */
  marker(x, y, n) {
    this.add(`<circle cx="${num(x)}" cy="${num(y)}" r="9.6" fill="${COLOURS.action}" stroke="#fff" stroke-width="2"/>`);
    this.text(x, y + 4.2, n, { size: 11.5, weight: 800, fill: "#fff", anchor: "middle" });
    return this;
  }

  /** A zone drawn behind equipment: a faint panel with a small caps label. */
  zone(x, y, w, h, label, { fill = "#faf8f4", stroke = COLOURS.rule, dash = null, labelFill = COLOURS.faint, sw = 1.2 } = {}) {
    this.rect(x, y, w, h, { fill, stroke, sw, rx: 12, dash });
    if (label) this.text(x + 12, y + 16, label, { size: 8.4, weight: 700, fill: labelFill, spacing: "0.12em", upper: true });
    return this;
  }

  /** The resistor symbol used for a 120 ohm terminator. */
  terminator(x, y, { vertical = false } = {}) {
    if (vertical) this.rect(x - 4, y, 8, 16, { fill: "#fff", stroke: COLOURS.forest, sw: 1.4, rx: 1.5 });
    else this.rect(x, y - 4, 16, 8, { fill: "#fff", stroke: COLOURS.forest, sw: 1.4, rx: 1.5 });
    return this;
  }

  /** The legend of the line kinds used, then an optional note. Placed below everything drawn so far (this.bottom). */
  finish({ extraLegend = [], note = null, noteLines = null, legendKinds = null } = {}) {
    const kinds = legendKinds ?? [...this.usedWires];
    const entries = [...kinds.map((kind) => ({ kind, name: WIRES[kind].name })), ...extraLegend];
    const colWidth = 244;
    const perRow = Math.max(1, Math.floor((this.width - 32) / colWidth));
    const rows = Math.ceil(entries.length / perRow);
    const noteRows = [];
    for (const row of noteLines ?? (note ? [note] : [])) noteRows.push(...wrapText(row, this.width - 36, 9.2, 400));
    const top = this.bottom;
    this.add(`<line x1="16" y1="${top + 6}" x2="${this.width - 16}" y2="${top + 6}" stroke="${COLOURS.rule}" stroke-width="1"/>`);
    entries.forEach((entry, index) => {
      const col = index % perRow;
      const row = Math.floor(index / perRow);
      const x = 18 + col * colWidth;
      const y = top + 24 + row * 20;
      if (entry.kind) {
        const style = WIRES[entry.kind];
        if (style.outline) {
          this.path(`M${x} ${y - 4}h32`, { stroke: style.stroke, sw: style.width - 1, cap: "butt" });
          this.path(`M${x} ${y - 4}h32`, { stroke: "#fff", sw: style.width - 4.6, cap: "butt" });
        } else {
          this.path(`M${x} ${y - 4}h32`, { stroke: style.stroke, sw: style.width, dash: style.dash, cap: style.cap });
        }
      } else {
        this.add(entry.swatch(x, y - 4));
      }
      this.text(x + 40, y, entry.name, { size: 9.6, fill: COLOURS.night, maxWidth: colWidth - 46 });
    });
    const noteTop = top + 24 + rows * 20 + 4;
    noteRows.forEach((row, index) => this.text(18, noteTop + index * 12.4, row, { size: 9.2, italic: true, fill: COLOURS.muted }));
    this.height = noteTop + (noteRows.length ? noteRows.length * 12.4 : -6) + 8;
    return this;
  }

  toString() {
    const header = [
      `<rect x="0" y="0" width="${this.width}" height="38" fill="${COLOURS.cream}"/>`,
      `<line x1="0" y1="38" x2="${this.width}" y2="38" stroke="${COLOURS.rule}" stroke-width="1"/>`
    ].join("");
    const badgeWidth = measure(this.kit, 10, 800) + 18;
    const kitBadge = `<rect x="14" y="9" width="${num(badgeWidth)}" height="20" rx="5" fill="${COLOURS.forest}"/><text x="${num(14 + badgeWidth / 2)}" y="23.2" font-size="10" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="0.06em">${esc(this.kit)}</text>`;
    const title = `<text x="${num(14 + badgeWidth + 10)}" y="24" font-size="13" font-weight="700" fill="${COLOURS.forest}">${esc(this.title)}</text>`;
    const label = `<text x="${this.width - 14}" y="23.6" font-size="9.4" font-weight="700" fill="${COLOURS.faint}" text-anchor="end" letter-spacing="0.08em">${esc(this.label)}</text>`;
    const room = this.width - 14 - badgeWidth - 10 - 14 - measure(this.label, 9.4, 700) - 20;
    if (measure(this.title, 13, 700) > room) this.warn(`the title "${this.title}" is too long for the title bar`);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.width} ${num(this.height)}" font-family="Inter, 'Liberation Sans', Arial, sans-serif" role="img" aria-label="${esc(`${this.kit}: ${this.title}`)}"><rect x="0" y="0" width="${this.width}" height="${num(this.height)}" fill="#fff"/>${header}${kitBadge}${title}${label}${this.body.join("")}</svg>`;
  }
}

function midpoint(points) {
  // the middle of the longest segment
  let best = 0;
  let at = [points[0][0], points[0][1]];
  for (let index = 1; index < points.length; index += 1) {
    const [x1, y1] = points[index - 1];
    const [x2, y2] = points[index];
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length > best) {
      best = length;
      at = [(x1 + x2) / 2, (y1 + y2) / 2];
    }
  }
  return at;
}

/** A swatch for the legend that is not a wire: a filled box, for example. `draw(x, y)` returns svg markup. */
export function swatch(name, draw) {
  return { name, swatch: draw };
}
