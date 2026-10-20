import { createHash, randomInt } from "crypto";

// The one thing a person types or pastes at a box. Short enough to read out over the phone, long
// enough that guessing is out of the question: twelve symbols from 32 is 60 bits, and the endpoint
// that takes it is rate limited besides. The alphabet leaves out the characters people confuse
// (0 and O, 1 and I), so a code read off a screen and typed by hand is not misread.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BODY_LENGTH = 12;

/** A code is good for a week: long enough to order the box and install it, short enough to be forgotten about safely. */
export const ENROLMENT_VALID_FOR_MS = 7 * 24 * 3_600_000;

export function generateEnrolmentCode(): string {
  const symbols = Array.from({ length: BODY_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)] as string);
  return formatEnrolmentCode(symbols.join(""));
}

export function formatEnrolmentCode(body: string): string {
  return `GRC-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

/** The twelve symbols of whatever someone typed, or undefined if it cannot be a code. Forgiving
 * about case, spaces, dashes and the "GRC" prefix; strict about everything else. */
export function normaliseEnrolmentCode(input: unknown): string | undefined {
  if (typeof input !== "string" || input.length > 64) return undefined;
  const stripped = input.toUpperCase().replace(/[\s-]/g, "");
  const body = stripped.startsWith("GRC") ? stripped.slice(3) : stripped;
  if (body.length !== BODY_LENGTH) return undefined;
  for (const symbol of body) if (!ALPHABET.includes(symbol)) return undefined;
  return body;
}

export function hashEnrolmentCode(body: string): string {
  return createHash("sha256").update(`greecon-enrol:${body}`).digest("hex");
}
