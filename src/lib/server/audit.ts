/**
 * Append-only audit trail for sensitive/destructive actions.
 *
 * Design goals:
 *   - Best-effort: a failure to write an audit row must never break the primary
 *     operation, so every write is wrapped and errors are logged, not thrown.
 *   - Cheap to call from any route handler.
 *   - Structured `metadata` for before/after snapshots and request context.
 *
 * Rows are queried in the Audit Center (see reports UI) and are never updated or
 * deleted by application code.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionPayload } from "@/lib/server/auth";

export type AuditInput = {
  action: string; // dotted verb, e.g. "doctor.delete", "admin.reset", "payout.create"
  actor?: Pick<SessionPayload, "sub" | "name"> | null;
  actorId?: string | null;
  actorName?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
};

/** Best-effort audit write. Never throws. */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId ?? input.actor?.sub ?? null,
        actorName: input.actorName ?? input.actor?.name ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        summary: input.summary ?? null,
        metadata: input.metadata,
        ip: input.ip ?? null,
      },
    });
  } catch (err) {
    // Do not surface audit failures to callers; log for observability only.
    console.error(`[audit] failed to record ${input.action}:`, err);
  }
}

/** Best-effort IP extraction from a request (proxy-aware, first hop wins). */
export function auditIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}
