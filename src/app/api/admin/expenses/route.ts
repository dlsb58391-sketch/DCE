import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { expensesForMonth, normalizeExpenseKind } from "@/lib/server/expenses";
import { isValidMonthKey, monthKeyOf } from "@/lib/server/doctors";
import { num } from "@/lib/server/money";
import { resolveActiveBranchId } from "@/lib/server/branch-context";
import { parseJson, z, zOptText } from "@/lib/server/validate";
import { withRoute } from "@/lib/server/http";

/**
 * GET /api/admin/expenses?month=YYYY-MM
 * Active clinic expenses with the amount that applies to the requested month
 * (recurring default unless overridden) and the month total.
 */
export const GET = withRoute("admin.expenses.GET", adminExpensesGET);

async function adminExpensesGET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const p = new URL(req.url).searchParams.get("month");
  const month = isValidMonthKey(p) ? p : monthKeyOf(new Date());
  const { expenses, total } = await expensesForMonth(month);
  return NextResponse.json({ month, expenses, total });
}

const ExpenseCreateBody = z
  .object({
    labelEn: zOptText,
    labelAr: zOptText,
    kind: z.string().nullish(),
    amount: z.union([z.string(), z.number()]).nullish(),
  })
  .refine((b) => Boolean(b.labelEn || b.labelAr), { message: "label_required", path: ["labelEn"] });

export const POST = withRoute("admin.expenses.POST", adminExpensesPOST);

async function adminExpensesPOST(req: Request) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;

  const parsed = await parseJson(req, ExpenseCreateBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const labelEn = body.labelEn ?? "";
  const labelAr = body.labelAr ?? "";

  const amount = Number(body.amount);
  const max = await prisma.clinicExpense.aggregate({ _max: { sortOrder: true } });
  const branchId = await resolveActiveBranchId();
  const expense = await prisma.clinicExpense.create({
    data: {
      labelEn: labelEn || labelAr,
      labelAr: labelAr || labelEn,
      kind: normalizeExpenseKind(body.kind),
      amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
      active: true,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
      branchId,
    },
  });
  await writeAudit({
    action: "expense.create",
    actor: session,
    entityType: "ClinicExpense",
    entityId: expense.id,
    summary: `Created expense ${expense.labelEn || expense.labelAr}`,
    metadata: { amount: Number(expense.amount), kind: expense.kind },
    ip: auditIp(req),
  });
  return NextResponse.json({ expense: { ...expense, amount: num(expense.amount) } });
}
