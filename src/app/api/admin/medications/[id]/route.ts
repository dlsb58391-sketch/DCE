import { NextResponse } from "next/server";
import { requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { auditIp } from "@/lib/server/audit";
import { withRoute, errorJson } from "@/lib/server/http";
import { parseJson, z } from "@/lib/server/validate";
import { updateMedication, deleteMedication } from "@/lib/server/prescriptions-ops";

/**
 * One catalog medication: edit (PATCH) or soft-delete (DELETE). Both owner-level.
 * A DELETE moves the entry to the Recycle Bin; issued prescriptions keep their
 * snapshots, so past documents are unaffected.
 */
const MedicationUpdateBody = z.object({
  nameEn: z.string().trim().min(1).optional(),
  nameAr: z.string().trim().min(1).optional(),
  form: z.string().trim().nullish(),
  strength: z.string().trim().nullish(),
  route: z.string().trim().nullish(),
  defaultDosage: z.string().trim().nullish(),
  defaultFrequency: z.string().trim().nullish(),
  defaultDurationDays: z.coerce.number().nullish(),
  defaultInstructions: z.string().trim().nullish(),
  notes: z.string().trim().nullish(),
  active: z.boolean().optional(),
});

export const PATCH = withRoute("admin.medications.id.PATCH", medPatch);

async function medPatch(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, MedicationUpdateBody);
  if (!parsed.ok) return parsed.response;

  const r = await updateMedication({ id, input: parsed.data, actor: session, ip: auditIp(req) });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}

export const DELETE = withRoute("admin.medications.id.DELETE", medDelete);

async function medDelete(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const r = await deleteMedication({ id, actor: session, ip: auditIp(req) });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json({ ok: true });
}
