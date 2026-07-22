/** Next.js startup hook — validates critical config, then boots the scheduler. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logger } = await import("./src/lib/server/logger");

    // Pin the process timezone to the clinic's zone (Africa/Cairo) unless the
    // host already set TZ. All appointment slot/day math uses Date.setHours/
    // getHours, which read the process timezone; on a UTC host (e.g. Railway)
    // that would drift ~2–3h from the Cairo-formatted labels shown to patients.
    // Node re-runs tzset() on assignment, so setting it here — before the
    // scheduler and any route handler runs — makes all subsequent Date math
    // Cairo-local. Non-destructive: stored UTC instants are unchanged.
    if (!process.env.TZ) {
      process.env.TZ = "Africa/Cairo";
      logger.info("startup_tz_default", { tz: "Africa/Cairo" });
    }

    // Boot-time configuration validation — surface every misconfig at once via
    // structured logs (errors for functionality-breaking gaps, warnings for
    // degraded/less-secure setups). Never throws: a runnable-but-flawed process
    // still starts and logs loudly.
    const { validateEnvAndLog } = await import("./src/lib/server/env");
    await validateEnvAndLog();

    const { startScheduler } = await import("./src/lib/scheduler");
    startScheduler();
    logger.info("startup_scheduler_started", {});
  }
}
