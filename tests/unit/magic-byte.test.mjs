import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Mirrors mimeMatchesContent() in src/lib/server/storage.ts. Re-implemented per
 * the tests/unit convention (plain `node --test`, no TypeScript loader). Keep in
 * sync with the source signatures.
 */
function bytesStartWith(buf, sig, offset = 0) {
  if (buf.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (buf[offset + i] !== sig[i]) return false;
  return true;
}

function mimeMatchesContent(declared, buf) {
  switch (declared) {
    case "image/jpeg":
      return bytesStartWith(buf, [0xff, 0xd8, 0xff]);
    case "image/png":
      return bytesStartWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/gif":
      return bytesStartWith(buf, [0x47, 0x49, 0x46, 0x38]);
    case "image/webp":
      return bytesStartWith(buf, [0x52, 0x49, 0x46, 0x46]) && bytesStartWith(buf, [0x57, 0x45, 0x42, 0x50], 8);
    case "application/pdf":
      return bytesStartWith(buf, [0x25, 0x50, 0x44, 0x46]);
    case "image/heic":
    case "image/heif":
      return bytesStartWith(buf, [0x66, 0x74, 0x79, 0x70], 4);
    default:
      return false;
  }
}

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const heic = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // "MZ" — Windows PE

test("valid signatures match their declared types", () => {
  assert.equal(mimeMatchesContent("image/png", png), true);
  assert.equal(mimeMatchesContent("image/jpeg", jpeg), true);
  assert.equal(mimeMatchesContent("application/pdf", pdf), true);
  assert.equal(mimeMatchesContent("image/webp", webp), true);
  assert.equal(mimeMatchesContent("image/heic", heic), true);
});

test("disguised executable claiming to be png is rejected", () => {
  assert.equal(mimeMatchesContent("image/png", exe), false);
});

test("mismatched declared type is rejected", () => {
  assert.equal(mimeMatchesContent("image/jpeg", png), false);
  assert.equal(mimeMatchesContent("application/pdf", png), false);
});

test("unknown declared type is rejected", () => {
  assert.equal(mimeMatchesContent("text/html", Buffer.from("<html>")), false);
  assert.equal(mimeMatchesContent("image/svg+xml", Buffer.from("<svg>")), false);
});

test("truncated buffer does not throw and is rejected", () => {
  assert.equal(mimeMatchesContent("image/png", Buffer.from([0x89])), false);
});
