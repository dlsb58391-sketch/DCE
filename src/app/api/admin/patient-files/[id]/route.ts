import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { softDeleteEntity } from "@/lib/server/soft-delete-ops";
import { withRoute } from "@/lib/server/http";

/** Soft-delete a patient file (moves the DB row to the Recycle Bin; the disk
 * binary is retained so a restore is lossless — permanent delete removes it). */
export const DELETE = withRoute("admin.patient-files.id.DELETE", adminPatientfilesIdDELETE);

async function adminPatientfilesIdDELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;

  const { id } = await ctx.params;
  const file = await prisma.patientFile.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await softDeleteEntity("PatientFile", id, session?.sub ?? null);
  await writeAudit({
    action: "patientFile.delete",
    actor: session,
    entityType: "PatientFile",
    entityId: id,
    summary: `Deleted file ${file.fileName} for patient ${file.patientKey}`,
    metadata: { patientKey: file.patientKey, category: file.category },
    ip: auditIp(req),
  });
  return NextResponse.json({ ok: true });
}
