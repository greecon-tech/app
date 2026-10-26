// What goes into which PDF.
//
// Each document is a list of parts. A part is Markdown (with the macros of lib/macros.mjs) made either from a source written for the
// guides (docs/launch/packs/*.md) or from a launch document (docs/launch/01, 02, 05) reshaped by lib/launch.mjs. The same part
// has the same number and the same text in every PDF it appears in.

import { join } from "node:path";
import { PACKS, readText } from "./lib/util.mjs";
import { headingLine } from "./lib/sources.mjs";
import { expand } from "./lib/macros.mjs";
import { founderPart, loadManual, loadRunbooks } from "./lib/launch.mjs";

export const VERSION = "1.0";
const KITS = ["H", "S", "F", "W"];

const read = (name) => readText(join(PACKS, name));

/** The text before the first "##" is the part's lead (shown large under the part's title); the rest is the body. */
function splitLead(markdown) {
  const lines = markdown.split("\n");
  let inFence = false;
  const at = lines.findIndex((line) => {
    if (/^```/.test(line)) inFence = !inFence;
    return !inFence && /^## /.test(line);
  });
  if (at < 0) return { lead: markdown.trim(), body: "" };
  return { lead: lines.slice(0, at).join("\n").trim(), body: lines.slice(at).join("\n") };
}

function part(spec, { lead, body }) {
  return { ...spec, cssClass: spec.id, lead, body };
}

// ---------------------------------------------------------------------------------------------------------------------------
// The parts
// ---------------------------------------------------------------------------------------------------------------------------

const PARTS = {
  part1: () => part({ id: "part-1", label: "Part 1", title: "Before you begin", runningHead: "Part 1 · Before you begin" }, splitLead(read("part1-before-you-begin.md"))),

  part2: ({ config, ctx, notes }) => {
    const founder = founderPart(config, ctx, notes);
    return part(
      { id: "part-2", label: "Part 2", title: "Platform go-live: the founder", runningHead: "Part 2 · Platform go-live" },
      { lead: founder.lead, body: `${founder.body}\n${founder.tearoff}` }
    );
  },

  part3: ({ config, ctx, notes }) => {
    const manual = loadManual(config, ctx, notes);
    const body = [
      manual.chapter("rules"),
      manual.chapter("1"),
      manual.chapter("2"),
      manual.chapter("3"),
      manual.chapter("4"),
      manual.chapter("5"),
      manual.chapter("6"),
      manual.chapter("7", { extra: manual.runIns }),
      manual.chapter("8", { extra: manual.asciiToDiagram }),
      manual.chapter("11"),
      manual.chapter("13")
    ].join("\n");
    return part({ id: "part-3", label: "Part 3", title: "The project manager's job, first call to day 90", runningHead: "Part 3 · The project manager's job" }, { lead: manual.lead, body });
  },

  part4: () => part({ id: "part-4", label: "Part 4", title: "Hardware reference", runningHead: "Part 4 · Hardware reference" }, splitLead(read("part4-hardware-reference.md"))),

  part5: ({ ctx }) => {
    const blocks = KITS.map((letter, index) => {
      const kit = ctx.kits.kits[letter];
      const lower = letter.toLowerCase();
      const heading = headingLine(2, { number: `5.${index + 1}`, title: `Site pack ${letter}: ${kit.name}`, id: `pack-${lower}`, classes: ["lv2", "pack-title"] });
      const intro = `*${kit.short}.* Planning estimate: ${kit.headline} This pack is also printed on its own as PDF ${kit.pdf.slice(0, 2)} (${kit.pdf}).`;
      // each pack is written for one kit, so its macros are expanded with that kit
      const pack = expand(PACK_SOURCE[letter], ctx.withKit(letter), `pack-${lower}.md`);
      return `${heading}\n\n${intro}\n\n<!--shift:1-->\n${pack}\n<!--/shift-->\n`;
    });
    return part(
      { id: "part-5", label: "Part 5", title: "The four site packs", runningHead: "Part 5 · The four site packs" },
      { lead: read("part5-lead.md").trim(), body: blocks.join("\n") }
    );
  },

  part6: ({ config, ctx, notes }) => {
    const manual = loadManual(config, ctx, notes);
    // the markers are replaced before the lead is split off, because the first chapter of the manual is what ends the lead
    const filled = read("part6-commissioning-handover.md")
      .replace("@@MANUAL 9@@", () => manual.chapter("9", { number: "6.1" }))
      .replace("@@MANUAL 10@@", () => manual.chapter("10", { number: "6.2" }));
    const { lead, body } = splitLead(filled);
    return part({ id: "part-6", label: "Part 6", title: "Commissioning, handover and what to leave", runningHead: "Part 6 · Commissioning and handover" }, { lead, body });
  },

  /** The runbooks. `only` limits them to the ones a project manager can do (05, R14 says which). */
  part7: ({ config, ctx, notes }, { only = null } = {}) => {
    const runbooks = loadRunbooks(config, ctx, notes);
    return part(
      { id: "part-7", label: "Part 7", title: only ? "Quick runbooks: the ones the project manager uses" : "Quick runbooks", runningHead: "Part 7 · Quick runbooks" },
      { lead: runbooks.lead, body: runbooks.render(only) }
    );
  },

  appendices: ({ config, ctx, notes }) => {
    const manual = loadManual(config, ctx, notes);
    const runbooks = loadRunbooks(config, ctx, notes);
    const { lead, body } = splitLead(read("appendices.md"));
    const filled = body
      .replace("@@MANUAL 14@@", () => manual.chapter("14", { number: "B.1", title: "Words used in the manual", level: 3 }))
      .replace("@@MANUAL 12@@", () => manual.chapter("12", { number: "C.1", title: "On site and at the box", level: 3 }))
      .replace("@@RUNBOOK R3 TABLE@@", () => runbooks.table("R3", "| Symptom"));
    return part({ id: "appendices", label: "Appendices", title: "Forms, words, symptoms, shopping lists and contacts", runningHead: "Appendices" }, { lead, body: filled });
  },

  pack: (letter) => ({ ctx }) => {
    const kit = ctx.kits.kits[letter];
    return part(
      { id: `pack-${letter.toLowerCase()}-part`, label: `Site pack ${letter}`, title: kit.name, runningHead: `Site pack ${letter} · ${kit.running}` },
      { lead: `*${kit.short}.* ${read("pack-lead.md").trim()}`, body: PACK_SOURCE[letter] }
    );
  }
};

const PACK_SOURCE = Object.fromEntries(KITS.map((letter) => [letter, `{{include:pack-${letter.toLowerCase()}.md}}`]));

// ---------------------------------------------------------------------------------------------------------------------------
// The documents
// ---------------------------------------------------------------------------------------------------------------------------

const PDF_NAMES = {
  "00": "00-Greecon-Complete-Deployment-Guide.pdf",
  "01": "01-Founder-Go-Live-Guide.pdf",
  "02": "02-Project-Manager-Field-Manual.pdf",
  "03": "03-Hardware-Reference.pdf",
  "04": "04-Site-Pack-H-Hotel-or-Guesthouse.pdf",
  "05": "05-Site-Pack-S-Solar-Plant.pdf",
  "06": "06-Site-Pack-F-Farm-or-Greenhouse.pdf",
  "07": "07-Site-Pack-W-Water-Tank-and-Pump-Station.pdf"
};

const BOOK_REFS = {
  founder: { text: "Part 2", href: "#part-2" },
  manual: { text: "Part 3", href: "#part-3" },
  hardware: { text: "Part 4", href: "#part-4" },
  runbooks: { text: "Part 7", href: "#part-7" },
  appendices: { text: "the Appendices", href: "#appendices" },
  packs: { text: "Part 5", href: "#part-5" },
  sales: { text: "the Sales kit (document 04, not part of these guides)" },
  book: { text: "this book" }
};

const elsewhere = (self) => ({
  founder: self === "founder" ? { text: "this guide" } : { text: "the Founder Go-Live Guide (PDF 01)" },
  manual: self === "manual" ? { text: "this manual" } : { text: "the Project Manager Field Manual (PDF 02)" },
  hardware: self === "hardware" ? { text: "this reference" } : { text: "the Hardware Reference (PDF 03)" },
  runbooks: self === "manual" ? { text: "the runbooks", href: "#part-7" } : { text: "the Complete Deployment Guide, Part 7 (PDF 00)" },
  appendices: self === "manual" ? { text: "the Appendices", href: "#appendices" } : { text: "the Appendices of the Complete Deployment Guide (PDF 00)" },
  packs: { text: "PDFs 04 to 07" },
  sales: { text: "the Sales kit (document 04, not part of these guides)" },
  book: { text: "the Complete Deployment Guide (PDF 00)" }
});

/** @returns the documents, each with its cover words, its references and the parts it is made of. */
export function documents(kits) {
  const packDoc = (n, letter) => {
    const kit = kits.kits[letter];
    return {
      id: n,
      file: PDF_NAMES[n],
      title: `Site Pack ${letter}: ${kit.name}`,
      runningTitle: `Site pack ${letter} · ${kit.running}`,
      kit: letter,
      tocDepth: 3,
      refs: elsewhere("pack"),
      readme: { who: `The project manager and the electrician at a ${kit.name.toLowerCase()} (kit ${letter}); the owner at handover`, when: "For each site of this kind: the whole pack, ticked off as the work is done" },
      cover: {
        kicker: `Site pack ${letter}`,
        title: kit.name,
        subtitle: `${kit.short}. Everything for one kind of site in one pack: what to buy, the survey, the diagrams, install day step by step, the platform steps, the commissioning tests and the handover sheet.`,
        forWho: "The project manager at this kind of site, the electrician, and the customer's owner at handover",
        print: "The whole pack, for the site in front of you. Tick the boxes as you go",
        covers: `Bill of materials · survey · system, wiring, network and enclosure diagrams · install day · addressing · the ten setup steps · commissioning · handover`,
        badge: letter
      },
      parts: [PARTS.pack(letter)]
    };
  };
  return [
    {
      id: "00",
      file: PDF_NAMES["00"],
      title: "Greecon Complete Deployment Guide",
      runningTitle: "Complete Deployment Guide",
      partNumbers: true,
      tocDepth: 2,
      refs: BOOK_REFS,
      readme: { who: "Everyone: the founder, the project manager and the electrician", when: "Once, to keep in the office. For a job, print the pack or guide that fits it (04 to 07, 01 to 03)" },
      cover: {
        kicker: "Deployment guide",
        title: "Complete Deployment Guide",
        subtitle: "Hardware and software setup for every kind of site, from the first call to day 90, in one book.",
        forWho: "The founder, the project manager and the electrician",
        print: "Keep one copy in the office. For a job, print the pack or guide that fits it (PDFs 01 to 07)",
        covers: "Before you begin · platform go-live · the project manager's job · every hardware type · the four site packs · commissioning and handover · runbooks · forms, words, symptoms, shopping lists, contacts"
      },
      parts: [PARTS.part1, PARTS.part2, PARTS.part3, PARTS.part4, PARTS.part5, PARTS.part6, PARTS.part7, PARTS.appendices]
    },
    {
      id: "01",
      file: PDF_NAMES["01"],
      title: "Greecon Founder Go-Live Guide",
      runningTitle: "Founder Go-Live Guide",
      tocDepth: 2,
      refs: elsewhere("founder"),
      readme: { who: "The founder (nothing technical is assumed)", when: "Once, before the first customer. The last page tears off as the go-live checklist" },
      cover: {
        kicker: "Guide 01 · For the founder",
        title: "Founder Go-Live Guide",
        subtitle: "Put the platform on the internet: Railway, the two addresses, the first sign-in, email and text messages, the demo, the outside checks and backups.",
        forWho: "The founder, once. Nothing technical is assumed",
        print: "Once, before the first customer. The last page tears off as the go-live checklist",
        covers: "Twelve steps of clicking and pasting, what you should see at each, what to do if you do not, and the checklist"
      },
      parts: [PARTS.part2]
    },
    {
      id: "02",
      file: PDF_NAMES["02"],
      title: "Greecon Project Manager Field Manual",
      runningTitle: "Project Manager Field Manual",
      tocDepth: 3,
      refs: elsewhere("manual"),
      readme: { who: "The project manager, for every site", when: "Once for the office and the car; print the forms (Appendix A) for each site" },
      cover: {
        kicker: "Guide 02 · For the project manager",
        title: "Project Manager Field Manual",
        subtitle: "A customer from the first call to day 90: survey, preparing the box, install day, the setup list, commissioning, handover, the morning check and the forms.",
        forWho: "The project manager, for every site",
        print: "Once for the car and the office; print the forms (Appendix A) for each site",
        covers: "The job · the rules · the setup list step by step · the four kinds of site · commissioning · handover · the runbooks a project manager uses · forms, glossary, symptoms, shopping lists, contacts"
      },
      parts: [PARTS.part3, PARTS.part6, (g) => PARTS.part7(g, { only: ["R0", "R1", "R2", "R3", "R4", "R5", "R6", "R10", "R11"] }), PARTS.appendices]
    },
    {
      id: "03",
      file: PDF_NAMES["03"],
      title: "Greecon Hardware Reference",
      runningTitle: "Hardware Reference",
      tocDepth: 2,
      tocClasses: ["hw"],
      refs: elsewhere("hardware"),
      readme: { who: "The project manager who buys and fits hardware, and the electrician", when: "Once, to keep with the spares kit" },
      cover: {
        kicker: "Guide 03 · For the project manager and the electrician",
        title: "Hardware Reference",
        subtitle: "Every part of a kit: the box, the converter, the meters, the input modules, the level, pressure, flow, soil and climate sensors, the cellular router, power, the UPS, the enclosure, labels, tools and spares.",
        forWho: "The project manager who buys and fits hardware, and the electrician",
        print: "Once, to keep with the spares kit",
        covers: "Specifications, planning estimates, settings, fitting, checks and the mistakes to avoid, part by part"
      },
      parts: [PARTS.part4]
    },
    packDoc("04", "H"),
    packDoc("05", "S"),
    packDoc("06", "F"),
    packDoc("07", "W")
  ];
}
