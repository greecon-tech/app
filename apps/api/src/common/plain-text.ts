// Text that came from a person (a name, a site's name, the words of a request for access) is put into the emails, texts
// and screens of other people. It must not be able to break a message into lines of its own making, hide or reorder what
// is around it, run on without end, or carry a working link from outside Greecon into a message Greecon sends.

/** Control characters (a line break, a tab, a bell) and the separators that act as line breaks. */
const CONTROL = /[\p{Cc}\u2028\u2029]/gu;
/** Invisible characters that reorder or hide text: direction overrides and isolates, zero-width spaces and joiners, the byte-order mark. */
const INVISIBLE = /\p{Cf}/gu;

/** A web address: one with a scheme, one that starts with www., or a bare domain ending in a common top-level domain (not
 * the part of an email address after the @), including the endings link shorteners and throwaway domains use. The list is of
 * endings no ordinary word is (a missing space after a full stop must not turn a sentence into a link), so it does not hold
 * every one: the rest are stopped by who may write where (an email address is checked as one, a telephone number keeps its
 * digits only). */
const WEB_ADDRESS =
  /\b[a-z][a-z0-9+.-]*:\/\/\S+|\bwww\.\S+|(?<![\w@.-])(?:[a-z0-9-]+\.)+(?:com|net|org|info|biz|io|co|me|app|dev|xyz|top|site|online|shop|link|click|ru|cn|al|eu|de|it|uk|ly|gl|gd|gy|cc|tk|ml|ga|cf|gq|pw|ws|vip|icu|buzz|su|ua)\b(?:\/\S*)?|(?<![\w@.-])(?:shorturl\.at|lnkd\.in|youtu\.be)\b(?:\/\S*)?/gi;

/** One line of plain text: control characters and line breaks become spaces, invisible characters go, runs of spaces become
 * one, and it is cut to `max` characters (whole characters, with an ellipsis) so nobody's name can push the rest out. */
export function oneLine(text: string, max: number): string {
  const flat = text.replace(CONTROL, " ").replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
  const characters = Array.from(flat);
  return characters.length <= max ? flat : `${characters.slice(0, Math.max(0, max - 1)).join("").trimEnd()}…`;
}

/** Several lines of plain text, for words a person wrote at length (the words of a request for access, as they are kept):
 * the line breaks stay, with at most one empty line in a row; everything else is as oneLine makes it. */
export function severalLines(text: string, max: number): string {
  const lines = text.split(/\r\n?|\n/).map((line) => line.replace(CONTROL, " ").replace(INVISIBLE, "").replace(/\s+/g, " ").trim());
  const joined = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const characters = Array.from(joined);
  return characters.length <= max ? joined : `${characters.slice(0, Math.max(0, max - 1)).join("").trimEnd()}…`;
}

/** The same text with every web address in it written so that no phone or mail program makes a link of it:
 * "https://evil.example" becomes "https[:]//evil[.]example". The words stay readable. */
export function withoutLinks(text: string): string {
  return text.replace(WEB_ADDRESS, (address) => address.replace(/:\/\//, "[:]//").replace(/\./g, "[.]"));
}

/** Text from a person, ready to go into a message: one line, at most `max` characters, and no working link. */
export function userText(text: string, max: number): string {
  return oneLine(withoutLinks(oneLine(text, max * 2)), max);
}

/** How many web addresses a text has. */
export function webAddressesIn(text: string): number {
  return text.match(WEB_ADDRESS)?.length ?? 0;
}
