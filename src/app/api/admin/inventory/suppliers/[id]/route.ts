import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { softDeleteEntity } from "@/lib/server/soft-delete-ops";
import { parseJson, z, zOptText } from "@/lib/server/validate";
import { withRoute } from "@/lib/server/http";

const SupplierUpdateBody = z.object({
  nameEn: zOptText,
  nameAr: zOptText,
  contactName: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  address: z.string().nullish(),
  taxId: z.string().nullish(),
  paymentTerms: z.string().nullish(),
  notes: z.string().nullish(),
  active: z.boolean().nullish(),
});

/** A nullable text field: `null`/"" clears it, a non-empty string trims + sets. */
function textPatch(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export const PATCH = withRoute("admin.inventory.suppliers.id.PATCH", supplierPatch);

async function supplierPatch(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, SupplierUpdateBody);
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;

  const data: Record<string, unknown> = {};
  if (typeof b.nameEn === "string" && b.nameEn.trim()) data.nameEn = b.nameEn.trim();
  if (typeof b.nameAr === "string" && b.nameAr.trim()) data.nameAr = b.nameAr.trim();
  for (const key of ["contactName", "phone", "email", "address", "taxId", "paymentTerms", "notes"] as const) {
    const patch = textPatch(b[key]);
    if (patch !== undefined) data[key] = patch;
  }
  if (typeof b.active === "boolean") data.active = b.active;

  const supplier = await prisma.supplier.update({ where: { id }, data });
  await writeAudit({
    action: "supplier.update",
    actor: session,
    entityType: "Supplier",
    entityId: id,
    summary: `Updated supplier ${supplier.nameEn || supplier.nameAr}`,
    ip: auditIp(req),
  });
  return NextResponse.json({ supplier });
}

export const DELETE = withRoute("admin.inventory.suppliers.id.DELETE", supplierDelete);

async function supplierDelete(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  // Soft-delete: the supplier's received batches keep their history (the
  // batch -> supplier FK is SET NULL), so removing a supplier never rewrites
  // stock valuation and is fully recoverable from the Recycle Bin.
  await softDeleteEntity("Supplier", id, session?.sub ?? null);
  await writeAudit({
    action: "supplier.delete",
    actor: session,
    entityType: "Supplier",
    entityId: id,
    summary: `Deleted supplier ${id}`,
    ip: auditIp(req),
  });
  return NextResponse.json({ ok: true });
}
