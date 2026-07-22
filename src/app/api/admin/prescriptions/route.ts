import { NextResponse } from "next/server";
import { requireSession, requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { auditIp } from "@/lib/server/audit";
import { getPagination, jsonWithPagination } from "@/lib/server/pagination";
import { withRoute, errorJson } from "@/lib/server/http";
import { parseJson, z } from "@/lib/server/validate";
import { listPrescriptionsByPhone, createPrescription } from "@/lib/server/prescriptions-ops";
import { resolveActiveBranchId } from "@/lib/server/branch-context";

/**
 * Prescriptions collection, keyed by patient phone (like /admin/treatments).
 *
 * GET ?phone=... returns that patient's prescriptions (newest first), readable by
 * any signed-in staff member; soft-deleted prescriptions are auto-hidden. POST
 * issues a new prescription (owner-level) — the patient is looked up / created by
 * phone and the patient, doctor and each medication line are snapshotted so the
 * printed document stays stable.
 */
export const GET = withRoute("admin.prescriptions.GET", rxListGet);

async function rxListGet(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const phone = new URL(req.url).searchParams.get("phone");
  if (!phone) return errorJson("phone_required", 400);

  const pg = getPagination(req, { defaultLimit: 100, maxLimit: 200 });
  const { prescriptions, total } = await listPrescriptionsByPhone(phone, pg.take, pg.skip);
  return jsonWithPagination({ prescriptions }, total, pg);
}

const RxItemBody = z.object({
  medicationId: z.string().trim().min(1).nullish(),
  nameEn: z.string().trim().nullish(),
  nameAr: z.string().trim().nullish(),
  strength: z.string().trim().nullish(),
  form: z.string().trim().nullish(),
  dosage: z.string().trim().nullish(),
  frequency: z.string().trim().nullish(),
  durationDays: z.coerce.number().nullish(),
  quantity: z.string().trim().nullish(),
  refills: z.coerce.number().nullish(),
  instructions: z.string().trim().nullish(),
});

const RxCreateBody = z.object({
  phone: z.string().trim().min(1),
  name: z.string().trim().nullish(),
  doctorId: z.string().trim().min(1).nullish(),
  appointmentId: z.string().trim().min(1).nullish(),
  diagnosis: z.string().trim().nullish(),
  notes: z.string().trim().nullish(),
  items: z.array(RxItemBody).min(1, "add at least one medication"),
});

export const POST = withRoute("admin.prescriptions.POST", rxCreatePost);

async function rxCreatePost(req: Request) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;

  const parsed = await parseJson(req, RxCreateBody);
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;

  const r = await createPrescription({
    phone: b.phone,
    name: b.name ?? null,
    doctorId: b.doctorId ?? null,
    appointmentId: b.appointmentId ?? null,
    diagnosis: b.diagnosis ?? null,
    notes: b.notes ?? null,
    branchId: await resolveActiveBranchId(),
    items: b.items.map((it) => ({
      medicationId: it.medicationId ?? null,
      nameEn: it.nameEn ?? null,
      nameAr: it.nameAr ?? null,
      strength: it.strength ?? null,
      form: it.form ?? null,
      dosage: it.dosage ?? null,
      frequency: it.frequency ?? null,
      durationDays: it.durationDays ?? null,
      quantity: it.quantity ?? null,
      refills: it.refills ?? null,
      instructions: it.instructions ?? null,
    })),
    actor: session,
    ip: auditIp(req),
  });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}
