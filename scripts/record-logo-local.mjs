#!/usr/bin/env node

import playwright from 'playwright';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_DIR = path.resolve(__dirname, '../public/tutorial/videos');
const LOGO_HTML = path.resolve(__dirname, '../public/cliniva-logo.html');

console.log('╔════════════════════════════════════════╗');
console.log('║  Recording Cliniva Logo (LOCAL FILE)   ║');
console.log('╚════════════════════════════════════════╝\n');

const browser = await playwright.chromium.launch();

try {
  console.log('Recording Cliniva logo from local file...');
  const ctx = await browser.newContext({ 
    recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } }
  });
  const page = await ctx.newPage();
  
  // Navigate to LOCAL Cliniva logo file
  const fileUrl = pathToFileURL(LOGO_HTML).href;
  console.log(`Loading: ${fileUrl}`);
  await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 });
  
  // Let it play for 5 seconds (animation + audio length)
  await page.waitForTimeout(5000);
  
  const videoPath = await page.video().path();
  await page.close();
  await ctx.close();
  
  console.log('✓ Logo video recorded\n');
  
  // Rename the video file to 00_intro.webm
  if (fs.existsSync(videoPath)) {
    const targetPath = path.join(VIDEO_DIR, '00_intro.webm');
    
    // Remove old file if exists
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    
    fs.renameSync(videoPath, targetPath);
    console.log(`✓ Saved as 00_intro.webm`);
  }
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  ✓ Cliniva logo intro ready!          ║');
  console.log('╚════════════════════════════════════════╝');

} catch (error) {
  console.error('✗ Recording failed:', error.message);
  process.exit(1);
} finally {
  await browser.close();
}
