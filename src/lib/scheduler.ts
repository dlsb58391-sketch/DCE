import cron from "node-cron";

let started = false;

/** Start the once-a-minute WhatsApp scheduler (idempotent across hot reloads). */
export function startScheduler() {
  if (started) return;
  if (process.env.SCHEDULER_ENABLED === "0") return;
  started = true;

  // Every 20 seconds (6-field cron). Minute precision is enough for reminders,
  // but the shorter interval lets seconds-level follow-ups fire promptly.
  cron.schedule("*/20 * * * * *", async () => {
    try {
      const { processTick } = await import("./server/appointments");
      const r = await processTick();
      if (r.sent > 0) console.log(`[scheduler] dispatched ${r.sent} WhatsApp message(s)`);
    } catch (e) {
      console.error("[scheduler] tick failed:", e);
    }
    try {
      const { processFollowups } = await import("./server/followups");
      const f = await processFollowups();
      if (f.sent > 0) console.log(`[scheduler] sent ${f.sent} post-session follow-up(s)`);
    } catch (e) {
      console.error("[scheduler] follow-up tick failed:", e);
    }
  });

  console.log("[scheduler] started — ticking every 20s");
}
