#!/usr/bin/env node
/**
 * PostgreSQL production backup (pg_dump) with retention + optional verify.
 *
 *   node scripts/pg-backup.mjs                 # one snapshot -> backups/postgres/
 *   node scripts/pg-backup.mjs --keep 30       # keep the 30 newest, prune older
 *   node scripts/pg-backup.mjs --verify        # pg_restore --list the new dump
 *
 * Connection: BACKUP_DATABASE_URL || DATABASE_URL (must be Postgres). Output dir:
 * BACKUP_DIR || ./backups/postgres. The dump is custom-format (-Fc) and includes
 * soft-deleted rows (they are ordinary rows), so the Recycle Bin is preserved.
 *
 * For the SQLite/desktop build use `npm run db:backup` instead. See docs/RUNBOOK.md
 * section 5 for scheduling, offsite copies and restore.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  backupStamp,
  backupFileName,
  parseKeep,
  wantsVerify,
  pgDumpArgs,
  pgRestoreVerifyArgs,
  selectForPrune,
  resolveDatabaseUrl,
  redactUrl,
} from "./lib/pg-backup-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(msg) {
  console.error(`pg-backup: ${msg}`);
  process.exit(1);
}

function run(bin, args, label) {
  const res = spawnSync(bin, args, { stdio: ["ignore", "inherit", "inherit"] });
  if (res.error && res.error.code === "ENOENT") {
    fail(`\`${bin}\` not found on PATH. Install the PostgreSQL client tools (${label}).`);
  }
  if (res.status !== 0) fail(`${bin} exited with code ${res.status}.`);
}

let databaseUrl;
try {
  databaseUrl = resolveDatabaseUrl(process.env);
} catch (err) {
  fail(err.message);
}

const backupDir = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.join(root, "backups", "postgres");
fs.mkdirSync(backupDir, { recursive: true });

const stamp = backupStamp();
const fileName = backupFileName(stamp);
const outFile = path.join(backupDir, fileName);

console.log(`pg-backup: dumping ${redactUrl(databaseUrl)}`);
console.log(`  -> ${path.relative(root, outFile)}`);
run("pg_dump", pgDumpArgs(databaseUrl, outFile), "pg_dump");

const stat = fs.existsSync(outFile) ? fs.statSync(outFile) : null;
if (!stat || stat.size === 0) fail("dump file is missing or empty — backup FAILED.");
const sizeMB = (stat.size / 1024 / 1024).toFixed(2);

if (wantsVerify(process.argv.slice(2))) {
  console.log("pg-backup: verifying dump is readable (pg_restore --list)...");
  run("pg_restore", pgRestoreVerifyArgs(outFile), "pg_restore");
}

fs.writeFileSync(
  path.join(backupDir, `${fileName}.manifest.json`),
  JSON.stringify(
    { file: fileName, createdAt: new Date().toISOString(), sizeMB: Number(sizeMB), format: "pg_dump -Fc", includesSoftDeleted: true },
    null,
    2,
  ),
);

console.log(`pg-backup: created ${fileName} (${sizeMB} MB)`);

const keep = parseKeep(process.argv.slice(2));
if (keep) {
  const names = fs.readdirSync(backupDir);
  const toDelete = selectForPrune(names, keep);
  for (const name of toDelete) {
    fs.rmSync(path.join(backupDir, name), { force: true });
    fs.rmSync(path.join(backupDir, `${name}.manifest.json`), { force: true });
    console.log(`  pruned old backup: ${name}`);
  }
  console.log(`pg-backup: retention applied (kept newest ${keep}).`);
}
