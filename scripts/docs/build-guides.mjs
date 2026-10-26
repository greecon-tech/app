#!/usr/bin/env node
// Builds the Greecon guides as printable A4 PDFs into docs/launch/pdf/.
//
//   npm run docs:pdf                      all eight PDFs and the README of the folder
//   npm run docs:pdf -- --only 01,04      only those PDFs (the README still lists all of them)
//   npm run docs:pdf -- --date 2026-11-02 the date on the covers (default: today, UTC; or GUIDES_DATE)
//   npm run docs:pdf -- --keep-html       keep the HTML each PDF was printed from, and say where
//   npm run docs:pdf -- --verbose         print every note, not only the warnings
//
// The text comes from docs/launch/01, 02 and 05 (reshaped) and from the sources written for the guides in docs/launch/packs/.
// Screen names are typed once, in scripts/docs/ui-labels.json. The diagrams are drawn by scripts/docs/diagrams.mjs. The same
// sources always give the same files (apart from nothing: the dates in the PDF are fixed to the build date).
//
// Tools used, all already on the build machine: pandoc, Chromium through Playwright (PLAYWRIGHT_MODULE, default
// /opt/node22/lib/node_modules/playwright), and poppler (pdfinfo, pdftotext). No npm package is added.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

import { DOCS_SCRIPTS, PACKS, PDF_DIR, REPO, Notes, escapeHtml, readJson, readText } from "./lib/util.mjs";
import { Context } from "./lib/macros.mjs";
import { collectHeadings, coverHtml, documentHtml, pageCss, partHtml, renderMarkdown, tocHtml } from "./lib/html.mjs";
import { prepareFonts } from "./lib/fonts.mjs";
import { destinationPages, fixDates, launchBrowser, pageCount, pageTexts, printToPdf } from "./lib/pdf.mjs";
import { buildDiagrams } from "./diagrams.mjs";
import { VERSION, documents } from "./documents.mjs";

const MAX_BYTES = 4 * 1024 * 1024;

// ---------------------------------------------------------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { only: null, date: null, keepHtml: false, verbose: false, out: PDF_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      index += 1;
      return next;
    };
    if (arg === "--only") args.only = value().split(",").map((item) => item.trim()).filter(Boolean);
    else if (arg.startsWith("--only=")) args.only = arg.slice(7).split(",").map((item) => item.trim()).filter(Boolean);
    else if (arg === "--date") args.date = value();
    else if (arg.startsWith("--date=")) args.date = arg.slice(7);
    else if (arg === "--out") args.out = value();
    else if (arg === "--keep-html") args.keepHtml = true;
    else if (arg === "--verbose" || arg === "-v") args.verbose = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(readText(new URL(import.meta.url).pathname).split("\n").slice(1, 12).map((line) => line.replace(/^\/\/ ?/, "")).join("\n"));
      process.exit(0);
    } else throw new Error(`Unknown option ${arg}. Try --help.`);
  }
  return args;
}

function longDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// ---------------------------------------------------------------------------------------------------------------------------
// Checks of the sources against the platform
// ---------------------------------------------------------------------------------------------------------------------------

/** The ten titles of the setup list must be exactly the ones the platform shows. */
function checkStepTitles(steps, notes) {
  const file = join(REPO, "apps", "api", "src", "setup", "setup-checklist.ts");
  if (!existsSync(file)) {
    notes.warn(`The setup checklist (${relative(REPO, file)}) was not found, so the ten step titles were not checked against the platform`);
    return;
  }
  const source = readText(file);
  const found = new Set();
  for (const match of source.matchAll(/(?:title:\s*|manualStep\(\s*"[a-z]+",\s*)"((?:[^"\\]|\\.)*)"/g)) found.add(match[1].replace(/\\"/g, '"').replace(/\\'/g, "'"));
  const mine = steps.map((step) => step.title);
  const missing = mine.filter((title) => !found.has(title));
  const extra = [...found].filter((title) => !mine.includes(title));
  if (missing.length > 0 || extra.length > 0 || mine.length !== 10) {
    throw new Error(
      `The setup-list steps in docs/launch/packs/steps.json do not match apps/api/src/setup/setup-checklist.ts.\n` +
        (missing.length ? `  Not in the platform: ${missing.map((title) => `"${title}"`).join(", ")}\n` : "") +
        (extra.length ? `  In the platform but not in steps.json: ${extra.map((title) => `"${title}"`).join(", ")}\n` : "")
    );
  }
  notes.info(`The ten setup-list step titles match ${relative(REPO, file)} exactly`);
}

/** The templates named in kits.json must exist in the platform. */
function checkTemplates(kits, notes) {
  const file = join(REPO, "packages", "shared", "src", "site-templates.ts");
  if (!existsSync(file)) return;
  const source = readText(file);
  for (const kit of Object.values(kits.kits)) {
    if (!source.includes(`name: "${kit.template}"`)) throw new Error(`kits.json: kit ${kit.letter} names the template "${kit.template}", which is not in packages/shared/src/site-templates.ts`);
  }
  notes.info("The four template names match packages/shared/src/site-templates.ts");
}

/** The text of the places screen names come from: the web app, the shared templates and profiles, the setup list. */
function appSources() {
  const roots = [join(REPO, "apps", "web", "src"), join(REPO, "packages", "shared", "src"), join(REPO, "apps", "api", "src", "setup")];
  const chunks = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(tsx?|live)$/.test(entry.name)) chunks.push(readFileSync(path, "utf8"));
    }
  };
  for (const root of roots) if (existsSync(root)) walk(root);
  return chunks.join("\n");
}

/** Every screen name the guides print should still be found somewhere in the web app. A name that is not is a warning, not a stop: some names are built from pieces. */
function checkLabels(labels, notes) {
  const source = appSources();
  if (!source) {
    notes.warn("apps/web/src was not found, so the screen names were not checked against the web app");
    return;
  }
  const missing = Object.entries(labels).filter(([, text]) => !source.includes(text) && !source.includes(text.replace(/ — /g, " ")) && !source.includes(text.replace(/’/g, "'")) && !source.includes(text.replace(/'/g, "&apos;")));
  if (missing.length > 0) notes.warn(`Screen names not found as text in apps/web/src, packages/shared/src or apps/api/src/setup (check the app, then ui-labels.json): ${missing.map(([key, text]) => `${key} = "${text}"`).join("; ")}`);
  else notes.info(`All ${Object.keys(labels).length} screen names are found in the app's own text`);
}

function checkKits(kits, notes) {
  for (const kit of Object.values(kits.kits)) {
    for (const line of kit.bom) if (!kits.parts[line.part]) throw new Error(`kits.json: kit ${kit.letter} lists a part "${line.part}" that does not exist`);
  }
  notes.info(`kits.json: ${Object.keys(kits.parts).length} parts, ${Object.keys(kits.kits).length} kits`);
}

// ---------------------------------------------------------------------------------------------------------------------------
// Checks of a finished document
// ---------------------------------------------------------------------------------------------------------------------------

/** Links inside the document that point at nothing become plain words, with a note. */
function fixDanglingLinks(html, label, notes) {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  let dangling = 0;
  const fixed = html.replace(/<a href="#([^"]*)">([\s\S]*?)<\/a>/g, (whole, target, inner) => {
    if (ids.has(target)) return whole;
    dangling += 1;
    notes.info(`${label}: a link to "#${target}" has no target in this document, so it is plain text`);
    return inner;
  });
  return { html: fixed, dangling };
}

const TEXT_CHECKS = [
  [/\bundefined\b/i, "the word undefined"],
  [/\[object Object\]/, "[object Object]"],
  [/\bNaN\b/, "NaN"],
  [/\{\{(?!\s*(?:Postgres|api)\.)/, "an unexpanded {{placeholder}}"],
  [/<\/?(?:span|div|p|table|tr|td|th|ul|ol|li|figure|figcaption|svg|section|h[1-6]|strong|em|nav|dl|dt|dd)\b[^>]*>/i, "raw HTML"],
  [/<a\s[^>]*>/i, "raw HTML (a link)"],
  [/&(?:amp|lt|gt|quot|nbsp|#\d+);/, "an HTML entity"],
  [/Ã[\u0080-¿]|â€|�/, "mojibake"],
  [/@@[A-Z][A-Z ]*\d*@@/, "an unfilled marker"],
  [/ZZHTMLBLOCK/, "an unrestored figure"]
];

function checkText(texts, label) {
  const problems = [];
  texts.forEach((text, index) => {
    for (const [pattern, what] of TEXT_CHECKS) {
      const match = text.match(pattern);
      if (match) problems.push(`${label}, page ${index + 1}: ${what} ("${match[0].slice(0, 60).replace(/\s+/g, " ")}")`);
    }
  });
  return problems;
}

/** Pages with next to no text: a blank page left by a page break. The cover is made of text, so it is never empty. */
function blankPages(texts) {
  const blanks = [];
  texts.forEach((text, index) => {
    const body = text
      .split("\n")
      .filter((line) => !/^\s*(GREECON\s+·|Greecon Sh\.p\.k|Version \d|Page \d+ of \d+)/.test(line) && !/Page \d+ of \d+/.test(line))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (body.length < 12) blanks.push(index + 1);
  });
  return blanks;
}

function countLinks(pdfPath) {
  const text = readFileSync(pdfPath).toString("latin1");
  return { links: (text.match(/\/Subtype\s*\/Link\b/g) ?? []).length };
}

// ---------------------------------------------------------------------------------------------------------------------------
// One document
// ---------------------------------------------------------------------------------------------------------------------------

async function buildDocument(spec, shared) {
  const { browser, ui, kits, steps, diagrams, fontsCss, baseCss, date, notes, work, out } = shared;
  const label = `PDF ${spec.id}`;
  const docNotes = new Notes();
  const doc = { ...spec, version: VERSION, date, dateLong: longDate(date) };
  const ctx = new Context({ labels: ui.labels, kits, steps, diagrams, doc, kit: spec.kit ?? null, refs: spec.refs, notes: docNotes });
  const config = { ui };

  const made = spec.parts.map((make) => make({ config, ctx, notes: docNotes }));
  // "Part 3" only means something inside the complete guide, where Parts 1 and 2 come before it: the stand-alone guides name their
  // parts by what they are about, in the contents, on the part's first page and in the running head
  if (!spec.partNumbers) {
    for (const part of made) {
      if (/^Part \d+$/.test(part.label ?? "")) part.label = "";
      part.runningHead = part.runningHead.replace(/^Part \d+ · /, "");
    }
  }
  const usedIds = new Set(["contents"]);
  for (const part of made) {
    usedIds.add(part.id);
    usedIds.add(`section-${part.id}`);
  }
  const renderedParts = made.map((part) => {
    part.sectionId = `section-${part.id}`;
    const lead = part.lead ? renderMarkdown(part.lead, ctx, { file: `${part.id} (lead)`, usedIds, notes: docNotes }).html : "";
    const body = renderMarkdown(part.body, ctx, { file: part.id, usedIds, notes: docNotes }).html;
    return partHtml(part, body, lead);
  });

  const joined = fixDanglingLinks(renderedParts.join("\n"), label, docNotes);
  const bodyHtml = joined.html;
  const entries = collectHeadings(bodyHtml).filter((entry) => !entry.noToc && (entry.toc || entry.role <= doc.tocDepth || entry.classes.some((name) => (doc.tocClasses ?? []).includes(name))));
  const furnitureCss = pageCss(doc, made);
  const cover = coverHtml(doc);
  const tocNote = doc.tocNote ?? "";

  const htmlPath = join(work, `${spec.id}.html`);
  const pdfPath = join(work, `${spec.id}.pdf`);
  const partsHtml = bodyHtml.split(/(?=<section class="part )/).filter((chunk) => chunk.trim().startsWith("<section"));

  let pages = new Map();
  for (let pass = 1; pass <= 3; pass += 1) {
    writeFileSync(htmlPath, documentHtml({ doc, fontsCss, baseCss, furnitureCss, cover, toc: tocHtml(entries, pages, { note: tocNote }), parts: partsHtml }));
    await printToPdf(browser, htmlPath, pdfPath);
    const dests = destinationPages(pdfPath);
    const found = new Map(entries.map((entry) => [entry.id, dests.get(entry.id) ?? ""]));
    const same = entries.every((entry) => String(found.get(entry.id) ?? "") === String(pages.get(entry.id) ?? ""));
    pages = found;
    if (same) break;
  }

  // The tags (the structure of the page, for screen readers) are about a third of a long PDF. If they would take it over the size
  // limit, the PDF is printed again without them: the pages, the bookmarks and the links are the same.
  let tagged = true;
  const taggedSize = statSync(pdfPath).size;
  if (taggedSize > MAX_BYTES) {
    await printToPdf(browser, htmlPath, pdfPath, { tagged: false });
    tagged = false;
    docNotes.warn(`printed without tags: with them it was ${(taggedSize / 1048576).toFixed(1)} MB, over the 4 MB limit`);
  }

  const lost = entries.filter((entry) => !pages.get(entry.id));
  if (lost.length > 0) notes.warn(`${label}: no page number found for ${lost.length} entries in the contents: ${lost.slice(0, 5).map((entry) => `"${entry.title}"`).join(", ")}${lost.length > 5 ? ", ..." : ""}`);

  fixDates(pdfPath, date);
  mkdirSync(out, { recursive: true });
  const target = join(out, spec.file);
  writeFileSync(target, readFileSync(pdfPath));
  const count = pageCount(target);
  const size = statSync(target).size;
  const final = pageTexts(target);

  const problems = checkText(final, label);
  const blanks = blankPages(final);
  if (blanks.length > 0) problems.push(`${label}: nearly empty pages: ${blanks.join(", ")}`);
  if (size > MAX_BYTES) problems.push(`${label}: ${(size / 1048576).toFixed(2)} MB is over the 4 MB limit`);
  const { links } = countLinks(target);
  for (const message of docNotes.warnings) notes.warn(`${label}: ${message}`);
  for (const message of docNotes.infos) notes.info(`${label}: ${message}`);
  for (const problem of problems) notes.warn(problem);

  return { spec, target, count, size, links, tagged, entries: entries.length, dangling: joined.dangling, problems, usedDiagrams: ctx.usedDiagrams.size };
}

// ---------------------------------------------------------------------------------------------------------------------------
// The README of the folder
// ---------------------------------------------------------------------------------------------------------------------------

function pdfDate(path) {
  const text = readFileSync(path).toString("latin1").match(/\/CreationDate \(D:(\d{4})(\d\d)(\d\d)/);
  return text ? `${text[1]}-${text[2]}-${text[3]}` : "";
}

function writeReadme(specs, out, date) {
  const rows = specs.map((spec) => {
    const path = join(out, spec.file);
    const built = existsSync(path);
    const pages = built ? pageCount(path) : "";
    const when = built ? pdfDate(path) : "not built";
    return `| [${spec.file}](${spec.file}) | ${spec.readme.who} | ${spec.readme.when} | ${pages} | ${when} |`;
  });
  const text = [
    "# Greecon printable guides",
    "",
    "A4, portrait, one file for each kind of reader. Every PDF has a cover, contents with page numbers and links, bookmarks, and page numbers in the footer. They are made from the launch documents and from the site packs in `docs/launch/packs/`; do not edit the PDFs, change the sources and rebuild.",
    "",
    "| File | Who it is for | When to print it | Pages | Built |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    "**Rebuild:** `npm run docs:pdf` (or `npm run docs:pdf -- --only 01,04` for some of them). It needs pandoc, Chromium through Playwright and poppler, all on the build machine, and no network. Screen names are typed once, in `scripts/docs/ui-labels.json`; the setup-list step titles are checked against `apps/api/src/setup/setup-checklist.ts` at every build. The date on the covers is the build date (`GUIDES_DATE=2026-11-02 npm run docs:pdf` fixes it); the same sources and the same date give byte-identical files.",
    "",
    "**Fonts and size.** The body is set in Bitstream Charter and the headings and tables in Inter, both from the build machine. Charter is installed only as Type 1, so the build converts it in memory (`scripts/docs/lib/type1-to-otf.mjs`); both fonts are given TrueType outlines (`scripts/docs/lib/otf-to-ttf.mjs`) so that Chromium embeds them as real fonts, which keeps the complete guide under 4 MB. Nothing is downloaded and no converted font is kept. A PDF that would still be over 4 MB with its accessibility tags is printed without them (the complete guide is the one that is).",
    ""
  ].join("\n");
  writeFileSync(join(out, "README.md"), text);
}

// ---------------------------------------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const notes = new Notes();
  const date = args.date ?? process.env.GUIDES_DATE ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d\d-\d\d$/.test(date)) throw new Error(`The date "${date}" is not YYYY-MM-DD`);

  const ui = readJson(join(DOCS_SCRIPTS, "ui-labels.json"));
  const kits = readJson(join(PACKS, "kits.json"));
  const steps = readJson(join(PACKS, "steps.json")).steps;
  const baseCss = readText(join(DOCS_SCRIPTS, "guides.css"));

  checkKits(kits, notes);
  checkStepTitles(steps, notes);
  checkTemplates(kits, notes);
  checkLabels(ui.labels, notes);

  const specs = documents(kits);
  const chosen = args.only ? specs.filter((spec) => args.only.includes(spec.id)) : specs;
  if (args.only) {
    const unknown = args.only.filter((id) => !specs.some((spec) => spec.id === id));
    if (unknown.length > 0) throw new Error(`There is no PDF numbered ${unknown.join(", ")}. The numbers are ${specs.map((spec) => spec.id).join(", ")}.`);
  }

  const fonts = prepareFonts();
  for (const line of fonts.report) notes.info(line);

  const diagrams = buildDiagrams();
  for (const diagram of Object.values(diagrams)) for (const warning of diagram.warnings) notes.warn(`diagram ${diagram.id}: ${warning}`);

  const work = mkdtempSync(join(tmpdir(), "greecon-guides-"));
  const browser = await launchBrowser();
  const results = [];
  try {
    for (const spec of chosen) {
      const started = Date.now();
      const result = await buildDocument(spec, { browser, ui, kits, steps, diagrams, fontsCss: fonts.css, baseCss, date, notes, work, out: args.out });
      results.push(result);
      console.log(`Wrote ${relative(REPO, result.target)}  ${result.count} pages, ${(result.size / 1024).toFixed(0)} KB, ${result.links} links${result.tagged ? ", tagged" : ", not tagged (size)"}  (${((Date.now() - started) / 1000).toFixed(1)} s)`);
    }
  } finally {
    await browser.close();
    if (args.keepHtml) console.log(`HTML kept in ${work}`);
    else rmSync(work, { recursive: true, force: true });
  }

  // a spelling in ui-labels.json "legacy" that no launch document uses any more should be removed from it
  if (!args.only || args.only.includes("00")) {
    const used = ui.legacy.used ?? new Set();
    const stale = [...Object.keys(ui.legacy.map), ...(ui.legacy.composite ?? []).map((item) => `composite:${item.old}`)].filter((literal) => !used.has(literal));
    if (stale.length > 0) notes.warn(`ui-labels.json "legacy" lists spellings that no launch document uses any more (remove them): ${stale.map((item) => `"${item}"`).join(", ")}`);
  }

  writeReadme(specs, args.out, date);
  console.log(`Wrote ${relative(REPO, join(args.out, "README.md"))}`);

  if (args.verbose) for (const message of notes.infos) console.log(`note: ${message}`);
  if (notes.warnings.length > 0) {
    console.log(`\n${notes.warnings.length} warning(s):`);
    for (const message of notes.warnings) console.log(`  - ${message}`);
  }
  const bad = results.filter((result) => result.problems.length > 0);
  console.log(`\n${results.length} PDF(s) built${bad.length > 0 ? `, ${bad.length} with problems in the text (listed above)` : ", the text of each checked: no placeholders, raw HTML, entities or blank pages"}.`);
  if (bad.length > 0 || fonts.ok === false) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack ?? String(error));
  process.exit(1);
});
