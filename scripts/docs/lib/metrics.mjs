// Real text widths for the diagrams, read from the installed Inter font files, so that boxes are sized and long labels wrapped
// by what the print will actually do and not by a guess. Only advance widths are used (no kerning), which is within a percent
// or two for the short labels in the diagrams. If a font file cannot be found the widths fall back to an average.

import { existsSync, readFileSync } from "node:fs";

const INTER_DIR = process.env.INTER_DIR ?? "/usr/share/fonts/opentype/inter";
const FILES = { 400: "Inter-Regular.otf", 500: "Inter-Medium.otf", 600: "Inter-SemiBold.otf", 700: "Inter-Bold.otf", 800: "Inter-ExtraBold.otf" };

const cache = new Map();

function readFont(path) {
  const buffer = readFileSync(path);
  const count = buffer.readUInt16BE(4);
  const tables = {};
  for (let index = 0; index < count; index += 1) {
    const at = 12 + index * 16;
    tables[buffer.toString("latin1", at, at + 4)] = { offset: buffer.readUInt32BE(at + 8), length: buffer.readUInt32BE(at + 12) };
  }
  const unitsPerEm = buffer.readUInt16BE(tables.head.offset + 18);
  const metricCount = buffer.readUInt16BE(tables.hhea.offset + 34);
  const hmtx = tables.hmtx.offset;
  const advance = (glyph) => buffer.readUInt16BE(hmtx + Math.min(glyph, metricCount - 1) * 4);

  // cmap: prefer format 12, else format 4
  const cmapAt = tables.cmap.offset;
  const records = buffer.readUInt16BE(cmapAt + 2);
  let format4 = null;
  let format12 = null;
  for (let index = 0; index < records; index += 1) {
    const platform = buffer.readUInt16BE(cmapAt + 4 + index * 8);
    const encoding = buffer.readUInt16BE(cmapAt + 6 + index * 8);
    const offset = cmapAt + buffer.readUInt32BE(cmapAt + 8 + index * 8);
    const format = buffer.readUInt16BE(offset);
    if (format === 12 && !format12) format12 = offset;
    if (format === 4 && !format4 && (platform === 3 || platform === 0) && (encoding === 1 || encoding === 3 || platform === 0)) format4 = offset;
  }
  const glyphOf = (code) => {
    if (format12 !== null) {
      const groups = buffer.readUInt32BE(format12 + 12);
      let low = 0;
      let high = groups - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        const at = format12 + 16 + mid * 12;
        const start = buffer.readUInt32BE(at);
        const end = buffer.readUInt32BE(at + 4);
        if (code < start) high = mid - 1;
        else if (code > end) low = mid + 1;
        else return buffer.readUInt32BE(at + 8) + (code - start);
      }
      return 0;
    }
    if (format4 !== null) {
      const segX2 = buffer.readUInt16BE(format4 + 6);
      const endCodes = format4 + 14;
      const startCodes = endCodes + segX2 + 2;
      const deltas = startCodes + segX2;
      const rangeOffsets = deltas + segX2;
      for (let index = 0; index < segX2 / 2; index += 1) {
        const end = buffer.readUInt16BE(endCodes + index * 2);
        if (code > end) continue;
        const start = buffer.readUInt16BE(startCodes + index * 2);
        if (code < start) return 0;
        const delta = buffer.readUInt16BE(deltas + index * 2);
        const rangeOffset = buffer.readUInt16BE(rangeOffsets + index * 2);
        if (rangeOffset === 0) return (code + delta) & 0xffff;
        const glyph = buffer.readUInt16BE(rangeOffsets + index * 2 + rangeOffset + (code - start) * 2);
        return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
      }
    }
    return 0;
  };
  return { unitsPerEm, advance, glyphOf, widths: new Map() };
}

function fontFor(weight) {
  const key = weight >= 800 ? 800 : weight >= 700 ? 700 : weight >= 600 ? 600 : weight >= 500 ? 500 : 400;
  if (cache.has(key)) return cache.get(key);
  let font = null;
  try {
    const path = `${INTER_DIR}/${FILES[key]}`;
    if (existsSync(path)) font = readFont(path);
  } catch {
    font = null;
  }
  cache.set(key, font);
  return font;
}

/** The width of a text at a font size, in the same units as the size. */
export function measure(text, size, weight = 400) {
  const font = fontFor(weight);
  const string = String(text);
  if (!font) return string.length * size * (weight >= 700 ? 0.55 : 0.5);
  let total = 0;
  for (const char of string) {
    const code = char.codePointAt(0);
    let width = font.widths.get(code);
    if (width === undefined) {
      width = font.advance(font.glyphOf(code)) / font.unitsPerEm;
      font.widths.set(code, width);
    }
    total += width;
  }
  return total * size;
}

/** Breaks a text into lines no wider than maxWidth. A word wider than the space gets a line to itself. */
export function wrapText(text, maxWidth, size, weight = 400) {
  const out = [];
  for (const paragraph of String(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const trial = line ? `${line} ${word}` : word;
      if (line && measure(trial, size, weight) > maxWidth) {
        out.push(line);
        line = word;
      } else {
        line = trial;
      }
    }
    out.push(line);
  }
  return out;
}
