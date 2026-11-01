// A number as a person types it, and the two units a level transmitter's label can be in. Pure, so that the setup page and its tests use the same ones.

/** A number as a person types it. Where they write in Albanian, Italian, German or most of Europe, a decimal comma is as much a number as a point:
 * "2,5" is 2.5, and so is "2.5". Greecon does not guess at a thousands separator: a comma and a point together, or two commas, are not a number
 * it can be sure of. Anything that is not a plain number is NaN, never 0 (an empty field must not become a range of zero). */
export function typedNumber(text: string): number {
  const tidy = text.replace(/\s+/g, "");
  if (tidy === "") return Number.NaN;
  if (/^[+-]?\d+,\d+$/.test(tidy)) return Number(tidy.replace(",", "."));
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(tidy) ? Number(tidy) : Number.NaN;
}

/** Metres of water that one bar holds up: a level transmitter is often a pressure sensor at the bottom of the tank, and its label says bar. */
export const METRES_OF_WATER_PER_BAR = 10.197;

export type LevelLabelUnit = "m" | "bar";

/** The range on a level transmitter's label, in metres of water, from the unit the label gives it in. */
export function levelInMetres(value: number, unit: LevelLabelUnit): number {
  return unit === "bar" ? Math.round(value * METRES_OF_WATER_PER_BAR * 10_000) / 10_000 : value;
}
