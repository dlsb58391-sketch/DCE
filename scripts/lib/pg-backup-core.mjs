/**
 * Pure helpers for the PostgreSQL backup tool (scripts/pg-backup.mjs).
 *
 * Kept side-effect free (no fs, no child_process, no env access) so the naming,
 * retention and argument-building logic can be unit-tested without a database or
 * pg_dump installed. The wrapper script does all the actual I/O.
 */

const FILE_RE = /^cliniva-(\d{8}-\d{6})\.dump$/;

/** Zero-padded local timestamp `YYYYMMDD-HHMMSS` (matches scripts/backup.mjs). */
export function backupStamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
  );
}

/** Canonical dump file name for a stamp, e.g. `cliniva-20260201-100000.dump`. */
export function backupFileName(stamp) {
  return `cliniva-${stamp}.dump`;
}

/** True for a file this tool created (so pruning never touches foreign files). */
export function isBackupFile(name) {
  return FILE_RE.test(name);
}

/** True for a Postgres connection string (guards against dumping SQLite dev.db). */
export function isPostgresUrl(url) {
  return typeof url === "string" && /^postgres(ql)?:\/\//i.test(url.trim());
}

/**
 * Resolve the connection string to dump. Prefers BACKUP_DATABASE_URL (lets ops
 * point backups at a read replica) then DATABASE_URL. Throws a clear error when
 * missing or not a Postgres URL — this script never dumps the SQLite dev DB.
 */
export function resolveDatabaseUrl(env = {}) {
  const url = (env.BACKUP_DATABASE_URL || env.DATABASE_URL || "").trim();
  if (!url) throw new Error("No DATABASE_URL (or BACKUP_DATABASE_URL) set — nothing to back up.");
  if (!isPostgresUrl(url)) {
    throw new Error("pg-backup only supports PostgreSQL. For SQLite/desktop use `npm run db:backup`.");
  }
  return url;
}

/**
 * Parse `--keep N` from argv. Returns a positive integer (retain the N newest)
 * or null when absent/invalid (retain everything). Mirrors scripts/backup.mjs.
 */
export function parseKeep(argv = []) {
  const i = argv.indexOf("--keep");
  if (i === -1) return null;
  const n = parseInt(argv[i + 1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** True when `--verify` is passed (run `pg_restore --list` on the new dump). */
export function wantsVerify(argv = []) {
  return argv.includes("--verify");
}

/**
 * pg_dump arguments for a portable, restorable snapshot:
 *  -Fc            custom (compressed) format — restore selectively with pg_restore
 *  --no-owner     restore into any role (portable across environments)
 *  --no-privileges drop GRANT/REVOKE noise
 *  -f <file>      output path
 *
 * The dump captures EVERY row, including soft-deleted ones (deletedAt is not
 * null) — they are ordinary rows — so the Recycle Bin survives a restore.
 */
export function pgDumpArgs(databaseUrl, outFile) {
  return ["-Fc", "--no-owner", "--no-privileges", "-f", outFile, databaseUrl];
}

/** pg_restore args to list a dump's contents (a cheap integrity check). */
export function pgRestoreVerifyArgs(file) {
  return ["--list", file];
}

/**
 * Given existing backup file names and a retention count, return the names to
 * delete (oldest beyond the newest `keep`). Foreign files are ignored. Returns
 * [] when keep is null/invalid so a bad argument never deletes anything.
 */
export function selectForPrune(names = [], keep = null) {
  if (!Number.isFinite(keep) || keep <= 0) return [];
  const mine = names.filter(isBackupFile).sort().reverse(); // newest first (lexicographic == chronological)
  return mine.slice(keep);
}

/** Redact the password in a connection string for safe logging. */
export function redactUrl(url) {
  if (typeof url !== "string") return "";
  return url.replace(/(postgres(?:ql)?:\/\/[^:/@]+:)[^@]*(@)/i, "$1****$2");
}
