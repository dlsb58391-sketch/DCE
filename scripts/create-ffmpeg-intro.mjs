#!/usr/bin/env node

/**
 * Create an animated intro video using FFmpeg with text overlay
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_DIR = path.resolve(__dirname, '../public/tutorial/videos');
const ffmpegPath = path.resolve(__dirname, '../node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe');

console.log('╔════════════════════════════════════════╗');
console.log('║  Creating Animated Intro Video         ║');
console.log('╚════════════════════════════════════════╝\n');

try {
  const introPath = path.join(VIDEO_DIR, '00_intro.webm');
  
  // Create animated intro with FFmpeg - 5 seconds duration
  // Dark green background with animated text
  const cmd = `"${ffmpegPath}" -f lavfi -i color=#1a472a:s=1280x720:d=5 -vf "drawtext=text='كلينييفا':fontfile='C\\\\Windows\\\\Fonts\\\\arial.ttf':fontsize=120:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-100:alpha='if(lt(t,0.5),0,if(lt(t,4.5),(t-0.5)/2,1))'" -c:v libvpx-vp9 -pix_fmt yuva420p -y "${introPath}"`;
  
  console.log('Creating intro with FFmpeg...');
  
  try {
    execSync(cmd, {
      stdio: 'pipe',
      shell: true
    });
    console.log('✓ Intro video created');
  } catch (e) {
    // FFmpeg text rendering might fail, create simple colored video instead
    console.log('⚠ Using simple colored intro (text rendering not available)');
    
    const simpleCmd = `"${ffmpegPath}" -f lavfi -i color=#1a472a:s=1280x720:d=5 -c:v libvpx-vp9 -pix_fmt yuva420p -y "${introPath}"`;
    execSync(simpleCmd, {
      stdio: 'pipe',
      shell: true
    });
    console.log('✓ Intro video created (simple green)');
  }

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  ✓ Intro video ready                  ║');
  console.log('╚════════════════════════════════════════╝');

} catch (error) {
  console.error('\n✗ Failed to create intro:', error.message);
  process.exit(1);
}
