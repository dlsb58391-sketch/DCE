#!/usr/bin/env node

/**
 * Compile the tutorial MP4 with perfect audio/video sync.
 *
 * Root-cause fix: the old single concat filter joined the video and audio
 * tracks independently, so any section whose video was longer than its audio
 * (e.g. 14_settings at 32s vs 14s) produced a long silent "freeze", and the
 * whole timeline drifted.
 *
 * This version normalises EACH section to exactly its audio duration, then
 * concatenates the normalised segments with the concat demuxer (-c copy):
 *   - video longer than audio  -> show the LAST <audio> seconds (skips the
 *     login/overview intro captured at the start of a recording)
 *   - video shorter than audio -> freeze the last frame to fill the gap
 *
 * The result: every voiceover plays over real, moving content and the tracks
 * never drift.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_DIR = path.resolve(__dirname, '../public/tutorial/videos');
const AUDIO_DIR = path.resolve(__dirname, '../public/tutorial');
const SEG_DIR = path.resolve(VIDEO_DIR, '_segments');
const OUTPUT_MP4 = path.resolve(__dirname, '../public/tutorial-demo.mp4');
const ffmpegPath = path.resolve(__dirname, '../node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe');

const sections = [
  '00_intro', '01_overview', '02_add_patient', '03_add_doctor',
  '04_add_operation', '05_appointments', '06_analytics', '07_revenue',
  '08_earnings', '09_bookings', '10_patients', '11_doctors',
  '12_offers', '13_editor', '14_settings', '15_messages',
  '16_whatsapp_demo', '17_excel_demo',
];

function durationOf(file) {
  let out = '';
  try {
    out = execSync(`"${ffmpegPath}" -i "${file}" -f null - 2>&1`, {
      encoding: 'utf8', shell: true, maxBuffer: 10 * 1024 * 1024,
    });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '') + (e.message || '');
  }
  const m = out.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (m) return (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
  return null;
}

console.log('╔════════════════════════════════════════╗');
console.log('║  MP4 Compilation (synced segments)     ║');
console.log('╚════════════════════════════════════════╝\n');

if (!fs.existsSync(SEG_DIR)) fs.mkdirSync(SEG_DIR, { recursive: true });

const listFile = path.join(SEG_DIR, 'concat-list.txt');
const listLines = [];

try {
  for (const section of sections) {
    const videoFile = path.join(VIDEO_DIR, `${section}.webm`);
    const audioFile = path.join(AUDIO_DIR, `${section}.mp3`);
    if (!fs.existsSync(videoFile)) { console.warn(`⚠ missing ${section}.webm`); continue; }
    if (!fs.existsSync(audioFile)) { console.warn(`⚠ missing ${section}.mp3`); continue; }

    const A = durationOf(audioFile);
    const V = durationOf(videoFile);
    if (!A || !V) { console.warn(`⚠ could not read durations for ${section}`); continue; }

    const segOut = path.join(SEG_DIR, `${section}.mp4`);
    const vf = 'fps=25,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p';

    let cmd;
    if (V > A + 0.3) {
      // Video longer than audio: take the LAST A seconds (skip the intro).
      const ss = (V - A).toFixed(3);
      cmd = `"${ffmpegPath}" -ss ${ss} -i "${videoFile}" -i "${audioFile}" ` +
            `-filter_complex "[0:v]${vf}[v]" -map "[v]" -map 1:a ` +
            `-t ${A.toFixed(3)} -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p ` +
            `-c:a aac -ar 44100 -ac 2 -y "${segOut}"`;
    } else {
      // Video shorter than audio: freeze last frame to fill the gap.
      const pad = (A - V + 2).toFixed(3);
      cmd = `"${ffmpegPath}" -i "${videoFile}" -i "${audioFile}" ` +
            `-filter_complex "[0:v]tpad=stop_mode=clone:stop_duration=${pad},${vf}[v]" -map "[v]" -map 1:a ` +
            `-t ${A.toFixed(3)} -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p ` +
            `-c:a aac -ar 44100 -ac 2 -y "${segOut}"`;
    }

    execSync(cmd, { stdio: 'pipe', encoding: 'utf8', shell: true, maxBuffer: 10 * 1024 * 1024 });
    const mode = V > A + 0.3 ? `trim last ${A.toFixed(1)}s` : `pad to ${A.toFixed(1)}s`;
    console.log(`✓ ${section}  (V:${V.toFixed(1)}s A:${A.toFixed(1)}s → ${mode})`);
    listLines.push(`file '${segOut.replace(/\\/g, '/')}'`);
  }

  fs.writeFileSync(listFile, listLines.join('\n'), 'utf8');

  console.log('\nConcatenating segments...');
  const concatCmd = `"${ffmpegPath}" -f concat -safe 0 -i "${listFile}" -c copy -movflags +faststart -y "${OUTPUT_MP4}"`;
  execSync(concatCmd, { stdio: 'pipe', encoding: 'utf8', shell: true, maxBuffer: 10 * 1024 * 1024 });

  if (fs.existsSync(OUTPUT_MP4)) {
    const sizeMB = (fs.statSync(OUTPUT_MP4).size / (1024 ** 2)).toFixed(2);
    const total = durationOf(OUTPUT_MP4);
    console.log(`\n✓ MP4 created: ${sizeMB} MB`);
    console.log(`  Duration: ${total ? total.toFixed(1) + 's' : 'n/a'}`);
    console.log(`  Location: ${OUTPUT_MP4}`);
  } else {
    throw new Error('MP4 file was not created');
  }

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  ✓ Tutorial MP4 Ready!                 ║');
  console.log('╚════════════════════════════════════════╝');
} catch (error) {
  console.error('\n✗ Compilation failed:', error.message);
  if (error.stderr) console.error(String(error.stderr).split('\n').slice(-15).join('\n'));
  process.exit(1);
}
