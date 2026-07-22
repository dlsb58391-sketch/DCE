import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

/** URL-safe ~24-char random password for local/dev seeding only. */
function generatePassword() {
  return randomBytes(18).toString("base64url");
}

async function main() {
  // Per-clinic admin defaults so a fresh deploy seeds a branded login.
  // All overridable via SEED_DOCTOR_* env vars (set these in Railway).
  const slug = process.env.NEXT_PUBLIC_CLINIC || process.env.CLINIC || "badawi";
  const DEFAULTS = {
    badawi: { email: "doctor@bdic.clinic", name: "Dr. Badawi", username: "badawi" },
    ibrahim: { email: "doctor@theboss.clinic", name: "Dr. Ibrahim Salah", username: "boss" },
    dce: { email: "doctor@dentalcenterofegypt.com", name: "Dr. Medhat Basseem", username: "dental" },
    clinva: { email: "admin@clinva.app", name: "Clinva Admin", username: "admin" },
  };
  const d = DEFAULTS[slug] || { email: `doctor@${slug}.clinic`, name: "Doctor", username: slug };

  const email = process.env.SEED_DOCTOR_EMAIL || d.email;
  const username = (process.env.SEED_DOCTOR_USERNAME || d.username).toLowerCase();
  const name = process.env.SEED_DOCTOR_NAME || d.name;

  // SEC-03: no hardcoded default credentials.
  //  - Production: SEED_DOCTOR_PASSWORD is mandatory (refuse to create a known password).
  //  - Dev: generate a random one-time password and print it once.
  const isProd = process.env.NODE_ENV === "production";
  const providedPassword = process.env.SEED_DOCTOR_PASSWORD;
  let password = providedPassword;
  let generated = false;
  if (!password) {
    if (isProd) {
      console.error(
        "[seed] SEED_DOCTOR_PASSWORD is required in production. " +
          "Set it in the environment and re-run. Refusing to seed a default password."
      );
      await prisma.$disconnect();
      process.exit(1);
    }
    password = generatePassword();
    generated = true;
  }
  const passwordHash = await bcrypt.hash(password, 12);

  // Only rotate an existing user's password when one was explicitly provided.
  const update = { username };
  if (providedPassword) update.passwordHash = passwordHash;

  await prisma.user.upsert({
    where: { email },
    update,
    create: {
      email,
      username,
      passwordHash,
      name,
      role: "admin",
      tokenVersion: 1,
    },
  });

  await prisma.setting.upsert({
    where: { key: "clinic" },
    update: {},
    create: {
      key: "clinic",
      value: JSON.stringify({
        openMin: 10 * 60,
        closeMin: 22 * 60,
        slotMin: 30,
        closedWeekday: 5,
      }),
    },
  });

  // Multi-branch foundation (Sprint 12): guarantee the default branch exists so
  // the migration's backfill target is always present. Idempotent: never rotates
  // an existing branch's editable fields (name/phone/address), only ensures the
  // row + its stable code. Matches the id/code the migration seeds.
  await prisma.branch.upsert({
    where: { id: "branch_main" },
    update: {},
    create: {
      id: "branch_main",
      nameEn: "Main Branch",
      nameAr: "الفرع الرئيسي",
      code: "MAIN",
      active: true,
      sortOrder: 0,
    },
  });

  // Never print a configured secret to logs. Show only a locally-generated dev
  // password so a fresh checkout can sign in.
  if (generated) {
    console.log(`Seeded user: ${username} (${email})`);
    console.log(`Generated dev password (shown once): ${password}`);
  } else {
    console.log(`Seeded user: ${username} (${email}) [password from SEED_DOCTOR_PASSWORD]`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
