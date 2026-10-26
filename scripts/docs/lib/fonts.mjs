// The fonts of the guides: Inter for headings, tables and labels, Bitstream Charter for the body.
//
// Both are installed on the build machine and nothing is fetched. Charter is installed only as Type 1
// (/usr/share/fonts/X11/Type1), which Chromium cannot use, so each of its four faces is converted in memory from the installed file
// (lib/type1-to-otf.mjs). Inter is installed as OpenType with PostScript outlines.
//
// Both are then given TrueType outlines (lib/otf-to-ttf.mjs) and handed to the page as an @font-face. The reason is the size of the
// PDF: Chromium embeds a PostScript-outline font as "Type 3" and stores every letter of every page one at a time, which made the
// complete guide 7 MB; a TrueType font is embedded as a real font and the same text takes a fraction of the room. The shapes and
// the spacing are the same; nothing is fetched and nothing is committed. If a face cannot be converted the page falls back to the
// next font in the stack and the build says so.

import { existsSync, readFileSync } from "node:fs";
import { convertType1ToOtf } from "./type1-to-otf.mjs";
import { convertOtfToTtf } from "./otf-to-ttf.mjs";

const TYPE1_DIR = process.env.CHARTER_DIR ?? "/usr/share/fonts/X11/Type1";
const INTER_DIR = process.env.INTER_DIR ?? "/usr/share/fonts/opentype/inter";

const FACES = [
  { file: "c0648bt_", style: "Regular", weight: 400, bold: false, italic: false },
  { file: "c0632bt_", style: "Bold", weight: 700, bold: true, italic: false },
  { file: "c0649bt_", style: "Italic", weight: 400, bold: false, italic: true },
  { file: "c0633bt_", style: "Bold Italic", weight: 700, bold: true, italic: true }
];

const INTER_FACES = [
  { file: "Inter-Regular", weight: 400, italic: false },
  { file: "Inter-Medium", weight: 500, italic: false },
  { file: "Inter-SemiBold", weight: 600, italic: false },
  { file: "Inter-Bold", weight: 700, italic: false },
  { file: "Inter-ExtraBold", weight: 800, italic: false },
  { file: "Inter-Italic", weight: 400, italic: true },
  { file: "Inter-BoldItalic", weight: 700, italic: true }
];

const fontFace = (family, face, ttf) =>
  `@font-face { font-family: "${family}"; font-style: ${face.italic ? "italic" : "normal"}; font-weight: ${face.weight}; src: url(data:font/ttf;base64,${ttf.toString("base64")}) format("truetype"); }`;

/** @returns {{ css: string, report: string[], ok: boolean }} */
export function prepareFonts() {
  const report = [];
  const rules = [];
  let converted = 0;
  for (const face of FACES) {
    const pfb = `${TYPE1_DIR}/${face.file}.pfb`;
    const afm = `${TYPE1_DIR}/${face.file}.afm`;
    if (!existsSync(pfb)) {
      report.push(`Charter ${face.style}: ${pfb} not found, the body falls back to the next serif`);
      continue;
    }
    try {
      const result = convertType1ToOtf({ pfbPath: pfb, afmPath: existsSync(afm) ? afm : undefined, familyName: "Bitstream Charter", styleName: face.style, weight: face.weight, bold: face.bold, italic: face.italic });
      const { ttf } = convertOtfToTtf(result.otf);
      rules.push(fontFace("Bitstream Charter", face, ttf));
      converted += 1;
      if (result.unmapped.length > 0) report.push(`Charter ${face.style}: glyphs without a Unicode value: ${result.unmapped.join(", ")}`);
    } catch (error) {
      report.push(`Charter ${face.style}: could not be converted (${error.message}), the body falls back to the next serif`);
    }
  }
  report.unshift(
    converted === FACES.length
      ? `Body font: Bitstream Charter, all ${converted} faces converted from the installed Type 1 files`
      : `Body font: Bitstream Charter converted for ${converted} of ${FACES.length} faces`
  );
  let interConverted = 0;
  for (const face of INTER_FACES) {
    const path = `${INTER_DIR}/${face.file}.otf`;
    if (!existsSync(path)) {
      report.push(`Inter ${face.file}: ${path} not found, headings fall back to the next sans-serif`);
      continue;
    }
    try {
      const { ttf } = convertOtfToTtf(readFileSync(path));
      rules.push(fontFace("Inter", face, ttf));
      interConverted += 1;
    } catch (error) {
      report.push(`Inter ${face.file}: could not be converted (${error.message}), headings fall back to the next sans-serif`);
    }
  }
  const interOk = interConverted === INTER_FACES.length;
  report.push(interOk ? `Headings and tables: Inter, all ${interConverted} faces from ${INTER_DIR}` : `Inter converted for ${interConverted} of ${INTER_FACES.length} faces`);
  return { css: rules.join("\n"), report, ok: converted === FACES.length && interOk };
}
