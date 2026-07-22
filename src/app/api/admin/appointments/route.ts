import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { stageOf, minutesUntil, ensurePatient } from "@/lib/server/appointments";
import { normalizePhone } from "@/lib/server/phone";
import { generateCode } from "@/lib/server/code";
import { getPagination, jsonWithPagination } from "@/lib/server/pagination";
import { withRoute } from "@/lib/server/http";
import { resolveActiveBranchId, resolveBranchScope, branchWhereFilter } from "@/lib/server/branch-context";
import {
  parseJson,
  z,
  zReqText,
  zOptText,
  zRequiredDateString,
} from "@/lib/server/validate";

/** Admin: list recent appointments with their WhatsApp message log + live stage. */
export const GET = withRoute("appointments.GET", appointmentsGet);

async function appointmentsGet(req: Request) {
  const { error, session } = await requireSession();
  if (error) return error;

  const status = new URL(req.url).searchParams.get("status") || undefined;
  const now = new Date();
  const pg = getPagination(req, { defaultLimit: 100, maxLimit: 500 });

  // Scope the schedule to the active branch (owners can view all branches).
  const scope = await resolveBranchScope({ role: session.role });
  const branchFilter = branchWhereFilter(scope);
  const and: Record<string, unknown>[] = [];
  if (status) and.push({ status });
  if (Object.keys(branchFilter).length) and.push(branchFilter);
  const where = and.length ? { AND: and } : undefined;

  const appts = await prisma.appointment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: pg.applied ? pg.take : 100,
    skip: pg.applied ? pg.skip : undefined,
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      doctor: { select: { id: true, nameEn: true, nameAr: true } },
    },
  });

  const total = pg.applied ? await prisma.appointment.count({ where }) : appts.length;

  return jsonWithPagination(
    {
      appointments: appts.map((a) => ({
        ...a,
        doctorNameEn: a.doctor?.nameEn ?? null,
        doctorNameAr: a.doctor?.nameAr ?? null,
        stage: stageOf(a, now),
        minutesUntil: Math.round(minutesUntil(a, now)),
      })),
    },
    total,
    pg
  );
}

/**
 * POST /api/admin/appointments
 * Doctor books an appointment straight from the dashboard. Creates a *confirmed*
 * appointment (so it lands on the schedule immediately), optionally assigned to a
 * doctor, and links or creates the client account:
 *   - patientId given  → use that existing profile.
 *   - createAccount !== false → ensurePatient (dedupes by phone, creates if new).
 *   - createAccount === false → book with name+phone only, no account linked yet.
 * Body: { name, phone, scheduledAt, durationMin?, serviceId?, serviceLabelEn?,
 *         serviceLabelAr?, complaint?, doctorId?, patientId?, createAccount? }
 */
const AppointmentBody = z.object({
  name: zReqText,
  phone: zReqText,
  scheduledAt: zRequiredDateString,
  durationMin: z.union([z.string(), z.number()]).nullish(),
  serviceId: zOptText,
  serviceLabelEn: zOptText,
  serviceLabelAr: zOptText,
  complaint: zOptText,
  doctorId: z.string().trim().nullish(),
  patientId: z.string().trim().nullish(),
  createAccount: z.boolean().optional().catch(undefined),
  lang: z.string().optional().catch(undefined),
});

export const POST = withRoute("appointments.POST", appointmentsPost);

async function appointmentsPost(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const parsed = await parseJson(req, AppointmentBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const name = body.name;
  const phoneRaw = body.phone;

  const when = new Date(body.scheduledAt);

  const serviceId = (body.serviceId || "checkup").trim() || "checkup";
  const serviceLabelEn = (body.serviceLabelEn || serviceId).trim() || serviceId;
  const serviceLabelAr = (body.serviceLabelAr || serviceLabelEn).trim() || serviceLabelEn;

  // Validate the doctor if one was chosen.
  let doctorId: string | null = body.doctorId ? String(body.doctorId) : null;
  if (doctorId) {
    const doc = await prisma.doctor.findUnique({ where: { id: doctorId }, select: { id: true } });
    if (!doc) doctorId = null;
  }

  const norm = normalizePhone(phoneRaw);
  const phone = norm.e164 || phoneRaw;

  // Resolve the client account.
  let patientId: string | null = null;
  if (body.patientId) {
    const existing = await prisma.patient.findUnique({ where: { id: String(body.patientId) }, select: { id: true } });
    patientId = existing?.id ?? null;
  }
  if (!patientId && body.createAccount !== false) {
    try {
      patientId = await ensurePatient(name, phone);
    } catch (e) {
      console.error("[appointments] ensurePatient failed:", e instanceof Error ? e.message : e);
    }
  }

  // Unique short tracking code (same alphabet as bookings).
  let code = generateCode();
  for (let i = 0; i < 6; i++) {
    const clash = await prisma.appointment.findUnique({ where: { code }, select: { id: true } });
    if (!clash) break;
    code = generateCode();
  }

  const durationNum = Number(body.durationMin);
  const appt = await prisma.appointment.create({
    data: {
      code,
      patientName: name,
      phone,
      serviceId,
      serviceLabelEn,
      serviceLabelAr,
      scheduledAt: when,
      durationMin: durationNum > 0 ? Math.round(durationNum) : 30,
      complaint: body.complaint ? body.complaint : null,
      lang: body.lang === "ar" ? "ar" : "en",
      status: "confirmed",
      confirmedAt: new Date(),
      doctorId,
      patientId,
      branchId: await resolveActiveBranchId(),
    },
  });

  return NextResponse.json({ ok: true, code: appt.code, id: appt.id });
}

