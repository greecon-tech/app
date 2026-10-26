// Turns an installed Type 1 font (a .pfb and its .afm) into an OpenType/CFF font that a browser can use.
//
// Why this exists: Bitstream Charter is installed on the build machine only as Type 1 (/usr/share/fonts/X11/Type1),
// and Chromium cannot use Type 1 fonts, so without this the guides' body text would silently fall back to some other
// serif. The conversion happens in memory on every build, from the font that is installed; nothing converted is kept
// in the repository.
//
// What it does: reads the PFB, decrypts it (eexec, then each charstring), runs the Type 1 charstrings (including
// flex, hint replacement and seac accents) into plain outlines, writes them as Type 2 charstrings in a CFF table, and
// wraps that in the OpenType tables a browser needs (head, hhea, hmtx, maxp, OS/2, name, cmap, post and, from the
// AFM, GPOS kerning). Hints are dropped: the guides are printed, not shown at small screen sizes, so the outlines alone are
// what matters.
//
// It is deliberately small and only as general as the four Charter files need. It throws, rather than guessing,
// when it meets something it does not understand.

import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------------------------------------------

const STANDARD_ENCODING = (() => {
  const names = new Map();
  const ascii =
    "space exclam quotedbl numbersign dollar percent ampersand quoteright parenleft parenright asterisk plus comma hyphen period slash " +
    "zero one two three four five six seven eight nine colon semicolon less equal greater question at " +
    "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z bracketleft backslash bracketright asciicircum underscore quoteleft " +
    "a b c d e f g h i j k l m n o p q r s t u v w x y z braceleft bar braceright asciitilde";
  ascii.split(" ").forEach((name, index) => names.set(32 + index, name));
  const high = {
    161: "exclamdown", 162: "cent", 163: "sterling", 164: "fraction", 165: "yen", 166: "florin", 167: "section", 168: "currency",
    169: "quotesingle", 170: "quotedblleft", 171: "guillemotleft", 172: "guilsinglleft", 173: "guilsinglright", 174: "fi", 175: "fl",
    177: "endash", 178: "dagger", 179: "daggerdbl", 180: "periodcentered", 182: "paragraph", 183: "bullet", 184: "quotesinglbase",
    185: "quotedblbase", 186: "quotedblright", 187: "guillemotright", 188: "ellipsis", 189: "perthousand", 191: "questiondown",
    193: "grave", 194: "acute", 195: "circumflex", 196: "tilde", 197: "macron", 198: "breve", 199: "dotaccent", 200: "dieresis",
    202: "ring", 203: "cedilla", 205: "hungarumlaut", 206: "ogonek", 207: "caron", 208: "emdash", 225: "AE", 227: "ordfeminine",
    232: "Lslash", 233: "Oslash", 234: "OE", 235: "ordmasculine", 241: "ae", 245: "dotlessi", 248: "lslash", 249: "oslash", 250: "oe",
    251: "germandbls"
  };
  for (const [code, name] of Object.entries(high)) names.set(Number(code), name);
  return names;
})();

/** Glyph name to Unicode, for the names a Latin text font uses. */
const UNICODE_OF = (() => {
  const map = new Map();
  const ascii =
    "space exclam quotedbl numbersign dollar percent ampersand quotesingle parenleft parenright asterisk plus comma hyphen period slash " +
    "zero one two three four five six seven eight nine colon semicolon less equal greater question at " +
    "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z bracketleft backslash bracketright asciicircum underscore grave " +
    "a b c d e f g h i j k l m n o p q r s t u v w x y z braceleft bar braceright asciitilde";
  ascii.split(" ").forEach((name, index) => map.set(name, 0x20 + index));
  const latin1 =
    "space exclamdown cent sterling currency yen brokenbar section dieresis copyright ordfeminine guillemotleft logicalnot hyphen registered macron " +
    "degree plusminus twosuperior threesuperior acute mu paragraph periodcentered cedilla onesuperior ordmasculine guillemotright onequarter onehalf threequarters questiondown " +
    "Agrave Aacute Acircumflex Atilde Adieresis Aring AE Ccedilla Egrave Eacute Ecircumflex Edieresis Igrave Iacute Icircumflex Idieresis " +
    "Eth Ntilde Ograve Oacute Ocircumflex Otilde Odieresis multiply Oslash Ugrave Uacute Ucircumflex Udieresis Yacute Thorn germandbls " +
    "agrave aacute acircumflex atilde adieresis aring ae ccedilla egrave eacute ecircumflex edieresis igrave iacute icircumflex idieresis " +
    "eth ntilde ograve oacute ocircumflex otilde odieresis divide oslash ugrave uacute ucircumflex udieresis yacute thorn ydieresis";
  latin1.split(" ").forEach((name, index) => {
    if (index === 0 || name === "hyphen") return; // a space and a hyphen are already mapped above
    map.set(name, 0xa0 + index);
  });
  const other = {
    dotlessi: 0x131, Lslash: 0x141, lslash: 0x142, OE: 0x152, oe: 0x153, Scaron: 0x160, scaron: 0x161, Ydieresis: 0x178, Zcaron: 0x17d, zcaron: 0x17e,
    florin: 0x192, circumflex: 0x2c6, caron: 0x2c7, breve: 0x2d8, dotaccent: 0x2d9, ring: 0x2da, ogonek: 0x2db, tilde: 0x2dc, hungarumlaut: 0x2dd,
    endash: 0x2013, emdash: 0x2014, quoteleft: 0x2018, quoteright: 0x2019, quotesinglbase: 0x201a, quotedblleft: 0x201c, quotedblright: 0x201d,
    quotedblbase: 0x201e, dagger: 0x2020, daggerdbl: 0x2021, bullet: 0x2022, ellipsis: 0x2026, perthousand: 0x2030, guilsinglleft: 0x2039,
    guilsinglright: 0x203a, fraction: 0x2044, trademark: 0x2122, Euro: 0x20ac, minus: 0x2212, fi: 0xfb01, fl: 0xfb02
  };
  for (const [name, code] of Object.entries(other)) map.set(name, code);
  return map;
})();

// ---------------------------------------------------------------------------------------------------------------
// Reading the Type 1 font
// ---------------------------------------------------------------------------------------------------------------

function readPfb(buffer) {
  const clear = [];
  const binary = [];
  let position = 0;
  while (position < buffer.length) {
    if (buffer[position] !== 0x80) throw new Error("Not a PFB file: a segment marker is missing.");
    const kind = buffer[position + 1];
    if (kind === 3) break;
    const length = buffer.readUInt32LE(position + 2);
    const body = buffer.subarray(position + 6, position + 6 + length);
    if (kind === 1) clear.push(body);
    else if (kind === 2) binary.push(body);
    else throw new Error(`Unknown PFB segment type ${kind}.`);
    position += 6 + length;
  }
  return { clear: Buffer.concat(clear), encrypted: Buffer.concat(binary) };
}

function decrypt(bytes, key, skip) {
  const out = Buffer.alloc(bytes.length);
  let r = key;
  for (let index = 0; index < bytes.length; index += 1) {
    const cipher = bytes[index];
    out[index] = cipher ^ (r >> 8);
    r = ((cipher + r) * 52845 + 22719) & 0xffff;
  }
  return out.subarray(skip);
}

function readType1(buffer) {
  const { clear, encrypted } = readPfb(buffer);
  const head = clear.toString("latin1");
  const text = (key) => head.match(new RegExp(`/${key}\\s*\\(([^)]*)\\)`))?.[1];
  const number = (key, fallback) => {
    const match = head.match(new RegExp(`/${key}\\s+(-?[\\d.]+)`));
    return match ? Number(match[1]) : fallback;
  };
  const bbox = head.match(/\/FontBBox\s*\{\s*(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/);
  const matrix = head.match(/\/FontMatrix\s*\[\s*([\d.]+)/);
  if (matrix && Math.abs(Number(matrix[1]) - 0.001) > 1e-9) throw new Error("Only fonts with 1000 units to the em are handled.");

  const priv = decrypt(encrypted, 55665, 4);
  const privText = priv.toString("latin1");
  const lenIV = Number(privText.match(/\/lenIV\s+(\d+)/)?.[1] ?? 4);
  const unlock = (bytes) => decrypt(bytes, 4330, lenIV);

  const subrs = [];
  const subrsAt = privText.indexOf("/Subrs");
  const charStringsAt = privText.indexOf("/CharStrings");
  if (subrsAt < 0 || charStringsAt < 0) throw new Error("The font has no Subrs or CharStrings.");
  const subrPattern = /dup\s+(\d+)\s+(\d+)\s+(?:RD|-\|) /g;
  subrPattern.lastIndex = subrsAt;
  for (let match = subrPattern.exec(privText); match && match.index < charStringsAt; match = subrPattern.exec(privText)) {
    const start = match.index + match[0].length;
    const length = Number(match[2]);
    subrs[Number(match[1])] = unlock(priv.subarray(start, start + length));
    subrPattern.lastIndex = start + length;
  }

  const glyphs = new Map();
  const order = [];
  const glyphPattern = /\/(\S+)\s+(\d+)\s+(?:RD|-\|) /g;
  glyphPattern.lastIndex = charStringsAt + "/CharStrings".length;
  for (let match = glyphPattern.exec(privText); match; match = glyphPattern.exec(privText)) {
    const start = match.index + match[0].length;
    const length = Number(match[2]);
    glyphs.set(match[1], unlock(priv.subarray(start, start + length)));
    order.push(match[1]);
    glyphPattern.lastIndex = start + length;
  }
  if (glyphs.size === 0) throw new Error("No glyphs were found.");

  return {
    fontName: head.match(/\/FontName\s+\/(\S+)/)?.[1] ?? "Unnamed",
    fullName: text("FullName") ?? "Unnamed",
    familyName: text("FamilyName") ?? "Unnamed",
    notice: text("Notice") ?? "",
    version: text("version") ?? "1.0",
    weightName: text("Weight") ?? "Regular",
    italicAngle: number("ItalicAngle", 0),
    underlinePosition: number("UnderlinePosition", -100),
    underlineThickness: number("UnderlineThickness", 50),
    bbox: bbox ? bbox.slice(1, 5).map(Number) : [0, -250, 1000, 900],
    subrs,
    glyphs,
    order
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Running Type 1 charstrings into outlines
// ---------------------------------------------------------------------------------------------------------------

/** One glyph as plain outlines: contours of absolute points, in font units. */
function drawGlyph(font, name, depth = 0) {
  if (depth > 2) throw new Error(`Accents nested too deeply in ${name}.`);
  const state = {
    stack: [],
    postScript: [],
    x: 0,
    y: 0,
    sbx: 0,
    width: 0,
    contours: [],
    flex: null,
    seac: null,
    done: false
  };

  const moveTo = (x, y) => {
    state.x = x;
    state.y = y;
    if (state.flex) return;
    state.contours.push([{ x, y, move: true }]);
  };
  const ensureContour = () => {
    if (state.contours.length === 0) state.contours.push([{ x: state.x, y: state.y, move: true }]);
  };
  const lineTo = (x, y) => {
    ensureContour();
    state.contours[state.contours.length - 1].push({ x, y, line: true });
    state.x = x;
    state.y = y;
  };
  const curveTo = (x1, y1, x2, y2, x3, y3) => {
    ensureContour();
    state.contours[state.contours.length - 1].push({ c: [x1, y1, x2, y2, x3, y3] });
    state.x = x3;
    state.y = y3;
  };

  const run = (bytes, level) => {
    if (level > 10) throw new Error(`Subroutines nested too deeply in ${name}.`);
    let at = 0;
    const stack = state.stack;
    while (at < bytes.length && !state.done) {
      const b0 = bytes[at];
      at += 1;
      if (b0 >= 32) {
        if (b0 <= 246) stack.push(b0 - 139);
        else if (b0 <= 250) stack.push((b0 - 247) * 256 + bytes[at++] + 108);
        else if (b0 <= 254) stack.push(-(b0 - 251) * 256 - bytes[at++] - 108);
        else {
          stack.push(bytes.readInt32BE(at));
          at += 4;
        }
        continue;
      }
      switch (b0) {
        case 1: // hstem
        case 3: // vstem
          stack.length = 0;
          break;
        case 4: // vmoveto
          moveTo(state.x, state.y + stack[0]);
          stack.length = 0;
          break;
        case 5: // rlineto
          lineTo(state.x + stack[0], state.y + stack[1]);
          stack.length = 0;
          break;
        case 6: // hlineto
          lineTo(state.x + stack[0], state.y);
          stack.length = 0;
          break;
        case 7: // vlineto
          lineTo(state.x, state.y + stack[0]);
          stack.length = 0;
          break;
        case 8: {
          // rrcurveto
          const [dx1, dy1, dx2, dy2, dx3, dy3] = stack;
          const x1 = state.x + dx1, y1 = state.y + dy1, x2 = x1 + dx2, y2 = y1 + dy2;
          curveTo(x1, y1, x2, y2, x2 + dx3, y2 + dy3);
          stack.length = 0;
          break;
        }
        case 9: // closepath: contours are closed implicitly when written
          stack.length = 0;
          break;
        case 10: {
          // callsubr
          const subr = font.subrs[stack.pop()];
          if (!subr) throw new Error(`${name} calls a subroutine that is not there.`);
          run(subr, level + 1);
          break;
        }
        case 11: // return
          return;
        case 13: // hsbw
          state.sbx = stack[0];
          state.width = stack[1];
          state.x = stack[0];
          state.y = 0;
          stack.length = 0;
          break;
        case 14: // endchar
          state.done = true;
          break;
        case 21: // rmoveto
          moveTo(state.x + stack[0], state.y + stack[1]);
          stack.length = 0;
          break;
        case 22: // hmoveto
          moveTo(state.x + stack[0], state.y);
          stack.length = 0;
          break;
        case 30: {
          // vhcurveto
          const [dy1, dx2, dy2, dx3] = stack;
          const x1 = state.x, y1 = state.y + dy1, x2 = x1 + dx2, y2 = y1 + dy2;
          curveTo(x1, y1, x2, y2, x2 + dx3, y2);
          stack.length = 0;
          break;
        }
        case 31: {
          // hvcurveto
          const [dx1, dx2, dy2, dy3] = stack;
          const x1 = state.x + dx1, y1 = state.y, x2 = x1 + dx2, y2 = y1 + dy2;
          curveTo(x1, y1, x2, y2, x2, y2 + dy3);
          stack.length = 0;
          break;
        }
        case 12: {
          const b1 = bytes[at];
          at += 1;
          switch (b1) {
            case 0: // dotsection
            case 1: // vstem3
            case 2: // hstem3
              stack.length = 0;
              break;
            case 6: {
              // seac: asb adx ady bchar achar
              const [asb, adx, ady, bchar, achar] = stack;
              state.seac = { asb, adx, ady, bchar, achar };
              state.done = true;
              stack.length = 0;
              break;
            }
            case 7: // sbw
              state.sbx = stack[0];
              state.width = stack[2];
              state.x = stack[0];
              state.y = stack[1];
              stack.length = 0;
              break;
            case 12: {
              // div
              const divisor = stack.pop();
              stack.push(stack.pop() / divisor);
              break;
            }
            case 16: {
              // callothersubr: arg1 ... argn n othersubr#
              const which = stack.pop();
              const count = stack.pop();
              const args = [];
              for (let index = 0; index < count; index += 1) args.push(stack.pop());
              if (which === 1) {
                state.flex = [];
              } else if (which === 2) {
                if (!state.flex) throw new Error(`${name} adds a flex point outside a flex.`);
                state.flex.push({ x: state.x, y: state.y });
              } else if (which === 0) {
                const points = state.flex;
                state.flex = null;
                if (!points || points.length !== 7) throw new Error(`${name} has a flex without seven points.`);
                curveTo(points[1].x, points[1].y, points[2].x, points[2].y, points[3].x, points[3].y);
                curveTo(points[4].x, points[4].y, points[5].x, points[5].y, points[6].x, points[6].y);
                // args are [y, x, flex height] as popped; the two pops that follow give back x then y
                state.postScript.push(args[0], args[1]);
              } else if (which === 3) {
                state.postScript.push(args[0]);
              } else {
                for (const value of args.reverse()) state.postScript.push(value);
              }
              break;
            }
            case 17: // pop
              stack.push(state.postScript.pop() ?? 0);
              break;
            case 33: // setcurrentpoint
              state.x = stack[0];
              state.y = stack[1];
              stack.length = 0;
              break;
            default:
              throw new Error(`${name} uses an operator (12 ${b1}) that is not handled.`);
          }
          break;
        }
        default:
          throw new Error(`${name} uses an operator (${b0}) that is not handled.`);
      }
    }
  };

  run(font.glyphs.get(name), 0);

  let contours = state.contours;
  if (state.seac) {
    const { asb, adx, ady, bchar, achar } = state.seac;
    const baseName = STANDARD_ENCODING.get(bchar);
    const accentName = STANDARD_ENCODING.get(achar);
    if (!baseName || !font.glyphs.has(baseName) || !accentName || !font.glyphs.has(accentName)) throw new Error(`${name} is built from glyphs the font does not have.`);
    const base = drawGlyph(font, baseName, depth + 1);
    const accent = drawGlyph(font, accentName, depth + 1);
    const dx = state.sbx + adx - asb;
    const dy = ady;
    contours = [...base.contours, ...accent.contours.map((contour) => contour.map((point) => shift(point, dx, dy)))];
  }
  return { name, width: state.width, contours };
}

function shift(point, dx, dy) {
  if (point.c) return { c: point.c.map((value, index) => value + (index % 2 === 0 ? dx : dy)) };
  return { ...point, x: point.x + dx, y: point.y + dy };
}

function boundsOf(contours) {
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  const see = (x, y) => {
    xMin = Math.min(xMin, x);
    xMax = Math.max(xMax, x);
    yMin = Math.min(yMin, y);
    yMax = Math.max(yMax, y);
  };
  for (const contour of contours) {
    for (const point of contour) {
      if (point.c) for (let index = 0; index < 6; index += 2) see(point.c[index], point.c[index + 1]);
      else see(point.x, point.y);
    }
  }
  return xMin === Infinity ? { xMin: 0, yMin: 0, xMax: 0, yMax: 0 } : { xMin, yMin, xMax, yMax };
}

// ---------------------------------------------------------------------------------------------------------------
// Writing the font
// ---------------------------------------------------------------------------------------------------------------

class Bytes {
  constructor() {
    this.parts = [];
    this.length = 0;
  }
  push(...values) {
    const chunk = Buffer.from(values);
    this.parts.push(chunk);
    this.length += chunk.length;
    return this;
  }
  add(buffer) {
    this.parts.push(buffer);
    this.length += buffer.length;
    return this;
  }
  u16(value) {
    return this.push((value >> 8) & 0xff, value & 0xff);
  }
  u32(value) {
    return this.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
  }
  i16(value) {
    return this.u16(value & 0xffff);
  }
  buffer() {
    return Buffer.concat(this.parts);
  }
}

/** A number as a Type 2 charstring operand. */
function type2Number(value) {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) > 1e-6) {
    const fixed = Math.round(value * 65536);
    return Buffer.from([255, (fixed >> 24) & 0xff, (fixed >> 16) & 0xff, (fixed >> 8) & 0xff, fixed & 0xff]);
  }
  if (rounded >= -107 && rounded <= 107) return Buffer.from([rounded + 139]);
  if (rounded >= 108 && rounded <= 1131) return Buffer.from([247 + ((rounded - 108) >> 8), (rounded - 108) & 0xff]);
  if (rounded >= -1131 && rounded <= -108) return Buffer.from([251 + ((-rounded - 108) >> 8), (-rounded - 108) & 0xff]);
  if (rounded >= -32768 && rounded <= 32767) return Buffer.from([28, (rounded >> 8) & 0xff, rounded & 0xff]);
  throw new Error(`The number ${value} is too large for a charstring.`);
}

function type2CharString(glyph) {
  const out = new Bytes();
  let x = 0;
  let y = 0;
  let first = true;
  const emit = (numbers, operator) => {
    for (const number of numbers) out.add(type2Number(number));
    out.push(...operator);
  };
  for (const contour of glyph.contours) {
    const start = contour[0];
    const numbers = first ? [glyph.width] : [];
    first = false;
    emit([...numbers, start.x - x, start.y - y], [21]);
    x = start.x;
    y = start.y;
    let lines = [];
    let curves = [];
    const flushLines = () => {
      for (let index = 0; index < lines.length; index += 48) emit(lines.slice(index, index + 48), [5]);
      lines = [];
    };
    const flushCurves = () => {
      for (let index = 0; index < curves.length; index += 48) emit(curves.slice(index, index + 48), [8]);
      curves = [];
    };
    for (const point of contour.slice(1)) {
      if (point.c) {
        flushLines();
        const [x1, y1, x2, y2, x3, y3] = point.c;
        curves.push(x1 - x, y1 - y, x2 - x1, y2 - y1, x3 - x2, y3 - y2);
        x = x3;
        y = y3;
      } else {
        flushCurves();
        lines.push(point.x - x, point.y - y);
        x = point.x;
        y = point.y;
      }
    }
    flushLines();
    flushCurves();
  }
  if (first) out.add(type2Number(glyph.width));
  out.push(14); // endchar
  return out.buffer();
}

function cffIndex(items) {
  if (items.length === 0) return Buffer.from([0, 0]);
  const out = new Bytes();
  out.u16(items.length);
  out.push(4);
  let offset = 1;
  out.u32(offset);
  for (const item of items) {
    offset += item.length;
    out.u32(offset);
  }
  for (const item of items) out.add(item);
  return out.buffer();
}

/** A DICT operand written with a fixed size when it may need patching (offsets), compactly otherwise. */
function dictInt(value, fixed = false) {
  if (fixed) return Buffer.from([29, (value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]);
  if (value >= -107 && value <= 107) return Buffer.from([value + 139]);
  if (value >= 108 && value <= 1131) return Buffer.from([247 + ((value - 108) >> 8), (value - 108) & 0xff]);
  if (value >= -1131 && value <= -108) return Buffer.from([251 + ((-value - 108) >> 8), (-value - 108) & 0xff]);
  return Buffer.from([28, (value >> 8) & 0xff, value & 0xff]);
}

function buildCff({ font, glyphs }) {
  const header = Buffer.from([1, 0, 4, 4]);
  const nameIndex = cffIndex([Buffer.from(font.fontName, "latin1")]);

  // Every string is custom, even those that duplicate a standard one: it is valid and keeps this small.
  const strings = [font.version, font.fullName, font.familyName, font.weightName, ...glyphs.slice(1).map((glyph) => glyph.name)];
  const sid = (index) => 391 + index;
  const stringIndex = cffIndex(strings.map((text) => Buffer.from(text, "latin1")));
  const subrIndex = cffIndex([]);

  const charset = new Bytes();
  charset.push(0);
  glyphs.slice(1).forEach((_, index) => charset.u16(sid(4 + index)));
  const charsetData = charset.buffer();

  const charStrings = cffIndex(glyphs.map(type2CharString));

  const privateData = Buffer.concat([dictInt(0), Buffer.from([20]), dictInt(0), Buffer.from([21])]);

  const topDict = (offsets) =>
    Buffer.concat([
      dictInt(sid(0)), Buffer.from([0]), // version
      dictInt(sid(1)), Buffer.from([2]), // FullName
      dictInt(sid(2)), Buffer.from([3]), // FamilyName
      dictInt(sid(3)), Buffer.from([4]), // Weight
      ...font.bbox.map((value) => dictInt(value)), Buffer.from([5]), // FontBBox
      dictInt(offsets.charset, true), Buffer.from([15]),
      dictInt(offsets.charStrings, true), Buffer.from([17]),
      dictInt(privateData.length, true), dictInt(offsets.private, true), Buffer.from([18])
    ]);

  const sizeOfTop = cffIndex([topDict({ charset: 0, charStrings: 0, private: 0 })]).length;
  let cursor = header.length + nameIndex.length + sizeOfTop + stringIndex.length + subrIndex.length;
  const offsets = { charset: cursor };
  cursor += charsetData.length;
  offsets.charStrings = cursor;
  cursor += charStrings.length;
  offsets.private = cursor;
  const topIndex = cffIndex([topDict(offsets)]);

  return Buffer.concat([header, nameIndex, topIndex, stringIndex, subrIndex, charsetData, charStrings, privateData]);
}

function utf16(text) {
  const out = Buffer.alloc(text.length * 2);
  for (let index = 0; index < text.length; index += 1) out.writeUInt16BE(text.charCodeAt(index), index * 2);
  return out;
}

function buildName(records) {
  // [nameId, text], written for the Windows platform (3, 1, English US)
  const sorted = [...records].sort((a, b) => a[0] - b[0]);
  const strings = sorted.map(([, text]) => utf16(text));
  const out = new Bytes();
  out.u16(0).u16(sorted.length).u16(6 + sorted.length * 12);
  let offset = 0;
  sorted.forEach(([id], index) => {
    out.u16(3).u16(1).u16(0x409).u16(id).u16(strings[index].length).u16(offset);
    offset += strings[index].length;
  });
  for (const text of strings) out.add(text);
  return out.buffer();
}

function buildCmap(pairs) {
  // pairs: [[unicode, glyphId]] sorted by unicode, BMP only. One segment per character keeps it simple and valid.
  const segments = pairs.map(([code, glyph]) => ({ start: code, end: code, delta: (glyph - code) & 0xffff }));
  segments.push({ start: 0xffff, end: 0xffff, delta: 1 });
  const segCount = segments.length;
  let power = 1;
  let log = 0;
  while (power * 2 <= segCount) {
    power *= 2;
    log += 1;
  }
  const table = new Bytes();
  table.u16(4).u16(16 + segCount * 8).u16(0).u16(segCount * 2).u16(power * 2).u16(log).u16(segCount * 2 - power * 2);
  for (const segment of segments) table.u16(segment.end);
  table.u16(0);
  for (const segment of segments) table.u16(segment.start);
  for (const segment of segments) table.u16(segment.delta);
  for (let index = 0; index < segCount; index += 1) table.u16(0);
  const subtable = table.buffer();
  const out = new Bytes();
  out.u16(0).u16(2);
  out.u16(0).u16(3).u32(20); // Unicode platform, BMP
  out.u16(3).u16(1).u32(20); // Windows, Unicode BMP
  out.add(subtable);
  return out.buffer();
}

function parseAfm(text) {
  const kerning = [];
  let ascender = 0;
  let descender = 0;
  let capHeight = 0;
  let xHeight = 0;
  for (const line of text.split(/\r?\n/)) {
    let match;
    if ((match = line.match(/^KPX\s+(\S+)\s+(\S+)\s+(-?\d+)/))) kerning.push([match[1], match[2], Number(match[3])]);
    else if ((match = line.match(/^Ascender\s+(-?\d+)/))) ascender = Number(match[1]);
    else if ((match = line.match(/^Descender\s+(-?\d+)/))) descender = Number(match[1]);
    else if ((match = line.match(/^CapHeight\s+(-?\d+)/))) capHeight = Number(match[1]);
    else if ((match = line.match(/^XHeight\s+(-?\d+)/))) xHeight = Number(match[1]);
  }
  return { kerning, ascender, descender, capHeight, xHeight };
}

/** Kerning as an OpenType GPOS 'kern' feature (one pair-adjustment lookup, format 1). Browsers ignore the old kern table. */
function buildGpos(pairs) {
  const byLeft = new Map();
  for (const [left, right, value] of pairs) {
    if (!byLeft.has(left)) byLeft.set(left, new Map());
    byLeft.get(left).set(right, value);
  }
  const lefts = [...byLeft.keys()].sort((a, b) => a - b);

  const coverage = new Bytes();
  coverage.u16(1).u16(lefts.length);
  for (const left of lefts) coverage.u16(left);
  const coverageData = coverage.buffer();

  const pairSets = lefts.map((left) => {
    const rights = [...byLeft.get(left).entries()].sort((a, b) => a[0] - b[0]);
    const set = new Bytes();
    set.u16(rights.length);
    for (const [right, value] of rights) set.u16(right).i16(value);
    return set.buffer();
  });

  // PairPos format 1: format, coverage offset, value formats, then the pair set offsets
  const pairPosHeader = 10 + pairSets.length * 2;
  const pairPos = new Bytes();
  pairPos.u16(1).u16(pairPosHeader).u16(0x0004).u16(0).u16(pairSets.length);
  let offset = pairPosHeader + coverageData.length;
  for (const set of pairSets) {
    pairPos.u16(offset);
    offset += set.length;
  }
  pairPos.add(coverageData);
  for (const set of pairSets) pairPos.add(set);
  const pairPosData = pairPos.buffer();

  // Lookup: type 2, flags 0, one subtable
  const lookup = new Bytes();
  lookup.u16(2).u16(0).u16(1).u16(8);
  lookup.add(pairPosData);
  const lookupData = lookup.buffer();

  const lookupList = new Bytes();
  lookupList.u16(1).u16(4);
  lookupList.add(lookupData);
  const lookupListData = lookupList.buffer();

  // Feature 'kern' using lookup 0
  const feature = new Bytes();
  feature.u16(0).u16(1).u16(0);
  const featureData = feature.buffer();
  const featureList = new Bytes();
  featureList.u16(1).add(Buffer.from("kern", "latin1")).u16(8);
  featureList.add(featureData);
  const featureListData = featureList.buffer();

  // Scripts DFLT and latn share one Script table with a default language system using feature 0
  const langSys = new Bytes();
  langSys.u16(0).u16(0xffff).u16(1).u16(0);
  const langSysData = langSys.buffer();
  const script = new Bytes();
  script.u16(4).u16(0);
  script.add(langSysData);
  const scriptData = script.buffer();
  const scriptList = new Bytes();
  scriptList.u16(2);
  scriptList.add(Buffer.from("DFLT", "latin1")).u16(14);
  scriptList.add(Buffer.from("latn", "latin1")).u16(14);
  scriptList.add(scriptData);
  const scriptListData = scriptList.buffer();

  const header = new Bytes();
  header.u16(1).u16(0).u16(10).u16(10 + scriptListData.length).u16(10 + scriptListData.length + featureListData.length);
  return Buffer.concat([header.buffer(), scriptListData, featureListData, lookupListData]);
}

function checksum(buffer) {
  let sum = 0;
  const padded = Buffer.concat([buffer, Buffer.alloc((4 - (buffer.length % 4)) % 4)]);
  for (let index = 0; index < padded.length; index += 4) sum = (sum + padded.readUInt32BE(index)) >>> 0;
  return sum;
}

function assemble(tables) {
  const tags = Object.keys(tables).sort();
  const count = tags.length;
  let power = 1;
  let log = 0;
  while (power * 2 <= count) {
    power *= 2;
    log += 1;
  }
  const header = new Bytes();
  header.add(Buffer.from("OTTO", "latin1")).u16(count).u16(power * 16).u16(log).u16(count * 16 - power * 16);
  let offset = 12 + count * 16;
  const body = [];
  const entries = [];
  for (const tag of tags) {
    const data = tables[tag];
    entries.push({ tag, offset, length: data.length, sum: checksum(data) });
    const padded = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)]);
    body.push(padded);
    offset += padded.length;
  }
  for (const entry of entries) header.add(Buffer.from(entry.tag, "latin1")).u32(entry.sum).u32(entry.offset).u32(entry.length);
  const whole = Buffer.concat([header.buffer(), ...body]);
  const adjustment = (0xb1b0afba - checksum(whole)) >>> 0;
  const headEntry = entries.find((entry) => entry.tag === "head");
  whole.writeUInt32BE(adjustment, headEntry.offset + 8);
  return whole;
}

/**
 * @param {{ pfbPath: string, afmPath?: string, familyName: string, styleName: string, weight: number, bold: boolean, italic: boolean }} options
 * @returns {{ otf: Buffer, glyphCount: number, unmapped: string[], kernPairs: number }}
 */
export function convertType1ToOtf({ pfbPath, afmPath, familyName, styleName, weight, bold, italic }) {
  const font = readType1(readFileSync(pfbPath));
  const afm = afmPath ? parseAfm(readFileSync(afmPath, "latin1")) : { kerning: [], ascender: 0, descender: 0, capHeight: 0, xHeight: 0 };

  const names = font.order.includes(".notdef") ? [".notdef", ...font.order.filter((name) => name !== ".notdef")] : [".notdef", ...font.order];
  // A font without a .notdef gets an empty one (0 500 hsbw endchar).
  if (!font.glyphs.has(".notdef")) font.glyphs.set(".notdef", Buffer.from([139, 248, 136, 13, 14]));
  const glyphs = names.map((name) => drawGlyph(font, name));
  const bounds = glyphs.map((glyph) => boundsOf(glyph.contours));

  // Unicode map
  const unmapped = [];
  const codeToGlyph = new Map();
  glyphs.forEach((glyph, id) => {
    if (id === 0) return;
    let code = UNICODE_OF.get(glyph.name);
    if (code === undefined) {
      const uni = glyph.name.match(/^uni([0-9A-F]{4})$/);
      if (uni) code = parseInt(uni[1], 16);
    }
    if (code === undefined) unmapped.push(glyph.name);
    else if (!codeToGlyph.has(code)) codeToGlyph.set(code, id);
  });
  const space = codeToGlyph.get(0x20);
  if (space !== undefined) codeToGlyph.set(0xa0, space);
  const hyphen = codeToGlyph.get(0x2d);
  if (hyphen !== undefined) codeToGlyph.set(0xad, hyphen);
  const pairs = [...codeToGlyph.entries()].sort((a, b) => a[0] - b[0]);

  const glyphId = new Map(glyphs.map((glyph, id) => [glyph.name, id]));
  const kern = afm.kerning
    .map(([left, right, value]) => [glyphId.get(left), glyphId.get(right), value])
    .filter(([left, right]) => left !== undefined && right !== undefined);

  const [bboxXMin, bboxYMin, bboxXMax, bboxYMax] = font.bbox;
  const ascender = afm.ascender || bboxYMax;
  const descender = afm.descender || bboxYMin;
  const widths = glyphs.map((glyph) => glyph.width);
  const average = Math.round(widths.reduce((sum, value) => sum + value, 0) / widths.length);

  const head = new Bytes();
  head.u32(0x00010000).u32(0x00010000).u32(0).u32(0x5f0f3cf5).u16(0x000b).u16(1000);
  head.u32(0).u32(0).u32(0).u32(0); // created and modified: fixed, so the same input gives the same font
  head.i16(bboxXMin).i16(bboxYMin).i16(bboxXMax).i16(bboxYMax);
  head.u16((bold ? 1 : 0) | (italic ? 2 : 0)).u16(8).i16(2).i16(0).i16(0);

  const hhea = new Bytes();
  hhea.u32(0x00010000).i16(ascender).i16(descender).i16(0).u16(Math.max(...widths));
  hhea.i16(Math.min(...bounds.map((box) => box.xMin))).i16(0).i16(Math.max(...bounds.map((box) => box.xMax)));
  hhea.i16(1).i16(0).i16(0);
  hhea.u32(0).u32(0).i16(0).u16(glyphs.length);

  const hmtx = new Bytes();
  glyphs.forEach((glyph, id) => hmtx.u16(glyph.width).i16(bounds[id].xMin));

  const maxp = new Bytes();
  maxp.u32(0x00005000).u16(glyphs.length);

  const unicodeRanges = 0x80000007; // Basic Latin, Latin-1, Latin Extended-A, General Punctuation
  const os2 = new Bytes();
  os2.u16(4).i16(average).u16(weight).u16(5).u16(0);
  os2.i16(650).i16(600).i16(0).i16(75).i16(650).i16(600).i16(0).i16(350).i16(50).i16(250).i16(0);
  os2.add(Buffer.alloc(10));
  os2.u32(unicodeRanges).u32(0).u32(0).u32(0);
  os2.add(Buffer.from("NONE", "latin1"));
  os2.u16((italic ? 1 : 0) | (bold ? 0x20 : 0) | (!bold && !italic ? 0x40 : 0));
  os2.u16(pairs[0][0]).u16(Math.min(0xffff, pairs[pairs.length - 1][0]));
  os2.i16(ascender).i16(descender).i16(0).u16(Math.max(bboxYMax, ascender)).u16(Math.abs(Math.min(bboxYMin, descender)));
  os2.u32(1).u32(0);
  os2.i16(afm.xHeight || 480).i16(afm.capHeight || 670).u16(0).u16(32).u16(kern.length > 0 ? 2 : 1);

  const full = `${familyName} ${styleName === "Regular" ? "" : styleName}`.trim();
  const name = buildName([
    [0, font.notice],
    [1, familyName],
    [2, styleName],
    [3, `${font.fontName};converted for the Greecon guides`],
    [4, full],
    [5, `Version ${font.version}`],
    [6, font.fontName]
  ]);

  const post = new Bytes();
  post.u32(0x00030000).u32(Math.round(font.italicAngle * 65536) >>> 0).i16(font.underlinePosition).i16(font.underlineThickness).u32(0).u32(0).u32(0).u32(0).u32(0);

  const tables = {
    "CFF ": buildCff({ font, glyphs }),
    "OS/2": os2.buffer(),
    cmap: buildCmap(pairs),
    head: head.buffer(),
    hhea: hhea.buffer(),
    hmtx: hmtx.buffer(),
    maxp: maxp.buffer(),
    name,
    post: post.buffer()
  };
  if (kern.length > 0) tables.GPOS = buildGpos(kern);

  return { otf: assemble(tables), glyphCount: glyphs.length, unmapped, kernPairs: kern.length };
}
