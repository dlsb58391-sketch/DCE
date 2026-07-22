import { NextResponse } from "next/server";
import { findByCode, publicView, type Stage } from "@/lib/server/appointments";
import { withRoute } from "@/lib/server/http";

const STAGES: Stage[] = ["pending", "reserved", "reminder", "queue", "turn", "completed", "declined", "cancelled"];

/** Public live tracker data for a booking code. `?preview=<stage>` forces a stage. */
export const GET = withRoute("track.code.GET", trackCodeGET);

async function trackCodeGET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const appt = await findByCode(code);
  if (!appt) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const view = await publicView(appt);

  const preview = new URL(req.url).searchParams.get("preview");
  if (preview && STAGES.includes(preview as Stage)) {
    view.stage = preview as Stage;
    if (view.stage === "queue" && view.ahead === 0) view.ahead = 3; // illustrative
  }

  return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
}
