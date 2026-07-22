import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { ensureProceduresSeeded } from "@/lib/server/operations";
import { serializeProcedure } from "@/lib/server/money";
import { getPagination, jsonWithPagination } from "@/lib/server/pagination";
import { withRoute } from "@/lib/server/http";
import { parseJson, z, zOptText, zMoney } from "@/lib/server/validate";

/** Admin: the operations/procedures catalog. */
export const GET = withRoute("procedures.GET", proceduresGet);

async function proceduresGet(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  await ensureProceduresSeeded();
  const pg = getPagination(req, { defaultLimit: 100, maxLimit: 500 });
  const procedures = await prisma.procedure.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    take: pg.take,
    skip: pg.skip,
  });
  const total = pg.applied ? await prisma.procedure.count() : procedures.length;
  return jsonWithPagination({ procedures: procedures.map(serializeProcedure) }, total, pg);
}

const ProcedureCreateBody = z
  .object({
    nameEn: zOptText,
    nameAr: zOptText,
    price: zMoney,
    cost: z.union([z.string(), z.number()]).nullish(),
  })
  .refine((b) => Boolean(b.nameEn || b.nameAr), { message: "name_required", path: ["nameEn"] });

export const POST = withRoute("procedures.POST", proceduresPost);

async function proceduresPost(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const parsed = await parseJson(req, ProcedureCreateBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const nameEn = body.nameEn ?? "";
  const nameAr = body.nameAr ?? "";
  const price = body.price;

  // Optional net cost (materials/lab), for clinic-profit precision. null/blank = unset.
  let cost: number | null = null;
  if (body.cost != null && body.cost !== "") {
    const c = Number(body.cost);
    if (Number.isFinite(c) && c >= 0) cost = c;
  }

  const max = await prisma.procedure.aggregate({ _max: { sortOrder: true } });
  const procedure = await prisma.procedure.create({
    data: {
      nameEn: nameEn || nameAr,
      nameAr: nameAr || nameEn,
      price,
      cost,
      active: true,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json({ procedure: serializeProcedure(procedure) });
}
