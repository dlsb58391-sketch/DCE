import { randomInt } from "crypto";

// Unambiguous alphabet (no 0/O/1/I/L) for short, human-friendly tracking codes.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
