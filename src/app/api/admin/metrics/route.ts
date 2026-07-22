import { NextResponse } from "next/server";
import { requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { withRoute } from "@/lib/server/http";
import { metrics } from "@/lib/server/metrics";

/**
 * Owner-only operational metrics: request counts by status class and per-route
 * latency quantiles (p50/p95/p99) gathered in-process. Read-only and cheap;
 * exposes no patient or financial data.
 */
export const GET = withRoute("admin.metrics.GET", metricsGet);

async function metricsGet() {
  const { error } = await requireRole(OWNER_ROLES);
  if (error) return error;
  return NextResponse.json(metrics.snapshot());
}
