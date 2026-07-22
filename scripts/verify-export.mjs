// Verify the Excel export end-to-end: login, download both workbooks, read them
// back with exceljs, and compare row counts against the database.
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3000";
const EMAIL = process.env.DOCTOR_EMAIL || "doctor@bdic.clinic";
const PASS = process.env.DOCTOR_PASS || "bdic12345";
const outDir = path.join(process.cwd(), "exports");
fs.mkdirSync(outDir, { recursive: true });

const prisma = new PrismaClient();

function cookieFrom(res) {
  const raw = res.headers.get("set-cookie") || "";
  return raw.split(",").map((s) => s.split(";")[0].trim()).filter((s) => s.includes("=")).join("; ");
}

async function main() {
  // 1) login
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  if (!login.ok) throw new Error(`login failed ${login.status}: ${await login.text()}`);
  const cookie = cookieFrom(login);
  if (!cookie) throw new Error("no session cookie returned");
  console.log("login OK");

  // 2) download both files
  const files = {};
  for (const type of ["schedule", "profiles"]) {
    const res = await fetch(`${BASE}/api/admin/export?type=${type}`, { headers: { cookie } });
    if (!res.ok) throw new Error(`export ${type} failed ${res.status}: ${await res.text()}`);
    const cd = res.headers.get("content-disposition") || "";
    const name = /filename="([^"]+)"/.exec(cd)?.[1] || `BDIC-${type}.xlsx`;
    const buf = Buffer.from(await res.arrayBuffer());
    const dest = path.join(outDir, name);
    fs.writeFileSync(dest, buf);
    files[type] = dest;
    console.log(`downloaded ${type} -> ${name} (${buf.length} bytes)`);
  }

  // 3) read back + count
  const readCounts = {};
  for (const [type, file] of Object.entries(files)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const sheets = {};
    wb.eachSheet((ws) => {
      sheets[ws.name] = Math.max(0, ws.rowCount - 1); // minus header
    });
    readCounts[type] = sheets;
  }

  // 4) DB truth
  const [patients, appts, treatments, payments, chats] = await Promise.all([
    prisma.patient.count(),
    prisma.appointment.count(),
    prisma.treatmentRecord.count(),
    prisma.payment.count(),
    prisma.chatMessage.count(),
  ]);

  console.log("\n=== Excel sheet row counts (data rows) ===");
  console.log(JSON.stringify(readCounts, null, 2));
  console.log("\n=== DB counts ===");
  console.log(JSON.stringify({ patients, appts, treatments, payments, chats }, null, 2));

  const checks = [
    ["Schedule rows == appointments", readCounts.schedule?.["Schedule"], appts],
    ["Patients rows == patients", readCounts.profiles?.["Patients"], patients],
    ["Operations rows == treatments", readCounts.profiles?.["Operations"], treatments],
    ["Payments rows == payments", readCounts.profiles?.["Payments"], payments],
    ["WhatsApp rows == chats", readCounts.profiles?.["WhatsApp Messages"], chats],
  ];
  console.log("\n=== Checks ===");
  let allOk = true;
  for (const [label, got, want] of checks) {
    const ok = got === want;
    allOk = allOk && ok;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (excel=${got}, db=${want})`);
  }
  console.log(allOk ? "\nALL CHECKS PASSED" : "\nSOME CHECKS FAILED");
  await prisma.$disconnect();
  process.exit(allOk ? 0 : 1);
}

main().catch(async (e) => {
  console.error("ERROR:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
