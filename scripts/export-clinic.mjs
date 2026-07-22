#!/usr/bin/env node
/**
 * export-clinic — assemble a standalone, deployable Next.js app for one clinic
 * in deploy/<slug>/. The shared source is copied and the clinic is pinned via
 * env, so the folder can be zipped and deployed to its own host/domain as-is.
 *
 * It excludes node_modules, .next, git, other clinics' databases, and the
 * Clinva product-marketing assets (public/product) that a clinic site doesn't
 * need — keeping the export small.
 *
 * Usage:  node scripts/export-clinic.mjs <slug>
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/export-clinic.mjs <slug>");
  process.exit(1);
}

const configFile = path.join(ROOT, "src", "lib", "clinics", `${slug}.ts`);
if (!fs.existsSync(configFile)) {
  console.error(`No clinic config found: src/lib/clinics/${slug}.ts. Run new-clinic.mjs first.`);
  process.exit(1);
}

const OUT = path.join(ROOT, "deploy", slug);

// Top-level items to copy into the standalone app.
const INCLUDE = [
  "src",
  "prisma",
  "public",
  "worker",
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "tsconfig.json",
  "postcss.config.mjs",
  "eslint.config.mjs",
  "components.json",
  "start-dev.cmd",
  "start-worker.cmd",
];

// Never copy these (regenerable or private) — matched anywhere by folder name.
// NOTE: top-level-only folders (clinics/, deploy/, exports/, backups/) are simply
// not in INCLUDE, so they're never copied — and must NOT be listed here, or they'd
// wrongly skip src/lib/clinics (the actual configs the app needs).
const EXCLUDE_DIRS = new Set([".next", "node_modules", ".git", ".wwebjs_auth", ".wwebjs_cache", "test-results", "playwright-report"]);
// Inside public/, skip the Clinva product marketing (not part of a clinic site).
const EXCLUDE_REL = new Set([path.join("public", "product")]);

function copyRecursive(src, dst, rel = "") {
  const base = path.basename(src);
  if (EXCLUDE_DIRS.has(base)) return;
  if (EXCLUDE_REL.has(rel)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dst, entry), path.join(rel, entry));
    }
  } else {
    // Skip SQLite db files here; we copy only this clinic's db explicitly below.
    if (/\.db(-journal)?$/.test(base)) return;
    fs.copyFileSync(src, dst);
  }
}

function readClinicMeta() {
  // Pull dbFile + photo from the generated config without importing TS.
  const txt = fs.readFileSync(configFile, "utf8");
  const dbFile = (/dbFile:\s*"([^"]+)"/.exec(txt) || [])[1] || `${slug}.db`;
  const photo = (/photo:\s*"([^"]+)"/.exec(txt) || [])[1] || "";
  return { dbFile, photo };
}

function main() {
  if (fs.existsSync(OUT)) {
    fs.rmSync(OUT, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT, { recursive: true });

  // 1) copy shared app
  for (const item of INCLUDE) {
    const src = path.join(ROOT, item);
    if (!fs.existsSync(src)) continue;
    copyRecursive(src, path.join(OUT, item), item);
  }

  const meta = readClinicMeta();

  // 2) per-clinic env: prefer the one scaffolded in clinics/<slug>/.env
  const clinicEnv = path.join(ROOT, "clinics", slug, ".env");
  let envText;
  if (fs.existsSync(clinicEnv)) {
    envText = fs.readFileSync(clinicEnv, "utf8");
  } else {
    envText = `NEXT_PUBLIC_CLINIC="${slug}"\nDATABASE_URL="file:./${meta.dbFile}"\nWHATSAPP_PROVIDER="waweb"\nWHATSAPP_DEFAULT_CC="20"\n`;
  }
  fs.writeFileSync(path.join(OUT, ".env"), envText);
  fs.writeFileSync(path.join(OUT, ".env.production"), envText);

  // 3) this clinic's database (if it exists), placed under prisma/
  const dbSrc = path.join(ROOT, "prisma", meta.dbFile);
  if (fs.existsSync(dbSrc)) {
    fs.copyFileSync(dbSrc, path.join(OUT, "prisma", meta.dbFile));
  }

  // 4) copy any staged assets from clinics/<slug>/assets into public/
  const assetsDir = path.join(ROOT, "clinics", slug, "assets");
  if (fs.existsSync(assetsDir)) {
    for (const f of fs.readdirSync(assetsDir)) {
      fs.copyFileSync(path.join(assetsDir, f), path.join(OUT, "public", f));
    }
  }

  // 5) deploy README
  fs.writeFileSync(
    path.join(OUT, "DEPLOY.md"),
    `# ${slug} — standalone deployable app

This folder is a self-contained Next.js app pinned to the "${slug}" clinic
(NEXT_PUBLIC_CLINIC=${slug}, own database ${meta.dbFile}).

## Run on a host
\`\`\`
npm install
npx prisma migrate deploy      # creates/updates ${meta.dbFile}
npm run build
npm start
\`\`\`

## Notes
- Branding comes from src/lib/clinics/${slug}.ts (already included).
- Env is in .env / .env.production — point the domain + WhatsApp vars at the real host.
- Hero photo expected at public${meta.photo}.
- The WhatsApp worker (worker/) uses WA_AGENT_SECRET from .env; run start-worker.cmd
  (or your process manager) alongside the web app.
`
  );

  // Size report
  let bytes = 0, files = 0;
  const walk = (d) => { for (const e of fs.readdirSync(d)) { const p = path.join(d, e); const s = fs.statSync(p); if (s.isDirectory()) walk(p); else { bytes += s.size; files++; } } };
  walk(OUT);

  console.log(`\n✅ Exported clinic "${slug}" -> deploy/${slug}/`);
  console.log(`   ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB (excludes node_modules/.next/product)`);
  console.log(`   DB: ${fs.existsSync(path.join(OUT, "prisma", meta.dbFile)) ? `bundled (${meta.dbFile})` : `not found — run prisma migrate deploy on host`}`);
  console.log(`\n   cd deploy/${slug} && npm install && npx prisma migrate deploy && npm run build && npm start\n`);
}

main();
