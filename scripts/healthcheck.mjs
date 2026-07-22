#!/usr/bin/env node
/**
 * Ping the running server's health endpoint and report.
 *
 *   node scripts/healthcheck.mjs              # checks http://localhost:3000
 *   BASE_URL=https://your-domain.com node scripts/healthcheck.mjs
 *
 * Exit code 0 = healthy, 1 = unhealthy/unreachable (so it can drive cron/monitoring alerts).
 */
const base = process.env.BASE_URL || "http://localhost:3000";
const url = `${base.replace(/\/$/, "")}/api/health`;

try {
  const started = Date.now();
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  const ms = Date.now() - started;
  if (res.ok && body.status === "ok") {
    console.log(`[healthy] ${url}  db=${body.db} uptime=${body.uptimeSec}s rtt=${ms}ms`);
    process.exit(0);
  }
  console.error(`[unhealthy] ${url}  http=${res.status} ${JSON.stringify(body)}`);
  process.exit(1);
} catch (e) {
  console.error(`[unreachable] ${url}  ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
