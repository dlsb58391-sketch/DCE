import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { withRoute } from "@/lib/server/http";

/**
 * GET /api/admin/patients/search?q=...
 * Type-ahead search across ALL patient accounts by name or phone (trailing
 * digits), for the appointment/operation client pickers. Returns up to 10.
 */
export const GET = withRoute("admin.patients.search.GET", adminPatientsSearchGET);

async function adminPatientsSearchGET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ patients: [] });

  const digits = q.replace(/\D/g, "");
  const phoneFrag = digits.length >= 6 ? digits.slice(-9) : digits;

  const or: Array<Record<string, unknown>> = [{ name: { contains: q, mode: "insensitive" } }];
  if (digits.length >= 3) or.push({ phone: { contains: phoneFrag } });

  const patients = await prisma.patient.findMany({
    where: { OR: or },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, name: true, phone: true, createdAt: true },
  });

  return NextResponse.json({
    patients: patients.map((p) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
