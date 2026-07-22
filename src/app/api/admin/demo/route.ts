import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/guard";
import { confirmAppointment, createAppointmentWithUniqueCode } from "@/lib/server/appointments";
import { DEFAULT_BRANCH_ID } from "@/lib/server/branches";
import { withRoute } from "@/lib/server/http";

/**
 * Admin demo helper: create a *confirmed* appointment N minutes from now so the
 * WhatsApp + live-queue stages can be showcased without waiting hours.
 */
export const POST = withRoute("admin.demo.POST", adminDemoPOST);

async function adminDemoPOST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const minutes = Number(body.minutes);
  const mins = Number.isFinite(minutes) ? minutes : 50;
  const lang = body.lang === "ar" ? "ar" : "en";

  const appt = await createAppointmentWithUniqueCode({
    patientName: String(body.name || "Demo Patient"),
    phone: String(body.phone || "+20 100 000 0000"),
    serviceId: "checkup",
    serviceLabelEn: "Check-up",
    serviceLabelAr: "كشف",
    scheduledAt: new Date(Date.now() + mins * 60000),
    durationMin: 30,
    lang,
    branchId: DEFAULT_BRANCH_ID,
    status: "pending",
  });

  await confirmAppointment({ id: appt.id });
  return NextResponse.json({ ok: true, code: appt.code, minutes: mins });
}
