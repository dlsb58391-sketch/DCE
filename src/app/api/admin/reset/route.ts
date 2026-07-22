import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { withRoute } from "@/lib/server/http";

/**
 * POST /api/admin/reset
 * Danger zone: wipes all operational + patient data so the clinic can start
 * fresh (handoff / go-live). Preserves the login accounts (User), clinic
 * settings (Setting), the procedures catalogue (Procedure) and — unless
 * `wipeCatalog` is passed — the clinic expenses config.
 *
 * Guarded twice: an authenticated admin session AND an explicit confirm token
 * in the body, so it can never fire by accident.
 *
 * Body: { confirm: "RESET-FRESH", wipeCatalog?: boolean }
 * Returns the number of rows removed per table.
 */
const CONFIRM = "RESET-FRESH";

export const POST = withRoute("admin.reset.POST", adminResetPOST);

async function adminResetPOST(req: Request) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;

  let body: { confirm?: string; wipeCatalog?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (body?.confirm !== CONFIRM) {
    return NextResponse.json({ error: "confirm_required", hint: `send { "confirm": "${CONFIRM}" }` }, { status: 400 });
  }

  const wipeCatalog = body.wipeCatalog === true;

  // Delete children before parents so foreign keys never block a delete, even
  // where the schema doesn't cascade. Run atomically.
  const removed = await prisma.$transaction(async (tx) => {
    const payments = await tx.payment.deleteMany({});
    const treatmentDoctors = await tx.treatmentDoctor.deleteMany({});
    const doctorPayouts = await tx.doctorPayout.deleteMany({});
    const treatments = await tx.treatmentRecord.deleteMany({});
    const messages = await tx.message.deleteMany({});
    const appointments = await tx.appointment.deleteMany({});
    const chatMessages = await tx.chatMessage.deleteMany({});
    const waOutbox = await tx.waOutbox.deleteMany({});
    const waConversations = await tx.waConversation.deleteMany({});
    const patientFiles = await tx.patientFile.deleteMany({});
    const patients = await tx.patient.deleteMany({});
    const doctors = await tx.doctor.deleteMany({});

    const result: Record<string, number> = {
      payments: payments.count,
      treatmentDoctors: treatmentDoctors.count,
      doctorPayouts: doctorPayouts.count,
      treatments: treatments.count,
      messages: messages.count,
      appointments: appointments.count,
      chatMessages: chatMessages.count,
      waOutbox: waOutbox.count,
      waConversations: waConversations.count,
      patientFiles: patientFiles.count,
      patients: patients.count,
      doctors: doctors.count,
    };

    if (wipeCatalog) {
      const overrides = await tx.clinicExpenseOverride.deleteMany({});
      const expenses = await tx.clinicExpense.deleteMany({});
      const procedures = await tx.procedure.deleteMany({});
      result.expenseOverrides = overrides.count;
      result.expenses = expenses.count;
      result.procedures = procedures.count;
    }

    return result;
  });

  const total = Object.values(removed).reduce((a, b) => a + b, 0);
  await writeAudit({
    action: "admin.reset",
    actor: session,
    entityType: "Clinic",
    summary: `Wiped ${total} rows (wipeCatalog=${wipeCatalog})`,
    metadata: { removed, wipeCatalog },
    ip: auditIp(req),
  });
  return NextResponse.json({ ok: true, removed, total, keptCatalog: !wipeCatalog });
}
