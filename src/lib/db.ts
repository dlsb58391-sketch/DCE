import { PrismaClient } from "@prisma/client";
import { softDeleteExtension } from "@/lib/server/soft-delete";

// Build the singleton client with the soft-delete filter applied. The extension
// hides `deletedAt`-stamped rows from every list/aggregate read (see
// src/lib/server/soft-delete.ts), so soft-deleted records disappear from the UI
// and all financial roll-ups exactly as a hard delete would — without losing the
// data. Writes and the Recycle Bin opt out explicitly.
function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  }).$extends(softDeleteExtension);
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// The client handed to an interactive `prisma.$transaction((tx) => …)` callback.
// Because our singleton is `$extends`-ed with the soft-delete extension, that
// callback client is NOT the base `Prisma.TransactionClient` — it is the
// extended client minus the connection-management methods. Helpers that receive
// a transaction client (e.g. postReceipt, nextPoCode) must type it as this so
// the extended `tx` is assignable.
export type TxClient = Omit<
  ExtendedPrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

// Reuse a single client across hot-reloads / serverless invocations.
const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Cache the client on the global in EVERY environment. Cliniva runs as a
// long-lived server (Railway `next start`) and as an Electron desktop process —
// never per-request serverless — so skipping the cache in production would open a
// fresh connection pool on each cold module load and exhaust Postgres'
// max_connections under load. (Reviewed: backend blueprint Issue 9.)
globalForPrisma.prisma = prisma;
