#!/usr/bin/env node
/**
 * Restore a backup created by scripts/backup.mjs.
 *
 *   node scripts/restore.mjs               # restore the NEWEST backup
 *   node scripts/restore.mjs 20260627-0830 # restore a specific backup
 *   node scripts/restore.mjs --list        # list available backups
 *
 * SAFETY: before overwriting, the current db + uploads are auto-saved to
 * backups/_pre-restore-<timestamp>/ so a restore is itself reversible.
 *
 * Stop the server first so nothing is mid-write (see docs/RUNBOOK.md §7).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backupsRoot = path.join(root, "backups");

function listBackups() {
  if (!fs.existsSync(backupsRoot)) return [];
  return fs
    .readdirSync(backupsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_pre-restore"))
    .map((e) => e.name)
    .sort()
    .reverse();
}

function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const arg = process.argv[2];

if (arg === "--list") {
  const all = listBackups();
  console.log(all.length ? all.map((b) => "  " + b).join("\n") : "  (no backups yet)");
  process.exit(0);
}

const backups = listBackups();
if (backups.length === 0) {
  console.error("No backups found. Run `npm run db:backup` first.");
  process.exit(1);
}

const name = arg && !arg.startsWith("--") ? arg : backups[0];
const src = path.join(backupsRoot, name);
if (!fs.existsSync(src)) {
  console.error(`Backup not found: ${name}\nAvailable:\n` + backups.map((b) => "  " + b).join("\n"));
  process.exit(1);
}

// 1) auto-save current state (so the restore itself is reversible)
const safety = path.join(backupsRoot, `_pre-restore-${ts()}`);
fs.mkdirSync(safety, { recursive: true });
for (const rel of ["prisma/dev.db", "prisma/dev.db-journal", "prisma/dev.db-wal", "private-uploads"]) {
  const p = path.join(root, rel);
  if (fs.existsSync(p)) {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) fs.cpSync(p, path.join(safety, path.basename(rel)), { recursive: true });
    else fs.copyFileSync(p, path.join(safety, path.basename(rel)));
  }
}
console.log(`Current state saved to backups/${path.basename(safety)} (in case you need to undo).`);

// 2) restore the chosen backup over the live paths
for (const entry of fs.readdirSync(src)) {
  if (entry === "MANIFEST.json") continue;
  const from = path.join(src, entry);
  const to = entry === "private-uploads" ? path.join(root, entry) : path.join(root, "prisma", entry);
  if (fs.statSync(from).isDirectory()) {
    fs.rmSync(to, { recursive: true, force: true });
    fs.cpSync(from, to, { recursive: true });
  } else {
    fs.copyFileSync(from, to);
  }
  console.log(`  restored ${entry}`);
}

console.log(`\nRestored backup: ${name}\nRestart the server to pick up the restored data.`);
