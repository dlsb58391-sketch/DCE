import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { confirmAppointment, findByCode, stageOf } from "@/lib/server/appointments";
import { parseJson, z } from "@/lib/server/validate";
import { withRoute } from "@/lib/server/http";

const PatchBody = z.object({
  action: z.enum(["confirm", "decline", "complete"]),
});

/** Admin: read one appointment (with messages). */
export const GET = withRoute("admin.appointments.code.GET", adminAppointmentsCodeGET);

async function adminAppointmentsCodeGET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { error } = await requireSession();
  if (error) return error;
  const { code } = await ctx.params;
  const appt = await prisma.appointment.findUnique({
    where: { code: code.toUpperCase() },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!appt) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ appointment: { ...appt, stage: stageOf(appt) } });
}

/** Admin: confirm / decline / complete a booking. Confirm fires the WhatsApp flow. */
export const PATCH = withRoute("admin.appointments.code.PATCH", adminAppointmentsCodePATCH);

async function adminAppointmentsCodePATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { error } = await requireSession();
  if (error) return error;
  const { code } = await ctx.params;

  const parsed = await parseJson(req, PatchBody);
  if (!parsed.ok) return parsed.response;
  const { action } = parsed.data;

  const appt = await findByCode(code);
  if (!appt) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (action === "confirm") {
    const updated = await confirmAppointment({ id: appt.id });
    return NextResponse.json({ ok: true, appointment: updated });
  }
  if (action === "decline") {
    const updated = await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: "declined" },
    });
    return NextResponse.json({ ok: true, appointment: updated });
  }
  const updated = await prisma.appointment.update({
    where: { id: appt.id },
    data: { status: "completed", completedAt: new Date() },
  });
  return NextResponse.json({ ok: true, appointment: updated });
}
