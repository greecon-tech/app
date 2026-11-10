// The hardware sheets: one for each part that qualifies for a Greecon kit, each printed alone and all of them in the catalogue.
//
// A sheet is a Markdown source (docs/launch/packs/hardware/<id>.md) and one entry in docs/launch/packs/hardware/sheets.json. The
// entry says what cannot be left to prose: which part of kits.json the sheet is about, how the part qualifies, the number it has
// on the cable, what it does at each of the four kinds of site, and the facts of the platform's own code that the sheet repeats.
// The tables a sheet shares with the kit lists (which kit uses the part, how many, what it costs) are made here from kits.json, so
// a sheet cannot disagree with a site pack, and the build stops when the platform's code no longer says what a sheet says.

import { join } from "node:path";
import { PACKS, REPO, readJson, readText } from "./util.mjs";

export const HARDWARE = join(PACKS, "hardware");
const KIT_ORDER = ["H", "S", "F", "W"];
const REQUIRED = ["id", "file", "title", "short", "class", "qualifies", "fittedBy", "subtitle", "forWho", "sites"];

export function loadSheets() {
  return readJson(join(HARDWARE, "sheets.json"));
}

/** "HW05" */
export function sheetCode(sheet) {
  return `HW${String(sheet.n).padStart(2, "0")}`;
}

/** What the kit lists say about the sheet's part: the part itself, or the sheet's own words for a part no kit list buys (a battery). */
export function partOf(kits, sheet) {
  return sheet.part ? kits.parts[sheet.part] : sheet.own;
}

/** The line of a kit's list for the sheet's part, or undefined where that kit does not use it. */
export function kitLine(kits, sheet, letter) {
  if (sheet.part) return kits.kits[letter].bom.find((entry) => entry.part === sheet.part);
  return sheet.own?.kits?.[letter];
}

/** The number each kind of equipment has on the cable in every kit, read from the platform's own code. */
export function kitUnits() {
  const file = join(REPO, "packages", "shared", "src", "device-profiles.ts");
  const match = readText(file).match(/export const KIT_UNITS = \{([^}]*)\}/);
  if (!match) throw new Error("packages/shared/src/device-profiles.ts no longer declares KIT_UNITS the way the hardware sheets read it.");
  return Object.fromEntries([...match[1].matchAll(/(\w+):\s*(\d+)/g)].map((pair) => [pair[1], Number(pair[2])]));
}

/** Stops the build when the sheets and the kit lists, or the sheets and the platform's code, have come apart. */
export function checkSheets(data, kits, notes) {
  const sheets = data.sheets;
  if (!Array.isArray(sheets) || sheets.length === 0) throw new Error("hardware/sheets.json has no sheets.");
  const parts = new Set();
  const names = new Set();
  sheets.forEach((sheet, index) => {
    const where = `hardware/sheets.json, sheet ${index + 1}${sheet.id ? ` (${sheet.id})` : ""}`;
    for (const field of REQUIRED) if (!sheet[field]) throw new Error(`${where}: "${field}" is missing.`);
    if (sheet.n !== index + 1) throw new Error(`${where}: its number must be ${index + 1}, the place it has in the list.`);
    if (!data.classes?.[sheet.class]) throw new Error(`${where}: there is no way of qualifying called "${sheet.class}".`);
    for (const name of [sheet.id, sheet.file]) {
      if (names.has(name)) throw new Error(`${where}: "${name}" is used by another sheet.`);
      names.add(name);
    }
    if (sheet.part) {
      if (!kits.parts[sheet.part]) throw new Error(`${where}: kits.json has no part called "${sheet.part}".`);
      if (parts.has(sheet.part)) throw new Error(`${where}: the part "${sheet.part}" already has a sheet.`);
      if (sheet.own) throw new Error(`${where}: a part of kits.json takes its words from there, not from "own".`);
      parts.add(sheet.part);
    } else {
      for (const field of ["item", "does", "spec", "estimate", "kits"]) if (!sheet.own?.[field]) throw new Error(`${where}: a part that is in no kit list says its own "${field}".`);
    }
    const letters = Object.keys(sheet.sites);
    for (const letter of KIT_ORDER) {
      if (typeof sheet.sites[letter] !== "string" || !sheet.sites[letter].trim()) throw new Error(`${where}: say what the part does at kit ${letter}, or why that kit has none.`);
    }
    const strangers = letters.filter((letter) => !KIT_ORDER.includes(letter));
    if (strangers.length > 0) throw new Error(`${where}: there is no kit ${strangers.join(", ")}.`);
  });

  // a part that is added to a kit must get a sheet, or the catalogue would no longer be every part
  const without = Object.keys(kits.parts).filter((id) => !parts.has(id));
  if (without.length > 0) throw new Error(`Every part of a kit has a hardware sheet, and these have none: ${without.join(", ")}. Add them to docs/launch/packs/hardware/sheets.json.`);

  const units = kitUnits();
  // the catalogue's table of numbers on the cable is every number the platform has, no more and no fewer
  const named = Object.keys(data.onTheCable ?? {});
  const unnamed = Object.keys(units).filter((name) => !named.includes(name));
  if (unnamed.length > 0) throw new Error(`hardware/sheets.json, "onTheCable": the platform (KIT_UNITS) has ${unnamed.join(", ")}, and the catalogue has no words for ${unnamed.length > 1 ? "them" : "it"}.`);
  for (const name of named) {
    if (units[name] === undefined) throw new Error(`hardware/sheets.json, "onTheCable": the platform (KIT_UNITS) has no number called "${name}".`);
    for (const id of data.onTheCable[name].sheets ?? []) if (!sheets.some((sheet) => sheet.id === id)) throw new Error(`hardware/sheets.json, "onTheCable".${name}: there is no sheet called "${id}".`);
  }
  for (const letter of KIT_ORDER) {
    const kind = data.kinds?.[letter];
    if (!kind?.file || !kind?.subtitle || !Array.isArray(kind?.units)) throw new Error(`hardware/sheets.json, "kinds": kit ${letter} needs its "file", its "subtitle" and the "units" it has on the cable.`);
    for (const name of kind.units) if (units[name] === undefined) throw new Error(`hardware/sheets.json, "kinds".${letter}: the platform (KIT_UNITS) has no number called "${name}".`);
  }
  let facts = 0;
  for (const sheet of sheets) {
    for (const [name, number] of Object.entries(sheet.units ?? {})) {
      if (units[name] !== number) throw new Error(`Hardware sheet ${sheetCode(sheet)} (${sheet.id}) gives "${name}" the number ${number}; the platform (KIT_UNITS in packages/shared/src/device-profiles.ts) gives it ${units[name] ?? "no number"}. Correct the sheet and its text.`);
    }
    for (const fact of sheet.facts ?? []) {
      if (!readText(join(REPO, fact.file)).includes(fact.has)) {
        throw new Error(`Hardware sheet ${sheetCode(sheet)} (${sheet.id}) says that ${fact.says}, but ${fact.file} no longer contains "${fact.has}". Look at the platform first, then correct the sheet.`);
      }
      facts += 1;
    }
  }
  notes.info(`hardware/sheets.json: ${sheets.length} sheets, one for each of the ${Object.keys(kits.parts).length} parts of kits.json and ${sheets.length - parts.size} more; the numbers on the cable and ${facts} facts match the platform's code`);
}

function cell(text) {
  return String(text ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** Which kits use the part, in words: "Kits H, S; optional in kit W". */
export function usedInWords(kits, sheet) {
  const required = [];
  const optional = [];
  for (const letter of KIT_ORDER) {
    const line = kitLine(kits, sheet, letter);
    if (!line) continue;
    (line.optional ? optional : required).push(letter);
  }
  const say = (letters) => `kit${letters.length > 1 ? "s" : ""} ${letters.length > 1 ? `${letters.slice(0, -1).join(", ")} and ${letters[letters.length - 1]}` : letters[0]}`;
  const bits = [];
  if (required.length > 0) bits.push(say(required).replace(/^kit/, "Kit"));
  if (optional.length > 0) bits.push(`${required.length > 0 ? "optional" : "Optional"} in ${say(optional)}`);
  return bits.join("; ") || "No standard kit";
}

/** The card at the head of a sheet: what the part does, how it qualifies, what it must be, its number, who fits it, what it costs, where it is used. */
export function glanceCard(ctx, sheet, data) {
  const part = partOf(ctx.kits, sheet);
  const kind = data.classes[sheet.class];
  const rows = [
    ["What it does", part.does],
    ["How it qualifies", `**${kind.label}.** ${sheet.qualifies}`],
    [sheet.class === "approved" ? "Make and model" : "Specification", part.spec],
    ...(sheet.unitWords ? [["Number on the cable", sheet.unitWords]] : []),
    ...(sheet.rows ?? []),
    ["Fitted by", sheet.fittedBy],
    // a part nobody buys has words where the others have a figure
    ["Planning estimate (EUR)", /\d/.test(part.estimate) ? `${part.estimate}. Not a quote.` : `${part.estimate}.`],
    ["Used in", `${usedInWords(ctx.kits, sheet)}. The table under *At each kind of site* says what it does at each.`]
  ];
  // a row that begins with a number and a full stop ("3. Set with the maker's tool") would be read as the first item of a numbered list, and printed as "1."
  const plain = (text) => String(text).replace(/^(\d+)\. /, "$1\\. ");
  return ["::: speccard", ...rows.flatMap(([term, text]) => [term, `:   ${plain(text)}`, ""]), ":::", ""].join("\n");
}

const USE = {
  yes: '<span class="use yes">In the kit</span>',
  optional: '<span class="use opt">Optional</span>',
  no: '<span class="use no">Not used</span>'
};

/** What the part does at each of the four kinds of site: whether the kit has it and how many come from kits.json, the words from the sheet. */
export function sitesTable(ctx, sheet) {
  const rows = KIT_ORDER.map((letter) => {
    const kit = ctx.kits.kits[letter];
    const line = kitLine(ctx.kits, sheet, letter);
    const use = !line ? USE.no : line.optional ? USE.optional : USE.yes;
    return `| <span class="kitbadge">${letter}</span> **${cell(kit.name)}** | ${use} | ${cell(line ? line.qty : "None")} | ${cell(sheet.sites[letter])} |`;
  });
  return ["::: sites", "| Kind of site | In its kit | How many | What it does there |", "|-------------------|---------|--------|------------------------------------------------|", ...rows, ":::", ""].join("\n");
}

/** Every sheet against every kind of site, on one page: the index of the catalogue. */
export function matrixTable(ctx, data) {
  const rows = data.sheets.map((sheet) => {
    const part = partOf(ctx.kits, sheet);
    // how many the kit has: "0 or 1" is a part fitted only where the site calls for it, which the words above the table say
    const marks = KIT_ORDER.map((letter) => {
      const line = kitLine(ctx.kits, sheet, letter);
      return line ? cell(line.qty) : "–";
    });
    return `| [${sheetCode(sheet)}](#hw-${sheet.id}) | **${cell(sheet.short)}** | ${cell(data.classes[sheet.class].short)} | ${marks.join(" | ")} | ${cell(part.estimate)} |`;
  });
  return [
    "::: matrix",
    "| Sheet | Hardware | Qualifies as | H | S | F | W | Planning estimate (EUR) |",
    "|------|-------------------|-------------|--------|--------|--------|--------|----------------|",
    ...rows,
    ":::",
    ""
  ].join("\n");
}

/** The three ways a part qualifies, with the sheets of each. */
export function classesTable(data) {
  const rows = Object.entries(data.classes).map(([key, kind]) => {
    const which = data.sheets.filter((sheet) => sheet.class === key).map((sheet) => `${sheetCode(sheet)} ${sheet.short}`);
    return `| **${cell(kind.label)}** | ${cell(kind.means)} | ${cell(kind.platform)} | ${cell(which.join("; "))} |`;
  });
  return ["| A part qualifies as | Which means | In the platform | The sheets |", "|-------------|-------------------------|-------------------------|------------------|", ...rows, ""].join("\n");
}

/** "HW05" or "HW05 and HW06", each a link to its sheet. */
function sheetLinks(data, ids) {
  return ids
    .map((id) => data.sheets.find((sheet) => sheet.id === id))
    .map((sheet) => `[${sheetCode(sheet)}](#hw-${sheet.id})`)
    .join(" and ");
}

/** Every part of the kit of one kind of site, with the sheet of each: the catalogue read by site, where the sheets are read by part. */
export function kitTable(ctx, data, letter) {
  const rows = data.sheets
    .filter((sheet) => kitLine(ctx.kits, sheet, letter))
    .map((sheet) => {
      const line = kitLine(ctx.kits, sheet, letter);
      const part = partOf(ctx.kits, sheet);
      const price = /\d/.test(part.estimate) ? `EUR ${part.estimate}` : part.estimate;
      return `| [${sheetCode(sheet)}](#hw-${sheet.id}) | **${cell(sheet.short)}** <span class="how">${cell(data.classes[sheet.class].short)} · ${cell(price)}</span> | ${line.optional ? USE.optional : USE.yes} | ${cell(line.qty)} | ${cell(sheet.sites[letter])} |`;
    });
  return ["::: kitlist", "| Sheet | Hardware | In the kit | How many | What it does at this kind of site |", "|-----|---------------|---------|-------|----------------------------------------------|", ...rows, ":::", ""].join("\n");
}

/** The sheets whose part this kind of site does not use, with the reason where the sheet gives one. */
export function kitUnused(ctx, data, letter) {
  const unused = data.sheets.filter((sheet) => !kitLine(ctx.kits, sheet, letter));
  if (unused.length === 0) return "";
  const said = unused.filter((sheet) => !/^none\.?$/i.test(sheet.sites[letter].trim()));
  const silent = unused.filter((sheet) => !said.includes(sheet));
  const out = [];
  if (said.length > 0) {
    out.push("::: kitlist", "| Sheet | Hardware | Why it is not in this kit |", "|------|------------------|------------------------------------------------------|");
    for (const sheet of said) out.push(`| [${sheetCode(sheet)}](#hw-${sheet.id}) | **${cell(sheet.short)}** | ${cell(sheet.sites[letter])} |`);
    out.push(":::", "");
  }
  if (silent.length > 0) out.push(`Never at this kind of site: ${silent.map((sheet) => `${sheetCode(sheet)} ${sheet.short}`).join("; ")}.`, "");
  return out.join("\n");
}

/** The number each device has on the data cable, for one kind of site or (with no letter) for every kit. The numbers are the platform's own. */
export function unitsTable(data, letter) {
  const units = kitUnits();
  const names = letter ? data.kinds[letter].units : Object.keys(data.onTheCable);
  const rows = [...names]
    .sort((a, b) => units[a] - units[b])
    .map((name) => {
      const entry = data.onTheCable[name];
      return `| **${units[name]}** | ${cell(entry.name)} | ${cell(entry.what)} | ${sheetLinks(data, entry.sheets)} |`;
    });
  return ["::: numbers", "| Number | Device | What it is | Sheet |", "|---------|------------------|----------------------------------------|-----------|", ...rows, ":::", ""].join("\n");
}
