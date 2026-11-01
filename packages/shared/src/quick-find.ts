// Quick find: one box, opened from anywhere with Ctrl+K (or Command+K, or "/"), that takes a person to a page, a site, a client or an
// action by what they remember of its name (docs/29-apple-notion-standards.md). This is only the matching, so that the screen and the
// tests agree on what "found" means. The entries, and where the screen gets them from, are the web app's business.

export const FIND_KINDS = ["Page", "Site", "Client", "Request", "Action"] as const;
export type FindKind = (typeof FIND_KINDS)[number];

export interface FindEntry {
  /** Stable and unique within one list: a path, or an id. */
  id: string;
  kind: FindKind;
  /** What it is called, as the person knows it. */
  label: string;
  /** A second line: where it is, or how it is doing. Also searched, less strongly than the label. */
  detail?: string;
  href: string;
  /** Other words that find it without being on it: "settings" finds "Who is told". */
  keywords?: readonly string[];
}

/** Lower case, without accents, and with every run of marks between words turned into one space: "Durrës" is found by "durres",
 * and "Who's told" by "whos told". */
export function foldForFind(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** How strongly one piece of text answers one typed word: a word that begins with it counts most, a part of a word less, none is 0. */
function strength(folded: string, word: string, whole: number, part: number): number {
  if (!folded) return 0;
  if (folded.startsWith(word)) return whole + 4;
  if (folded.includes(` ${word}`)) return whole;
  return folded.includes(word) ? part : 0;
}

/** How well an entry answers the words typed. 0 means it does not: every word must be found somewhere in the entry. */
export function scoreEntry(entry: FindEntry, words: readonly string[]): number {
  const label = foldForFind(entry.label);
  const detail = foldForFind(entry.detail ?? "");
  const keywords = foldForFind((entry.keywords ?? []).join(" "));
  let total = 0;
  for (const word of words) {
    const best = Math.max(strength(label, word, 30, 15), strength(keywords, word, 12, 6), strength(detail, word, 8, 4));
    if (best === 0) return 0;
    total += best;
  }
  // What was typed is the start of the name: the one the person meant.
  if (words.length > 0 && label.startsWith(words.join(" "))) total += 10;
  return total;
}

/** The entries that answer what was typed, best first; those that answer equally well keep the order they were given in.
 * Nothing typed gives the first `limit` entries as they were given, which is the list of suggestions. */
export function findEntries(entries: readonly FindEntry[], query: string, limit = 12): FindEntry[] {
  const words = foldForFind(query).split(" ").filter(Boolean);
  if (words.length === 0) return entries.slice(0, limit);
  return entries
    .map((entry, index) => ({ entry, index, score: scoreEntry(entry, words) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((hit) => hit.entry);
}
