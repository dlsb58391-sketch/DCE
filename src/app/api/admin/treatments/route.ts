import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { normalizePhone } from "@/lib/server/phone";
import { ensurePatient } from "@/lib/server/appointments";
import { computeTotals, normalizeMethod } from "@/lib/server/operations";
import { clampPct, computeShares, type DoctorAssignmentInput } from "@/lib/server/doctors";
import { num, numOrNull } from "@/lib/server/money";
import { resolveActiveBranchId } from "@/lib/server/branch-context";
import { parseJson, z } from "@/lib/server/validate";
import { withRoute } from "@/lib/server/http";

const tail = (p: string) => (p || "").replace(/\D/g, "").slice(-9);

/**
 * GET /api/admin/treatments?phone=...
 * Returns the patient's operations, payments and money totals (billed/paid/balance).
 * Keyed by phone so it works for any patient (WhatsApp, website or manual).
 */
export const GET = withRoute("admin.treatments.GET", adminTreatmentsGET);

async function adminTreatmentsGET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const phoneParam = new URL(req.url).searchParams.get("phone");
  if (!phoneParam) return NextResponse.json({ error: "phone_required" }, { status: 400 });

  const key = normalizePhone(phoneParam).digits || phoneParam.replace(/\D/g, "");
  const t = tail(key);
  if (t.length < 8) return NextResponse.json({ treatments: [], payments: [], totals: { billed: 0, paid: 0, balance: 0 } });

  // All patient rows that share this phone (there should be one, but match the
  // trailing digits to be safe), then their treatments + payments.
  const patients = await prisma.patient.findMany({ where: { phone: { contains: t } }, select: { id: true } });
  const patientIds = patients.map((p) => p.id);
  if (patientIds.length === 0) {
    return NextResponse.json({ treatments: [], payments: [], totals: { billed: 0, paid: 0, balance: 0 } });
  }

  const [treatments, payments] = await Promise.all([
    prisma.treatmentRecord.findMany({
      where: { patientId: { in: patientIds } },
      orderBy: { performedAt: "desc" },
      include: {
        doctors: {
          where: { deletedAt: null },
          include: { doctor: { select: { nameEn: true, nameAr: true } } },
        },
      },
    }),
    prisma.payment.findMany({
      where: { patientId: { in: patientIds } },
      orderBy: { paidAt: "desc" },
    }),
  ]);

  // Amount paid toward each specific treatment (for the per-operation remaining).
  const paidByTreatment = new Map<string, number>();
  for (const p of payments) {
    if (p.treatmentRecordId) {
      paidByTreatment.set(p.treatmentRecordId, (paidByTreatment.get(p.treatmentRecordId) ?? 0) + num(p.amount));
    }
  }

  return NextResponse.json({
    treatments: treatments.map((t) => ({
      id: t.id,
      procedureId: t.procedureId,
      nameEn: t.nameEn,
      nameAr: t.nameAr,
      basePrice: numOrNull(t.basePrice),
      discountPct: num(t.discountPct),
      price: num(t.price),
      cost: numOrNull(t.cost),
      paid: paidByTreatment.get(t.id) ?? 0,
      notes: t.notes,
      performedAt: t.performedAt.toISOString(),
      doctors: t.doctors.map((d) => ({
        doctorId: d.doctorId,
        nameEn: d.doctor?.nameEn ?? "",
        nameAr: d.doctor?.nameAr ?? "",
        commissionPct: num(d.commissionPct),
        amount: num(d.amount),
      })),
    })),
    payments: payments.map((p) => ({
      id: p.id,
      amount: num(p.amount),
      method: p.method,
      note: p.note,
      treatmentRecordId: p.treatmentRecordId,
      paidAt: p.paidAt.toISOString(),
    })),
    totals: computeTotals(treatments, payments),
  });
}

const zLoose = z.union([z.string(), z.number()]).nullish();

const TreatmentBody = z.object({
  phone: zLoose,
  name: zLoose,
  procedureId: zLoose,
  nameEn: zLoose,
  nameAr: zLoose,
  price: zLoose,
  discountPct: zLoose,
  cost: zLoose,
  doctors: z
    .array(z.object({ doctorId: zLoose, commissionPct: zLoose }).passthrough())
    .optional()
    .catch(undefined),
  notes: zLoose,
  paidNow: zLoose,
  method: zLoose,
  performedAt: zLoose,
});

/**
 * POST /api/admin/treatments
 * Records an operation for a patient (creating the patient by phone if needed),
 * with an optional percentage discount and an optional initial payment.
 * Body: { phone, name?, procedureId?, nameEn, nameAr, price(=list price),
 *         discountPct?, notes?, paidNow?, method?, performedAt? }
 */
export const POST = withRoute("admin.treatments.POST", adminTreatmentsPOST);

async function adminTreatmentsPOST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const parsed = await parseJson(req, TreatmentBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const phoneRaw = String(body.phone ?? "").trim();
  if (!phoneRaw) return NextResponse.json({ error: "phone_required" }, { status: 400 });
  const basePrice = Number(body.price);
  if (!Number.isFinite(basePrice) || basePrice < 0) return NextResponse.json({ error: "bad_price" }, { status: 400 });

  // Discount is a percentage (0–100); the net charged price = base − discount.
  let discountPct = Number(body.discountPct);
  if (!Number.isFinite(discountPct) || discountPct < 0) discountPct = 0;
  if (discountPct > 100) discountPct = 100;
  const netPrice = Math.round(basePrice * (1 - discountPct / 100) * 100) / 100;

  // Resolve the name/price from the catalog if a procedureId is given.
  let nameEn = String(body.nameEn ?? "").trim();
  let nameAr = String(body.nameAr ?? "").trim();
  let procedureId = body.procedureId ? String(body.procedureId) : null;
  let procCost: number | null = null;
  if (procedureId) {
    const proc = await prisma.procedure.findUnique({ where: { id: procedureId } });
    if (proc) {
      nameEn = nameEn || proc.nameEn;
      nameAr = nameAr || proc.nameAr;
      procCost = numOrNull(proc.cost);
    } else {
      procedureId = null; // stale id → treat as custom
    }
  }
  if (!nameEn && !nameAr) return NextResponse.json({ error: "name_required" }, { status: 400 });

  // Net cost (materials/lab) snapshot: explicit value wins, else fall back to the
  // catalog cost. null/blank clears it. Used for clinic-profit precision only.
  let cost: number | null = procCost;
  if (body.cost !== undefined) {
    if (body.cost == null || body.cost === "") cost = null;
    else if (Number.isFinite(Number(body.cost)) && Number(body.cost) >= 0) cost = Number(body.cost);
  }

  // Doctor assignments: validate the doctors exist, dedupe by id, and snapshot
  // each doctor's % + earned amount (of the net charged price) on the join row.
  // A missing/invalid per-op % falls back to the doctor's profile default.
  let shares: { doctorId: string; commissionPct: number; amount: number }[] = [];
  if (Array.isArray(body.doctors) && body.doctors.length > 0) {
    const byId = new Map<string, DoctorAssignmentInput>();
    for (const d of body.doctors) {
      const doctorId = d?.doctorId ? String(d.doctorId) : "";
      if (!doctorId) continue;
      byId.set(doctorId, { doctorId, commissionPct: Number(d?.commissionPct) });
    }
    const ids = [...byId.keys()];
    if (ids.length > 0) {
      const docs = await prisma.doctor.findMany({ where: { id: { in: ids } } });
      const known = new Map(docs.map((x) => [x.id, x]));
      const assignments: DoctorAssignmentInput[] = [];
      for (const [id, a] of byId) {
        const doc = known.get(id);
        if (!doc) continue; // silently drop unknown ids
        const pct = Number.isFinite(a.commissionPct) && a.commissionPct > 0 ? clampPct(a.commissionPct) : num(doc.commissionPct);
        assignments.push({ doctorId: id, commissionPct: pct });
      }
      const computed = computeShares(netPrice, assignments);
      if (computed.doctorsTotalPct > 100) return NextResponse.json({ error: "commission_over_100" }, { status: 400 });
      shares = computed.shares;
    }
  }

  const to = normalizePhone(phoneRaw).digits || phoneRaw.replace(/\D/g, "");
  const patientId = await ensurePatient(String(body.name ?? "").trim() || nameAr || nameEn, to);
  if (!patientId) return NextResponse.json({ error: "patient_failed" }, { status: 400 });

  const performedAt = body.performedAt ? new Date(body.performedAt) : new Date();
  const paidNow = Number(body.paidNow);
  const hasPayment = Number.isFinite(paidNow) && paidNow > 0;
  const branchId = await resolveActiveBranchId();

  // Create the treatment (with its doctor splits) and the optional initial payment
  // atomically: a crash between the two writes must never leave a billed operation
  // with a silently dropped payment (or vice-versa).
  const treatment = await prisma.$transaction(async (tx) => {
    const created = await tx.treatmentRecord.create({
      data: {
        patientId,
        procedureId,
        nameEn: nameEn || nameAr,
        nameAr: nameAr || nameEn,
        basePrice,
        discountPct,
        price: netPrice,
        cost,
        notes: body.notes ? String(body.notes).trim() : null,
        performedAt: isNaN(performedAt.getTime()) ? new Date() : performedAt,
        branchId,
        doctors: shares.length
          ? { create: shares.map((s) => ({ doctorId: s.doctorId, commissionPct: s.commissionPct, amount: s.amount })) }
          : undefined,
      },
    });

    if (hasPayment) {
      await tx.payment.create({
        data: {
          patientId,
          treatmentRecordId: created.id,
          amount: Math.min(paidNow, netPrice),
          method: normalizeMethod(body.method),
          paidAt: new Date(),
          branchId,
        },
      });
    }

    return created;
  });

  return NextResponse.json({ ok: true, id: treatment.id });
}
