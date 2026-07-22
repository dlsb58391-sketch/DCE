// Build the standalone Clinva Windows desktop app (.exe installer).
//
// Pipeline (keeps the committed Postgres schema untouched — Railway stays fine):
//   1. Write a temporary SQLite variant of the Prisma schema.
//   2. Create a fresh seed database (prisma/clinva-seed.db) + generate the
//      SQLite Prisma client.
//   3. Seed the default Clinva admin + clinic settings into it.
//   4. Build Next.js in standalone mode (DESKTOP_BUILD=1, clinic=clinva).
//   5. Copy public/ and .next/static into the standalone output, ensure the
//      Prisma query engine is present.
//   6. Package with electron-builder (NSIS installer).
//   7. Restore the original Prisma client (Postgres) and remove temp files.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA = path.join(ROOT, "prisma", "schema.prisma");
const TMP_SCHEMA = path.join(ROOT, "prisma", "schema.desktop.prisma");
const SEED_DB = path.join(ROOT, "prisma", "clinva-seed.db");
const STANDALONE = path.join(ROOT, ".next", "standalone");

const SEED_URL = "file:./clinva-seed.db"; // resolved relative to prisma/
const PASSWORD = process.env.CLINVA_ADMIN_PASSWORD || "clinva2026";

function run(cmd, env = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env } });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/**
 * electron-builder can occasionally emit a corrupted app wrapper in this
 * environment. Replace it with the known-good electron runtime binary.
 */
function ensureWorkingWindowsExe() {
  const sourceExe = path.join(ROOT, "node_modules", "electron", "dist", "electron.exe");
  const targetExe = path.join(ROOT, "dist-desktop", "win-unpacked", "Clinva.exe");
  if (!fs.existsSync(sourceExe) || !fs.existsSync(targetExe)) return;
  fs.copyFileSync(sourceExe, targetExe);
  console.log("  patched win-unpacked/Clinva.exe from electron runtime");
}

/** Ensure the Prisma query engine .node/.dll is present in the standalone client. */
function ensurePrismaEngine() {
  const srcClient = path.join(ROOT, "node_modules", ".prisma", "client");
  const dstClient = path.join(STANDALONE, "node_modules", ".prisma", "client");
  if (!fs.existsSync(srcClient)) return;
  const engines = fs.readdirSync(srcClient).filter((f) => f.includes("query_engine") || f.endsWith(".dll.node"));
  fs.mkdirSync(dstClient, { recursive: true });
  for (const f of engines) {
    const d = path.join(dstClient, f);
    if (!fs.existsSync(d)) {
      fs.copyFileSync(path.join(srcClient, f), d);
      console.log("  bundled prisma engine:", f);
    }
  }
}

function main() {
  // Icon (idempotent).
  if (!fs.existsSync(path.join(ROOT, "electron", "assets", "icon.ico"))) {
    run("node scripts/make-icon.mjs");
  }

  // 1. Temp SQLite schema.
  const schema = fs.readFileSync(SCHEMA, "utf8");
  const sqliteSchema = schema.replace('provider = "postgresql"', 'provider = "sqlite"');
  fs.writeFileSync(TMP_SCHEMA, sqliteSchema);

  try {
    // 2. Fresh seed DB + SQLite client.
    for (const f of [SEED_DB, SEED_DB + "-journal"]) if (fs.existsSync(f)) fs.rmSync(f);
    run(`npx prisma db push --schema prisma/schema.desktop.prisma --skip-generate --accept-data-loss`, {
      DATABASE_URL: SEED_URL,
    });
    run(`npx prisma generate --schema prisma/schema.desktop.prisma`, { DATABASE_URL: SEED_URL });

    // 3. Seed admin + settings.
    run(`node prisma/seed.mjs`, {
      DATABASE_URL: SEED_URL,
      NEXT_PUBLIC_CLINIC: "clinva",
      CLINIC: "clinva",
      SEED_DOCTOR_PASSWORD: PASSWORD,
    });

    // 4. Next standalone build.
    run(`npx next build`, {
      DESKTOP_BUILD: "1",
      NEXT_PUBLIC_CLINIC: "clinva",
      CLINIC: "clinva",
      DATABASE_URL: SEED_URL,
      NEXT_TELEMETRY_DISABLED: "1",
    });

    // 5. Bring static assets + engine into the standalone tree.
    if (!fs.existsSync(STANDALONE)) throw new Error("standalone output missing — did next build run with output:standalone?");
    copyDir(path.join(ROOT, "public"), path.join(STANDALONE, "public"));
    copyDir(path.join(ROOT, ".next", "static"), path.join(STANDALONE, ".next", "static"));
    copyDir(path.join(ROOT, "worker"), path.join(STANDALONE, "worker"));
    ensurePrismaEngine();

    // 6. Package installer.
    run(`npx electron-builder --win nsis --config.extraMetadata.main=electron/main.js`);
    ensureWorkingWindowsExe();

    console.log("\n✅ Desktop build complete. Installer in dist-desktop/.");
  } finally {
    // 7. Cleanup + restore Postgres client for the repo's normal state.
    if (fs.existsSync(TMP_SCHEMA)) fs.rmSync(TMP_SCHEMA);
    try {
      run(`npx prisma generate`);
    } catch (e) {
      console.warn("warning: could not restore Postgres Prisma client:", e.message);
    }
  }
}

main();
