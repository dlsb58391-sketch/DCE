import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth";
import { processTick } from "@/lib/server/appointments";
import { processFollowups } from "@/lib/server/followups";
import { withRoute } from "@/lib/server/http";

/**
 * Run one scheduler tick. Callable by:
 *  - a signed-in doctor (manual refresh), or
 *  - an external cron via header `x-cron-secret: $CRON_SECRET`.
 */
export const POST = withRoute("admin.tick.POST", adminTickPOST);

async function adminTickPOST(req: Request) {
  const session = await getSession();
  const secret = process.env.CRON_SECRET;
  const headerOk = !!secret && req.headers.get("x-cron-secret") === secret;
  if (!session && !headerOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await processTick();
  const followups = await processFollowups();
  return NextResponse.json({ ok: true, ...result, followups });
}
