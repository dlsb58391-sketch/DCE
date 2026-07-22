#!/usr/bin/env node

import playwright from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://boss-dental-production.up.railway.app';
const VIDEO_DIR = path.resolve(__dirname, '../public/tutorial/videos');

console.log('╔════════════════════════════════════════╗');
console.log('║  Recording Real WhatsApp & Excel       ║');
console.log('╚════════════════════════════════════════╝\n');

const browser = await playwright.chromium.launch();

try {
  // 1. Login
  console.log('Step 1: Logging in...');
  const ctxAuth = await browser.newContext();
  const pageAuth = await ctxAuth.newPage();
  
  await pageAuth.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  await pageAuth.locator('input[autocomplete="username"]').fill('doctor@theboss.clinic');
  await pageAuth.locator('input[type="password"]').fill('Boss@Ibrahim2026');
  
  const submitBtn = pageAuth.locator('button[type="submit"]');
  await submitBtn.click();
  
  // Wait for dashboard
  try {
    await pageAuth.waitForURL(/\/dashboard/, { timeout: 40000 });
  } catch (e) {
    console.log('Navigating directly to dashboard...');
    await pageAuth.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  
  const cookies = await ctxAuth.cookies();
  await pageAuth.close();
  console.log('✓ Logged in\n');

  // 2. Record WhatsApp Messages section
  console.log('Recording WhatsApp messages section...');
  const ctxWA = await browser.newContext({ recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } } });
  await ctxWA.addCookies(cookies);
  const pageWA = await ctxWA.newPage();
  
  await pageWA.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Wait a bit for dashboard to render
  await pageWA.waitForTimeout(1000);
  
  // Click on Messages button in nav
  try {
    const navButtons = pageWA.locator('nav button, [role="navigation"] button');
    const messagesBtn = navButtons.filter({ hasText: /رسائل|messages|Messages/i }).first();
    
    const isVisible = await messagesBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (isVisible) {
      await messagesBtn.click({ timeout: 10000 });
      await pageWA.waitForTimeout(2000);
      console.log('✓ Navigated to Messages');
    } else {
      console.log('⚠ Messages button not found, showing dashboard');
    }
  } catch (e) {
    console.log('⚠ Could not click messages button');
  }
  
  // Show the page for 3 seconds
  await pageWA.waitForTimeout(3000);
  
  const videoWAPath = await pageWA.video().path();
  await pageWA.close();
  await ctxWA.close();
  console.log('✓ WhatsApp video recorded\n');

  // 3. Record Settings/Export section
  console.log('Recording Excel export section...');
  const ctxExcel = await browser.newContext({ recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } } });
  await ctxExcel.addCookies(cookies);
  const pageExcel = await ctxExcel.newPage();
  
  await pageExcel.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  await pageExcel.waitForTimeout(1000);
  
  // Click on Settings button
  try {
    const navButtons = pageExcel.locator('nav button, [role="navigation"] button');
    const settingsBtn = navButtons.filter({ hasText: /إعدادات|settings|Settings/i }).first();
    
    const isVisible = await settingsBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (isVisible) {
      await settingsBtn.click({ timeout: 10000 });
      await pageExcel.waitForTimeout(2000);
      console.log('✓ Navigated to Settings');
    } else {
      console.log('⚠ Settings button not found, showing dashboard');
    }
  } catch (e) {
    console.log('⚠ Could not click settings button');
  }
  
  // Show the page for 3 seconds
  await pageExcel.waitForTimeout(3000);
  
  const videoExcelPath = await pageExcel.video().path();
  await pageExcel.close();
  await ctxExcel.close();
  console.log('✓ Excel/Settings video recorded\n');
  
  await ctxAuth.close();

  console.log('╔════════════════════════════════════════╗');
  console.log('║  ✓ Videos recorded successfully        ║');
  console.log('╚════════════════════════════════════════╝');

} catch (error) {
  console.error('✗ Recording failed:', error.message);
  process.exit(1);
} finally {
  await browser.close();
}
