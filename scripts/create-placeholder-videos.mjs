#!/usr/bin/env node

/**
 * Create placeholder webm videos for sections that don't have recordings yet.
 * These are simple 3-second videos with a colored background.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_DIR = path.resolve(__dirname, '../public/tutorial/videos');

console.log('╔════════════════════════════════════════╗');
console.log('║  Creating Placeholder Videos           ║');
console.log('╚════════════════════════════════════════╝\n');

const placeholders = [
  { name: '00_intro.webm', color: '#1a1a2e', duration: 3 },
  { name: '16_whatsapp_demo.webm', color: '#00a884', duration: 3 },
  { name: '17_excel_demo.webm', color: '#217346', duration: 3 },
];

try {
  for (const placeholder of placeholders) {
    const videoPath = path.join(VIDEO_DIR, placeholder.name);
    
    if (fs.existsSync(videoPath)) {
      console.log(`⊘ ${placeholder.name} already exists`);
      continue;
    }
    
    console.log(`Creating ${placeholder.name}...`);
    
    // Create a simple video with FFmpeg
    const ffmpegCmd = `ffmpeg -f lavfi -i color=${placeholder.color}:s=1280x720:d=${placeholder.duration} -c:v libvpx-vp9 -pix_fmt yuva420p -y "${videoPath}"`;
    
    execSync(ffmpegCmd, { 
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    console.log(`✓ ${placeholder.name}`);
  }
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  Placeholder videos created            ║');
  console.log('╚════════════════════════════════════════╝');

} catch (error) {
  console.error('\n✗ Failed to create placeholders:', error.message);
  process.exit(1);
}
