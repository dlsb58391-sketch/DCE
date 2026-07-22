import { promises as fs } from "fs";
import path from "path";

/** Root dir for patient file binaries (kept outside .next, gitignored). */
export function uploadsDir(): string {
  const dir = process.env.UPLOADS_DIR || path.join(process.cwd(), "private-uploads");
  return path.join(dir, "patient-files");
}

export async function ensureUploadsDir(): Promise<string> {
  const dir = uploadsDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Absolute path for a stored file's relative storagePath.
 * Uses path.resolve to collapse any `..` components, then verifies the result is
 * still strictly inside the uploads directory. This is a traversal-proof
 * containment check: even a malicious storagePath written directly to the DB
 * cannot escape the uploads root.
 */
export function resolveStored(storagePath: string): string {
  const base = uploadsDir();
  const resolved = path.resolve(base, storagePath);
  const allowedPrefix = base.endsWith(path.sep) ? base : base + path.sep;
  if (!resolved.startsWith(allowedPrefix)) {
    console.error(
      `[storage] Path traversal detected: storagePath=${JSON.stringify(storagePath)} ` +
        `resolved=${JSON.stringify(resolved)} base=${JSON.stringify(base)}`,
    );
    throw new Error("storage_path_traversal");
  }
  return resolved;
}

const SAFE = /[^a-zA-Z0-9._-]/g;
export function safeName(name: string): string {
  const base = path.basename(name).replace(SAFE, "_");
  return base.slice(-120) || "file";
}

export const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

function bytesStartWith(buf: Buffer, sig: number[], offset = 0): boolean {
  if (buf.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[offset + i] !== sig[i]) return false;
  }
  return true;
}

/**
 * Verify a file's binary content matches its declared MIME type using magic-byte
 * signatures. Defends against disguised uploads (e.g. an executable renamed to a
 * .png with a spoofed content-type). Only the allow-listed types are recognised;
 * any other declared type returns false.
 */
export function mimeMatchesContent(declared: string, buf: Buffer): boolean {
  switch (declared) {
    case "image/jpeg":
      return bytesStartWith(buf, [0xff, 0xd8, 0xff]);
    case "image/png":
      return bytesStartWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/gif":
      return bytesStartWith(buf, [0x47, 0x49, 0x46, 0x38]); // "GIF8"
    case "image/webp":
      // "RIFF" .... "WEBP"
      return bytesStartWith(buf, [0x52, 0x49, 0x46, 0x46]) && bytesStartWith(buf, [0x57, 0x45, 0x42, 0x50], 8);
    case "application/pdf":
      return bytesStartWith(buf, [0x25, 0x50, 0x44, 0x46]); // "%PDF"
    case "image/heic":
    case "image/heif":
      return bytesStartWith(buf, [0x66, 0x74, 0x79, 0x70], 4); // ISO-BMFF "ftyp" box
    default:
      return false;
  }
}

export async function writeFileBuffer(relName: string, buf: Buffer): Promise<void> {
  const dest = resolveStored(relName); // throws on traversal before any I/O
  await ensureUploadsDir();
  await fs.writeFile(dest, buf);
}

export async function deleteStored(storagePath: string): Promise<void> {
  try {
    await fs.unlink(resolveStored(storagePath));
  } catch {
    /* already gone */
  }
}

export async function readStored(storagePath: string): Promise<Buffer> {
  return fs.readFile(resolveStored(storagePath));
}
