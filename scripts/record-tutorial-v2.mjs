/**
 * Boss Dental Tutorial Recorder V2
 * 
 * Logs in ONCE, then records all 15 videos consecutively
 * No login screen in the recorded videos
 * 
 * Run: node scripts/record-tutorial-v2.mjs
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, renameSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://boss-dental-production.up.railway.app';
const VIDEOS_DIR = path.join(__dirname, '..', 'public', 'tutorial', 'videos');

if (!existsSync(VIDEOS_DIR)) mkdirSync(VIDEOS_DIR, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const videoConfigs = [
  { id: '01_overview', label: 'الرئيسية', sectionId: 'overview', description: 'تصوير شاشة الرئيسية مع الإحصائيات' },
  { id: '02_add_patient', label: 'إضافة عميل', sectionId: 'patients', description: 'فتح نموذج إضافة عميل وملء البيانات' },
  { id: '03_add_doctor', label: 'إضافة طبيب', sectionId: 'doctors', description: 'فتح نموذج إضافة طبيب مع نسبة العمولة' },
  { id: '04_add_operation', label: 'إضافة عملية', sectionId: 'operations', description: 'فتح نموذج إضافة عملية' },
  { id: '05_appointments', label: 'المواعيد', sectionId: 'overview', description: 'عرض جدول المواعيد' },
  { id: '06_analytics', label: 'التحليلات', sectionId: 'analytics', description: 'عرض قسم التحليلات والمخططات' },
  { id: '07_revenue', label: 'الإيرادات', sectionId: 'revenue', description: 'عرض قسم الإيرادات' },
  { id: '08_earnings', label: 'الأرباح', sectionId: 'earnings', description: 'عرض قسم أرباح الأطباء' },
  { id: '09_bookings', label: 'الحجوزات', sectionId: 'bookings', description: 'عرض قسم الحجوزات' },
  { id: '10_patients', label: 'العملاء', sectionId: 'patients', description: 'عرض قائمة العملاء والملفات' },
  { id: '11_doctors', label: 'الأطباء', sectionId: 'doctors', description: 'عرض قائمة الأطباء' },
  { id: '12_offers', label: 'العروض', sectionId: 'offers', description: 'عرض قسم العروض' },
  { id: '13_editor', label: 'محرر الموقع', sectionId: 'editor', description: 'عرض محرر الموقع' },
  { id: '14_settings', label: 'الإعدادات', sectionId: 'settings', description: 'عرض قسم الإعدادات' },
  { id: '15_messages', label: 'الرسائل', sectionId: 'messages', description: 'عرض قسم الرسائل والتذكيرات' },
];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await sleep(1000);
  await page.locator('input[autocomplete="username"]').fill('boss');
  await page.locator('input[type="password"]').fill('boss2026');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await sleep(2000);
  console.log('✓ Logged in once');
}

async function recordVideo(page, config, index) {
  console.log(`  ${index}. Recording ${config.label}...`);

  // Navigate to section using nav button
  const navLabels = {
    overview: ['الرئيسية', 'Overview'],
    analytics: ['التحليلات', 'Analytics'],
    revenue: ['الإيرادات', 'Revenue'],
    earnings: ['الأرباح', 'Earnings'],
    bookings: ['الحجوزات', 'Bookings'],
    whatsapp: ['واتساب', 'WhatsApp'],
    messages: ['رسائل العملاء', 'Client Messages'],
    reminders: ['التذكيرات', 'Reminders'],
    calendar: ['التقويم', 'Calendar'],
    patients: ['العملاء', 'Clients'],
    operations: ['العمليات', 'Operations'],
    doctors: ['الأطباء', 'Doctors'],
    offers: ['العروض', 'Offers'],
    editor: ['محرر الموقع', 'Site Editor'],
    settings: ['الإعدادات', 'Settings'],
  };

  const labels = navLabels[config.sectionId] || [config.label];
  for (const label of labels) {
    const btn = page.locator(`nav button`).filter({ hasText: label });
    if (await btn.count() > 0) {
      await btn.first().click();
      await sleep(1800);
      break;
    }
  }

  // Record screen
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1200);

  if (config.id === '02_add_patient') {
    // Click add button and show form
    const addBtn = page.getByRole('button', { name: /إضافة عميل|Add Client/i }).first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await sleep(1000);
    }
  } else if (config.id === '03_add_doctor') {
    // Click add button for doctor
    const addBtn = page.getByRole('button', { name: /إضافة طبيب|Add Doctor/i }).first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await sleep(1000);
    }
  } else if (config.id === '04_add_operation') {
    // Click add button for operation
    const addBtn = page.getByRole('button', { name: /إضافة.*عملية|Add.*Operation/i }).first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await sleep(1000);
    }
  } else if (config.id === '05_appointments') {
    // Scroll to show schedule
    await page.evaluate(() => window.scrollBy(0, 300));
    await sleep(800);
  } else if (config.id === '06_analytics' || config.id === '07_revenue' || config.id === '08_earnings') {
    // Scroll charts
    await page.evaluate(() => window.scrollBy(0, 400));
    await sleep(1000);
  } else if (config.id === '10_patients') {
    // Click a patient to show detail
    const patBtn = page.locator('button').filter({ hasText: /أحمد|سارة|محمود/i }).first();
    if (await patBtn.count() > 0) {
      await patBtn.click();
      await sleep(1200);
    }
  }

  await sleep(1500);
}

async function recordWithVideoContext(browser, config, index) {
  const tmpDir = path.join(VIDEOS_DIR, `_tmp_${config.id}`);
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: tmpDir, size: { width: 1280, height: 720 } },
  });
  const page = await ctx.newPage();

  try {
    await recordVideo(page, config, index);
  } catch (e) {
    console.log(`    ✗ Error: ${e.message.split('\n')[0]}`);
  } finally {
    await ctx.close();
    await sleep(1500);
  }

  const files = readdirSync(tmpDir).filter(f => f.endsWith('.webm'));
  if (files.length > 0) {
    const dest = path.join(VIDEOS_DIR, `${config.id}.webm`);
    renameSync(path.join(tmpDir, files[0]), dest);
    console.log(`     ✓ ${config.id}.webm`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Boss Dental Tutorial Recorder V2     ║');
  console.log('║  (No login in videos, login once)    ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Create a persistent browser + login once
  const browser = await chromium.launch({ headless: true });
  const persistCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const persistPage = await persistCtx.newPage();

  await login(persistPage);

  // Now record all videos in SEPARATE contexts from this logged-in session
  // But we need to use the same cookies for each new context
  const cookies = await persistCtx.cookies();

  console.log('Recording 15 videos...\n');
  for (let i = 0; i < videoConfigs.length; i++) {
    const config = videoConfigs[i];
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: path.join(VIDEOS_DIR, `_tmp_${config.id}`), size: { width: 1280, height: 720 } },
    });

    // Apply the cookies from the logged-in session
    if (cookies.length > 0) {
      await ctx.addCookies(cookies);
    }

    const page = await ctx.newPage();

    try {
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
      await sleep(1000);
      await recordVideo(page, config, i + 1);
    } catch (e) {
      console.log(`  ${i + 1}. ${config.label} - ✗ Error: ${e.message.split('\n')[0]}`);
    } finally {
      await ctx.close();
      await sleep(1500);

      const tmpDir = path.join(VIDEOS_DIR, `_tmp_${config.id}`);
      const files = readdirSync(tmpDir).filter(f => f.endsWith('.webm'));
      if (files.length > 0) {
        const dest = path.join(VIDEOS_DIR, `${config.id}.webm`);
        renameSync(path.join(tmpDir, files[0]), dest);
        console.log(`     ✓ ${config.id}.webm`);
      }
    }
  }

  await persistCtx.close();
  await browser.close();

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  Done! Videos ready for deployment   ║');
  console.log('╚════════════════════════════════════════╝');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
