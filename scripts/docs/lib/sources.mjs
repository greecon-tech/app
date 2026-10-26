// Reading and reshaping the launch documents (docs/launch/01, 02, 03, 05) and the Markdown the guides are written in.
//
// The launch documents are written for GitHub: relative links to each other, section numbers, screen names spelled out. The guides
// are books, so their text is taken from those documents and reshaped here: headings numbered for the part they sit in, links to
// other documents turned into "Part 4" or "the Hardware Reference (PDF 03)", screen names made to follow ui-labels.json, check
// boxes drawn. Nothing is copied by hand; a change to a launch document reaches the guides at the next build.

import { escapeRegExp, githubSlug } from "./util.mjs";

// ---------------------------------------------------------------------------------------------------------------------------
// Screen names
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * Where a screen name stands alone in bold in a launch document, treat it as the label of the same name in ui-labels.json, so the
 * guides follow the labels. Names listed in `exclude` are left alone (a launch document may use the same word for somebody else's
 * screen: Railway has Settings too).
 */
export function applyLegacyUi(text, config, { exclude = [], file, notes }) {
  let out = text;
  const counts = new Map();
  const entries = Object.entries(config.legacy.map).filter(([literal]) => !exclude.includes(literal));
  entries.sort((a, b) => b[0].length - a[0].length);
  for (const [literal, key] of entries) {
    const pattern = new RegExp(String.raw`\*\*${escapeRegExp(literal)}(\.?)\*\*`, "g");
    out = out.replace(pattern, (_, stop) => {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return `**{{ui.${key}}}${stop}**`;
    });
  }
  for (const composite of config.legacy.composite ?? []) {
    if (out.includes(composite.old)) {
      out = out.split(composite.old).join(composite.new);
      notes.info(`${file}: rewrote "${composite.old}" as ${composite.new} (${composite.about})`);
    }
  }
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  notes.info(`${file}: ${total} screen names follow ui-labels.json${exclude.length ? ` (left alone: ${exclude.join(", ")})` : ""}`);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------------------------------------------------------

/** Splits a document into its title, the text before the first "##", and its "##" sections (headings inside code are ignored). */
export function parseSections(text) {
  const lines = text.split("\n");
  let inFence = false;
  let title = null;
  const preamble = [];
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence) {
      const h1 = line.match(/^# (.*)$/);
      if (h1 && title === null) {
        title = h1[1];
        continue;
      }
      const h2 = line.match(/^## (.*)$/);
      if (h2) {
        current = { heading: h2[1].trim(), lines: [] };
        sections.push(current);
        continue;
      }
    }
    (current ? current.lines : preamble).push(line);
  }
  return {
    title,
    preamble: preamble.join("\n").trim(),
    sections: sections.map((section) => ({ heading: section.heading, body: section.lines.join("\n").trim() }))
  };
}

export function findSection(parsed, test, { file, notes, required = true }) {
  const found = parsed.sections.find((section) => test(section.heading));
  if (!found && required) throw new Error(`${file}: expected section is missing. The launch document may have been restructured; update scripts/docs/documents.mjs.`);
  if (!found) notes.warn(`${file}: an optional section is missing`);
  return found;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Links between launch documents
// ---------------------------------------------------------------------------------------------------------------------------

const LAUNCH_DOCS = { "01": "founder", "02": "manual", "03": "hardware", "04": "sales", "05": "runbooks" };

/**
 * Turns "[03](03-hardware-and-wiring.md)" and its like into what the printed book can say: "Part 4" (a link) in the complete guide,
 * "the Hardware Reference (PDF 03)" where Part 4 is another file, plain words for documents that are not part of the guides.
 */
export function rewriteLinks(text, ctx, { file, notes }) {
  return text.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (whole, label, target) => {
    if (target.startsWith("#") || /^https?:/.test(target)) return whole;
    const match = target.match(/^(?:\.\.\/)?(\d\d)-[^#]*\.md(#.*)?$/);
    if (!match) {
      notes.warn(`${file}: a link to "${target}" was left as it is`);
      return whole;
    }
    const number = match[1];
    const labelMatch = label.match(/^(\d\d)\b\s*(.*)$/);
    const rest = labelMatch ? labelMatch[2] : label;
    const suffix = rest.startsWith(",") ? rest : "";
    const key = LAUNCH_DOCS[number];
    if (key && ctx.refs[key]) {
      const ref = ctx.refs[key];
      const text = `${ref.text}${suffix}`;
      return ref.href ? `[${text}](${ref.href})` : text;
    }
    // not part of the guides: say what it is and where it lives
    if (labelMatch) {
      if (suffix) return `document ${number}${suffix}`;
      if (rest) return `${rest} (document ${number})`;
      return `document ${number}`;
    }
    return label;
  });
}

// ---------------------------------------------------------------------------------------------------------------------------
// Literal rewrites and headings
// ---------------------------------------------------------------------------------------------------------------------------

/** Replaces exact pieces of text. A piece that is not found is a warning: the launch document has probably changed under us. */
export function literalReplace(text, rules, { file, notes }) {
  let out = text;
  for (const [from, to] of rules) {
    if (!out.includes(from)) {
      notes.warn(`${file}: expected to find "${from.slice(0, 70).replace(/\n/g, " ")}" but did not (the launch document may have changed)`);
      continue;
    }
    out = out.split(from).join(to);
  }
  return out;
}

/** A heading line with a number span, an id and a class, ready for the Markdown reader. */
export function headingLine(level, { number, title, id, classes = [] }) {
  const numberSpan = number ? `[${number}]{.num} ` : "";
  const attributes = [`#${id}`, ...classes.map((name) => `.${name}`)].join(" ");
  return `${"#".repeat(level)} ${numberSpan}${title} {${attributes}}`;
}

/**
 * Gives every heading in a text a role class (lv1 part, lv2 chapter, lv3 section, lv4 minor) and a unique id. `shift` moves the
 * whole text down: a site pack inside the complete guide is one level deeper than the same pack on its own. The tag never goes
 * deeper than h4; the role class keeps the true depth.
 */
export function normalizeHeadings(md, { shift = 0, usedIds, notes, file }) {
  let inFence = false;
  const shifts = [shift];
  return md
    .split("\n")
    .map((line) => {
      if (/^```/.test(line)) inFence = !inFence;
      if (inFence) return line;
      // a block of text that sits deeper than the rest is wrapped in <!--shift:1--> ... <!--/shift-->
      const open = line.match(/^<!--shift:(-?\d+)-->\s*$/);
      if (open) {
        shifts.push(shifts[shifts.length - 1] + Number(open[1]));
        return "";
      }
      if (/^<!--\/shift-->\s*$/.test(line)) {
        if (shifts.length > 1) shifts.pop();
        return "";
      }
      const match = line.match(/^(#{1,6})\s+(.*?)(?:\s+\{([^{}]*)\})?\s*$/);
      if (!match) return line;
      const depth = shifts[shifts.length - 1];
      const level = match[1].length;
      let text = match[2];
      let attributes = (match[3] ?? "").trim();
      const roleMatch = attributes.match(/\blv(\d)\b/);
      const role = (roleMatch ? Number(roleMatch[1]) : level) + depth;
      const dataAttributes = (attributes.match(/data-[\w-]+="[^"]*"/g) ?? []).join(" ");
      attributes = attributes.replace(/data-[\w-]+="[^"]*"/g, "").replace(/\blv\d\b/g, "").replace(/\s+/g, " ").trim();
      const classes = (attributes.match(/(?:^|\s)\.[\w-]+/g) ?? []).map((value) => value.trim().slice(1));
      let id = attributes.match(/#([\w-]+)/)?.[1];
      if (!id) id = githubSlug(text.replace(/\[([^\]]*)\]\{[^}]*\}/g, "$1")) || "section";
      const original = id;
      for (let counter = 2; usedIds.has(id); counter += 1) id = `${original}-${counter}`;
      if (id !== original) notes.info(`${file}: the heading id "${original}" was already used, so this one is "${id}"`);
      usedIds.add(id);
      const tag = Math.min(level + depth, 4);
      text = text.trim();
      return `${"#".repeat(tag)} ${text} {#${id} ${[...classes, `lv${role}`].map((name) => `.${name}`).join(" ")}${dataAttributes ? ` ${dataAttributes}` : ""}}`;
    })
    .join("\n");
}
