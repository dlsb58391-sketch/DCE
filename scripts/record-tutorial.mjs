/**
 * Boss Dental Tutorial Recorder
 * 
 * Phase 1: Seeds live site with realistic Arabic demo data
 * Phase 2: Records real instruction videos for each dashboard section
 * 
 * Run: node scripts/record-tutorial.mjs
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

// ─── Demo data ────────────────────────────────────────────────────────────────
const PATIENTS = [
  { name: 'أحمد محمد علي', phone: '01001234567', gender: 'male', notes: 'حساسية من البنسلين' },
  { name: 'سارة خالد إبراهيم', phone: '01112345678', gender: 'female', notes: '' },
  { name: 'محمود عبدالله حسن', phone: '01223456789', gender: 'male', notes: 'ضغط دم مرتفع' },
  { name: 'فاطمة يوسف سيد', phone: '01534567890', gender: 'female', notes: '' },
  { name: 'عمر طارق محمود', phone: '01145678901', gender: 'male', notes: '' },
  { name: 'ريم أحمد ناصر', phone: '01256789012', gender: 'female', notes: 'سكري النوع الثاني' },
  { name: 'كريم حسام الدين', phone: '01067890123', gender: 'male', notes: '' },
  { name: 'نور الهدى عبدالرحمن', phone: '01178901234', gender: 'female', notes: '' },
  { name: 'حسن علي البدري', phone: '01289012345', gender: 'male', notes: '' },
  { name: 'مايا سعيد حسين', phone: '01590123456', gender: 'female', notes: '' },
  { name: 'يوسف إبراهيم مصطفى', phone: '01601234567', gender: 'male', notes: '' },
  { name: 'دينا طه سالم', phone: '01712345678', gender: 'female', notes: 'حمل شهر ٦' },
];

const DOCTORS = [
  { nameAr: 'د. محمد إبراهيم', nameEn: 'Dr. Mohamed Ibrahim', specialtyAr: 'تقويم الأسنان', specialtyEn: 'Orthodontics', phone: '01001111111', commissionPct: 40 },
  { nameAr: 'د. هنا كمال', nameEn: 'Dr. Hana Kamal', specialtyAr: 'طب الأسنان العام', specialtyEn: 'General Dentistry', phone: '01002222222', commissionPct: 35 },
  { nameAr: 'د. ياسر سامي', nameEn: 'Dr. Yasser Samy', specialtyAr: 'زراعة الأسنان', specialtyEn: 'Implants', phone: '01003333333', commissionPct: 45 },
];

// ─── Login ────────────────────────────────────────────────────────────────────
async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await sleep(500);
  // Use autocomplete selector since inputs have no placeholder
  await page.locator('input[autocomplete="username"]').fill('boss');
  await page.locator('input[type="password"]').fill('boss2026');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await sleep(1500);
  console.log('  ✓ Logged in');
}

// ─── Navigate to a section by nav ID ─────────────────────────────────────────
async function goTo(page, sectionId) {
  // Click the nav button that navigates to this section  
  // Nav buttons show Arabic text — match by partial text or by data attribute
  const sectionLabels = {
    overview:    ['الرئيسية', 'Overview'],
    analytics:   ['التحليلات', 'Analytics'],
    revenue:     ['الإيرادات', 'Revenue'],
    earnings:    ['الأرباح', 'Earnings'],
    bookings:    ['الحجوزات', 'Bookings'],
    whatsapp:    ['واتساب', 'WhatsApp'],
    messages:    ['رسائل العملاء', 'Client Messages'],
    reminders:   ['التذكيرات', 'Reminders'],
    calendar:    ['التقويم', 'Calendar'],
    patients:    ['العملاء', 'Clients'],
    operations:  ['العمليات', 'Operations'],
    doctors:     ['الأطباء', 'Doctors'],
    offers:      ['العروض', 'Offers'],
    editor:      ['محرر الموقع', 'Site Editor'],
    settings:    ['الإعدادات', 'Settings'],
  };
  
  const labels = sectionLabels[sectionId] || [sectionId];
  for (const label of labels) {
    const btn = page.locator(`nav button`).filter({ hasText: label });
    if (await btn.count() > 0) {
      await btn.first().click();
      await sleep(1500);
      return;
    }
  }
  console.log(`  ! Could not find nav for ${sectionId}`);
}

// ─── Seed patients via browser-side fetch ─────────────────────────────────────
async function seedPatients(page) {
  console.log('  Seeding patients...');
  for (const p of PATIENTS) {
    const res = await page.evaluate(async ({ patient, base }) => {
      const r = await fetch(`${base}/api/admin/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patient),
      });
      return r.status;
    }, { patient: p, base: BASE });
    process.stdout.write(res === 200 || res === 201 ? '.' : `[${res}]`);
  }
  console.log(' done');
}

// ─── Seed doctors ─────────────────────────────────────────────────────────────
async function seedDoctors(page) {
  console.log('  Seeding doctors...');
  for (const d of DOCTORS) {
    const res = await page.evaluate(async ({ doc, base }) => {
      const r = await fetch(`${base}/api/admin/doctors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(doc),
      });
      return r.status;
    }, { doc: d, base: BASE });
    process.stdout.write(res === 200 || res === 201 ? '.' : `[${res}]`);
  }
  console.log(' done');
}

// ─── Seed appointments ────────────────────────────────────────────────────────
async function seedAppointments(page) {
  console.log('  Seeding appointments...');
  const appts = [
    { name: 'أحمد محمد علي', phone: '01001234567', minutes: 20, lang: 'ar' },
    { name: 'سارة خالد إبراهيم', phone: '01112345678', minutes: 60, lang: 'ar' },
    { name: 'محمود عبدالله حسن', phone: '01223456789', minutes: 100, lang: 'ar' },
    { name: 'فاطمة يوسف سيد', phone: '01534567890', minutes: 160, lang: 'ar' },
  ];
  for (const a of appts) {
    const res = await page.evaluate(async ({ appt, base }) => {
      const r = await fetch(`${base}/api/admin/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(appt),
      });
      return r.status;
    }, { appt: a, base: BASE });
    process.stdout.write(res === 200 || res === 201 ? '.' : `[${res}]`);
  }
  console.log(' done');
}

// ─── Record a single video ────────────────────────────────────────────────────
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
    console.log(`  ✗ Error in ${name}: ${e.message.split('\n')[0]}`);
  } finally {
    await ctx.close();
    await sleep(1200);
  }

  const files = readdirSync(tmpDir).filter(f => f.endsWith('.webm'));
  if (files.length > 0) {
    const dest = path.join(VIDEOS_DIR, `${name}.webm`);
    renameSync(path.join(tmpDir, files[0]), dest);
    console.log(`  ✓ ${name}.webm`);
  } else {
    console.log(`  ✗ No video for ${name}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIDEO RECORDINGS
// ═══════════════════════════════════════════════════════════════════════════════

// 01 — Overview (الرئيسية)
async function v01_overview(browser) {
  await recordVideo(browser, '01_overview', async (page) => {
    await login(page);
    // Scroll through overview section to show all stat cards
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(2000);
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
    await sleep(1500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1500);
  });
}

// 02 — إضافة عميل جديد (Add Patient)
async function v02_add_patient(browser) {
  await recordVideo(browser, '02_add_patient', async (page) => {
    await login(page);
    await goTo(page, 'patients');
    await sleep(1000);

    // Click "إضافة عميل" / "Add Client" button
    await page.getByRole('button', { name: /إضافة عميل|Add Client/i }).first().click();
    await sleep(800);

    // Fill in patient form - fields have labels, use label-based selection
    // Full name field
    await page.getByLabel(/الاسم بالكامل|Full name/i).fill('خالد سمير وهبة');
    await sleep(600);

    // Phone
    await page.getByLabel(/رقم الهاتف|Phone number/i).fill('01012345678');
    await sleep(600);

    // Email (optional)
    await page.getByLabel(/البريد الإلكتروني|Email/i).fill('khaled@example.com');
    await sleep(500);

    // Gender
    const maleOpt = page.getByRole('radio', { name: /ذكر|male/i });
    if (await maleOpt.count() > 0) await maleOpt.click();
    await sleep(400);

    // Notes
    const notesField = page.getByLabel(/ملاحظات|Notes/i).first();
    if (await notesField.count() > 0) {
      await notesField.fill('حساسية من الأسبرين');
    }
    await sleep(600);

    // Scroll to see medical history section
    await page.evaluate(() => window.scrollBy(0, 300));
    await sleep(800);

    // Save
    await page.getByRole('button', { name: /حفظ|Save/i }).last().click();
    await sleep(2500);
  });
}

// 03 — إضافة طبيب مع تحديد نسبة العمولة (Add Doctor)
async function v03_add_doctor(browser) {
  await recordVideo(browser, '03_add_doctor', async (page) => {
    await login(page);
    await goTo(page, 'doctors');
    await sleep(1000);

    // Open add doctor modal/form
    await page.getByRole('button', { name: /إضافة طبيب|Add Doctor/i }).first().click();
    await sleep(800);

    // Arabic name
    const arNameField = page.getByLabel(/الاسم.*عربي|Arabic.*name/i).first();
    if (await arNameField.count() > 0) {
      await arNameField.fill('د. عمر فاروق');
      await sleep(400);
    }

    // English name
    const enNameField = page.getByLabel(/الاسم.*إنجليزي|English.*name/i).first();
    if (await enNameField.count() > 0) {
      await enNameField.fill('Dr. Omar Farouq');
      await sleep(400);
    }

    // Phone
    const phoneField = page.getByLabel(/هاتف|Phone/i).first();
    if (await phoneField.count() > 0) {
      await phoneField.fill('01099887766');
      await sleep(400);
    }

    // Specialty Arabic
    const specArField = page.getByLabel(/التخصص.*عربي|Arabic.*specialty/i).first();
    if (await specArField.count() > 0) {
      await specArField.fill('جراحة الفم والأسنان');
      await sleep(400);
    }

    // Commission % — the KEY setting to show
    const commField = page.getByLabel(/نسبة.*عمولة|commission|العمولة/i).first();
    if (await commField.count() > 0) {
      await commField.clear();
      await commField.fill('40');
      await sleep(800);
      // Highlight the commission field by scrolling to it
      await commField.evaluate(el => {
        el.style.boxShadow = '0 0 0 4px rgba(0,200,100,0.4)';
        setTimeout(() => el.style.boxShadow = '', 2000);
      });
      await sleep(1500);
    }

    // Save
    await page.getByRole('button', { name: /حفظ|Save/i }).last().click();
    await sleep(2500);
    
    // Show the doctor in the list with commission %
    await sleep(1500);
  });
}

// 04 — إضافة عملية (Add Operation/Treatment)
async function v04_add_operation(browser) {
  await recordVideo(browser, '04_add_operation', async (page) => {
    await login(page);
    await goTo(page, 'operations');
    await sleep(1000);

    // Click add button
    await page.getByRole('button', { name: /إضافة.*عملية|Add.*Operation|سجّل/i }).first().click();
    await sleep(1000);

    // Take a screenshot-style pause to show the form
    await sleep(1500);

    // Try to fill patient search
    const patSearch = page.getByPlaceholder(/ابحث|search|بحث/i).first();
    if (await patSearch.count() > 0) {
      await patSearch.fill('أحمد');
      await sleep(1000);
      // Click first result
      const firstResult = page.locator('[role="option"], li').first();
      if (await firstResult.count() > 0) {
        await firstResult.click();
        await sleep(500);
      }
    }
    
    await sleep(2000);
  });
}

// 05 — قسم المواعيد (Appointments / Overview Schedule)
async function v05_appointments(browser) {
  await recordVideo(browser, '05_appointments', async (page) => {
    await login(page);
    // Overview shows today's schedule
    await sleep(2000);
    // Scroll down to see appointment slots
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
    await sleep(2000);
    await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'smooth' }));
    await sleep(1500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1000);
  });
}

// 06 — التحليلات (Analytics)
async function v06_analytics(browser) {
  await recordVideo(browser, '06_analytics', async (page) => {
    await login(page);
    await goTo(page, 'analytics');
    await sleep(2000);
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
    await sleep(1500);
    await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'smooth' }));
    await sleep(1500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1000);
  });
}

// 07 — الإيرادات (Revenue)
async function v07_revenue(browser) {
  await recordVideo(browser, '07_revenue', async (page) => {
    await login(page);
    await goTo(page, 'revenue');
    await sleep(2500);
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
    await sleep(1500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1000);
  });
}

// 08 — الأرباح (Earnings / Doctor Commissions)
async function v08_earnings(browser) {
  await recordVideo(browser, '08_earnings', async (page) => {
    await login(page);
    await goTo(page, 'earnings');
    await sleep(2500);
    // Scroll to show doctor earnings table
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
    await sleep(1500);
    // Click first doctor to show detail
    const docRow = page.locator('table tbody tr, .doctor-earnings-row').first();
    if (await docRow.count() > 0) {
      await docRow.click();
      await sleep(2000);
    }
    await sleep(1000);
  });
}

// 09 — الحجوزات (Online Bookings)
async function v09_bookings(browser) {
  await recordVideo(browser, '09_bookings', async (page) => {
    await login(page);
    await goTo(page, 'bookings');
    await sleep(2500);
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await sleep(1500);
    // Show how to confirm a booking if any exist
    const confirmBtn = page.getByRole('button', { name: /تأكيد|Confirm/i }).first();
    if (await confirmBtn.count() > 0) {
      await confirmBtn.hover();
      await sleep(1000);
    }
    await sleep(1500);
  });
}

// 10 — العملاء (Patients list with detail)
async function v10_patients(browser) {
  await recordVideo(browser, '10_patients', async (page) => {
    await login(page);
    await goTo(page, 'patients');
    await sleep(2000);
    // Click a patient to show profile
    const patBtn = page.locator('nav button, [role="button"]').filter({ hasText: 'أحمد' }).first();
    // Try clicking the first patient card in the list
    const firstPatient = page.locator('button').filter({ hasText: /أحمد|سارة|محمود/i }).first();
    if (await firstPatient.count() > 0) {
      await firstPatient.click();
      await sleep(2000);
      // Scroll profile to show sessions, medical history
      await page.evaluate(() => {
        const detail = document.querySelector('.lg\\:col-span-2');
        if (detail) detail.scrollTop = 300;
      });
      await sleep(1500);
    }
  });
}

// 11 — الأطباء مع نسبة العمولة (Doctors + commission)
async function v11_doctors(browser) {
  await recordVideo(browser, '11_doctors', async (page) => {
    await login(page);
    await goTo(page, 'doctors');
    await sleep(2000);
    // Click first doctor to show edit form with commission %
    const editBtn = page.getByRole('button', { name: /تعديل|Edit/i }).first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await sleep(1500);
      // Highlight commission field
      const commField = page.getByLabel(/نسبة.*عمولة|commission|العمولة/i).first();
      if (await commField.count() > 0) {
        await commField.evaluate(el => {
          el.parentElement.style.background = 'rgba(0,200,100,0.1)';
          el.style.border = '2px solid #00c864';
        });
        await sleep(2000);
      }
      // Close
      const cancelBtn = page.getByRole('button', { name: /إلغاء|Cancel/i }).first();
      if (await cancelBtn.count() > 0) await cancelBtn.click();
      await sleep(500);
    }
    await sleep(1500);
  });
}

// 12 — العروض (Offers)
async function v12_offers(browser) {
  await recordVideo(browser, '12_offers', async (page) => {
    await login(page);
    await goTo(page, 'offers');
    await sleep(2500);
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await sleep(1500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1000);
  });
}

// 13 — محرر الموقع (Site Editor)
async function v13_editor(browser) {
  await recordVideo(browser, '13_editor', async (page) => {
    await login(page);
    await goTo(page, 'editor');
    await sleep(2500);
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
    await sleep(1500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1000);
  });
}

// 14 — الإعدادات (Settings — show working hours, clinic info)
async function v14_settings(browser) {
  await recordVideo(browser, '14_settings', async (page) => {
    await login(page);
    await goTo(page, 'settings');
    await sleep(2500);
    // Click through tabs if they exist
    const tabs = page.getByRole('tab');
    const tabCount = await tabs.count();
    for (let i = 0; i < Math.min(tabCount, 4); i++) {
      await tabs.nth(i).click();
      await sleep(1200);
    }
    await sleep(1000);
  });
}

// 15 — الرسائل والتذكيرات (Messages + Reminders)
async function v15_messages(browser) {
  await recordVideo(browser, '15_messages', async (page) => {
    await login(page);
    await goTo(page, 'messages');
    await sleep(2000);
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await sleep(1500);
    // Also show reminders
    await goTo(page, 'reminders');
    await sleep(2000);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('╔═══════════════════════════════════╗');
  console.log('║   Boss Dental Tutorial Recorder   ║');
  console.log('╚═══════════════════════════════════╝\n');

  // ── Phase 1: Seed demo data ──────────────────────────────────────────────────
  console.log('Phase 1: Seeding demo data...');
  const seedBrowser = await chromium.launch({ headless: true });
  const seedCtx = await seedBrowser.newContext({ viewport: { width: 1280, height: 720 } });
  const seedPage = await seedCtx.newPage();

  await login(seedPage);
  await seedDoctors(seedPage);
  await seedPatients(seedPage);
  await seedAppointments(seedPage);

  await seedCtx.close();
  await seedBrowser.close();
  console.log('\n✓ Data seeded\n');

  // ── Phase 2: Record instruction videos ────────────────────────────────────────
  console.log('Phase 2: Recording instruction videos...\n');
  const browser = await chromium.launch({ headless: true });

  const videos = [
    ['01 Overview (الرئيسية)', v01_overview],
    ['02 Add Patient (إضافة عميل)', v02_add_patient],
    ['03 Add Doctor (إضافة طبيب)', v03_add_doctor],
    ['04 Add Operation (إضافة عملية)', v04_add_operation],
    ['05 Appointments (المواعيد)', v05_appointments],
    ['06 Analytics (التحليلات)', v06_analytics],
    ['07 Revenue (الإيرادات)', v07_revenue],
    ['08 Earnings (الأرباح)', v08_earnings],
    ['09 Bookings (الحجوزات)', v09_bookings],
    ['10 Patients (العملاء)', v10_patients],
    ['11 Doctors (الأطباء)', v11_doctors],
    ['12 Offers (العروض)', v12_offers],
    ['13 Site Editor (المحرر)', v13_editor],
    ['14 Settings (الإعدادات)', v14_settings],
    ['15 Messages & Reminders', v15_messages],
  ];

  for (const [label, fn] of videos) {
    console.log(`▶ ${label}`);
    await fn(browser);
  }

  await browser.close();

  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║  Done! Videos saved to public/tutorial/videos ║');
  console.log('╚═══════════════════════════════════════════════╝');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
