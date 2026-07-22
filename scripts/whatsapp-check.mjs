#!/usr/bin/env node
/**
 * WhatsApp Cloud API credential checker for BDIC.
 *
 * After you paste WHATSAPP_TOKEN + WHATSAPP_PHONE_ID into .env, run:
 *
 *   node scripts/whatsapp-check.mjs                 # validate token + phone id
 *   node scripts/whatsapp-check.mjs +20100xxxxxxx   # also send a test message
 *
 * It tells you, in plain language, exactly what works and what to fix.
 * Reads .env itself (no extra deps).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// --- tiny .env loader (no dependency) ---
function loadEnv() {
  const p = path.join(root, ".env");
  const out = {};
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return { ...out, ...process.env };
}

const env = loadEnv();
const TOKEN = env.WHATSAPP_TOKEN;
const PHONE_ID = env.WHATSAPP_PHONE_ID;
const VERSION = env.WHATSAPP_API_VERSION || "v21.0";
const PROVIDER = env.WHATSAPP_PROVIDER || "mock";
const to = process.argv[2];

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const info = (m) => console.log(`  • ${m}`);

console.log("\n=== BDIC WhatsApp Cloud API check ===\n");

console.log(`Provider: WHATSAPP_PROVIDER = "${PROVIDER}"`);
if (PROVIDER !== "metaCloud") {
  info('Set WHATSAPP_PROVIDER="metaCloud" in .env to actually send via Meta (currently not).');
}
if (!TOKEN) bad("WHATSAPP_TOKEN is empty — paste your access token into .env");
if (!PHONE_ID) bad("WHATSAPP_PHONE_ID is empty — paste your Phone Number ID into .env");
if (!TOKEN || !PHONE_ID) {
  console.log("\nFix the above, then re-run. See docs/WHATSAPP-META-SETUP.md\n");
  process.exit(1);
}

// 1) validate the phone number id + token by reading the number's profile
try {
  const res = await fetch(`https://graph.facebook.com/${VERSION}/${PHONE_ID}?fields=display_phone_number,verified_name,quality_rating`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const body = await res.json();
  if (res.ok) {
    ok(`Token + Phone ID valid.`);
    info(`Number: ${body.display_phone_number ?? "?"}  (${body.verified_name ?? "unverified name"})`);
    if (body.quality_rating) info(`Quality rating: ${body.quality_rating}`);
  } else {
    bad(`Graph API rejected the request (HTTP ${res.status}).`);
    info(`Reason: ${body.error?.message ?? JSON.stringify(body)}`);
    if (body.error?.code === 190) info("Code 190 = token expired/invalid. Generate a fresh token (or a permanent System User token).");
    process.exit(1);
  }
} catch (e) {
  bad(`Network error reaching Graph API: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

// 2) optional: send a test message
if (to) {
  const digits = to.replace(/[^\d]/g, "");
  console.log(`\nSending a test message to ${digits} …`);
  try {
    const res = await fetch(`https://graph.facebook.com/${VERSION}/${PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: digits,
        type: "text",
        text: { body: "✅ BDIC WhatsApp is connected. (test message)" },
      }),
    });
    const body = await res.json();
    if (res.ok) {
      ok(`Test message accepted (id: ${body.messages?.[0]?.id ?? "?"}).`);
      info("If it doesn't arrive: the recipient must have messaged you first, OR be added as a test recipient in the Meta dashboard (for the free test number).");
    } else {
      bad(`Send failed (HTTP ${res.status}): ${body.error?.message ?? JSON.stringify(body)}`);
      if (body.error?.code === 131030) info("131030 = recipient not in allowed list. Add them as a test number in Meta → API Setup.");
      process.exit(1);
    }
  } catch (e) {
    bad(`Network error sending: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}

console.log("\nAll good. ✅\n");
