// The launch documents as parts of the guides: which of their sections go where, how they are numbered in the book, and the few
// places where text refers to another section by number. Each function returns Markdown (with {{macros}}) ready for the build.
//
// A launch document that has been restructured makes a section lookup fail loudly; a sentence that has been reworded makes a
// literal rewrite warn, so the build never silently prints something stale.

import { join } from "node:path";
import { LAUNCH, githubSlug, readText } from "./util.mjs";
import { applyLegacyUi, findSection, headingLine, literalReplace, parseSections, rewriteLinks } from "./sources.mjs";

function load(file, config, notes, { exclude = [] } = {}) {
  const raw = readText(join(LAUNCH, file));
  const withNames = applyLegacyUi(raw, config.ui, { exclude, file, notes });
  return withNames;
}

/** "Step 3. Railway: the API service" style number for the founder guide. */
const stripNumber = (heading) => heading.replace(/^\d+\.\s+/, "");

// ---------------------------------------------------------------------------------------------------------------------------
// Part 2: the founder (01-founder-go-live.md)
// ---------------------------------------------------------------------------------------------------------------------------

export function founderPart(config, ctx, notes) {
  const file = "01-founder-go-live.md";
  const text = load(file, config, notes, { exclude: ["Settings"] });
  const parsed = parseSections(text);
  const lead = rewriteLinks(parsed.preamble.replace(/\n---\s*$/, "").trim(), ctx, { file, notes });
  const out = [];
  let tearoff = "";
  for (const section of parsed.sections) {
    const numbered = section.heading.match(/^(\d+)\.\s+(.*)$/);
    const id = githubSlug(section.heading);
    let body = rewriteLinks(section.body, ctx, { file, notes });
    if (numbered && numbered[1] === "12") {
      const marker = body.indexOf("**Go-live checklist.**");
      if (marker < 0) {
        notes.warn(`${file}: the go-live checklist was not found, so there is no tear-off page`);
      } else {
        tearoff = body.slice(marker);
        body = body.slice(0, marker).trim();
      }
    }
    // "0. What you need before you start" is not a step; 1 to 12 are
    const isStep = numbered && numbered[1] !== "0";
    out.push(headingLine(2, isStep ? { number: `Step ${numbered[1]}`, title: numbered[2], id, classes: ["lv2"] } : { title: numbered ? numbered[2] : section.heading, id, classes: ["lv2"] }));
    out.push("", body, "");
  }
  let tearoffMd = "";
  if (tearoff) {
    const items = tearoff.replace(/^\*\*Go-live checklist\.\*\*\s*/, "").trim();
    const [intro, ...rest] = items.split(/\n\n(?=- \[ \])/);
    tearoffMd = [
      "::: tearoff",
      "[Tear off and keep]{.tearlabel}",
      "",
      "## Go-live checklist {#go-live-checklist .lv2 .intoc}",
      "",
      intro.trim(),
      "",
      rest.join("\n\n"),
      "",
      "Signed: {{line}} Date: {{line:short}}",
      ":::",
      ""
    ].join("\n");
  }
  return { lead, body: out.join("\n"), tearoff: tearoffMd };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Part 3, Part 6, Appendices B and C: the project manager's manual (02-project-manager-manual.md)
// ---------------------------------------------------------------------------------------------------------------------------

/** Where each section of the manual sits in the book. */
const MANUAL_PLACES = {
  rules: { number: "3.1" },
  1: { number: "3.2" },
  2: { number: "3.3" },
  3: { number: "3.4" },
  4: { number: "3.5" },
  5: { number: "3.6" },
  6: { number: "3.7" },
  7: { number: "3.8" },
  8: { number: "3.9" },
  9: { number: "6.1" },
  10: { number: "6.2" },
  11: { number: "3.10" },
  12: { number: "C" },
  13: { number: "3.11" },
  14: { number: "B" }
};

/** The numbers the manual's own text uses for its sections and steps, said as the book numbers them. */
const MANUAL_TEXT_REWRITES = [
  ["(section 4 below)", "(section 3.5 below)"],
  ["see [7.7](#7-the-setup-list-step-by-step)", "see [3.8.7](#7-the-setup-list-step-by-step)"],
  ["[section 13](#13-rehearsal-the-whole-job-on-a-desk)", "[section 3.11](#13-rehearsal-the-whole-job-on-a-desk)"],
  ["Paste the install line from step 4.7.", "Paste the install line from section 3.5, item 7."],
  ["you enter it in step 7.3.", "you enter it in step 3.8.3."],
  ["[step 5](#5-prepare-the-kit-at-the-office)", "[section 3.6](#5-prepare-the-kit-at-the-office)"],
  ["see [section 12](#12-when-something-is-wrong)", "see [Appendix C](#12-when-something-is-wrong)"],
  ["[section 9](#9-commissioning-checks-by-kind-of-site)", "[section 6.1](#9-commissioning-checks-by-kind-of-site)"],
  ["four readings (7.4)", "four readings (3.8.4)"],
  ["Prices (7.1) so that", "Prices (3.8.1) so that"],
  ["now, while the pump is stopped ([7.9](#7-the-setup-list-step-by-step))", "now, while the pump is stopped ([3.8.9](#7-the-setup-list-step-by-step))"],
  ["delete the battery and load meter if not fitted (7.4).", "delete the battery and load meter if not fitted (3.8.4)."],
  ["([section 5](#5-prepare-the-kit-at-the-office))", "([section 3.6](#5-prepare-the-kit-at-the-office))"],
  ["Electrician turns them; repeat 7.8", "Electrician turns them; repeat 3.8.8"],
  ["[Rehearsal](#13-rehearsal-the-whole-job-on-a-desk)", "[Rehearsal](#13-rehearsal-the-whole-job-on-a-desk) (section 3.11)"],
  ['[03](03-hardware-and-wiring.md), "Meter settings")', "[03](03-hardware-and-wiring.md), section 4.5)"]
];

/** Replaces the manual's ASCII picture of kit H with the real drawing. */
function replaceAsciiPicture(body, notes, file) {
  const fence = /```\n(?:(?!```)[\s\S])*?supply entry(?:(?!```)[\s\S])*?converter \(RTU→TCP\)(?:(?!```)[\s\S])*?```/;
  if (!fence.test(body)) {
    notes.warn(`${file}: the wiring picture of kit H was not found, so it was not replaced by a drawing`);
    return body;
  }
  return body.replace(fence, "{{diagram:kit-h-wiring}}");
}

/** "**7.4 Which register holds which reading.** text" becomes a heading of its own. */
function runInsToHeadings(body, notes, file) {
  const pattern = /^\*\*7\.(\d+) ([^*]+?)\.?\*\*[ ]?(\*\([^\n]*?\)\*)?[ ]?(.*)$/gm;
  let found = 0;
  const out = body.replace(pattern, (whole, n, title, aside, rest) => {
    found += 1;
    const heading = headingLine(3, { number: `3.8.${n}`, title, id: `setup-step-${n}`, classes: ["lv3", "toc2"] });
    const after = [aside, rest.replace(/^\.\s*/, "")].filter(Boolean).join(" ").trim();
    return `${heading}\n\n${after}`.trimEnd();
  });
  if (found !== 10) notes.warn(`${file}: expected the ten steps 7.1 to 7.10 and found ${found}`);
  return out;
}

export function loadManual(config, ctx, notes) {
  const file = "02-project-manager-manual.md";
  let text = load(file, config, notes);
  text = literalReplace(text, MANUAL_TEXT_REWRITES, { file, notes });
  const parsed = parseSections(text);
  const sections = new Map();
  for (const section of parsed.sections) {
    let key;
    const numbered = section.heading.match(/^(\d+)\.\s+(.*)$/);
    if (numbered) key = numbered[1];
    else if (/^The rules that never bend/.test(section.heading)) key = "rules";
    else {
      notes.warn(`${file}: a section called "${section.heading}" has no place in the guides`);
      continue;
    }
    sections.set(key, { ...section, id: githubSlug(section.heading), title: numbered ? numbered[2] : section.heading });
  }
  for (const key of Object.keys(MANUAL_PLACES)) {
    if (!sections.has(key)) throw new Error(`${file}: the section for "${key}" is missing`);
  }

  const rewrite = (key, { extra = (body) => body } = {}) => {
    const section = sections.get(key);
    let body = section.body;
    body = rewriteLinks(body, ctx, { file, notes });
    body = extra(body);
    return body;
  };

  const chapter = (key, options = {}) => {
    const section = sections.get(key);
    const place = MANUAL_PLACES[key];
    const body = rewrite(key, options);
    const level = options.level ?? 2;
    return [
      headingLine(level, { number: options.number ?? (place.number.length === 1 ? undefined : place.number), title: options.title ?? section.title, id: section.id, classes: [`lv${level}`, ...(options.classes ?? [])] }),
      "",
      body,
      ""
    ].join("\n");
  };

  const lead = rewriteLinks(parsed.preamble.replace(/\n---\s*$/, "").trim(), ctx, { file, notes });
  return {
    lead,
    chapter,
    asciiToDiagram: (body) => replaceAsciiPicture(body, notes, file),
    runIns: (body) => runInsToHeadings(body, notes, file),
    section: (key) => sections.get(key),
    rewrite
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Part 7 and the contact sheet: the runbooks (05-runbooks.md)
// ---------------------------------------------------------------------------------------------------------------------------

export function loadRunbooks(config, ctx, notes) {
  const file = "05-runbooks.md";
  const text = load(file, config, notes);
  const parsed = parseSections(text);
  const lead = rewriteLinks(parsed.preamble.replace(/\n---\s*$/, "").trim(), ctx, { file, notes });
  const books = [];
  for (const section of parsed.sections) {
    const match = section.heading.match(/^(R\d+|0)\.\s+(.*)$/);
    if (!match) {
      if (!/^Contact sheet/.test(section.heading)) notes.warn(`${file}: a section called "${section.heading}" has no place in the guides`);
      continue;
    }
    const key = match[1] === "0" ? "R0" : match[1];
    books.push({ key, title: match[2], id: githubSlug(section.heading), body: rewriteLinks(section.body, ctx, { file, notes }) });
  }
  const render = (keys) => {
    const chosen = keys ? books.filter((book) => keys.includes(book.key)) : books;
    if (keys) for (const key of keys) if (!books.some((book) => book.key === key)) notes.warn(`${file}: runbook ${key} is missing`);
    return chosen
      .map((book) => [headingLine(2, { number: book.key, title: book.title, id: book.id, classes: ["lv2", "intoc"] }), "", book.body, ""].join("\n"))
      .join("\n");
  };
  const table = (key, startsWith) => {
    const book = books.find((entry) => entry.key === key);
    if (!book) return "";
    const lines = book.body.split("\n");
    const start = lines.findIndex((line) => line.startsWith(startsWith));
    if (start < 0) return "";
    let end = start;
    while (end < lines.length && lines[end].startsWith("|")) end += 1;
    return lines.slice(start, end).join("\n");
  };
  return { lead, render, books, table };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Part 4 does not use 03-hardware-and-wiring.md as text (it is written afresh, from it); the build reads it only to check numbers
// ---------------------------------------------------------------------------------------------------------------------------

export const stripHeadingNumber = stripNumber;
