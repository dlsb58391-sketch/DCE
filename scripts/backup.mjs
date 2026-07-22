#!/usr/bin/env node
/**
 * Backup the BDIC database + patient files into ./backups/<timestamp>/.
 *
 *   node scripts/backup.mjs            # create a timestamped backup
 *   node scripts/backup.mjs --keep 20  # keep only the 20 newest, prune the rest
 *
 * SQLite: copies prisma/dev.db (+ -journal/-wal if present) and private-uploads/.
 * For PostgreSQL production, use `pg_dump` instead (see docs/RUNBOOK.md §5).
 *
 * Safe to run while the site is live (file copy is near-instant for SQLite).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backupsRoot = path.join(root, "backups");

function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function copyIfExists(src, destDir) {
  if (!fs.existsSync(src)) return false;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.cpSync(src, path.join(destDir, path.basename(src)), { recursive: true });
  } else {
    fs.copyFileSync(src, path.join(destDir, path.basename(src)));
  }
  return true;
}

function dirSizeMB(dir) {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    total += e.isDirectory() ? Number(dirSizeMB(p)) * 1024 * 1024 : fs.statSync(p).size;
  }
  return (total / 1024 / 1024).toFixed(2);
}

function prune(keep) {
  if (!fs.existsSync(backupsRoot)) return;
  const dirs = fs
    .readdirSync(backupsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse();
  for (const old of dirs.slice(keep)) {
    fs.rmSync(path.join(backupsRoot, old), { recursive: true, force: true });
    console.log(`  pruned old backup: ${old}`);
  }
}

const keepArg = process.argv.indexOf("--keep");
const keep = keepArg !== -1 ? parseInt(process.argv[keepArg + 1], 10) : null;

const stamp = ts();
const dest = path.join(backupsRoot, stamp);
fs.mkdirSync(dest, { recursive: true });

let copied = 0;
for (const rel of ["prisma/dev.db", "prisma/dev.db-journal", "prisma/dev.db-wal", "private-uploads"]) {
  if (copyIfExists(path.join(root, rel), dest)) {
    console.log(`  + ${rel}`);
    copied++;
  }
}

if (copied === 0) {
  console.error("No database or uploads found to back up. (Is this a fresh checkout?)");
  fs.rmSync(dest, { recursive: true, force: true });
  process.exit(1);
}

fs.writeFileSync(
  path.join(dest, "MANIFEST.json"),
  JSON.stringify({ createdAt: new Date().toISOString(), items: copied, sizeMB: dirSizeMB(dest) }, null, 2)
);

console.log(`\nBackup created: backups/${stamp}  (${dirSizeMB(dest)} MB)`);
if (keep && Number.isFinite(keep)) {
  console.log(`Pruning to newest ${keep}...`);
  prune(keep);
}
