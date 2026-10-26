// The small macro language of the guide sources.
//
//   {{ui.key}}              a screen, button or form name, from scripts/docs/ui-labels.json (the only place they are typed)
//   {{kit.name}}            a fact about the kit this pack is for (kit.letter, kit.lower, kit.name, kit.template, kit.short, kit.headline, kit.pdf)
//   {{kit.H.name}}          the same for a named kit
//   {{doc.title}}           the document's title, {{doc.date}} the build date, {{doc.version}}
//   {{cb}}                  a real check box, drawn as a bordered square (never a font glyph)
//   {{pf}}                  Pass / Fail boxes
//   {{line}} {{line:long}} {{line:short}}   a line to write on
//   {{who:e}} {{who:pm}} {{who:c}} {{who:pm+c}}   who does a step: electrician, project manager, customer
//   {{include:file.md}}     another source from docs/launch/packs (macros inside it are expanded too)
//   {{diagram:id}}          a figure from diagrams.mjs; {{diagram:kit:system}} is kit-<letter>-system for the pack's kit
//   {{bom}} {{bom:H}} {{steps}} {{shopping}} {{shopping:all}} {{parts}} {{part:meter3}} {{tools}} {{spares}}   tables made from kits.json and steps.json
//   {{stepsummary}}         one table of the steps that apply to the pack's kit, with a box to tick for each
//   {{step:3}}              the title of step 3 of the platform's setup list, as the platform shows it (from steps.json)
//   {{ref:founder}}         where another document is, said the way this PDF can say it
//   {{pagebreak}}
//
// Only these names are macros. Anything else in double braces (Railway's ${{Postgres.DATABASE_URL}}) is left exactly as it is.

import { join } from "node:path";
import { PACKS, escapeHtml, readText } from "./util.mjs";
import { bomTable, partCard, partsTable, shoppingTable, stepCards, stepSummary, listOf } from "./generated.mjs";

const NAMES = ["ui", "kit", "doc", "diagram", "include", "who", "ref", "bom", "steps", "stepsummary", "step", "shopping", "parts", "part", "tools", "spares", "cb", "pf", "line", "pagebreak"];
const MACRO = new RegExp(String.raw`\{\{\s*(${NAMES.join("|")})(?:[.:]([^{}]*?))?\s*\}\}`, "g");

const WHO = {
  e: { cls: "e", text: "Electrician" },
  pm: { cls: "pm", text: "Project manager" },
  c: { cls: "c", text: "Customer" },
  platform: { cls: "pm", text: "The platform" }
};

export class Context {
  /**
   * @param {{ labels: Record<string,string>, kits: any, steps: any[], diagrams: Record<string, any>, doc: any, kit?: string|null, refs: Record<string, any>, notes: any }} options
   */
  constructor({ labels, kits, steps, diagrams, doc, kit = null, refs, notes }) {
    this.labels = labels;
    this.kits = kits;
    this.steps = steps;
    this.diagrams = diagrams;
    this.doc = doc;
    this.kitLetter = kit;
    this.refs = refs;
    this.notes = notes;
    this.htmlBlocks = [];
    this.usedDiagrams = new Set();
    this.usedLabels = new Set();
    this.includeTrail = [];
  }

  withKit(letter) {
    const next = Object.create(this);
    next.kitLetter = letter;
    return next;
  }

  get kit() {
    return this.kitLetter ? this.kits.kits[this.kitLetter] : null;
  }

  /** Raw HTML that must not pass through the Markdown reader: held aside and put back after it. */
  holdHtml(html) {
    this.htmlBlocks.push(html);
    return `\n\nZZHTMLBLOCK${this.htmlBlocks.length - 1}ZZ\n\n`;
  }
}

function figure(ctx, id) {
  const diagram = ctx.diagrams[id];
  if (!diagram) throw new Error(`There is no diagram called "${id}".`);
  ctx.usedDiagrams.add(id);
  const tall = diagram.height > 520 ? " tall" : "";
  return ctx.holdHtml(
    `<figure class="diagram${tall}" id="fig-${id}"><div class="svgbox">${diagram.svg}</div><figcaption><b>Figure ${escapeHtml(diagram.label)}.</b> ${escapeHtml(diagram.caption)}</figcaption></figure>`
  );
}

function handler(ctx, name, arg, file) {
  switch (name) {
    case "ui": {
      const text = ctx.labels[arg];
      if (text === undefined) throw new Error(`${file}: there is no UI label "${arg}" in scripts/docs/ui-labels.json`);
      ctx.usedLabels.add(arg);
      return text;
    }
    case "kit": {
      if (!arg) throw new Error(`${file}: {{kit}} needs a field`);
      let letter = ctx.kitLetter;
      let field = arg;
      const dot = arg.indexOf(".");
      if (dot > 0) {
        letter = arg.slice(0, dot);
        field = arg.slice(dot + 1);
      }
      if (!letter) throw new Error(`${file}: {{kit.${arg}}} used where no kit is set`);
      const kit = ctx.kits.kits[letter];
      if (!kit) throw new Error(`${file}: there is no kit ${letter}`);
      if (field === "lower") return letter.toLowerCase();
      if (field === "letter") return letter;
      if (!(field in kit)) throw new Error(`${file}: kit ${letter} has no field "${field}"`);
      return String(kit[field]);
    }
    case "doc": {
      const value = ctx.doc[arg];
      if (value === undefined) throw new Error(`${file}: the document has no "${arg}"`);
      return String(value);
    }
    case "cb":
      return '<span class="cb"></span>';
    case "pf":
      return '<span class="pf"><span class="cb"></span>Pass <span class="cb"></span>Fail</span>';
    case "line":
      return `<span class="wl${arg ? ` ${arg}` : ""}"></span>`;
    case "who": {
      return (arg ?? "")
        .split("+")
        .map((key) => {
          const who = WHO[key.trim()];
          if (!who) throw new Error(`${file}: unknown who "${key}"`);
          return `<span class="who ${who.cls}">${who.text}</span>`;
        })
        .join(" ");
    }
    case "pagebreak":
      return '\n\n<div class="pb"></div>\n\n';
    case "include": {
      if (!arg) throw new Error(`${file}: {{include}} needs a file`);
      const path = join(PACKS, arg);
      if (ctx.includeTrail.includes(path)) throw new Error(`${file}: includes loop through ${arg}`);
      ctx.includeTrail.push(path);
      try {
        return expand(readText(path), ctx, arg).replace(/\n+$/, "");
      } finally {
        ctx.includeTrail.pop();
      }
    }
    case "diagram": {
      if (!arg) throw new Error(`${file}: {{diagram}} needs an id`);
      let id = arg;
      if (arg.startsWith("kit:")) {
        if (!ctx.kitLetter) throw new Error(`${file}: {{diagram:${arg}}} used where no kit is set`);
        id = `kit-${ctx.kitLetter.toLowerCase()}-${arg.slice(4)}`;
      }
      return figure(ctx, id);
    }
    case "ref": {
      const ref = ctx.refs[arg];
      if (!ref) throw new Error(`${file}: there is no reference "${arg}"`);
      return ref.href ? `[${ref.text}](${ref.href})` : ref.text;
    }
    case "bom":
      return bomTable(arg ? ctx.withKit(arg) : ctx);
    case "steps":
      return stepCards(ctx);
    case "parts":
      return partsTable(ctx);
    case "part":
      return partCard(ctx, arg);
    case "stepsummary":
      return stepSummary(ctx);
    case "step": {
      const step = ctx.steps.find((item) => String(item.n) === String(arg));
      if (!step) throw new Error(`${file}: there is no setup-list step ${arg}`);
      return step.title;
    }
    case "shopping":
      return shoppingTable(ctx, arg === "all" ? null : arg || ctx.kitLetter);
    case "tools":
      return listOf(ctx.kits.tools);
    case "spares":
      return listOf(ctx.kits.spares);
    default:
      throw new Error(`${file}: unknown macro ${name}`);
  }
}

/** Expands every macro in a text. Macros may produce text with more macros in it, so it repeats until nothing changes. */
export function expand(text, ctx, file = "(text)") {
  let current = text;
  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    current = current.replace(MACRO, (whole, name, arg) => {
      changed = true;
      return handler(ctx, name, arg?.trim(), file);
    });
    if (!changed) return current;
  }
  throw new Error(`${file}: macros are nested too deeply`);
}

/** Puts the held HTML back where its placeholder paragraph is. */
export function restoreHtml(html, ctx) {
  return html.replace(/<p>ZZHTMLBLOCK(\d+)ZZ<\/p>/g, (_, index) => ctx.htmlBlocks[Number(index)]);
}
