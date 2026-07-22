import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildHealthPayload } from "@/lib/server/health";

/**
 * Readiness probe (GET): returns 200 with build/version metadata when the DB is
 * reachable, 503 otherwise. Backward compatible — all previously returned fields
 * (status, db, uptimeSec, latencyMs, time) are preserved; version/commit/env are
 * additive.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      buildHealthPayload({
        db: "up",
        latencyMs: Date.now() - startedAt,
        uptimeSec: Math.round(process.uptime()),
        time: new Date().toISOString(),
      }),
    );
  } catch (e) {
    return NextResponse.json(
      buildHealthPayload({
        db: "down",
        latencyMs: Date.now() - startedAt,
        uptimeSec: Math.round(process.uptime()),
        time: new Date().toISOString(),
        error: e instanceof Error ? e.message : "unknown",
      }),
      { status: 503 },
    );
  }
}

/**
 * Liveness probe (HEAD): confirms the process is up and serving without touching
 * the database. Cheap enough for aggressive orchestrator polling.
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

