#!/usr/bin/env node

/**
 * Record real WhatsApp messages and Excel export sections from dashboard
 */

import playwright from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://boss-dental-production.up.railway.app';
const VIDEO_DIR = path.resolve(__dirname, '../public/tutorial/videos');

console.log('╔════════════════════════════════════════╗');
console.log('║  Recording Real Dashboard Sections     ║');
console.log('╚════════════════════════════════════════╝\n');

const browser = await playwright.chromium.launch();

try {
  // 1. Login
  console.log('Logging in...');
  const ctxAuth = await browser.newContext();
  const pageAuth = await ctxAuth.newPage();
  
  await pageAuth.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  await pageAuth.locator('input[autocomplete="username"]').fill('doctor@theboss.clinic');
  await pageAuth.locator('input[type="password"]').fill('Boss@Ibrahim2026');
  
  await pageAuth.locator('button[type="submit"]').click();
  
  try {
    await pageAuth.waitForURL(/\/dashboard/, { timeout: 40000 });
  } catch (e) {
    await pageAuth.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  
  const cookies = await ctxAuth.cookies();
  await pageAuth.close();
  console.log('✓ Logged in\n');

  // 2. Record WhatsApp section - show messages/chats
  console.log('Recording Messages section...');
  const ctxMessages = await browser.newContext({ 
    recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } } 
  });
  await ctxMessages.addCookies(cookies);
  const pageMessages = await ctxMessages.newPage();
  
  await pageMessages.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pageMessages.waitForTimeout(1000);
  
  // Try to find and click the messages section
  try {
    // Look for الرسائل button or link
    const buttons = pageMessages.locator('button, a, div[role="button"]');
    const count = await buttons.count();
    
    for (let i = 0; i < Math.min(count, 20); i++) {
      const text = await buttons.nth(i).textContent().catch(() => '');
      if (text.includes('الرسائل') || text.includes('Messages')) {
        await buttons.nth(i).click({ timeout: 5000 }).catch(() => {});
        await pageMessages.waitForTimeout(1500);
        break;
      }
    }
  } catch (e) {
    console.log('⚠ Could not navigate to messages');
  }
  
  // Take screenshot to show what's on screen
  await pageMessages.screenshot({ path: path.join(__dirname, '../public/tutorial/messages-screen.png') });
  
  // Record for 3 seconds
  await pageMessages.waitForTimeout(3000);
  
  await pageMessages.close();
  await ctxMessages.close();
  console.log('✓ Messages section recorded\n');

  // 3. Record Settings/Export section
  console.log('Recording Settings section...');
  const ctxSettings = await browser.newContext({ 
    recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } } 
  });
  await ctxSettings.addCookies(cookies);
  const pageSettings = await ctxSettings.newPage();
  
  await pageSettings.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pageSettings.waitForTimeout(1000);
  
  // Try to find and click the settings section
  try {
    const buttons = pageSettings.locator('button, a, div[role="button"]');
    const count = await buttons.count();
    
    for (let i = 0; i < Math.min(count, 20); i++) {
      const text = await buttons.nth(i).textContent().catch(() => '');
      if (text.includes('الإعدادات') || text.includes('Settings')) {
        await buttons.nth(i).click({ timeout: 5000 }).catch(() => {});
        await pageSettings.waitForTimeout(1500);
        break;
      }
    }
  } catch (e) {
    console.log('⚠ Could not navigate to settings');
  }
  
  // Take screenshot
  await pageSettings.screenshot({ path: path.join(__dirname, '../public/tutorial/settings-screen.png') });
  
  // Record for 3 seconds
  await pageSettings.waitForTimeout(3000);
  
  await pageSettings.close();
  await ctxSettings.close();
  console.log('✓ Settings section recorded\n');
  
  await ctxAuth.close();

  console.log('╔════════════════════════════════════════╗');
  console.log('║  ✓ Real dashboard sections recorded   ║');
  console.log('╚════════════════════════════════════════╝');

} catch (error) {
  console.error('\n✗ Recording failed:', error.message);
  process.exit(1);
} finally {
  await browser.close();
}
