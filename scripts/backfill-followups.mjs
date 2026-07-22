/**
 * One-off rollout guard for the post-session follow-up feature: mark every
 * appointment whose session has ALREADY ended (at rollout time) as
 * followupSentAt=now, so turning the feature on doesn't retro-blast old
 * sessions. Future / not-yet-ended sessions stay eligible.
 *
 *   node scripts/backfill-followups.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function sessionEnd(a) {
  if (a.completedAt) return a.completedAt;
  return new Date(a.scheduledAt.getTime() + (a.durationMin || 30) * 60000);
}

async function main() {
  const now = new Date();
  const appts = await prisma.appointment.findMany({
    where: { followupSentAt: null, status: { in: ["confirmed", "completed"] } },
  });

  const past = appts.filter((a) => sessionEnd(a).getTime() <= now.getTime());
  if (past.length) {
    await prisma.appointment.updateMany({
      where: { id: { in: past.map((a) => a.id) } },
      data: { followupSentAt: now },
    });
  }
  console.log(
    `Follow-up rollout guard: marked ${past.length} already-ended appointment(s); ` +
      `${appts.length - past.length} future session(s) remain eligible.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
