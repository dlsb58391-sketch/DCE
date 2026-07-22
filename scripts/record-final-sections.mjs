/**
 * Re-record real content for the 4 broken tutorial sections using the proven
 * login + navigation pattern from record-tutorial.mjs.
 *
 *   14_settings       -> Settings          (SettingsSection)
 *   15_messages       -> Client Messages   (ClientMessages)
 *   16_whatsapp_demo  -> WhatsApp          (Booking Bot panel)
 *   17_excel_demo     -> Earnings          (shows the "Export Excel" button)
 *
 * Each section records ~19s (longer than the longest voiceover, 17.3s). The
 * compile step trims every segment to its audio duration so narration always
 * plays over real, moving content.
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, renameSync, readdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://boss-dental-production.up.railway.app';
const VIDEOS_DIR = path.join(__dirname, '..', 'public', 'tutorial', 'videos');

if (!existsSync(VIDEOS_DIR)) mkdirSync(VIDEOS_DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await sleep(500);
  await page.locator('input[autocomplete="username"]').fill('boss');
  await page.locator('input[type="password"]').fill('boss2026');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await sleep(1500);
  console.log('  \u2713 Logged in');
}

async function goTo(page, labels) {
  // The desktop sidebar can clip its last items (e.g. Settings) below the
  // 720px fold, so a normal Playwright click fails actionability checks.
  // Trigger the React onClick directly via a native DOM click instead.
  const clicked = await page.evaluate((wanted) => {
    const btns = Array.from(document.querySelectorAll('aside nav button, nav button'));
    for (const label of wanted) {
      const btn = btns.find((b) => (b.textContent || '').includes(label));
      if (btn) {
        btn.click();
        return true;
      }
    }
    return false;
  }, labels);
  if (clicked) {
    await sleep(1500);
    return true;
  }
  console.log(`  ! Could not find nav for ${labels.join('/')}`);
  return false;
}

async function recordVideo(browser, name, fn) {
  const tmpDir = path.join(VIDEOS_DIR, `_tmp_${name}`);
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: tmpDir, size: { width: 1280, height: 720 } },
  });
  const page = await ctx.newPage();

  try {
    await fn(page);
    await sleep(800);
  } catch (e) {
    console.log(`  \u2717 Error in ${name}: ${e.message.split('\n')[0]}`);
  } finally {
    await ctx.close();
    await sleep(1200);
  }

  const files = readdirSync(tmpDir).filter((f) => f.endsWith('.webm'));
  if (files.length > 0) {
    const dest = path.join(VIDEOS_DIR, `${name}.webm`);
    if (existsSync(dest)) rmSync(dest, { force: true });
    renameSync(path.join(tmpDir, files[0]), dest);
    rmSync(tmpDir, { recursive: true, force: true });
    console.log(`  \u2713 ${name}.webm`);
  } else {
    console.log(`  \u2717 No video for ${name}`);
  }
}

// 14 — Settings (الإعدادات)
async function v14_settings(browser) {
  await recordVideo(browser, '14_settings', async (page) => {
    await login(page);
    await goTo(page, ['\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a', 'Settings']);
    await sleep(2000);
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await sleep(3000);
    await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'smooth' }));
    await sleep(3000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(6000);
  });
}

// 15 — Client Messages (رسائل العملاء)
async function v15_messages(browser) {
  await recordVideo(browser, '15_messages', async (page) => {
    await login(page);
    await goTo(page, ['\u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u0621', 'Client Messages']);
    await sleep(3000);
    const firstChat = page
      .locator('button, li, div[role="button"]')
      .filter({ hasText: /01\d|\+?\d{6,}/ })
      .first();
    if ((await firstChat.count()) > 0) {
      await firstChat.click({ timeout: 3000 }).catch(() => {});
      await sleep(3000);
    }
    await sleep(11000);
  });
}

// 16 — WhatsApp Booking Bot (واتساب)
async function v16_whatsapp(browser) {
  await recordVideo(browser, '16_whatsapp_demo', async (page) => {
    await login(page);
    await goTo(page, ['\u0648\u0627\u062a\u0633\u0627\u0628', 'WhatsApp']);
    await sleep(4000);
    await page.evaluate(() => window.scrollTo({ top: 200, behavior: 'smooth' }));
    await sleep(4000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(11000);
  });
}

// 17 — Excel export via Earnings (الأرباح)
async function v17_excel(browser) {
  await recordVideo(browser, '17_excel_demo', async (page) => {
    await login(page);
    await goTo(page, ['\u0627\u0644\u0623\u0631\u0628\u0627\u062d', 'Earnings']);
    await sleep(3000);
    const exportBtn = page
      .locator('a, button')
      .filter({ hasText: /Export Excel|\u062a\u0635\u062f\u064a\u0631/ })
      .first();
    if ((await exportBtn.count()) > 0) {
      await exportBtn.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(1500);
      await exportBtn.hover().catch(() => {});
      await sleep(3000);
    }
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await sleep(3000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(6000);
  });
}

console.log('\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
console.log('  Recording Final Dashboard Sections');
console.log('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n');

const browser = await chromium.launch();
try {
  console.log('14_settings:');      await v14_settings(browser);
  console.log('15_messages:');      await v15_messages(browser);
  console.log('16_whatsapp_demo:'); await v16_whatsapp(browser);
  console.log('17_excel_demo:');    await v17_excel(browser);
  console.log('\n\u2713 All 4 sections recorded');
} catch (error) {
  console.error('\n\u2717 Recording failed:', error.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
