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

/** Prints an HTML file to a PDF: A4, backgrounds on, the outline (bookmarks) and, unless told not to, the tags (reading order) written. */
export async function printToPdf(browser, htmlPath, pdfPath, { tagged = true } = {}) {
  const page = await browser.newPage();
  try {
    await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: "print" });
    await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true, outline: true, tagged });
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

/**
 * The page (1-based) each heading landed on, from the PDF itself: Chromium writes a named destination for every element that has an
 * id and is linked to, and poppler lists them. This is what the contents' links jump to, so the numbers printed in the contents are
 * the pages the links go to.
 */
export function destinationPages(pdfPath) {
  const result = spawnSync("pdfinfo", ["-dests", pdfPath], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`pdfinfo -dests failed: ${result.stderr}`);
  const pages = new Map();
  for (const line of result.stdout.split("\n")) {
    const match = line.match(/^\s*(\d+)\s+\[.*\]\s+"(.*)"\s*$/);
    if (match) pages.set(match[2], Number(match[1]));
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
