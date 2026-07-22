#!/usr/bin/env node
/**
 * Build a STAGING database from a snapshot of the live (dev/prod) data so you can
 * test edits and migrations against real-shaped data WITHOUT touching production.
 *
 *   node scripts/staging-sync.mjs
 *
 * What it does (SQLite dev):
 *   1. Copies prisma/dev.db  ->  prisma/staging.db
 *   2. Prints how to point the app at it:  DATABASE_URL="file:./staging.db"
 *
 * Then run your migration/edit against staging:
 *   $env:DATABASE_URL="file:./staging.db"; npm run db:deploy   # test here first
 * Only after it passes do you apply the same migration to production (after a backup).
 *
 * Production (PostgreSQL): use a dump/restore into a separate staging database:
 *   pg_dump "$PROD_URL" | psql "$STAGING_URL"
 * See docs/RUNBOOK.md §6 for the full safe-change workflow.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prod = path.join(root, "prisma", "dev.db");
const staging = path.join(root, "prisma", "staging.db");

if (!fs.existsSync(prod)) {
  console.error("No prisma/dev.db to snapshot. Run `npm run db:migrate` + `npm run db:seed` first.");
  process.exit(1);
}

// clean any previous staging artefacts (db + journal/wal)
for (const ext of ["", "-journal", "-wal"]) {
  const p = staging + ext;
  if (fs.existsSync(p)) fs.rmSync(p, { force: true });
}

fs.copyFileSync(prod, staging);
const sizeMB = (fs.statSync(staging).size / 1024 / 1024).toFixed(2);

console.log(`Staging database created: prisma/staging.db  (${sizeMB} MB)\n`);
console.log("Test changes against it safely (production stays untouched):");
console.log('  PowerShell:  $env:DATABASE_URL="file:./staging.db"; npm run db:deploy');
console.log('  bash:        DATABASE_URL="file:./staging.db" npm run db:deploy');
console.log("\nWhen satisfied: back up prod (npm run db:backup), then apply the same migration to prod.");
