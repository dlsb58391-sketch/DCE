import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { softDeleteInTransaction } from "@/lib/server/soft-delete-ops";
import { sessionTypes, sessionTypeById } from "@/lib/dashboard";
import { parseJson, z } from "@/lib/server/validate";
import { withRoute } from "@/lib/server/http";

/**
 * Admin: manage client accounts. Clients live in the database (Patient table).
 * A patient is shown in the Clients tab when it was added manually by the doctor
 * (source = "manual") OR it has at least one confirmed/completed appointment
 * (a real client account created from a website/WhatsApp booking).
 *
 * GET    — list clients (with derived session history + medical history)
 * POST   — create a manual client
 * PATCH  — edit a client
 * DELETE — remove a client (blocked when it has recorded operations, to protect
 *          earnings history)
 */

const digitsTail = (p: string) => (p || "").replace(/\D/g, "").slice(-9);

type ApptRow = {
  code: string;
  phone: string;
  serviceId: string;
  scheduledAt: Date;
  status: string;
  complaint: string | null;
};

const sessionStatus = (s: string): "completed" | "scheduled" | "cancelled" =>
  s === "completed" ? "completed" : s === "cancelled" || s === "declined" ? "cancelled" : "scheduled";

function buildSessions(phone: string, appts: ApptRow[]) {
  const pt = digitsTail(phone);
  if (pt.length < 8) return [];
  return appts
    .filter((a) => digitsTail(a.phone) === pt)
    .map((a) => {
      const typeId = sessionTypes.some((s) => s.id === a.serviceId) ? a.serviceId : "checkup";
      return {
        id: `wa-${a.code}`,
        typeId,
        date: a.scheduledAt.toISOString().slice(0, 10),
        cost: sessionTypeById(typeId).price,
        status: sessionStatus(a.status),
        notes: a.complaint ?? undefined,
      };
    });
}

type PatientRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  gender: string | null;
  source: string;
  notes: string | null;
  medical: Prisma.JsonValue;
  createdAt: Date;
};

function mapPatient(p: PatientRow, appts: ApptRow[]) {
  return {
    id: p.id,
    name: p.name,
    phone: p.phone,
    email: p.email ?? "",
    gender: (p.gender as "male" | "female" | undefined) ?? undefined,
    source: (p.source === "manual" ? "manual" : "booking") as "manual" | "booking",
    createdAt: p.createdAt.toISOString().slice(0, 10),
    notes: p.notes ?? "",
    medical: (p.medical as Record<string, string> | null) ?? undefined,
    sessions: buildSessions(p.phone, appts),
    payments: [] as never[],
  };
}

async function loadAppts(): Promise<ApptRow[]> {
  return prisma.appointment.findMany({
    orderBy: { scheduledAt: "asc" },
    take: 2000,
    select: { code: true, phone: true, serviceId: true, scheduledAt: true, status: true, complaint: true },
  });
}

export const GET = withRoute("admin.patients.GET", adminPatientsGET);

async function adminPatientsGET() {
  const { error } = await requireSession();
  if (error) return error;

  const [patients, appts] = await Promise.all([
    prisma.patient.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    loadAppts(),
  ]);

  // Real client accounts: manual additions, or bookers with a confirmed/completed
  // appointment (raw unconfirmed website leads are not clients yet).
  const confirmedTails = new Set(
    appts
      .filter((a) => a.status === "confirmed" || a.status === "completed")
      .map((a) => digitsTail(a.phone))
      .filter((d) => d.length >= 8)
  );

  const mapped = patients
    .filter((p) => p.source === "manual" || confirmedTails.has(digitsTail(p.phone)))
    .map((p) => mapPatient(p, appts));

  return NextResponse.json({ patients: mapped });
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function medicalInput(
  medical: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (medical === undefined) return undefined; // leave unchanged
  if (medical === null) return Prisma.DbNull;
  const cleaned = Object.fromEntries(
    Object.entries(medical).filter(([, v]) => typeof v === "string" && v.trim() !== "")
  );
  return Object.keys(cleaned).length ? (cleaned as Prisma.InputJsonValue) : Prisma.DbNull;
}

const PatientBody = z.object({
  id: z.string().nullish(),
  name: z.union([z.string(), z.number()]).nullish(),
  phone: z.union([z.string(), z.number()]).nullish(),
  email: z.union([z.string(), z.number()]).nullish(),
  gender: z.string().nullish(),
  notes: z.union([z.string(), z.number()]).nullish(),
  medical: z.record(z.string(), z.unknown()).nullish().catch(undefined),
});

export const POST = withRoute("admin.patients.POST", adminPatientsPOST);

async function adminPatientsPOST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const parsed = await parseJson(req, PatientBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const name = str(body.name);
  const phone = str(body.phone);
  if (!name || !phone) {
    return NextResponse.json({ error: "name and phone are required" }, { status: 400 });
  }

  const gender = body.gender === "male" || body.gender === "female" ? body.gender : null;
  const created = await prisma.patient.create({
    data: {
      name,
      phone,
      email: str(body.email) || null,
      gender,
      notes: str(body.notes) || null,
      source: "manual",
      medical: medicalInput(body.medical) ?? Prisma.DbNull,
    },
  });

  const appts = await loadAppts();
  return NextResponse.json({ patient: mapPatient(created, appts) });
}

export const PATCH = withRoute("admin.patients.PATCH", adminPatientsPATCH);

async function adminPatientsPATCH(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const parsed = await parseJson(req, PatientBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const id = str(body.id);
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const existing = await prisma.patient.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: Prisma.PatientUpdateInput = {};
  if (body.name !== undefined) {
    const name = str(body.name);
    if (!name) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    data.name = name;
  }
  if (body.phone !== undefined) {
    const phone = str(body.phone);
    if (!phone) return NextResponse.json({ error: "phone cannot be empty" }, { status: 400 });
    data.phone = phone;
  }
  if (body.email !== undefined) data.email = str(body.email) || null;
  if (body.gender !== undefined) data.gender = body.gender === "male" || body.gender === "female" ? body.gender : null;
  if (body.notes !== undefined) data.notes = str(body.notes) || null;
  const med = medicalInput(body.medical);
  if (med !== undefined) data.medical = med;

  const updated = await prisma.patient.update({ where: { id }, data });
  const appts = await loadAppts();
  return NextResponse.json({ patient: mapPatient(updated, appts) });
}

export const DELETE = withRoute("admin.patients.DELETE", adminPatientsDELETE);

async function adminPatientsDELETE(req: Request) {
  const { error, session } = await requireSession();
  if (error) return error;

  const url = new URL(req.url);
  let id = url.searchParams.get("id") ?? "";
  if (!id) {
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    id = str(body.id);
  }
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const treatmentCount = await prisma.treatmentRecord.count({ where: { patientId: id } });
  if (treatmentCount > 0) {
    return NextResponse.json(
      { error: "has_operations", message: "This client has recorded operations and cannot be deleted." },
      { status: 409 }
    );
  }

  // A missing patient stays a no-op success (matches the prior swallow-on-delete).
  const existing = await prisma.patient.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ ok: true });

  // Detach appointments (keep the schedule history, unchanged) then soft-delete
  // the client and its standalone payments in one transaction, so the client is
  // recoverable from the Recycle Bin instead of being erased.
  await prisma.$transaction(async (tx) => {
    await tx.appointment.updateMany({ where: { patientId: id }, data: { patientId: null } });
    await softDeleteInTransaction(tx, "Patient", id, session?.sub ?? null, new Date());
  });
  await writeAudit({
    action: "patient.delete",
    actor: session,
    entityType: "Patient",
    entityId: id,
    summary: `Deleted patient ${id}`,
    ip: auditIp(req),
  });
  return NextResponse.json({ ok: true });
}
