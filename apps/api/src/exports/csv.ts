// Writing a table the way a spreadsheet reads it. Two details matter more than they look:
//  - In many European settings, Albania's included, a spreadsheet expects a semicolon between columns and a
//    comma in numbers; a file with commas between columns opens as one long column. Both styles are offered.
//  - A text that begins with = + - @ is read by a spreadsheet as a formula, so a device or alert called
//    "=HYPERLINK(...)" would run when the file is opened. Text cells are written so that cannot happen.

export type CsvStyle = "standard" | "eu";

interface CsvFormat {
  delimiter: "," | ";";
  decimal: "." | ",";
}

export const CSV_FORMATS: Readonly<Record<CsvStyle, CsvFormat>> = {
  standard: { delimiter: ",", decimal: "." },
  eu: { delimiter: ";", decimal: "," }
};

/** Makes a spreadsheet read the file as UTF-8, so "Durrës" stays "Durrës". */
export const BYTE_ORDER_MARK = "﻿";

export function isCsvStyle(value: unknown): value is CsvStyle {
  return value === "standard" || value === "eu";
}

/** A text cell: quoted when it needs to be, and never a formula. */
export function csvText(value: string, style: CsvStyle): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  const { delimiter } = CSV_FORMATS[style];
  return safe.includes(delimiter) || /["\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** A number cell: empty when there is none, otherwise at most six decimals with the style's decimal mark. */
export function csvNumber(value: number | null | undefined, style: CsvStyle): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return String(Number(value.toFixed(6))).replace(".", CSV_FORMATS[style].decimal);
}

export type CsvCell = { text: string } | { number: number | null | undefined };

export const text = (value: string | undefined): CsvCell => ({ text: value ?? "" });
export const number = (value: number | null | undefined): CsvCell => ({ number: value });

/** One row, ended the way a spreadsheet expects. */
export function csvLine(cells: readonly CsvCell[], style: CsvStyle): string {
  return `${cells.map((cell) => ("text" in cell ? csvText(cell.text, style) : csvNumber(cell.number, style))).join(CSV_FORMATS[style].delimiter)}\r\n`;
}

/** The head row of a file, written first, after the byte-order mark. */
export function csvHeader(columns: readonly string[], style: CsvStyle): string {
  return BYTE_ORDER_MARK + csvLine(columns.map(text), style);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** "2026-10-19 14:05:00" on the given clock. */
export function localStamp(ms: number, timezone: string): string {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    formatters.set(timezone, formatter);
  }
  return formatter.format(ms);
}

export const utcStamp = (ms: number): string => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

/** "hotel-adriatik": a name that is safe in a file name. */
export function slug(name: string): string {
  const plain = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return plain.slice(0, 40) || "site";
}
