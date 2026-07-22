import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { normalizePhone } from "@/lib/server/phone";
import { ensurePatient } from "@/lib/server/appointments";
import { normalizeMethod } from "@/lib/server/operations";
import { resolveActiveBranchId } from "@/lib/server/branch-context";
import { parseJson, z, zReqText, zOptText } from "@/lib/server/validate";
import { withRoute } from "@/lib/server/http";

const PaymentBody = z.object({
  phone: zReqText,
  name: zOptText,
  amount: z.coerce.number().positive("must be greater than 0"),
  method: zOptText,
  note: zOptText,
  treatmentRecordId: z.string().trim().nullish(),
  paidAt: z.string().nullish(),
});

/**
 * POST /api/admin/payments
 * Record a payment from a patient (general, or toward a specific treatment).
 * Body: { phone, name?, amount, method?, note?, treatmentRecordId?, paidAt? }
 */
export const POST = withRoute("payments.POST", paymentsPost);

async function paymentsPost(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const parsed = await parseJson(req, PaymentBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const phoneRaw = body.phone;
  const amount = body.amount;

  const to = normalizePhone(phoneRaw).digits || phoneRaw.replace(/\D/g, "");
  const patientId = await ensurePatient(body.name || to, to);
  if (!patientId) return NextResponse.json({ error: "patient_failed" }, { status: 400 });

  // If tied to a treatment, make sure it belongs to this patient.
  let treatmentRecordId: string | null = null;
  if (body.treatmentRecordId) {
    const tr = await prisma.treatmentRecord.findUnique({
      where: { id: String(body.treatmentRecordId) },
      select: { id: true, patientId: true },
    });
    if (tr && tr.patientId === patientId) treatmentRecordId = tr.id;
  }

  const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
  const branchId = await resolveActiveBranchId();
  const payment = await prisma.payment.create({
    data: {
      patientId,
      treatmentRecordId,
      amount,
      method: normalizeMethod(body.method),
      note: body.note ? body.note : null,
      paidAt: isNaN(paidAt.getTime()) ? new Date() : paidAt,
      branchId,
    },
  });

  return NextResponse.json({ ok: true, id: payment.id });
}
