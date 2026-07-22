import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Mirrors the traversal-containment logic in resolveStored()
 * (src/lib/server/storage.ts). This repo runs unit tests with plain
 * `node --test` and has no TypeScript loader, so — following the existing
 * tests/unit/stage.test.mjs convention — the pure logic is re-implemented here.
 * Keep both in sync if the containment rule changes.
 */
const base = path.resolve("/srv/app/private-uploads/patient-files");

function resolveStored(storagePath) {
  const resolved = path.resolve(base, storagePath);
  const allowedPrefix = base.endsWith(path.sep) ? base : base + path.sep;
  if (!resolved.startsWith(allowedPrefix)) {
    throw new Error("storage_path_traversal");
  }
  return resolved;
}

test("normal flat filename resolves inside base", () => {
  const p = resolveStored("uuid__scan.jpg");
  assert.ok(p.startsWith(base + path.sep));
});

test("parent traversal is rejected", () => {
  assert.throws(() => resolveStored("../../etc/passwd"), /storage_path_traversal/);
});

test("deep traversal is rejected", () => {
  assert.throws(() => resolveStored("../../../../proc/1/environ"), /storage_path_traversal/);
});

test("absolute path escape is rejected", () => {
  const abs = process.platform === "win32" ? "C:\\Windows\\win.ini" : "/etc/passwd";
  assert.throws(() => resolveStored(abs), /storage_path_traversal/);
});

test("sibling directory sharing a name prefix is rejected", () => {
  // Resolves to a sibling ".../patient-files-evil/x" which must NOT be treated
  // as inside ".../patient-files/". The trailing separator on the prefix is what
  // prevents this class of bypass.
  assert.throws(() => resolveStored("../patient-files-evil/x"), /storage_path_traversal/);
});
