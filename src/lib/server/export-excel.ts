/**
 * Export the clinic data to Excel (.xlsx) workbooks, split into two files:
 *   1. Schedule            — every appointment / booking (the calendar).
 *   2. Profiles & Interactions — patients plus everything they did (operations,
 *      payments, WhatsApp messages) with computed money totals.
 *
 * Uses exceljs; each builder returns a Buffer ready to stream as a download.
 */
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { activeClinic } from "@/lib/clinics";
import { monthKeyOf, round2 } from "@/lib/server/doctors";
import { settleStatus, type SettleStatus } from "@/lib/server/earnings";
import { num } from "@/lib/server/money";

const CLINIC_TAG = activeClinic().slug.toUpperCase();
const CLINIC_CREATOR = `${activeClinic().brand.en} Dashboard`;

const TZ = "Africa/Cairo";

function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  }).format(d);
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: TZ,
  }).format(d);
}

const tail = (p: string) => (p || "").replace(/\D/g, "").slice(-9);

type Column = { header: string; key: string; width: number; money?: boolean };

/** Style a sheet header row + set columns. */
function setup(ws: ExcelJS.Worksheet, columns: Column[]) {
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFA87F2B" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.height = 22;
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  // currency format on money columns
  columns.forEach((c, i) => {
    if (c.money) ws.getColumn(i + 1).numFmt = '#,##0 "EGP"';
  });
}

function zebra(ws: ExcelJS.Worksheet) {
  ws.eachRow((row, n) => {
    if (n === 1) return;
    if (n % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F4EF" } };
      });
    }
  });
}

/** ---------- Schedule workbook ---------- */
export async function buildScheduleWorkbook(): Promise<Buffer> {
  const appts = await prisma.appointment.findMany({ orderBy: { scheduledAt: "desc" } });

  const wb = new ExcelJS.Workbook();
  wb.creator = CLINIC_CREATOR;
  wb.created = new Date();
  const ws = wb.addWorksheet("Schedule", { views: [{ rightToLeft: false }] });

  setup(ws, [
    { header: "Code", key: "code", width: 12 },
    { header: "Patient", key: "patient", width: 24 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Service (EN)", key: "svcEn", width: 20 },
    { header: "Service (AR)", key: "svcAr", width: 20 },
    { header: "Date & Time", key: "when", width: 24 },
    { header: "Duration (min)", key: "dur", width: 14 },
    { header: "Status", key: "status", width: 14 },
    { header: "Complaint / Reason", key: "complaint", width: 30 },
    { header: "Confirmed At", key: "confirmedAt", width: 22 },
    { header: "Completed At", key: "completedAt", width: 22 },
    { header: "Booked At", key: "createdAt", width: 22 },
  ]);

  for (const a of appts) {
    ws.addRow({
      code: a.code,
      patient: a.patientName,
      phone: a.phone,
      svcEn: a.serviceLabelEn,
      svcAr: a.serviceLabelAr,
      when: fmtDateTime(a.scheduledAt),
      dur: a.durationMin,
      status: a.status,
      complaint: a.complaint ?? "",
      confirmedAt: fmtDateTime(a.confirmedAt),
      completedAt: fmtDateTime(a.completedAt),
      createdAt: fmtDateTime(a.createdAt),
    });
  }
  zebra(ws);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** ---------- Profiles & Interactions workbook ---------- */
export async function buildProfilesWorkbook(): Promise<Buffer> {
  const [patients, treatments, payments, appts, chats] = await Promise.all([
    prisma.patient.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.treatmentRecord.findMany({ orderBy: { performedAt: "desc" } }),
    prisma.payment.findMany({ orderBy: { paidAt: "desc" } }),
    prisma.appointment.findMany({ select: { patientId: true, phone: true } }),
    prisma.chatMessage.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  // Money + counts per patient.
  const byPatient = new Map<string, { billed: number; paid: number; appts: number }>();
  const ensure = (id: string) => {
    if (!byPatient.has(id)) byPatient.set(id, { billed: 0, paid: 0, appts: 0 });
    return byPatient.get(id)!;
  };
  for (const t of treatments) ensure(t.patientId).billed += num(t.price);
  for (const p of payments) ensure(p.patientId).paid += num(p.amount);
  for (const a of appts) if (a.patientId) ensure(a.patientId).appts += 1;

  // Name lookup by patientId for the child sheets.
  const nameById = new Map(patients.map((p) => [p.id, p.name]));
  // Name lookup by phone tail for the messages sheet.
  const nameByTail = new Map<string, string>();
  for (const p of patients) {
    const t = tail(p.phone);
    if (t.length >= 8 && !nameByTail.has(t)) nameByTail.set(t, p.name);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = CLINIC_CREATOR;
  wb.created = new Date();

  // --- Patients (profiles) ---
  const wsP = wb.addWorksheet("Patients");
  setup(wsP, [
    { header: "Name", key: "name", width: 24 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Email", key: "email", width: 24 },
    { header: "Gender", key: "gender", width: 10 },
    { header: "Source", key: "source", width: 12 },
    { header: "Appointments", key: "appts", width: 14 },
    { header: "Total Billed", key: "billed", width: 16, money: true },
    { header: "Total Paid", key: "paid", width: 16, money: true },
    { header: "Balance Owed", key: "balance", width: 16, money: true },
    { header: "Notes", key: "notes", width: 30 },
    { header: "Client Since", key: "createdAt", width: 18 },
  ]);
  for (const p of patients) {
    const m = byPatient.get(p.id) ?? { billed: 0, paid: 0, appts: 0 };
    wsP.addRow({
      name: p.name,
      phone: p.phone,
      email: p.email ?? "",
      gender: p.gender ?? "",
      source: p.source,
      appts: m.appts,
      billed: m.billed,
      paid: m.paid,
      balance: m.billed - m.paid,
      notes: p.notes ?? "",
      createdAt: fmtDate(p.createdAt),
    });
  }
  zebra(wsP);

  // --- Operations (treatments) ---
  const wsT = wb.addWorksheet("Operations");
  const paidByTreatment = new Map<string, number>();
  for (const p of payments) {
    if (p.treatmentRecordId) paidByTreatment.set(p.treatmentRecordId, (paidByTreatment.get(p.treatmentRecordId) ?? 0) + num(p.amount));
  }
  setup(wsT, [
    { header: "Patient", key: "patient", width: 24 },
    { header: "Operation (AR)", key: "nameAr", width: 22 },
    { header: "Operation (EN)", key: "nameEn", width: 22 },
    { header: "List Price", key: "base", width: 14, money: true },
    { header: "Discount %", key: "disc", width: 12 },
    { header: "Charged (Net)", key: "price", width: 14, money: true },
    { header: "Paid", key: "paid", width: 14, money: true },
    { header: "Remaining", key: "remaining", width: 14, money: true },
    { header: "Notes", key: "notes", width: 26 },
    { header: "Performed", key: "performedAt", width: 18 },
  ]);
  for (const t of treatments) {
    const paid = paidByTreatment.get(t.id) ?? 0;
    wsT.addRow({
      patient: nameById.get(t.patientId) ?? "",
      nameAr: t.nameAr,
      nameEn: t.nameEn,
      base: num(t.basePrice ?? t.price),
      disc: num(t.discountPct),
      price: num(t.price),
      paid,
      remaining: Math.max(0, num(t.price) - paid),
      notes: t.notes ?? "",
      performedAt: fmtDate(t.performedAt),
    });
  }
  zebra(wsT);

  // --- Payments ---
  const wsPay = wb.addWorksheet("Payments");
  const treatmentName = new Map(treatments.map((t) => [t.id, t.nameAr || t.nameEn]));
  setup(wsPay, [
    { header: "Patient", key: "patient", width: 24 },
    { header: "Amount", key: "amount", width: 14, money: true },
    { header: "Method", key: "method", width: 12 },
    { header: "Toward Operation", key: "toward", width: 22 },
    { header: "Note", key: "note", width: 26 },
    { header: "Paid At", key: "paidAt", width: 18 },
  ]);
  for (const p of payments) {
    wsPay.addRow({
      patient: nameById.get(p.patientId) ?? "",
      amount: p.amount,
      method: p.method,
      toward: p.treatmentRecordId ? treatmentName.get(p.treatmentRecordId) ?? "" : "General account",
      note: p.note ?? "",
      paidAt: fmtDate(p.paidAt),
    });
  }
  zebra(wsPay);

  // --- WhatsApp Messages (interactions) ---
  const wsM = wb.addWorksheet("WhatsApp Messages");
  setup(wsM, [
    { header: "Name", key: "name", width: 22 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Direction", key: "direction", width: 12 },
    { header: "Type", key: "kind", width: 12 },
    { header: "Message", key: "body", width: 50 },
    { header: "When", key: "createdAt", width: 22 },
    { header: "Read", key: "read", width: 8 },
  ]);
  for (const c of chats) {
    wsM.addRow({
      name: nameByTail.get(tail(c.phone)) ?? "",
      phone: c.phone,
      direction: c.direction === "in" ? "From patient" : "From clinic",
      kind: c.kind,
      body: c.body,
      createdAt: fmtDateTime(c.createdAt),
      read: c.direction === "in" ? (c.readAt ? "Yes" : "No") : "",
    });
  }
  zebra(wsM);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** ---------- Doctor Earnings workbook (3 sheets) ---------- */
const STATUS_LABEL: Record<SettleStatus, string> = {
  paid: "Paid",
  partial: "Partially Paid",
  pending: "Pending",
  none: "—",
};

const MONTH_LABEL = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short" }).format(new Date(y, (m || 1) - 1, 1));
};

/**
 * Build a 3-sheet doctor-earnings workbook:
 *   1. Operations     — one row per doctor per operation (date, doctor, patient,
 *      operation, category, price, %, doctor earnings, clinic earnings, status).
 *   2. Monthly Summary — one row per doctor per month (ops, revenue, earnings,
 *      clinic, paid, pending).
 *   3. Doctor Summary  — one row per doctor (lifetime totals + settlement).
 * Pass `doctorId` to scope every sheet to a single doctor.
 */
export async function buildEarningsWorkbook(doctorId?: string): Promise<Buffer> {
  const [doctors, links, payouts] = await Promise.all([
    prisma.doctor.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.treatmentDoctor.findMany({
      where: doctorId ? { doctorId } : {},
      include: {
        treatmentRecord: {
          include: {
            patient: { select: { name: true } },
            procedure: { select: { nameEn: true } },
            doctors: { where: { deletedAt: null }, select: { amount: true } },
            payments: { where: { deletedAt: null }, select: { amount: true, paidAt: true } },
          },
        },
      },
    }),
    prisma.doctorPayout.findMany({ where: doctorId ? { doctorId } : {} }),
  ]);

  const docById = new Map(doctors.map((d) => [d.id, d]));
  const now = new Date();
  const curMonth = monthKeyOf(now);
  const prevMonth = monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const wb = new ExcelJS.Workbook();
  wb.creator = CLINIC_CREATOR;
  wb.created = new Date();

  // --- Sheet 1: Operations ---
  const wsOps = wb.addWorksheet("Operations");
  setup(wsOps, [
    { header: "Date", key: "date", width: 16 },
    { header: "Doctor", key: "doctor", width: 22 },
    { header: "Patient", key: "patient", width: 22 },
    { header: "Operation", key: "op", width: 22 },
    { header: "Category", key: "cat", width: 18 },
    { header: "Operation Price", key: "price", width: 16, money: true },
    { header: "Doctor %", key: "pct", width: 10 },
    { header: "Doctor Earnings", key: "docEarn", width: 16, money: true },
    { header: "Clinic Earnings", key: "clinicEarn", width: 16, money: true },
    { header: "Payment Status", key: "status", width: 16 },
    { header: "Payment Date", key: "payDate", width: 16 },
    { header: "Notes", key: "notes", width: 28 },
  ]);
  const opsSorted = [...links].sort((a, b) =>
    a.treatmentRecord.performedAt < b.treatmentRecord.performedAt ? 1 : -1,
  );
  for (const l of opsSorted) {
    const t = l.treatmentRecord;
    const opCommission = t.doctors.reduce((s, d) => s + num(d.amount), 0);
    const paid = t.payments.reduce((s, p) => s + num(p.amount), 0);
    const status = settleStatus(paid, num(t.price));
    const lastPay = t.payments.reduce<Date | null>((acc, p) => (!acc || p.paidAt > acc ? p.paidAt : acc), null);
    wsOps.addRow({
      date: fmtDate(t.performedAt),
      doctor: docById.get(l.doctorId)?.nameEn ?? "",
      patient: t.patient?.name ?? "",
      op: t.nameEn || t.nameAr,
      cat: t.procedure?.nameEn ?? "Custom",
      price: num(t.price),
      pct: num(l.commissionPct),
      docEarn: num(l.amount),
      clinicEarn: round2(num(t.price) - opCommission - num(t.cost)),
      status: STATUS_LABEL[status],
      payDate: status === "paid" && lastPay ? fmtDate(lastPay) : "",
      notes: t.notes ?? "",
    });
  }
  zebra(wsOps);

  // --- Sheet 2: Monthly Summary (per doctor per month) ---
  type M = { operations: number; revenue: number; earnings: number; materials: number; paid: number };
  const monthMap = new Map<string, M>(); // key: doctorId|monthKey
  const mk = (d: string, m: string) => `${d}|${m}`;
  const ensureM = (d: string, m: string) => {
    const k = mk(d, m);
    let v = monthMap.get(k);
    if (!v) {
      v = { operations: 0, revenue: 0, earnings: 0, materials: 0, paid: 0 };
      monthMap.set(k, v);
    }
    return v;
  };
  for (const l of links) {
    const t = l.treatmentRecord;
    const v = ensureM(l.doctorId, monthKeyOf(t.performedAt));
    v.operations += 1;
    v.revenue += num(t.price);
    v.earnings += num(l.amount);
    v.materials += num(t.cost);
  }
  for (const p of payouts) ensureM(p.doctorId, monthKeyOf(p.paidAt)).paid += num(p.amount);

  const wsMonthly = wb.addWorksheet("Monthly Summary");
  setup(wsMonthly, [
    { header: "Doctor", key: "doctor", width: 22 },
    { header: "Year", key: "year", width: 8 },
    { header: "Month", key: "month", width: 14 },
    { header: "Operations", key: "ops", width: 12 },
    { header: "Total Revenue", key: "revenue", width: 16, money: true },
    { header: "Doctor Earnings", key: "earnings", width: 16, money: true },
    { header: "Clinic Earnings", key: "clinic", width: 16, money: true },
    { header: "Paid", key: "paid", width: 14, money: true },
    { header: "Pending", key: "pending", width: 14, money: true },
  ]);
  const monthKeys = [...monthMap.keys()].sort((a, b) => (a < b ? 1 : -1));
  for (const key of monthKeys) {
    const [dId, monthKey] = key.split("|");
    const v = monthMap.get(key)!;
    wsMonthly.addRow({
      doctor: docById.get(dId)?.nameEn ?? "",
      year: monthKey.split("-")[0],
      month: MONTH_LABEL(monthKey),
      ops: v.operations,
      revenue: round2(v.revenue),
      earnings: round2(v.earnings),
      clinic: round2(v.revenue - v.earnings - v.materials),
      paid: round2(v.paid),
      pending: round2(Math.max(0, v.earnings - v.paid)),
    });
  }
  zebra(wsMonthly);

  // --- Sheet 3: Doctor Summary ---
  type D = { operations: number; revenue: number; earnings: number; materials: number; cur: number; prev: number };
  const docMap = new Map<string, D>();
  const ensureD = (id: string) => {
    let v = docMap.get(id);
    if (!v) {
      v = { operations: 0, revenue: 0, earnings: 0, materials: 0, cur: 0, prev: 0 };
      docMap.set(id, v);
    }
    return v;
  };
  for (const l of links) {
    const t = l.treatmentRecord;
    const v = ensureD(l.doctorId);
    v.operations += 1;
    v.revenue += num(t.price);
    v.earnings += num(l.amount);
    v.materials += num(t.cost);
    const key = monthKeyOf(t.performedAt);
    if (key === curMonth) v.cur += num(l.amount);
    if (key === prevMonth) v.prev += num(l.amount);
  }
  const paidByDoctor = new Map<string, number>();
  for (const p of payouts) paidByDoctor.set(p.doctorId, (paidByDoctor.get(p.doctorId) || 0) + num(p.amount));

  const wsDoc = wb.addWorksheet("Doctor Summary");
  setup(wsDoc, [
    { header: "Doctor Name", key: "name", width: 24 },
    { header: "Specialty", key: "spec", width: 20 },
    { header: "Total Operations", key: "ops", width: 14 },
    { header: "Total Revenue", key: "revenue", width: 16, money: true },
    { header: "Lifetime Earnings", key: "life", width: 16, money: true },
    { header: "Current Month", key: "cur", width: 16, money: true },
    { header: "Previous Month", key: "prev", width: 16, money: true },
    { header: "Total Paid", key: "paid", width: 16, money: true },
    { header: "Remaining Balance", key: "remaining", width: 16, money: true },
    { header: "Clinic Profit Generated", key: "clinic", width: 20, money: true },
  ]);
  const rankDoctors = doctorId ? doctors.filter((d) => d.id === doctorId) : doctors;
  for (const d of rankDoctors) {
    const v = docMap.get(d.id) ?? { operations: 0, revenue: 0, earnings: 0, materials: 0, cur: 0, prev: 0 };
    const paid = paidByDoctor.get(d.id) ?? 0;
    wsDoc.addRow({
      name: d.nameEn,
      spec: d.specialtyEn ?? "",
      ops: v.operations,
      revenue: round2(v.revenue),
      life: round2(v.earnings),
      cur: round2(v.cur),
      prev: round2(v.prev),
      paid: round2(paid),
      remaining: round2(Math.max(0, v.earnings - paid)),
      clinic: round2(v.revenue - v.earnings - v.materials),
    });
  }
  zebra(wsDoc);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function exportFileName(type: "schedule" | "profiles" | "earnings"): string {
  const stamp = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ })
    .format(new Date())
    .replace(/-/g, "");
  if (type === "schedule") return `${CLINIC_TAG}-Schedule-${stamp}.xlsx`;
  if (type === "earnings") return `${CLINIC_TAG}-Doctor-Earnings-${stamp}.xlsx`;
  return `${CLINIC_TAG}-Profiles-and-Interactions-${stamp}.xlsx`;
}
