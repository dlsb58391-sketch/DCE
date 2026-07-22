import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { getPagination, jsonWithPagination } from "@/lib/server/pagination";
import { withRoute } from "@/lib/server/http";
import { parseJson, z, zOptText } from "@/lib/server/validate";

/**
 * Inventory suppliers catalog.
 *
 * GET is readable by any signed-in staff member; creating a supplier is an
 * owner-level action. Suppliers are soft-deletable, so the list is auto-scoped
 * to live rows by the Prisma extension (deleted suppliers live in the Recycle
 * Bin). No Decimal fields, so rows are returned as-is.
 */
export const GET = withRoute("admin.inventory.suppliers.GET", suppliersGet);

async function suppliersGet(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const pg = getPagination(req, { defaultLimit: 200, maxLimit: 500 });
  const suppliers = await prisma.supplier.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    take: pg.take,
    skip: pg.skip,
  });
  const total = pg.applied ? await prisma.supplier.count() : suppliers.length;
  return jsonWithPagination({ suppliers }, total, pg);
}

const SupplierCreateBody = z
  .object({
    nameEn: zOptText,
    nameAr: zOptText,
    contactName: zOptText,
    phone: zOptText,
    email: zOptText,
    address: zOptText,
    taxId: zOptText,
    paymentTerms: zOptText,
    notes: zOptText,
    active: z.boolean().optional(),
  })
  .refine((b) => Boolean(b.nameEn || b.nameAr), { message: "name_required", path: ["nameEn"] });

export const POST = withRoute("admin.inventory.suppliers.POST", suppliersPost);

async function suppliersPost(req: Request) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;

  const parsed = await parseJson(req, SupplierCreateBody);
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;

  const nameEn = b.nameEn ?? "";
  const nameAr = b.nameAr ?? "";
  const max = await prisma.supplier.aggregate({ _max: { sortOrder: true } });
  const supplier = await prisma.supplier.create({
    data: {
      nameEn: nameEn || nameAr,
      nameAr: nameAr || nameEn,
      contactName: b.contactName ?? null,
      phone: b.phone ?? null,
      email: b.email ?? null,
      address: b.address ?? null,
      taxId: b.taxId ?? null,
      paymentTerms: b.paymentTerms ?? null,
      notes: b.notes ?? null,
      active: b.active ?? true,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  await writeAudit({
    action: "supplier.create",
    actor: session,
    entityType: "Supplier",
    entityId: supplier.id,
    summary: `Created supplier ${supplier.nameEn || supplier.nameAr}`,
    ip: auditIp(req),
  });
  return NextResponse.json({ supplier });
}
