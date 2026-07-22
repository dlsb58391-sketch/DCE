import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { softDeleteEntity } from "@/lib/server/soft-delete-ops";
import { clampPct } from "@/lib/server/doctors";
import { serializeDoctor } from "@/lib/server/money";
import { parseJson, z } from "@/lib/server/validate";
import { withRoute } from "@/lib/server/http";

const MAX_PHOTO_LEN = 1_500_000;

const DoctorUpdateBody = z.object({
  nameEn: z.string().nullish(),
  nameAr: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  specialtyEn: z.string().nullish(),
  specialtyAr: z.string().nullish(),
  photoUrl: z.string().nullish(),
  commissionPct: z.union([z.string(), z.number()]).nullish(),
  notes: z.string().nullish(),
  active: z.boolean().nullish(),
});

/** Admin: edit or remove a doctor. */
export const PATCH = withRoute("admin.doctors.id.PATCH", adminDoctorsIdPATCH);

async function adminDoctorsIdPATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, DoctorUpdateBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const data: Record<string, unknown> = {};
  if (typeof body.nameEn === "string" && body.nameEn.trim()) data.nameEn = body.nameEn.trim();
  if (typeof body.nameAr === "string" && body.nameAr.trim()) data.nameAr = body.nameAr.trim();
  if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;
  if (body.email !== undefined) data.email = body.email ? String(body.email).trim() : null;
  if (body.specialtyEn !== undefined) data.specialtyEn = body.specialtyEn ? String(body.specialtyEn).trim() : null;
  if (body.specialtyAr !== undefined) data.specialtyAr = body.specialtyAr ? String(body.specialtyAr).trim() : null;
  if (body.photoUrl !== undefined) {
    data.photoUrl =
      typeof body.photoUrl === "string" && body.photoUrl && body.photoUrl.length <= MAX_PHOTO_LEN
        ? body.photoUrl
        : null;
  }
  if (body.commissionPct != null) data.commissionPct = clampPct(body.commissionPct);
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
  if (typeof body.active === "boolean") data.active = body.active;

  const doctor = await prisma.doctor.update({ where: { id }, data });
  await writeAudit({
    action: "doctor.update",
    actor: session,
    entityType: "Doctor",
    entityId: id,
    summary: `Updated doctor ${doctor.nameEn || doctor.nameAr}`,
    metadata: { fields: Object.keys(data) },
    ip: auditIp(req),
  });
  return NextResponse.json({ doctor: serializeDoctor(doctor) });
}

export const DELETE = withRoute("admin.doctors.id.DELETE", adminDoctorsIdDELETE);

async function adminDoctorsIdDELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  // Soft-delete: the doctor and its commission splits + payouts are stamped
  // deletedAt in one transaction (the same rows today's ON DELETE CASCADE would
  // remove), so earnings/revenue roll-ups drop them exactly as before while the
  // records stay recoverable in the Recycle Bin.
  const existing = await prisma.doctor.findUnique({ where: { id }, select: { nameEn: true, nameAr: true } });
  await softDeleteEntity("Doctor", id, session?.sub ?? null);
  await writeAudit({
    action: "doctor.delete",
    actor: session,
    entityType: "Doctor",
    entityId: id,
    summary: existing ? `Deleted doctor ${existing.nameEn || existing.nameAr}` : `Deleted doctor ${id}`,
    ip: auditIp(req),
  });
  return NextResponse.json({ ok: true });
}
