import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { normalizeExpenseKind } from "@/lib/server/expenses";
import { softDeleteEntity } from "@/lib/server/soft-delete-ops";
import { isValidMonthKey } from "@/lib/server/doctors";
import { num } from "@/lib/server/money";
import { parseJson, z } from "@/lib/server/validate";
import { withRoute } from "@/lib/server/http";

const ExpenseUpdateBody = z.object({
  labelEn: z.string().nullish(),
  labelAr: z.string().nullish(),
  kind: z.string().nullish(),
  amount: z.union([z.string(), z.number()]).nullish(),
  active: z.boolean().nullish(),
  monthKey: z.string().nullish(),
  monthAmount: z.union([z.string(), z.number()]).nullish(),
});

/**
 * PATCH /api/admin/expenses/[id]
 * Edit the recurring expense and/or set a specific month's override.
 * Body: { labelEn?, labelAr?, kind?, amount?, active?, monthKey?, monthAmount? }
 *   - monthKey + numeric monthAmount → upsert that month's override.
 *   - monthKey + null monthAmount    → clear that month's override (revert to recurring).
 */
export const PATCH = withRoute("admin.expenses.id.PATCH", adminExpensesIdPATCH);

async function adminExpensesIdPATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, ExpenseUpdateBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const data: Record<string, unknown> = {};
  if (typeof body.labelEn === "string" && body.labelEn.trim()) data.labelEn = body.labelEn.trim();
  if (typeof body.labelAr === "string" && body.labelAr.trim()) data.labelAr = body.labelAr.trim();
  if (typeof body.kind === "string") data.kind = normalizeExpenseKind(body.kind);
  if (body.amount != null && Number.isFinite(Number(body.amount)) && Number(body.amount) >= 0) {
    data.amount = Number(body.amount);
  }
  if (typeof body.active === "boolean") data.active = body.active;
  if (Object.keys(data).length > 0) {
    await prisma.clinicExpense.update({ where: { id }, data });
  }

  // Month override handling
  if (isValidMonthKey(body.monthKey)) {
    const monthKey = body.monthKey;
    if (body.monthAmount == null) {
      await prisma.clinicExpenseOverride.deleteMany({ where: { expenseId: id, monthKey } });
    } else if (Number.isFinite(Number(body.monthAmount)) && Number(body.monthAmount) >= 0) {
      const amount = Number(body.monthAmount);
      await prisma.clinicExpenseOverride.upsert({
        where: { expenseId_monthKey: { expenseId: id, monthKey } },
        create: { expenseId: id, monthKey, amount },
        update: { amount },
      });
    }
  }

  const expense = await prisma.clinicExpense.findUnique({ where: { id } });
  await writeAudit({
    action: "expense.update",
    actor: session,
    entityType: "ClinicExpense",
    entityId: id,
    summary: `Updated expense ${id}`,
    metadata: { fields: Object.keys(data), monthKey: body.monthKey ?? null },
    ip: auditIp(req),
  });
  return NextResponse.json({ expense: expense ? { ...expense, amount: num(expense.amount) } : null });
}

export const DELETE = withRoute("admin.expenses.id.DELETE", adminExpensesIdDELETE);

async function adminExpensesIdDELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;
  // Soft-delete: the recurring expense is hidden from every month's roll-up while
  // its month overrides stay intact for a lossless restore (they are only read
  // through the now-hidden parent, so they never affect totals meanwhile).
  await softDeleteEntity("ClinicExpense", id, session?.sub ?? null);
  await writeAudit({
    action: "expense.delete",
    actor: session,
    entityType: "ClinicExpense",
    entityId: id,
    summary: `Deleted expense ${id}`,
    ip: auditIp(req),
  });
  return NextResponse.json({ ok: true });
}
