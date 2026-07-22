// End-to-end test for the follow-up (متابعة) reply alerts:
//  1. seed a follow-up "out" + an unread inbound "reply" for a real patient
//  2. login, GET /api/admin/followup-replies -> the client must appear
//  3. GET /api/admin/chats?phone=... (opens the thread -> marks read)
//  4. GET /api/admin/followup-replies again -> the client must be gone
// Cleans up the seeded rows at the end.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = "http://localhost:3000";
const EMAIL = process.env.DOCTOR_EMAIL || "doctor@bdic.clinic";
const PASS = process.env.DOCTOR_PASS || "bdic12345";

function cookieFrom(res) {
  const raw = res.headers.get("set-cookie") || "";
  return raw.split(",").map((s) => s.split(";")[0].trim()).filter((s) => s.includes("=")).join("; ");
}

const REPLY_BODY = "الحمد لله بقيت أحسن كتير بعد الجلسة 🙏 شكراً دكتور";

async function main() {
  // Pick a real patient (so the alert resolves a name).
  const patient = await prisma.patient.findFirst({ orderBy: { createdAt: "desc" } });
  if (!patient) throw new Error("no patients in DB to test with");
  const phone = (patient.phone || "").replace(/\D/g, "");
  if (!phone) throw new Error("patient has no usable phone");
  console.log(`test patient: ${patient.name} (${phone})`);

  // Seed: the clinic's follow-up (out) then the patient's reply (in, unread).
  const seededOut = await prisma.chatMessage.create({
    data: { phone, direction: "out", kind: "followup", body: "TEST followup message", readAt: new Date() },
  });
  const seededIn = await prisma.chatMessage.create({
    data: { phone, direction: "in", kind: "reply", body: REPLY_BODY, readAt: null },
  });
  const cleanup = async () => {
    await prisma.chatMessage.deleteMany({ where: { id: { in: [seededOut.id, seededIn.id] } } });
  };

  try {
    // login
    const login = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASS }),
    });
    if (!login.ok) throw new Error(`login failed ${login.status}`);
    const cookie = cookieFrom(login);

    // 1) alert should list this client with the exact reply body
    const a1 = await (await fetch(`${BASE}/api/admin/followup-replies`, { headers: { cookie } })).json();
    const found = (a1.replies || []).find((r) => r.phone.replace(/\D/g, "").slice(-9) === phone.slice(-9));
    console.log(`\n[1] alert present: ${!!found}`);
    if (!found) throw new Error("FAIL: seeded reply not returned by /followup-replies");
    console.log(`    name=${found.name}  count=${found.count}`);
    const bodyOk = found.lastBody === REPLY_BODY;
    console.log(`    arabic body intact (byte-for-byte): ${bodyOk}`);
    if (!bodyOk) throw new Error(`FAIL: body mismatch. got="${found.lastBody}"`);

    // 2) open the thread (marks inbound read)
    const th = await (await fetch(`${BASE}/api/admin/chats?phone=${encodeURIComponent(phone)}`, { headers: { cookie } })).json();
    const replyInThread = (th.messages || []).some((m) => m.kind === "reply" && m.body === REPLY_BODY);
    console.log(`\n[2] reply visible in chat thread: ${replyInThread}`);
    if (!replyInThread) throw new Error("FAIL: reply not in thread");

    // 3) alert should now be cleared for this client
    const a2 = await (await fetch(`${BASE}/api/admin/followup-replies`, { headers: { cookie } })).json();
    const still = (a2.replies || []).find((r) => r.phone.replace(/\D/g, "").slice(-9) === phone.slice(-9));
    console.log(`\n[3] alert cleared after opening chat: ${!still}`);
    if (still) throw new Error("FAIL: alert still present after read");

    console.log("\nALL CHECKS PASSED");
  } finally {
    await cleanup();
    console.log("cleaned up seeded rows");
    await prisma.$disconnect();
  }
}

main().catch(async (e) => {
  console.error("ERROR:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
