#!/usr/bin/env node
/**
 * BDIC WhatsApp Web worker — FREE, unofficial WhatsApp bot on your OWN number.
 *
 * Uses whatsapp-web.js (a WhatsApp Web automation library) so there is NO Meta
 * account, NO per-message cost, and you keep using your normal WhatsApp. You scan
 * a QR code ONCE (like linking WhatsApp Web); the session is then saved.
 *
 * It connects to your existing booking agent through the internal HTTP endpoint
 * POST /api/whatsapp/agent, so all the conversation logic stays in one place.
 *
 * Run (after `npm run dev` / `npm start` is up):
 *   node worker/whatsapp-web.mjs
 *
 * Env:
 *   APP_BASE_URL     default http://localhost:3000   (the running site)
 *   WA_AGENT_SECRET  shared secret matching the site's env (REQUIRED)
 *   WA_SESSION_DIR   default ./.wwebjs_auth          (persisted login)
 *
 * ⚠️  Use a phone number DEDICATED to the clinic, not your personal one:
 *     this is unofficial and WhatsApp could ban a number for automated activity.
 */
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from the project root so the worker runs standalone (e.g. via PM2 / a .cmd loop).
(() => {
  try {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const envPath = path.join(root, ".env");
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* env file is optional if vars are already set */
  }
})();

const BASE = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.WA_AGENT_SECRET;
const SESSION_DIR = process.env.WA_SESSION_DIR || "./.wwebjs_auth";

// Outbox poll timer (declared early; it's referenced by disconnect/fatal handlers).
let outboxTimer = null;

if (!SECRET) {
  console.error("FATAL: set WA_AGENT_SECRET (must match the site's WA_AGENT_SECRET).");
  process.exit(1);
}

/**
 * Find a Chrome/Chromium to drive. Order:
 *   1. CHROME_PATH env (set this on the VPS, e.g. /usr/bin/chromium-browser)
 *   2. puppeteer's own bundled Chromium (if it downloaded)
 *   3. a system Google Chrome / Edge install (Windows/macOS/Linux common paths)
 */
function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    `${process.env.LOCALAPPDATA || ""}/Google/Chrome/Application/chrome.exe`,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return undefined; // let whatsapp-web.js fall back to its bundled Chromium
}

const executablePath = findChrome();
console.log(`[wa] using Chrome: ${executablePath || "(puppeteer bundled Chromium)"}`);

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
  puppeteer: {
    headless: true,
    executablePath,
    // Flags required to run Chromium on a headless VPS.
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  },
});

/** Push the worker's status (and QR) to the site so the dashboard can show it. */
let lastState = "offline";
async function reportStatus(state, qr) {
  lastState = state;
  try {
    await fetch(`${BASE}/api/whatsapp/worker-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-agent-secret": SECRET },
      body: JSON.stringify({ state, qr }),
    });
  } catch {
    /* dashboard reporting is best-effort */
  }
}

// Heartbeat: re-post the last known state every 20s so the dashboard stays accurate
// (the site marks the worker "offline" only after 60s of silence).
setInterval(() => {
  if (lastState === "ready" || lastState === "authenticated") reportStatus(lastState);
}, 20_000);

client.on("qr", (qr) => {
  console.log("\n=== Scan this QR with WhatsApp (Settings → Linked Devices → Link a Device) ===\n");
  qrcode.generate(qr, { small: true });
  console.log("\nOr open the dashboard → WhatsApp tab to scan it there.\nWaiting for scan…");
  reportStatus("qr", qr);
});

client.on("authenticated", () => {
  console.log("[wa] authenticated — session saved.");
  reportStatus("authenticated");
});
client.on("auth_failure", (m) => console.error("[wa] auth failure:", m));
client.on("ready", () => {
  console.log("[wa] READY ✅  The booking bot is now live on your number.");
  reportStatus("ready");
});
client.on("disconnected", (r) => {
  console.error("[wa] disconnected:", r, "— exiting so the launcher restarts a fresh session.");
  reportStatus("disconnected");
  if (outboxTimer) clearInterval(outboxTimer);
  // Exit; start-worker.cmd (or PM2) relaunches with the saved session.
  setTimeout(() => process.exit(1), 1000);
});

// If Chrome's page detaches (the "detached Frame" crash), the session is dead —
// exit so the launcher restarts cleanly instead of looping on a broken client.
let fatalCount = 0;
function maybeFatal(err) {
  const msg = String(err?.message || err || "");
  console.error("[wa] error:", msg);
  if (/detached Frame|Session closed|Target closed|Protocol error|Execution context/i.test(msg)) {
    fatalCount++;
    if (fatalCount >= 3) {
      console.error("[wa] session looks dead — exiting for a clean restart.");
      if (outboxTimer) clearInterval(outboxTimer);
      setTimeout(() => process.exit(1), 500);
    }
  }
}
process.on("unhandledRejection", maybeFatal);

// Surface lifecycle progress so a silent hang during startup is diagnosable.
client.on("loading_screen", (percent, message) => console.log(`[wa] loading ${percent}% ${message || ""}`));
client.on("change_state", (state) => console.log(`[wa] state: ${state}`));

/** Forward an inbound message to the booking agent and return its replies. */
async function askAgent(phone, text, name, chatId) {
  const res = await fetch(`${BASE}/api/whatsapp/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-agent-secret": SECRET },
    body: JSON.stringify({ phone, text, name, chatId }),
  });
  if (!res.ok) {
    console.error("[agent] HTTP", res.status, await res.text().catch(() => ""));
    return { replies: [] };
  }
  return res.json();
}

/** Poll the outbox for server-initiated messages (e.g. doctor confirmations). */
async function drainOutbox() {
  try {
    const res = await fetch(`${BASE}/api/whatsapp/outbox`, {
      headers: { "x-agent-secret": SECRET },
    });
    if (!res.ok) return;
    const { messages } = await res.json();
    if (!messages?.length) return;
    const sent = [];
    const failed = [];
    for (const m of messages) {
      const digits = String(m.phone).replace(/\D/g, "");
      try {
        // Never deliver a message whose text was mangled into "?" placeholders by
        // a broken (non-UTF-8) sender — drop it instead of spamming the patient.
        const qCount = (String(m.body).match(/\?/g) || []).length;
        const nonSpace = String(m.body).replace(/\s/g, "").length;
        if (qCount >= 5 && nonSpace > 0 && qCount / nonSpace > 0.5) {
          console.error(`[outbox] skipping corrupted (mostly "?") message to ${digits}.`);
          failed.push(m.id);
          continue;
        }
        // The stored chat id is the EXACT chat the patient messaged us from
        // (their real msg.from), so replying there always reaches the right
        // person — even for "@lid" contacts whose real number isn't directly
        // addressable. Only when we have no chat id do we look the number up.
        let target = m.chatId || null;
        if (!target) {
          if (digits.length >= 10 && digits.length <= 15) {
            const numId = await client.getNumberId(digits);
            if (numId) target = numId._serialized;
          }
        }
        if (!target) {
          console.error(`[outbox] could not resolve a target for ${digits} — marking failed.`);
          failed.push(m.id);
          continue;
        }
        console.log(`[outbox] -> phone=${digits} target=${target}`);
        await client.sendMessage(target, m.body);
        sent.push(m.id);
      } catch (e) {
        const msg = String(e?.message || e);
        console.error("[outbox] send failed:", msg);
        if (/No LID|not.*registered|invalid|wid/i.test(msg)) failed.push(m.id);
        else maybeFatal(e);
      }
    }
    if (sent.length || failed.length) {
      await fetch(`${BASE}/api/whatsapp/outbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-agent-secret": SECRET },
        body: JSON.stringify({ ids: sent, failedIds: failed }),
      });
    }
  } catch {
    /* best-effort */
  }
}

/**
 * One-time repair: resolve any bookings saved under a "@lid" alias to the real
 * phone number (older messages stored the alias). Runs on ready, and retries a
 * few times if the site isn't reachable yet so a transient outage doesn't skip it.
 */
async function repairLids(attempt = 0) {
  try {
    const res = await fetch(`${BASE}/api/whatsapp/lid-fix`, {
      headers: { "x-agent-secret": SECRET },
    });
    if (!res.ok) return;
    const { pending } = await res.json();
    if (!pending?.length) return;
    console.log(`[lid-fix] resolving ${pending.length} aliased booking(s)…`);

    const fixes = [];
    for (const row of pending) {
      try {
        const [map] = await client.getContactLidAndPhone([row.chatId]);
        const real = map?.pn ? map.pn.split("@")[0].replace(/\D/g, "") : "";
        if (real && real.length >= 8 && real !== String(row.phone).replace(/\D/g, "")) {
          fixes.push({ chatId: row.chatId, phone: real });
          console.log(`[lid-fix] ${row.chatId} -> +${real}`);
        }
      } catch (e) {
        console.error("[lid-fix] resolve failed:", e?.message || e);
      }
    }

    if (fixes.length) {
      const r = await fetch(`${BASE}/api/whatsapp/lid-fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-agent-secret": SECRET },
        body: JSON.stringify({ fixes }),
      });
      const j = await r.json().catch(() => ({}));
      console.log(`[lid-fix] updated ${j.appts ?? 0} booking(s), ${j.patients ?? 0} client(s).`);
    }
  } catch (e) {
    // Site not up yet? Retry a handful of times with backoff.
    if (attempt < 6) {
      const wait = 10_000 * (attempt + 1);
      console.error(`[lid-fix] site unreachable (${e?.message || e}); retrying in ${wait / 1000}s`);
      setTimeout(() => repairLids(attempt + 1), wait);
    } else {
      console.error("[lid-fix] giving up after retries:", e?.message || e);
    }
  }
}

client.on("message", async (msg) => {
  try {
    // ignore group chats, status broadcasts, and non-text messages
    if (msg.from.endsWith("@g.us") || msg.from === "status@broadcast") return;
    if (msg.type !== "chat" || !msg.body) return;

    // Resolve the real phone number + contact name. msg.from can be a @lid alias
    // (WhatsApp privacy id); for those we ask WhatsApp to map the LID -> real
    // phone number so the dashboard shows a usable number, not the alias.
    let phone = msg.from.split("@")[0];
    let name;
    try {
      const contact = await msg.getContact();
      name = contact?.pushname || contact?.name || contact?.verifiedName || msg._data?.notifyName || undefined;

      if (msg.from.endsWith("@lid")) {
        let resolved;
        try {
          const [map] = await client.getContactLidAndPhone([msg.from]);
          if (map?.pn) resolved = map.pn.split("@")[0];
        } catch (e) {
          console.error("[wa] LID->phone lookup failed:", e?.message || e);
        }
        phone = String(resolved || contact?.number || msg.from.split("@")[0]).replace(/\D/g, "");
      } else {
        const cand = contact?.number || contact?.id?.user || msg.from.split("@")[0];
        phone = String(cand).replace(/\D/g, "");
      }
      console.log(`[wa] inbound from=${msg.from} | resolved=${phone} | name=${name}`);
    } catch (e) {
      name = msg._data?.notifyName || undefined;
      console.log(`[wa] inbound from=${msg.from} (getContact failed: ${e?.message || e})`);
    }

    const { replies } = await askAgent(phone, msg.body, name, msg.from);
    for (const body of replies) {
      if (body && body.trim()) await client.sendMessage(msg.from, body);
    }
  } catch (e) {
    console.error("[wa] message handler error:", e?.message || e);
    maybeFatal(e);
  }
});

// Poll the outbox once the client is ready (doctor-confirm messages, etc.).
client.on("ready", () => {
  if (outboxTimer) clearInterval(outboxTimer);
  outboxTimer = setInterval(drainOutbox, 8000);
  // Repair any older bookings still saved under a @lid alias.
  repairLids();
});

process.on("SIGINT", async () => {
  console.log("\n[wa] shutting down…");
  await client.destroy().catch(() => {});
  process.exit(0);
});

// A persistent volume can keep a stale Chromium "SingletonLock" from an unclean
// shutdown, which makes a fresh container refuse to launch ("profile appears to
// be in use by another Chromium process on another computer"). Clear those
// leftover lock files before starting so Chromium can boot cleanly.
function clearChromiumLocks(dir) {
  let removed = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (/^Singleton(Lock|Cookie|Socket)$/.test(entry.name)) {
        try {
          fs.rmSync(p, { force: true, recursive: true });
          removed++;
        } catch {
          /* ignore */
        }
      } else if (entry.isDirectory()) {
        removed += clearChromiumLocks(p);
      }
    }
  } catch {
    /* session dir may not exist on the very first run */
  }
  return removed;
}
const cleared = clearChromiumLocks(SESSION_DIR);
if (cleared) console.log(`[wa] cleared ${cleared} stale Chromium lock(s) under ${SESSION_DIR}`);

console.log(`[wa] starting worker → agent at ${BASE}/api/whatsapp/agent`);
client.initialize().catch((e) => {
  console.error("[wa] initialize() failed:", e?.stack || e?.message || e);
  setTimeout(() => process.exit(1), 500);
});
