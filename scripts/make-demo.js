import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const framesDir = path.join(publicDir, 'demo', 'frames');
const segmentsDir = path.join(publicDir, 'demo', 'segments');
const audioDir = path.join(publicDir, 'demo', 'audio');
const outputPath = path.join(publicDir, 'demo.mp4');

const BASE_URL = process.env.DEMO_URL || 'http://localhost:5173/?demo=1';
const DISPLAY_SECONDS = Number(process.env.DEMO_SECONDS || 5);
const PAD_SECONDS = Number(process.env.DEMO_PAD || 2.0);
const FADE_SECONDS = Number(process.env.DEMO_FADE || 0.5);
const WIDTH = Number(process.env.DEMO_WIDTH || 1920);
const HEIGHT = Number(process.env.DEMO_HEIGHT || 1080);

const scenes = [
  { label: 'Text', caption: 'Translate text instantly' },
  { label: 'Audio', caption: 'Speak and auto-translate' },
  { label: 'Video', caption: 'Translate videos with subtitles' },
  { label: 'Camera', caption: 'Point camera and translate text (OCR)' },
  { label: 'History', caption: 'Search and revisit past translations' },
  { label: 'Tour Guide', caption: 'Location-aware recommendations and maps' },
  { label: 'ChatGPT', caption: 'Agentic AI for travel planning' },
];

const labelToKey = {
  'Text': 'text',
  'Audio': 'audio',
  'Video': 'video',
  'Camera': 'camera',
  'History': 'history',
  'Tour Guide': 'tour',
  'ChatGPT': 'chatgpt',
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function detectFontPath() {
  const candidates = [
    // macOS
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/Library/Fonts/Arial.ttf',
    '/System/Library/Fonts/SFNS.ttf',
    '/System/Library/Fonts/SFNSDisplay.ttf',
    // Linux
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    // Windows
    'C:/Windows/Fonts/arial.ttf',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

async function waitForServer(urlStr, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const res = await fetch(urlStr, { method: 'GET' });
      if (res.ok) return true;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function clickTabByLabel(page, label) {
  await page.waitForSelector('div.border-b');
  const clicked = await page.evaluate((lbl) => {
    const container = document.querySelector('div.border-b');
    if (!container) return false;
    const btns = Array.from(container.querySelectorAll('button'));
    const target = btns.find((b) => (b.textContent || '').includes(lbl));
    if (target) {
      target.click();
      return true;
    }
    return false;
  }, label);
  if (!clicked) {
    throw new Error(`Tab button not found: ${label}`);
  }
}

async function captureFrame(page, label, outPath) {
  // Wait for main content container
  const selector = 'div.bg-white.rounded-xl.shadow-lg.p-6';
  await page.waitForSelector(selector);
  const element = await page.$(selector);
  if (!element) throw new Error('Main content container not found');
  await element.screenshot({ path: outPath });
}

function ensureFfmpeg() {
  if (!ffmpegPath) throw new Error('ffmpeg-static path not found');
}

function findVoiceoverFile(index, key) {
  if (!fs.existsSync(audioDir)) return undefined;
  const files = fs.readdirSync(audioDir).filter((f) => /\.(wav|mp3|m4a|aac|ogg)$/i.test(f));
  const prefix = String(index).padStart(2, '0');
  const byKey = files.find((f) => f.startsWith(`${prefix}-${key}-`));
  if (byKey) return path.join(audioDir, byKey);
  const byIndex = files.find((f) => f.startsWith(`${prefix}-`));
  if (byIndex) return path.join(audioDir, byIndex);
  return undefined;
}

function buildSegment(framePath, segmentPath, caption, fontPath, audioPath) {
  return new Promise((resolve, reject) => {
    const durationSec = DISPLAY_SECONDS + PAD_SECONDS;
    const fadeIn = `fade=t=in:st=0:d=${FADE_SECONDS}`;
    const fadeOut = `fade=t=out:st=${Math.max(0, durationSec - FADE_SECONDS)}:d=${FADE_SECONDS}`;
    const draw = fontPath
      ? `,drawtext=fontfile='${fontPath}':text='${String(caption).replace(/:/g, '\\:').replace(/'/g, "\\'") }':fontcolor=white:fontsize=${Math.round(HEIGHT * 0.045)}:box=1:boxcolor=black@0.5:boxborderw=10:x=(w-text_w)/2:y=h-${Math.round(HEIGHT * 0.15)}`
      : '';
    const vf = `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,` +
               `pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,` +
               `${fadeIn},${fadeOut}${draw},format=yuv420p`;

    const args = [
      '-hide_banner',
      '-y',
      '-loop', '1',
      '-i', framePath,
    ];
    if (audioPath) {
      args.push('-i', audioPath);
    } else {
      args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
    }
    args.push(
      '-t', String(durationSec),
      '-r', '30',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-vf', vf,
      '-c:a', 'aac',
      '-ac', '2',
      '-ar', '44100',
      '-map', '0:v:0',
      '-map', audioPath ? '1:a:0' : '1',
      segmentPath,
    );
    const proc = spawn(ffmpegPath, args, { stdio: 'inherit' });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg (segment) exited with code ${code}`));
    });
  });
}

function makeSegment(framePath, segmentPath, caption, fontPath, audioPath) {
    return new Promise((resolve, reject) => {
    const durationSec = DISPLAY_SECONDS + PAD_SECONDS;
    const fadeIn = `fade=t=in:st=0:d=${FADE_SECONDS}`;
    const fadeOut = `fade=t=out:st=${Math.max(0, durationSec - FADE_SECONDS)}:d=${FADE_SECONDS}`;
    const draw = fontPath
      ? `,drawtext=fontfile='${fontPath}':text='${String(caption).replace(/:/g, '\\:').replace(/'/g, "\\'")}':fontcolor=white:fontsize=${Math.round(HEIGHT * 0.045)}:box=1:boxcolor=black@0.5:boxborderw=10:x=(w-text_w)/2:y=h-${Math.round(HEIGHT * 0.15)}`
      : '';
    const vf = `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,` +
               `pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,` +
               `${fadeIn},${fadeOut}${draw},format=yuv420p`;

    // No audio fade-in or fade-out per request

    const cmd = ffmpeg()
      .input(framePath)
      .inputOptions(['-loop', '1'])
      .input(audioPath ?? 'anullsrc=channel_layout=stereo:sample_rate=44100')
      .inputOptions(audioPath ? [] : ['-f', 'lavfi'])
      .outputOptions(['-t', String(durationSec), '-r', '30'])
      .videoCodec('libx264')
      .outputOptions(['-pix_fmt', 'yuv420p'])
      .outputOptions(['-movflags', '+faststart'])
      .videoFilters(vf)
      .audioCodec('aac')
      .audioChannels(2)
      .audioFrequency(44100)
      .outputOptions(['-map', '0:v:0', '-map', audioPath ? '1:a:0' : '1'])
      .on('error', reject)
      .on('end', resolve);

    // Save after building chain without audio fades
    cmd.save(segmentPath);
  });
}

async function concatSegments(segmentPaths, outPath) {
  const listFile = path.join(segmentsDir, 'list.txt');
  const content = segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listFile, content);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listFile)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioChannels(2)
      .audioFrequency(44100)
      .outputOptions(['-pix_fmt', 'yuv420p', '-movflags', '+faststart'])
      .on('error', reject)
      .on('end', resolve)
      .save(outPath);
  });
}

async function concatSegmentsSpawn(segmentPaths, outPath) {
  const listFile = path.join(segmentsDir, 'list.txt');
  const content = segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listFile, content);

  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-ac', '2',
      '-ar', '44100',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      outPath,
    ];
    const proc = spawn(ffmpegPath, args, { stdio: 'inherit' });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg (concat) exited with code ${code}`));
    });
  });
}

async function main() {
  ensureDir(framesDir);
  ensureDir(segmentsDir);
  ensureFfmpeg();

  const serverOk = await waitForServer(BASE_URL);
  if (!serverOk) {
    console.error(`Dev server not reachable at ${BASE_URL}. Start it with 'npm run dev'.`);
    process.exit(1);
  }

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

    const segmentPaths = [];
    const fontPath = detectFontPath();

    for (let i = 0; i < scenes.length; i++) {
      const { label, caption } = scenes[i];
      await clickTabByLabel(page, label);
      await new Promise((r) => setTimeout(r, 1200));
      const frameOut = path.join(framesDir, `${String(i + 1).padStart(2, '0')}-${label.toLowerCase()}.png`);
      await captureFrame(page, label, frameOut);

      const key = labelToKey[label] || label.toLowerCase().replace(/\s+/g, '');
      const audioPath = findVoiceoverFile(i + 1, key);
      if (!audioPath) {
        console.warn(`No voiceover found for scene ${i + 1} (${label}). Will use silence.`);
      }
      const segOut = path.join(segmentsDir, `${String(i + 1).padStart(2, '0')}-${label.toLowerCase()}.mp4`);
      await buildSegment(frameOut, segOut, caption, fontPath, audioPath);
      segmentPaths.push(segOut);
      console.log(`Captured ${label}`);
    }

    await concatSegmentsSpawn(segmentPaths, outputPath);
    console.log(`Demo video written to ${outputPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});