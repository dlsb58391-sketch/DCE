// Mirrors normalizePhone() in src/lib/server/phone.ts. Phone normalization
// decides the exact digits used for wa.me / WhatsApp Cloud delivery, so a
// regression here silently sends (or fails to send) messages to the wrong
// number. These tests lock in the country-code, trunk-0, "00" prefix,
// bare-local and validity-window behavior. Keep in sync with phone.ts.
import { test } from "node:test";
import assert from "node:assert/strict";

/** Faithful mirror of normalizePhone (defaultCc defaults to Egypt "20"). */
function normalizePhone(raw, defaultCc = "20") {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith(defaultCc)) {
    // already has the country code
  } else if (d.startsWith("0")) {
    d = defaultCc + d.slice(1);
  } else if (d.length > 0 && d.length <= 10) {
    d = defaultCc + d;
  }
  const valid = d.length >= 10 && d.length <= 15;
  return { digits: d, e164: d ? `+${d}` : "", display: d ? `+${d}` : raw, valid };
}

test("international format with spaces/plus is stripped to bare digits", () => {
  const r = normalizePhone("+20 122 215 6274");
  assert.equal(r.digits, "201222156274");
  assert.equal(r.e164, "+201222156274");
  assert.equal(r.valid, true);
});

test("local number with trunk 0 gets the country code", () => {
  const r = normalizePhone("01222156274");
  assert.equal(r.digits, "201222156274");
  assert.equal(r.valid, true);
});

test("bare 10-digit local number (no leading 0) gets the country code", () => {
  const r = normalizePhone("1222156274");
  assert.equal(r.digits, "201222156274");
  assert.equal(r.valid, true);
});

test('"00" international prefix is dropped', () => {
  const r = normalizePhone("0020122156274");
  assert.equal(r.digits, "20122156274");
  assert.equal(r.valid, true);
});

test("already-prefixed numbers are left intact", () => {
  const r = normalizePhone("201222156274");
  assert.equal(r.digits, "201222156274");
  assert.equal(r.e164, "+201222156274");
});

test("punctuation and letters are ignored", () => {
  assert.equal(normalizePhone("(+20) 122-215-6274").digits, "201222156274");
});

test("custom country code (UK 44) applies to trunk-0 numbers", () => {
  const r = normalizePhone("07700900123", "44");
  assert.equal(r.digits, "447700900123");
  assert.equal(r.valid, true);
});

test("empty / junk input is invalid and falls back to raw display", () => {
  const empty = normalizePhone("");
  assert.equal(empty.digits, "");
  assert.equal(empty.e164, "");
  assert.equal(empty.valid, false);

  const junk = normalizePhone("abc");
  assert.equal(junk.digits, "");
  assert.equal(junk.display, "abc"); // display falls back to the raw input
  assert.equal(junk.valid, false);
});

test("too-short numbers normalize but are marked invalid", () => {
  const r = normalizePhone("123");
  assert.equal(r.digits, "20123"); // CC prepended
  assert.equal(r.valid, false); // below the 10-digit floor
});

test("over-long numbers are marked invalid (>15 digits)", () => {
  const r = normalizePhone("1234567890123456"); // 16 digits, no CC/0 prefix
  assert.equal(r.digits, "1234567890123456");
  assert.equal(r.valid, false);
});

test("validity window is inclusive at 10 and 15 digits", () => {
  assert.equal(normalizePhone("2012345678").valid, true); // 10 digits
  assert.equal(normalizePhone("201234567890123").valid, true); // 15 digits
  assert.equal(normalizePhone("20123456789012345").valid, false); // 17 digits
});
