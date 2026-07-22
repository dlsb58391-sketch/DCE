/**
 * One-off backfill: create a Patient account for every distinct phone that has
 * booked (website + WhatsApp) but has no Patient row yet, and link the matching
 * appointments to it. Idempotent — safe to run repeatedly.
 *
 *   node scripts/backfill-patients.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tail = (p) => (p || "").replace(/\D/g, "").slice(-9);
function isRealName(s) {
  const t = (s || "").trim();
  if (t.length < 2) return false;
  return (t.match(/[\p{L}]/gu) || []).length >= 2;
}

async function main() {
  const [appts, patients] = await Promise.all([
    prisma.appointment.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.patient.findMany(),
  ]);

  const existingTails = new Set(patients.map((p) => tail(p.phone)).filter((d) => d.length >= 8));

  // Only confirmed/completed bookings create a client account (matches the app:
  // accounts are created when the doctor confirms).
  const confirmed = appts.filter((a) => a.status === "confirmed" || a.status === "completed");

  // Group appointments by phone tail.
  const groups = new Map();
  for (const a of confirmed) {
    const t = tail(a.phone);
    if (t.length < 8) continue;
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(a);
  }

  let created = 0;
  let linked = 0;

  for (const [t, list] of groups) {
    let patientId;

    if (existingTails.has(t)) {
      const match = patients.find((p) => tail(p.phone) === t);
      patientId = match?.id;
    } else {
      // pick the best display name + a representative phone
      const named = list.find((a) => isRealName(a.patientName));
      const name = named?.patientName?.trim() || `+${list[0].phone.replace(/\D/g, "")}`;
      const phone = (named || list[0]).phone;
      const patient = await prisma.patient.create({
        data: { name, phone, source: "booking", createdAt: list[list.length - 1].createdAt },
      });
      patientId = patient.id;
      existingTails.add(t);
      created++;
    }

    if (patientId) {
      const toLink = list.filter((a) => a.patientId !== patientId).map((a) => a.id);
      if (toLink.length) {
        await prisma.appointment.updateMany({ where: { id: { in: toLink } }, data: { patientId } });
        linked += toLink.length;
      }
    }
  }

  console.log(`Backfill done: ${created} patient account(s) created, ${linked} appointment(s) linked.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
