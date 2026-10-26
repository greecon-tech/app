// OpenType with PostScript outlines (a "CFF" table) to OpenType with TrueType outlines (glyf and loca), in memory.
//
// Why: Chromium writes a PDF with the fonts the page used. A font with TrueType outlines is embedded as a real font and its
// text is stored compactly. A font with PostScript outlines is embedded as "Type 3", one drawing procedure for each glyph, and
// every letter on every page is then positioned and selected one at a time: the complete guide came to 7 MB, nearly all of it
// text. Converting the outlines (the same shapes, as quadratic curves) brings it to a fraction of that.
//
// What is kept: every other table is copied as it is (the character map, the widths, the kerning and substitution tables, the
// names), because the glyph numbers do not change. What is dropped: the CFF table, and with it the hinting, which a PDF does not use.
//
// Supported: name-keyed CFF fonts (Inter, and the Charter faces made by type1-to-otf.mjs). A CID-keyed font is refused, and so is a
// glyph that uses the old accented-letter shortcut of endchar (neither occurs in these fonts).

const be16 = (buffer, at) => buffer.readUInt16BE(at);

// ---------------------------------------------------------------------------------------------------------------------------
// CFF reading
// ---------------------------------------------------------------------------------------------------------------------------

function parseIndex(buffer, offset) {
  const count = be16(buffer, offset);
  if (count === 0) return { items: [], end: offset + 2 };
  const offSize = buffer[offset + 2];
  const read = (index) => {
    let value = 0;
    for (let k = 0; k < offSize; k += 1) value = value * 256 + buffer[offset + 3 + index * offSize + k];
    return value;
  };
  const base = offset + 3 + (count + 1) * offSize - 1;
  const items = [];
  for (let index = 0; index < count; index += 1) items.push([base + read(index), base + read(index + 1)]);
  return { items, end: base + read(count) };
}

function parseDict(buffer, start, end) {
  const dict = new Map();
  let operands = [];
  let at = start;
  while (at < end) {
    const b0 = buffer[at];
    if (b0 <= 21) {
      let operator = b0;
      at += 1;
      if (b0 === 12) {
        operator = 1200 + buffer[at];
        at += 1;
      }
      dict.set(operator, operands);
      operands = [];
    } else if (b0 === 28) {
      operands.push(buffer.readInt16BE(at + 1));
      at += 3;
    } else if (b0 === 29) {
      operands.push(buffer.readInt32BE(at + 1));
      at += 5;
    } else if (b0 === 30) {
      let text = "";
      at += 1;
      let done = false;
      while (!done) {
        const byte = buffer[at];
        at += 1;
        for (const nibble of [byte >> 4, byte & 15]) {
          if (nibble === 15) {
            done = true;
            break;
          }
          text += nibble < 10 ? String(nibble) : nibble === 10 ? "." : nibble === 11 ? "E" : nibble === 12 ? "E-" : nibble === 14 ? "-" : "";
        }
      }
      operands.push(Number.parseFloat(text));
    } else if (b0 >= 32 && b0 <= 246) {
      operands.push(b0 - 139);
      at += 1;
    } else if (b0 >= 247 && b0 <= 250) {
      operands.push((b0 - 247) * 256 + buffer[at + 1] + 108);
      at += 2;
    } else if (b0 >= 251 && b0 <= 254) {
      operands.push(-(b0 - 251) * 256 - buffer[at + 1] - 108);
      at += 2;
    } else {
      throw new Error(`CFF: unexpected byte ${b0} in a dictionary`);
    }
  }
  return dict;
}

const subrBias = (count) => (count < 1240 ? 107 : count < 33900 ? 1131 : 32768);

/** Runs one Type 2 charstring and returns its contours: lists of segments ["L", x, y] and ["C", x1, y1, x2, y2, x3, y3] after a start point. */
function runCharstring(buffer, [start, end], font) {
  const contours = [];
  let current = null;
  let x = 0;
  let y = 0;
  let stems = 0;
  let widthSeen = false;
  const stack = [];

  const moveTo = (dx, dy) => {
    x += dx;
    y += dy;
    current = { start: [x, y], segments: [] };
    contours.push(current);
  };
  const lineTo = (dx, dy) => {
    x += dx;
    y += dy;
    if (!current) moveTo(0, 0);
    current.segments.push(["L", x, y]);
  };
  const curveTo = (dx1, dy1, dx2, dy2, dx3, dy3) => {
    if (!current) moveTo(0, 0);
    const x1 = x + dx1;
    const y1 = y + dy1;
    const x2 = x1 + dx2;
    const y2 = y1 + dy2;
    x = x2 + dx3;
    y = y2 + dy3;
    current.segments.push(["C", x1, y1, x2, y2, x, y]);
  };
  const takeWidth = (condition) => {
    if (!widthSeen && condition) stack.shift();
    widthSeen = true;
  };

  let finished = false;
  const run = (from, to, depth) => {
    if (depth > 10) throw new Error("CFF: subroutines nested too deeply");
    let at = from;
    while (at < to && !finished) {
      const b0 = buffer[at];
      at += 1;
      if (b0 >= 32 || b0 === 28) {
        if (b0 === 28) {
          stack.push(buffer.readInt16BE(at));
          at += 2;
        } else if (b0 <= 246) stack.push(b0 - 139);
        else if (b0 <= 250) {
          stack.push((b0 - 247) * 256 + buffer[at] + 108);
          at += 1;
        } else if (b0 <= 254) {
          stack.push(-(b0 - 251) * 256 - buffer[at] - 108);
          at += 1;
        } else {
          stack.push(buffer.readInt32BE(at) / 65536);
          at += 4;
        }
        continue;
      }
      switch (b0) {
        case 1:
        case 3:
        case 18:
        case 23:
          takeWidth(stack.length % 2 === 1);
          stems += stack.length >> 1;
          stack.length = 0;
          break;
        case 19:
        case 20:
          takeWidth(stack.length % 2 === 1);
          stems += stack.length >> 1;
          stack.length = 0;
          at += (stems + 7) >> 3;
          break;
        case 21:
          takeWidth(stack.length > 2);
          moveTo(stack[0], stack[1]);
          stack.length = 0;
          break;
        case 22:
          takeWidth(stack.length > 1);
          moveTo(stack[0], 0);
          stack.length = 0;
          break;
        case 4:
          takeWidth(stack.length > 1);
          moveTo(0, stack[0]);
          stack.length = 0;
          break;
        case 5:
          for (let i = 0; i + 1 < stack.length; i += 2) lineTo(stack[i], stack[i + 1]);
          stack.length = 0;
          break;
        case 6:
        case 7: {
          let horizontal = b0 === 6;
          for (const value of stack) {
            if (horizontal) lineTo(value, 0);
            else lineTo(0, value);
            horizontal = !horizontal;
          }
          stack.length = 0;
          break;
        }
        case 8:
          for (let i = 0; i + 5 < stack.length; i += 6) curveTo(stack[i], stack[i + 1], stack[i + 2], stack[i + 3], stack[i + 4], stack[i + 5]);
          stack.length = 0;
          break;
        case 24: {
          let i = 0;
          for (; i + 7 < stack.length; i += 6) curveTo(stack[i], stack[i + 1], stack[i + 2], stack[i + 3], stack[i + 4], stack[i + 5]);
          lineTo(stack[i], stack[i + 1]);
          stack.length = 0;
          break;
        }
        case 25: {
          let i = 0;
          for (; i + 7 < stack.length; i += 2) lineTo(stack[i], stack[i + 1]);
          curveTo(stack[i], stack[i + 1], stack[i + 2], stack[i + 3], stack[i + 4], stack[i + 5]);
          stack.length = 0;
          break;
        }
        case 26: {
          let i = 0;
          let dx1 = 0;
          if (stack.length % 4 === 1) {
            dx1 = stack[0];
            i = 1;
          }
          for (; i + 3 < stack.length; i += 4) {
            curveTo(dx1, stack[i], stack[i + 1], stack[i + 2], 0, stack[i + 3]);
            dx1 = 0;
          }
          stack.length = 0;
          break;
        }
        case 27: {
          let i = 0;
          let dy1 = 0;
          if (stack.length % 4 === 1) {
            dy1 = stack[0];
            i = 1;
          }
          for (; i + 3 < stack.length; i += 4) {
            curveTo(stack[i], dy1, stack[i + 1], stack[i + 2], stack[i + 3], 0);
            dy1 = 0;
          }
          stack.length = 0;
          break;
        }
        case 30:
        case 31: {
          let horizontal = b0 === 31;
          let i = 0;
          while (i + 3 < stack.length) {
            const last = stack.length - i === 5 ? stack[i + 4] : 0;
            if (horizontal) curveTo(stack[i], 0, stack[i + 1], stack[i + 2], last, stack[i + 3]);
            else curveTo(0, stack[i], stack[i + 1], stack[i + 2], stack[i + 3], last);
            horizontal = !horizontal;
            i += 4;
          }
          stack.length = 0;
          break;
        }
        case 10: {
          const index = stack.pop() + subrBias(font.localSubrs.length);
          const subr = font.localSubrs[index];
          if (!subr) throw new Error("CFF: a local subroutine is missing");
          run(subr[0], subr[1], depth + 1);
          break;
        }
        case 29: {
          const index = stack.pop() + subrBias(font.globalSubrs.length);
          const subr = font.globalSubrs[index];
          if (!subr) throw new Error("CFF: a global subroutine is missing");
          run(subr[0], subr[1], depth + 1);
          break;
        }
        case 11:
          return;
        case 14:
          takeWidth(stack.length === 1 || stack.length === 5);
          if (stack.length >= 4) throw new Error("CFF: an accented-letter shortcut (seac) is not supported");
          finished = true;
          return;
        case 12: {
          const second = buffer[at];
          at += 1;
          switch (second) {
            case 34: {
              // hflex
              const [dx1, dx2, dy2, dx3, dx4, dx5, dx6] = stack;
              curveTo(dx1, 0, dx2, dy2, dx3, 0);
              curveTo(dx4, 0, dx5, -dy2, dx6, 0);
              stack.length = 0;
              break;
            }
            case 35: {
              // flex
              curveTo(stack[0], stack[1], stack[2], stack[3], stack[4], stack[5]);
              curveTo(stack[6], stack[7], stack[8], stack[9], stack[10], stack[11]);
              stack.length = 0;
              break;
            }
            case 36: {
              // hflex1
              const [dx1, dy1, dx2, dy2, dx3, dx4, dx5, dy5, dx6] = stack;
              curveTo(dx1, dy1, dx2, dy2, dx3, 0);
              curveTo(dx4, 0, dx5, dy5, dx6, -(dy1 + dy2 + dy5));
              stack.length = 0;
              break;
            }
            case 37: {
              // flex1
              const [dx1, dy1, dx2, dy2, dx3, dy3, dx4, dy4, dx5, dy5, d6] = stack;
              const sumX = dx1 + dx2 + dx3 + dx4 + dx5;
              const sumY = dy1 + dy2 + dy3 + dy4 + dy5;
              curveTo(dx1, dy1, dx2, dy2, dx3, dy3);
              if (Math.abs(sumX) > Math.abs(sumY)) curveTo(dx4, dy4, dx5, dy5, d6, -sumY);
              else curveTo(dx4, dy4, dx5, dy5, -sumX, d6);
              stack.length = 0;
              break;
            }
            case 9:
              stack.push(Math.abs(stack.pop()));
              break;
            case 10: {
              const b = stack.pop();
              stack.push(stack.pop() + b);
              break;
            }
            case 11: {
              const b = stack.pop();
              stack.push(stack.pop() - b);
              break;
            }
            case 12: {
              const b = stack.pop();
              stack.push(stack.pop() / b);
              break;
            }
            case 14:
              stack.push(-stack.pop());
              break;
            case 18:
              stack.pop();
              break;
            case 24: {
              const b = stack.pop();
              stack.push(stack.pop() * b);
              break;
            }
            case 27:
              stack.push(stack[stack.length - 1]);
              break;
            case 28: {
              const b = stack.pop();
              const a = stack.pop();
              stack.push(b, a);
              break;
            }
            default:
              throw new Error(`CFF: charstring operator 12 ${second} is not supported`);
          }
          break;
        }
        default:
          throw new Error(`CFF: charstring operator ${b0} is not supported`);
      }
    }
  };
  run(start, end, 0);
  return contours;
}

function readCff(buffer) {
  const headerSize = buffer[2];
  const names = parseIndex(buffer, headerSize);
  const tops = parseIndex(buffer, names.end);
  const strings = parseIndex(buffer, tops.end);
  const globals = parseIndex(buffer, strings.end);
  const top = parseDict(buffer, tops.items[0][0], tops.items[0][1]);
  if (top.has(1230) || top.has(1236)) throw new Error("CFF: a CID-keyed font is not supported");
  const charStringsAt = top.get(17)?.[0];
  if (charStringsAt === undefined) throw new Error("CFF: the font has no charstrings");
  const charStrings = parseIndex(buffer, charStringsAt);
  let localSubrs = [];
  const privateOperands = top.get(18);
  if (privateOperands) {
    const [size, offset] = privateOperands;
    const priv = parseDict(buffer, offset, offset + size);
    const subrsOffset = priv.get(19)?.[0];
    if (subrsOffset !== undefined) localSubrs = parseIndex(buffer, offset + subrsOffset).items;
  }
  return { glyphs: charStrings.items, globalSubrs: globals.items, localSubrs };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Cubic to quadratic curves
// ---------------------------------------------------------------------------------------------------------------------------

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** The piece of a cubic between t0 and t1, as four control points (by blossoming). */
function cubicPiece(p, t0, t1) {
  const blossom = (a, b, c) => {
    const q = [mix(p[0], p[1], a), mix(p[1], p[2], a), mix(p[2], p[3], a)];
    const r = [mix(q[0], q[1], b), mix(q[1], q[2], b)];
    return mix(r[0], r[1], c);
  };
  return [blossom(t0, t0, t0), blossom(t0, t0, t1), blossom(t0, t1, t1), blossom(t1, t1, t1)];
}

const cubicAt = (p, t) => {
  const u = 1 - t;
  return [0, 1].map((axis) => u * u * u * p[0][axis] + 3 * u * u * t * p[1][axis] + 3 * u * t * t * p[2][axis] + t * t * t * p[3][axis]);
};
const quadAt = (a, q, b, t) => {
  const u = 1 - t;
  return [0, 1].map((axis) => u * u * a[axis] + 2 * u * t * q[axis] + t * t * b[axis]);
};

/** A cubic as a short run of quadratics: returns [[control, end], ...]. */
function cubicToQuadratics(p0, p1, p2, p3, tolerance) {
  const cubic = [p0, p1, p2, p3];
  let best = null;
  for (let pieces = 1; pieces <= 12; pieces += 1) {
    const result = [];
    let worst = 0;
    for (let index = 0; index < pieces; index += 1) {
      const part = cubicPiece(cubic, index / pieces, (index + 1) / pieces);
      const control = [(3 * (part[1][0] + part[2][0]) - part[0][0] - part[3][0]) / 4, (3 * (part[1][1] + part[2][1]) - part[0][1] - part[3][1]) / 4];
      for (let step = 1; step < 8; step += 1) {
        const t = step / 8;
        const a = cubicAt(part, t);
        const b = quadAt(part[0], control, part[3], t);
        worst = Math.max(worst, Math.hypot(a[0] - b[0], a[1] - b[1]));
      }
      result.push([control, part[3]]);
    }
    best = result;
    if (worst <= tolerance) break;
  }
  return best;
}

// ---------------------------------------------------------------------------------------------------------------------------
// glyf
// ---------------------------------------------------------------------------------------------------------------------------

/** The points of each contour of a glyph, as {x, y, on}, in the TrueType direction. */
function glyphPoints(contours, tolerance) {
  const out = [];
  for (const contour of contours) {
    if (contour.segments.length === 0) continue;
    let pen = contour.start;
    const points = [{ x: pen[0], y: pen[1], on: true }];
    for (const segment of contour.segments) {
      if (segment[0] === "L") {
        points.push({ x: segment[1], y: segment[2], on: true });
        pen = [segment[1], segment[2]];
      } else {
        const end = [segment[5], segment[6 - 0]];
        const quads = cubicToQuadratics(pen, [segment[1], segment[2]], [segment[3], segment[4]], [segment[5], segment[6]], tolerance);
        for (const [control, to] of quads) {
          points.push({ x: control[0], y: control[1], on: false });
          points.push({ x: to[0], y: to[1], on: true });
        }
        pen = end;
      }
    }
    for (const point of points) {
      point.x = Math.round(point.x);
      point.y = Math.round(point.y);
    }
    // the contour closes by itself: a last point equal to the first is not needed
    while (points.length > 1 && points[points.length - 1].on && points[points.length - 1].x === points[0].x && points[points.length - 1].y === points[0].y) points.pop();
    if (points.length < 2) continue;
    // PostScript outlines run counter-clockwise on the outside, TrueType clockwise
    out.push([points[0], ...points.slice(1).reverse()]);
  }
  return out;
}

function encodeGlyph(contours) {
  const all = contours.flat();
  if (all.length === 0) return { data: Buffer.alloc(0), bbox: null, points: 0, contours: 0 };
  const xs = all.map((point) => point.x);
  const ys = all.map((point) => point.y);
  const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];

  const flags = [];
  const xBytes = [];
  const yBytes = [];
  let lastX = 0;
  let lastY = 0;
  for (const point of all) {
    let flag = point.on ? 1 : 0;
    const dx = point.x - lastX;
    const dy = point.y - lastY;
    if (dx === 0) flag |= 16;
    else if (Math.abs(dx) < 256) {
      flag |= 2 | (dx > 0 ? 16 : 0);
      xBytes.push(Buffer.from([Math.abs(dx)]));
    } else {
      const bytes = Buffer.alloc(2);
      bytes.writeInt16BE(dx);
      xBytes.push(bytes);
    }
    if (dy === 0) flag |= 32;
    else if (Math.abs(dy) < 256) {
      flag |= 4 | (dy > 0 ? 32 : 0);
      yBytes.push(Buffer.from([Math.abs(dy)]));
    } else {
      const bytes = Buffer.alloc(2);
      bytes.writeInt16BE(dy);
      yBytes.push(bytes);
    }
    flags.push(flag);
    lastX = point.x;
    lastY = point.y;
  }
  // flags with repeats
  const flagBytes = [];
  for (let index = 0; index < flags.length; ) {
    let run = 1;
    while (index + run < flags.length && flags[index + run] === flags[index] && run < 256) run += 1;
    if (run > 1) {
      flagBytes.push(flags[index] | 8, run - 1);
    } else flagBytes.push(flags[index]);
    index += run;
  }

  const header = Buffer.alloc(10 + contours.length * 2 + 2);
  header.writeInt16BE(contours.length, 0);
  header.writeInt16BE(bbox[0], 2);
  header.writeInt16BE(bbox[1], 4);
  header.writeInt16BE(bbox[2], 6);
  header.writeInt16BE(bbox[3], 8);
  let end = -1;
  contours.forEach((contour, index) => {
    end += contour.length;
    header.writeUInt16BE(end, 10 + index * 2);
  });
  header.writeUInt16BE(0, 10 + contours.length * 2); // no instructions
  let data = Buffer.concat([header, Buffer.from(flagBytes), ...xBytes, ...yBytes]);
  if (data.length % 4 !== 0) data = Buffer.concat([data, Buffer.alloc(4 - (data.length % 4))]);
  return { data, bbox, points: all.length, contours: contours.length };
}

// ---------------------------------------------------------------------------------------------------------------------------
// sfnt
// ---------------------------------------------------------------------------------------------------------------------------

function readTables(buffer) {
  const count = be16(buffer, 4);
  const tables = new Map();
  for (let index = 0; index < count; index += 1) {
    const at = 12 + index * 16;
    const tag = buffer.toString("latin1", at, at + 4);
    const offset = buffer.readUInt32BE(at + 8);
    const length = buffer.readUInt32BE(at + 12);
    tables.set(tag, buffer.subarray(offset, offset + length));
  }
  return tables;
}

function checksum(buffer) {
  let sum = 0;
  const padded = buffer.length % 4 === 0 ? buffer : Buffer.concat([buffer, Buffer.alloc(4 - (buffer.length % 4))]);
  for (let at = 0; at < padded.length; at += 4) sum = (sum + padded.readUInt32BE(at)) >>> 0;
  return sum;
}

function writeSfnt(tables) {
  const tags = [...tables.keys()].sort();
  const count = tags.length;
  let power = 1;
  let log = 0;
  while (power * 2 <= count) {
    power *= 2;
    log += 1;
  }
  const directory = Buffer.alloc(12 + count * 16);
  directory.writeUInt32BE(0x00010000, 0);
  directory.writeUInt16BE(count, 4);
  directory.writeUInt16BE(power * 16, 6);
  directory.writeUInt16BE(log, 8);
  directory.writeUInt16BE(count * 16 - power * 16, 10);
  let offset = directory.length;
  const bodies = [];
  tags.forEach((tag, index) => {
    const body = tables.get(tag);
    const padded = body.length % 4 === 0 ? body : Buffer.concat([body, Buffer.alloc(4 - (body.length % 4))]);
    const at = 12 + index * 16;
    directory.write(tag, at, 4, "latin1");
    directory.writeUInt32BE(checksum(body), at + 4);
    directory.writeUInt32BE(offset, at + 8);
    directory.writeUInt32BE(body.length, at + 12);
    bodies.push(padded);
    offset += padded.length;
  });
  const font = Buffer.concat([directory, ...bodies]);
  // the whole-font checksum goes in the head table
  const headIndex = tags.indexOf("head");
  const headAt = directory.readUInt32BE(12 + headIndex * 16 + 8);
  font.writeUInt32BE(0, headAt + 8);
  font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, headAt + 8);
  return font;
}

/**
 * @param {Buffer} otf an OpenType font with a CFF table
 * @returns {{ ttf: Buffer, glyphs: number }} the same font with TrueType outlines
 */
export function convertOtfToTtf(otf) {
  const tables = readTables(otf);
  const cffTable = tables.get("CFF ");
  if (!cffTable) throw new Error("The font has no CFF table (it is not an OpenType font with PostScript outlines)");
  const cff = readCff(cffTable);
  const head = Buffer.from(tables.get("head"));
  const unitsPerEm = head.readUInt16BE(18);
  const tolerance = unitsPerEm / 2500;

  const records = [];
  let maxPoints = 0;
  let maxContours = 0;
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const glyph of cff.glyphs) {
    const contours = glyphPoints(runCharstring(cffTable, glyph, cff), tolerance);
    const record = encodeGlyph(contours);
    records.push(record);
    maxPoints = Math.max(maxPoints, record.points);
    maxContours = Math.max(maxContours, record.contours);
    if (record.bbox) {
      box[0] = Math.min(box[0], record.bbox[0]);
      box[1] = Math.min(box[1], record.bbox[1]);
      box[2] = Math.max(box[2], record.bbox[2]);
      box[3] = Math.max(box[3], record.bbox[3]);
    }
  }

  const loca = Buffer.alloc((records.length + 1) * 4);
  let offset = 0;
  records.forEach((record, index) => {
    loca.writeUInt32BE(offset, index * 4);
    offset += record.data.length;
  });
  loca.writeUInt32BE(offset, records.length * 4);
  const glyf = Buffer.concat(records.map((record) => record.data));

  head.writeUInt32BE(0, 8); // the checksum adjustment is worked out again at the end
  head.writeInt16BE(1, 50); // long offsets in loca
  if (Number.isFinite(box[0])) {
    head.writeInt16BE(box[0], 36);
    head.writeInt16BE(box[1], 38);
    head.writeInt16BE(box[2], 40);
    head.writeInt16BE(box[3], 42);
  }

  const maxp = Buffer.alloc(32);
  maxp.writeUInt32BE(0x00010000, 0);
  maxp.writeUInt16BE(records.length, 4);
  maxp.writeUInt16BE(maxPoints, 6);
  maxp.writeUInt16BE(maxContours, 8);
  maxp.writeUInt16BE(0, 10); // composite points
  maxp.writeUInt16BE(0, 12); // composite contours
  maxp.writeUInt16BE(2, 14); // zones
  // twilight points, storage, function and instruction definitions, stack, instructions, components, depth: all 0

  const out = new Map();
  for (const [tag, body] of tables) {
    if (tag === "CFF " || tag === "VORG" || tag === "head" || tag === "maxp" || tag === "DSIG") continue;
    out.set(tag, body);
  }
  out.set("head", head);
  out.set("maxp", maxp);
  out.set("glyf", glyf);
  out.set("loca", loca);
  return { ttf: writeSfnt(out), glyphs: records.length };
}
