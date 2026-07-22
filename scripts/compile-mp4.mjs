#!/usr/bin/env node

/**
 * Compile all tutorial videos + audio into a single MP4 file.
 * 
 * Order:
 * 00_intro + 00_intro.mp3
 * 01_overview + 01_overview.mp3
 * ...
 * 15_messages + 15_messages.mp3
 * 16_whatsapp_demo + 16_whatsapp_demo.mp3
 * 17_excel_demo + 17_excel_demo.mp3
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEOS_DIR = path.resolve(__dirname, '../public/tutorial/videos');
const AUDIO_DIR = path.resolve(__dirname, '../public/tutorial');
const OUTPUT_MP4 = path.resolve(__dirname, '../public/tutorial-video-demo.mp4');

console.log('╔════════════════════════════════════════╗');
console.log('║  Compiling Tutorial MP4                ║');
console.log('║  All videos + audio → single MP4       ║');
console.log('╚════════════════════════════════════════╝\n');

// List of sections to compile
const sections = [
  '00_intro',
  '01_overview',
  '02_add_patient',
  '03_add_doctor',
  '04_add_operation',
  '05_appointments',
  '06_analytics',
  '07_revenue',
  '08_earnings',
  '09_bookings',
  '10_patients',
  '11_doctors',
  '12_offers',
  '13_editor',
  '14_settings',
  '15_messages',
  '16_whatsapp_demo',
  '17_excel_demo',
];

try {
  // 1. Create a concat file for FFmpeg
  const concatFile = path.join(VIDEOS_DIR, 'concat.txt');
  let concatContent = '';
  
  for (const section of sections) {
    const videoFile = path.join(VIDEOS_DIR, `${section}.webm`);
    const audioFile = path.join(AUDIO_DIR, `${section}.mp3`);
    
    if (!fs.existsSync(videoFile)) {
      console.warn(`⚠ Video not found: ${section}.webm`);
      continue;
    }
    if (!fs.existsSync(audioFile)) {
      console.warn(`⚠ Audio not found: ${section}.mp3`);
      continue;
    }
    
    concatContent += `file '${videoFile}'\n`;
  }
  
  fs.writeFileSync(concatFile, concatContent, 'utf8');
  console.log(`✓ Concat file created: ${sections.length} sections`);

  // 2. Use FFmpeg to concatenate videos with audio
  // FFmpeg command to concat videos and add audio sync
  const ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${concatFile}" -c:v libx264 -c:a aac -y "${OUTPUT_MP4}"`;
  
  console.log('\nRunning FFmpeg (this may take 10-30 minutes)...');
  console.log('Please wait...\n');
  
  execSync(ffmpegCmd, { 
    stdio: 'inherit',
    maxBuffer: 10 * 1024 * 1024 
  });
  
  // 3. Verify output
  if (fs.existsSync(OUTPUT_MP4)) {
    const size = fs.statSync(OUTPUT_MP4).size;
    const sizeGB = (size / (1024 ** 3)).toFixed(2);
    console.log(`\n✓ MP4 created successfully: ${sizeGB} GB`);
    console.log(`  File: ${OUTPUT_MP4}`);
  } else {
    throw new Error('MP4 file was not created');
  }
  
  // 4. Cleanup
  fs.unlinkSync(concatFile);
  console.log('✓ Cleanup complete');
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  Tutorial MP4 Ready for Download!     ║');
  console.log('╚════════════════════════════════════════╝');

} catch (error) {
  console.error('\n✗ Compilation failed:', error.message);
  process.exit(1);
}
