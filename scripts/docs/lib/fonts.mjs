// The fonts of the guides: Inter for headings, tables and labels, Bitstream Charter for the body.
//
// Both are installed on the build machine and nothing is fetched. Inter is installed as OpenType and the browser uses it
// directly. Charter is installed only as Type 1 (/usr/share/fonts/X11/Type1), which Chromium cannot use, so each of its four
// faces is converted in memory from the installed file (lib/type1-to-otf.mjs) and handed to the page as an @font-face. If a face
// cannot be converted the page falls back to the next serif in the stack and the build says so.

import { existsSync } from "node:fs";
import { convertType1ToOtf } from "./type1-to-otf.mjs";

const TYPE1_DIR = process.env.CHARTER_DIR ?? "/usr/share/fonts/X11/Type1";
const INTER_DIR = process.env.INTER_DIR ?? "/usr/share/fonts/opentype/inter";

const FACES = [
  { file: "c0648bt_", style: "Regular", weight: 400, bold: false, italic: false },
  { file: "c0632bt_", style: "Bold", weight: 700, bold: true, italic: false },
  { file: "c0649bt_", style: "Italic", weight: 400, bold: false, italic: true },
  { file: "c0633bt_", style: "Bold Italic", weight: 700, bold: true, italic: true }
];

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
      const data = result.otf.toString("base64");
      rules.push(
        `@font-face { font-family: "Bitstream Charter"; font-style: ${face.italic ? "italic" : "normal"}; font-weight: ${face.weight}; src: url(data:font/otf;base64,${data}) format("opentype"); }`
      );
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
  const interOk = existsSync(`${INTER_DIR}/Inter-Regular.otf`) && existsSync(`${INTER_DIR}/Inter-Bold.otf`);
  report.push(interOk ? `Headings and tables: Inter, installed (${INTER_DIR})` : `Inter was not found in ${INTER_DIR}: headings fall back to the next sans-serif`);
  return { css: rules.join("\n"), report, ok: converted === FACES.length && interOk };
}
