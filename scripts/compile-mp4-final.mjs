#!/usr/bin/env node

/**
 * Create placeholder webm videos and compile MP4 tutorial
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_DIR = path.resolve(__dirname, '../public/tutorial/videos');
const AUDIO_DIR = path.resolve(__dirname, '../public/tutorial');
const OUTPUT_MP4 = path.resolve(__dirname, '../public/tutorial-demo.mp4');

// Get ffmpeg path from node_modules
const ffmpegPath = path.resolve(__dirname, '../node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe');

console.log('╔════════════════════════════════════════╗');
console.log('║  MP4 Tutorial Compilation              ║');
console.log('║  Step 1: Create placeholders           ║');
console.log('║  Step 2: Compile with audio            ║');
console.log('╚════════════════════════════════════════╝\n');

try {
  // Step 1: Create missing placeholder videos
  console.log('Step 1: Creating placeholder videos...\n');
  
  const placeholders = [
    { name: '00_intro.webm', color: '#1a1a2e' },
    { name: '16_whatsapp_demo.webm', color: '#00a884' },
    { name: '17_excel_demo.webm', color: '#217346' },
  ];
  
  for (const ph of placeholders) {
    const videoPath = path.join(VIDEO_DIR, ph.name);
    
    if (fs.existsSync(videoPath)) {
      console.log(`⊘ ${ph.name} already exists`);
      continue;
    }
    
    console.log(`Creating ${ph.name}...`);
    
    // Create a 3-second video with colored background
    const cmd = `"${ffmpegPath}" -f lavfi -i color=${ph.color}:s=1280x720:d=3 -c:v libvpx-vp9 -pix_fmt yuva420p -y "${videoPath}"`;
    
    execSync(cmd, { 
      stdio: 'pipe',
      encoding: 'utf8',
      shell: true
    });
    
    console.log(`✓ ${ph.name}`);
  }
  
  // Step 2: Create concat file with videos and audio mixed
  console.log('\nStep 2: Preparing compilation...\n');
  
  const sections = [
    '00_intro', '01_overview', '02_add_patient', '03_add_doctor',
    '04_add_operation', '05_appointments', '06_analytics', '07_revenue',
    '08_earnings', '09_bookings', '10_patients', '11_doctors',
    '12_offers', '13_editor', '14_settings', '15_messages',
    '16_whatsapp_demo', '17_excel_demo',
  ];
  
  let ffmpegComplex = '';
  let audioInputs = '';
  let videoInputs = '';
  let concatInputs = '';
  let inputIndex = 0;
  let videoIndex = 0;
  let audioIndex = 0;
  
  // Build FFmpeg filter complex string
  for (const section of sections) {
    const videoFile = path.join(VIDEO_DIR, `${section}.webm`);
    const audioFile = path.join(AUDIO_DIR, `${section}.mp3`);
    
    if (!fs.existsSync(videoFile)) {
      console.warn(`⚠ Skipping: ${section}.webm not found`);
      continue;
    }
    if (!fs.existsSync(audioFile)) {
      console.warn(`⚠ Skipping: ${section}.mp3 not found`);
      continue;
    }
    
    // Add input files
    videoInputs += ` -i "${videoFile}"`;
    audioInputs += ` -i "${audioFile}"`;
    
    // Build filter complex
    concatInputs += `[${inputIndex}:v:0][${inputIndex + sections.length}:a:0]`;
    inputIndex++;
  }
  
  console.log(`Preparing to compile ${sections.length} sections...`);
  
  // Execute FFmpeg to compile
  console.log('Running FFmpeg compilation (this may take 20-60 minutes)...\n');
  
  const baseCmd = `"${ffmpegPath}"${videoInputs}${audioInputs} -filter_complex "concat=n=${sections.length}:v=1:a=1" -c:v libx264 -c:a aac -y "${OUTPUT_MP4}"`;
  
  execSync(baseCmd, {
    stdio: 'inherit',
    shell: true,
    maxBuffer: 10 * 1024 * 1024
  });
  
  // Step 3: Verify output
  if (fs.existsSync(OUTPUT_MP4)) {
    const sizeGB = (fs.statSync(OUTPUT_MP4).size / (1024 ** 3)).toFixed(2);
    console.log(`\n✓ MP4 created: ${sizeGB} GB`);
    console.log(`  Location: ${OUTPUT_MP4}`);
    console.log(`  Ready for download at: /tutorial-demo.mp4`);
  } else {
    throw new Error('MP4 file was not created');
  }
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  ✓ Tutorial MP4 Ready!                 ║');
  console.log('╚════════════════════════════════════════╝');

} catch (error) {
  console.error('\n✗ Compilation failed:', error.message);
  process.exit(1);
}
