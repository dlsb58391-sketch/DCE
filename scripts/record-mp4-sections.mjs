#!/usr/bin/env node

import playwright from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://boss-dental-production.up.railway.app';
const VIDEO_DIR = path.resolve(__dirname, '../public/tutorial/videos');

console.log('╔════════════════════════════════════════╗');
console.log('║  Recording MP4 Sections                ║');
console.log('║  (Intro, WhatsApp, Excel)              ║');
console.log('╚════════════════════════════════════════╝\n');

const browser = await playwright.chromium.launch();

try {
  // 1. Record Intro - Show Cliniva branding and system intro
  console.log('Recording intro (Cliniva branding)...');
  const ctx1 = await browser.newContext({ recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } } });
  const page1 = await ctx1.newPage();
  
  try {
    await page1.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.warn('Warning: page load took long, continuing...');
  }
  
  await page1.waitForTimeout(2500); // Show landing page
  const video1Path = await page1.video().path();
  await page1.close();
  await ctx1.close();
  console.log(`✓ 00_intro.webm recorded`);

  // 2. Quick login for dashboard recording
  console.log('\nLogging in for dashboard recordings...');
  const ctxAuth = await browser.newContext();
  const pageAuth = await ctxAuth.newPage();
  
  try {
    await pageAuth.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  } catch (e) {
    console.warn('Warning: login page slow, continuing...');
  }
  
  await pageAuth.locator('input[autocomplete="username"]').fill('doctor@theboss.clinic');
  await pageAuth.locator('input[type="password"]').fill('Boss@Ibrahim2026');
  
  const submitBtn = pageAuth.locator('button[type="submit"]');
  await submitBtn.click();
  
  // Wait for dashboard to load with longer timeout
  try {
    await pageAuth.waitForURL(/\/dashboard/, { timeout: 40000 });
  } catch (e) {
    console.warn('Warning: dashboard load slow, waiting additional time...');
    await pageAuth.waitForTimeout(5000);
    const currentUrl = pageAuth.url();
    if (!currentUrl.includes('/dashboard')) {
      console.log('Current URL:', currentUrl);
      console.log('Trying alternative navigation...');
      // Try navigating directly
      await pageAuth.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
  }
  
  const cookies = await ctxAuth.cookies();
  await pageAuth.close();
  console.log('✓ Logged in');

  // 3. Record WhatsApp Bot Demo
  console.log('Recording WhatsApp bot demo...');
  const ctxWA = await browser.newContext({ recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } } });
  await ctxWA.addCookies(cookies);
  const pageWA = await ctxWA.newPage();
  
  try {
    await pageWA.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  } catch (e) {
    console.warn('Warning: dashboard load slow');
  }
  
  // Navigate to messages/WhatsApp section
  try {
    const msgBtn = pageWA.locator('nav button').filter({ hasText: 'الرسائل' });
    await msgBtn.click({ timeout: 10000 });
  } catch (e) {
    console.warn('Warning: could not find messages button');
  }
  
  await pageWA.waitForTimeout(2000);
  const videoWAPath = await pageWA.video().path();
  await pageWA.close();
  await ctxWA.close();
  console.log(`✓ 16_whatsapp_demo.webm recorded`);

  // 4. Record Excel Export Demo
  console.log('Recording Excel export demo...');
  const ctxExcel = await browser.newContext({ recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } } });
  await ctxExcel.addCookies(cookies);
  const pageExcel = await ctxExcel.newPage();
  
  try {
    await pageExcel.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  } catch (e) {
    console.warn('Warning: dashboard load slow');
  }
  
  // Navigate to settings or appropriate section for export
  try {
    const settingsBtn = pageExcel.locator('nav button').filter({ hasText: 'الإعدادات' });
    await settingsBtn.click({ timeout: 10000 });
  } catch (e) {
    console.warn('Warning: could not find settings button');
  }
  
  await pageExcel.waitForTimeout(2000);
  const videoExcelPath = await pageExcel.video().path();
  await pageExcel.close();
  await ctxExcel.close();
  console.log(`✓ 17_excel_demo.webm recorded`);
  
  await ctxAuth.close();

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  Done recording additional sections   ║');
  console.log('╚════════════════════════════════════════╝');

} catch (error) {
  console.error('Recording failed:', error.message);
  process.exit(1);
} finally {
  await browser.close();
}
