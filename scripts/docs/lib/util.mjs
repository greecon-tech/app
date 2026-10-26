// Small helpers shared by the guide build.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const DOCS_SCRIPTS = resolve(HERE, "..");
export const REPO = resolve(DOCS_SCRIPTS, "..", "..");
export const LAUNCH = join(REPO, "docs", "launch");
export const PACKS = join(LAUNCH, "packs");
export const PDF_DIR = join(LAUNCH, "pdf");

export function readText(path) {
  if (!existsSync(path)) throw new Error(`File not found: ${path}`);
  return readFileSync(path, "utf8");
}

export function readJson(path) {
  return JSON.parse(readText(path));
}

/** GitHub's way of turning a heading into an anchor, which the launch documents' own links use. */
export function githubSlug(heading) {
  return heading
    .replace(/<[^>]*>/g, "")
    .replace(/[*_`]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function stripTags(html) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Messages printed at the end of the build: things the reader of the log should know. */
export class Notes {
  constructor() {
    this.warnings = [];
    this.infos = [];
  }
  warn(message) {
    this.warnings.push(message);
  }
  info(message) {
    this.infos.push(message);
  }
}
