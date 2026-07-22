import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/guard";
import { getFollowupConfig, setFollowupConfig } from "@/lib/server/followups";
import { parseJson, z } from "@/lib/server/validate";
import { withRoute } from "@/lib/server/http";

/** Admin: read or update the post-session follow-up settings (on/off + delay). */
export const GET = withRoute("admin.settings.followup.GET", adminSettingsFollowupGET);

async function adminSettingsFollowupGET() {
  const { error } = await requireSession();
  if (error) return error;
  const config = await getFollowupConfig();
  return NextResponse.json({ config });
}

const FollowupBody = z.object({
  enabled: z.boolean().optional().catch(undefined),
  delaySeconds: z.union([z.string(), z.number()]).nullish(),
  delayMinutes: z.union([z.string(), z.number()]).nullish(),
});

export const PUT = withRoute("admin.settings.followup.PUT", adminSettingsFollowupPUT);

async function adminSettingsFollowupPUT(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const parsed = await parseJson(req, FollowupBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // Accept delaySeconds (preferred) or legacy delayMinutes.
  let delaySeconds = Number(body.delaySeconds);
  if (!Number.isFinite(delaySeconds) || delaySeconds <= 0) {
    const mins = Number(body.delayMinutes);
    delaySeconds = Number.isFinite(mins) && mins > 0 ? mins * 60 : NaN;
  }

  const config = await setFollowupConfig({
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    delaySeconds: Number.isFinite(delaySeconds) && delaySeconds > 0 ? delaySeconds : undefined,
  });
  return NextResponse.json({ config });
}
