// Unit tests for the pure PostgreSQL backup helpers. These import the real
// side-effect-free core (no fs/child_process/env), so naming, retention and
// argument-building are locked without a database or pg_dump installed.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  backupStamp,
  backupFileName,
  isBackupFile,
  isPostgresUrl,
  resolveDatabaseUrl,
  parseKeep,
  wantsVerify,
  pgDumpArgs,
  pgRestoreVerifyArgs,
  selectForPrune,
  redactUrl,
} from "../../scripts/lib/pg-backup-core.mjs";

test("backupStamp zero-pads to YYYYMMDD-HHMMSS (local time)", () => {
  const d = new Date(2026, 1, 3, 4, 5, 6); // 2026-02-03 04:05:06 local
  assert.equal(backupStamp(d), "20260203-040506");
});

test("backupFileName wraps a stamp", () => {
  assert.equal(backupFileName("20260203-040506"), "cliniva-20260203-040506.dump");
});

test("isBackupFile matches our files only", () => {
  assert.equal(isBackupFile("cliniva-20260203-040506.dump"), true);
  assert.equal(isBackupFile("cliniva-20260203-040506.dump.manifest.json"), false);
  assert.equal(isBackupFile("dev.db"), false);
  assert.equal(isBackupFile("cliniva-bad.dump"), false);
});

test("isPostgresUrl accepts postgres/postgresql, rejects sqlite", () => {
  assert.equal(isPostgresUrl("postgres://u:p@h:5432/db"), true);
  assert.equal(isPostgresUrl("postgresql://u:p@h/db"), true);
  assert.equal(isPostgresUrl("file:./dev.db"), false);
  assert.equal(isPostgresUrl(undefined), false);
});

test("resolveDatabaseUrl prefers BACKUP_DATABASE_URL, then DATABASE_URL", () => {
  assert.equal(
    resolveDatabaseUrl({ BACKUP_DATABASE_URL: "postgres://a/db", DATABASE_URL: "postgres://b/db" }),
    "postgres://a/db",
  );
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: "postgres://b/db" }), "postgres://b/db");
});

test("resolveDatabaseUrl rejects missing and non-Postgres URLs", () => {
  assert.throws(() => resolveDatabaseUrl({}), /nothing to back up/);
  assert.throws(() => resolveDatabaseUrl({ DATABASE_URL: "file:./dev.db" }), /only supports PostgreSQL/);
});

test("parseKeep reads a positive integer, else null", () => {
  assert.equal(parseKeep(["--keep", "30"]), 30);
  assert.equal(parseKeep([]), null);
  assert.equal(parseKeep(["--keep", "0"]), null);
  assert.equal(parseKeep(["--keep", "-5"]), null);
  assert.equal(parseKeep(["--keep", "abc"]), null);
});

test("wantsVerify detects the --verify flag", () => {
  assert.equal(wantsVerify(["--verify"]), true);
  assert.equal(wantsVerify(["--keep", "5"]), false);
});

test("pgDumpArgs builds a portable custom-format dump", () => {
  assert.deepEqual(pgDumpArgs("postgres://u:p@h/db", "/out/x.dump"), [
    "-Fc",
    "--no-owner",
    "--no-privileges",
    "-f",
    "/out/x.dump",
    "postgres://u:p@h/db",
  ]);
});

test("pgRestoreVerifyArgs lists a dump", () => {
  assert.deepEqual(pgRestoreVerifyArgs("/out/x.dump"), ["--list", "/out/x.dump"]);
});

test("selectForPrune deletes only the oldest beyond keep, ignoring foreign files", () => {
  const names = [
    "cliniva-20260101-000000.dump",
    "cliniva-20260102-000000.dump",
    "cliniva-20260103-000000.dump",
    "cliniva-20260104-000000.dump",
    "README.txt",
    "cliniva-20260101-000000.dump.manifest.json",
  ];
  // keep newest 2 -> delete the two oldest backups only.
  assert.deepEqual(selectForPrune(names, 2), [
    "cliniva-20260102-000000.dump",
    "cliniva-20260101-000000.dump",
  ]);
});

test("selectForPrune never deletes when keep is null/invalid", () => {
  const names = ["cliniva-20260101-000000.dump", "cliniva-20260102-000000.dump"];
  assert.deepEqual(selectForPrune(names, null), []);
  assert.deepEqual(selectForPrune(names, 0), []);
  assert.deepEqual(selectForPrune(names, 5), []); // fewer than keep -> nothing to prune
});

test("redactUrl masks the password", () => {
  assert.equal(redactUrl("postgres://user:secret@host:5432/db"), "postgres://user:****@host:5432/db");
  assert.equal(redactUrl("postgresql://user:s3cr3t@host/db"), "postgresql://user:****@host/db");
});
