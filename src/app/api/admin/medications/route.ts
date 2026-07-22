import { NextResponse } from "next/server";
import { requireSession, requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { auditIp } from "@/lib/server/audit";
import { withRoute, errorJson } from "@/lib/server/http";
import { parseJson, z } from "@/lib/server/validate";
import { listMedications, createMedication } from "@/lib/server/prescriptions-ops";

/**
 * Medication catalog collection.
 *
 * GET is readable by any signed-in staff member; `?search=` matches name/strength
 * and `?includeInactive=1` also returns deactivated entries (soft-deleted rows
 * are always hidden). POST adds a catalog medication (owner-level). The catalog
 * is a reusable template — issued prescriptions snapshot the name/strength/form
 * so editing or deleting a medication never rewrites past prescriptions.
 */
export const GET = withRoute("admin.medications.GET", medsListGet);

async function medsListGet(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const sp = new URL(req.url).searchParams;
  const includeInactive = sp.get("includeInactive") === "1" || sp.get("includeInactive") === "true";
  const { medications } = await listMedications({ search: sp.get("search"), includeInactive });
  return NextResponse.json({ medications });
}

const MedicationBody = z.object({
  nameEn: z.string().trim().min(1).nullish(),
  nameAr: z.string().trim().min(1).nullish(),
  form: z.string().trim().nullish(),
  strength: z.string().trim().nullish(),
  route: z.string().trim().nullish(),
  defaultDosage: z.string().trim().nullish(),
  defaultFrequency: z.string().trim().nullish(),
  defaultDurationDays: z.coerce.number().nullish(),
  defaultInstructions: z.string().trim().nullish(),
  notes: z.string().trim().nullish(),
  active: z.boolean().nullish(),
});

export const POST = withRoute("admin.medications.POST", medsCreatePost);

async function medsCreatePost(req: Request) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;

  const parsed = await parseJson(req, MedicationBody);
  if (!parsed.ok) return parsed.response;

  const r = await createMedication({ input: parsed.data, actor: session, ip: auditIp(req) });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}
