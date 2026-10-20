import { randomInt } from "crypto";

// A temporary password is handed to a person by phone or in person and lasts until their first sign-in, so
// it has to be both easy to read aloud and too large to guess. Three groups of four from 31 letters and
// digits that cannot be mistaken for one another (no 0, o, 1, l or i) is about 59 bits: at the limit
// on sign-in attempts at one account, trying even a thousandth of them would take millions of years. The
// earlier word-word-NN form had 23,040 possibilities, which a patient caller could have tried in a day or two.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateTemporaryPassword(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}
