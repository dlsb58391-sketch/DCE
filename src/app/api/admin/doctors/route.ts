import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { clampPct } from "@/lib/server/doctors";
import { serializeDoctor } from "@/lib/server/money";
import { getPagination, jsonWithPagination } from "@/lib/server/pagination";
import { withRoute } from "@/lib/server/http";
import { parseJson, z, zOptText } from "@/lib/server/validate";

/** Admin: the clinic's doctors (practitioners assignable to operations). */
export const GET = withRoute("doctors.GET", doctorsGet);

async function doctorsGet(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const pg = getPagination(req, { defaultLimit: 100, maxLimit: 500 });
  const doctors = await prisma.doctor.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    take: pg.take,
    skip: pg.skip,
  });
  const total = pg.applied ? await prisma.doctor.count() : doctors.length;
  return jsonWithPagination({ doctors: doctors.map(serializeDoctor) }, total, pg);
}

// Guard against oversized profile photos stored as data URLs (~1.5MB of base64).
const MAX_PHOTO_LEN = 1_500_000;

const DoctorCreateBody = z
  .object({
    nameEn: zOptText,
    nameAr: zOptText,
    phone: zOptText,
    email: zOptText,
    specialtyEn: zOptText,
    specialtyAr: zOptText,
    photoUrl: z.string().nullish(),
    commissionPct: z.union([z.string(), z.number()]).nullish(),
    notes: zOptText,
  })
  .refine((b) => Boolean(b.nameEn || b.nameAr), { message: "name_required", path: ["nameEn"] });

export const POST = withRoute("doctors.POST", doctorsPost);

async function doctorsPost(req: Request) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;

  const parsed = await parseJson(req, DoctorCreateBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const nameEn = body.nameEn ?? "";
  const nameAr = body.nameAr ?? "";

  const photoUrl = typeof body.photoUrl === "string" && body.photoUrl.length <= MAX_PHOTO_LEN ? body.photoUrl : null;

  const max = await prisma.doctor.aggregate({ _max: { sortOrder: true } });
  const doctor = await prisma.doctor.create({
    data: {
      nameEn: nameEn || nameAr,
      nameAr: nameAr || nameEn,
      phone: body.phone ? body.phone : null,
      email: body.email ? body.email : null,
      specialtyEn: body.specialtyEn ? body.specialtyEn : null,
      specialtyAr: body.specialtyAr ? body.specialtyAr : null,
      photoUrl,
      commissionPct: clampPct(body.commissionPct),
      notes: body.notes ? body.notes : null,
      active: true,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  await writeAudit({
    action: "doctor.create",
    actor: session,
    entityType: "Doctor",
    entityId: doctor.id,
    summary: `Created doctor ${doctor.nameEn || doctor.nameAr}`,
    metadata: { commissionPct: Number(doctor.commissionPct) },
    ip: auditIp(req),
  });
  return NextResponse.json({ doctor: serializeDoctor(doctor) });
}
