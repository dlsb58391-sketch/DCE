import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { softDeleteEntity } from "@/lib/server/soft-delete-ops";
import { serializeProcedure } from "@/lib/server/money";
import { parseJson, z } from "@/lib/server/validate";
import { withRoute } from "@/lib/server/http";

const ProcedureUpdateBody = z.object({
  nameEn: z.string().nullish(),
  nameAr: z.string().nullish(),
  price: z.union([z.string(), z.number()]).nullish(),
  cost: z.union([z.string(), z.number()]).nullish(),
  active: z.boolean().nullish(),
});

/** Admin: edit or remove a catalog procedure. */
export const PATCH = withRoute("admin.procedures.id.PATCH", adminProceduresIdPATCH);

async function adminProceduresIdPATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, ProcedureUpdateBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const data: { nameEn?: string; nameAr?: string; price?: number; cost?: number | null; active?: boolean } = {};
  if (typeof body.nameEn === "string" && body.nameEn.trim()) data.nameEn = body.nameEn.trim();
  if (typeof body.nameAr === "string" && body.nameAr.trim()) data.nameAr = body.nameAr.trim();
  if (body.price != null && Number.isFinite(Number(body.price)) && Number(body.price) >= 0) {
    data.price = Number(body.price);
  }
  // cost: null or "" clears it; a valid number ≥ 0 sets it; anything else is ignored.
  if (body.cost !== undefined) {
    if (body.cost == null || body.cost === "") data.cost = null;
    else if (Number.isFinite(Number(body.cost)) && Number(body.cost) >= 0) data.cost = Number(body.cost);
  }
  if (typeof body.active === "boolean") data.active = body.active;

  const procedure = await prisma.procedure.update({ where: { id }, data });
  return NextResponse.json({ procedure: serializeProcedure(procedure) });
}

export const DELETE = withRoute("admin.procedures.id.DELETE", adminProceduresIdDELETE);

async function adminProceduresIdDELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;

  // Soft-delete: treatment records keep their snapshot (procedureId stays put but
  // the catalog entry is hidden, matching the old SET NULL effect on reads), so
  // removing a catalog entry never corrupts history and is fully recoverable.
  await softDeleteEntity("Procedure", id, session?.sub ?? null);
  await writeAudit({
    action: "procedure.delete",
    actor: session,
    entityType: "Procedure",
    entityId: id,
    summary: `Deleted procedure ${id}`,
    ip: auditIp(req),
  });
  return NextResponse.json({ ok: true });
}
