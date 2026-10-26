// Printing the HTML to PDF with Chromium (through Playwright), finding out on which page each heading landed, and making the
// file the same every time it is built from the same sources.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

export async function launchBrowser() {
  const require = createRequire(import.meta.url);
  const playwright = require(process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright");
  return playwright.chromium.launch();
}

/** Prints an HTML file to a PDF: A4, backgrounds on, the outline (bookmarks) and tags (reading order) written. */
export async function printToPdf(browser, htmlPath, pdfPath) {
  const page = await browser.newPage();
  try {
    await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: "print" });
    await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true, outline: true, tagged: true });
  } finally {
    await page.close();
  }
}

export function pageCount(pdfPath) {
  const result = spawnSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`pdfinfo failed: ${result.stderr}`);
  return Number(result.stdout.match(/^Pages:\s+(\d+)/m)?.[1]);
}

/** The text of each page, in reading order. */
export function pageTexts(pdfPath) {
  const result = spawnSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`pdftotext failed: ${result.stderr}`);
  const pages = result.stdout.split("\f");
  if (pages.length > 0 && pages[pages.length - 1].trim() === "") pages.pop();
  return pages;
}

function normal(text) {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Finds the page (1-based) of each heading. Headings are looked for in order, each from the page where the one before was found:
 * a part opener by its label in capitals (PART 3), a chapter by its number and the first words of its title at the start of a line.
 * Pages before `fromPage` (the cover and the contents) are not searched.
 */
export function findPages(texts, entries, fromPage) {
  const pages = new Map();
  let at = fromPage;
  for (const entry of entries) {
    const needle = normal(entry.label ? entry.label : `${entry.number} ${entry.title}`.trim());
    // a part opener is set in letter-spaced capitals, which the text extraction splits ("PA R T 2"): compare it without spaces
    const words = entry.label ? needle.replace(/\s/g, "") : needle.split(" ").slice(0, 6).join(" ");
    let found = -1;
    for (let index = at; index < texts.length; index += 1) {
      const lines = texts[index].split("\n").map((line) => normal(line));
      if (lines.some((line) => (entry.label ? line.replace(/\s/g, "") === words : line.startsWith(words)))) {
        found = index;
        break;
      }
    }
    if (found < 0) {
      pages.set(entry.id, "");
      continue;
    }
    pages.set(entry.id, found + 1);
    at = found;
  }
  return pages;
}

/** Overwrites the creation and modification dates Chromium writes, with a fixed one of the same length, so that the same sources give the same file. */
export function fixDates(pdfPath, date) {
  const buffer = readFileSync(pdfPath);
  const stamp = `D:${date.replace(/-/g, "")}000000+00'00'`;
  const text = buffer.toString("latin1").replace(/\/(CreationDate|ModDate) \(D:[^)]*\)/g, (_, key) => `/${key} (${stamp})`);
  writeFileSync(pdfPath, Buffer.from(text, "latin1"));
}
