import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function usageAndExit(msg) {
  if (msg) console.error(msg);
  console.error('Usage: node scripts/concat-demo.js "+/absolute/path/to/prepend.mp4" [outputPath] [--intro-text "Welcome..."] [--music-volume 0.12] [--voiceover "/abs/intro.wav"]');
  process.exit(1);
}

function parseArgs(argv) {
  const opts = {
    introText: 'Welcome to Grok — translate text, audio, video, and camera instantly.',
    musicVolume: 0.12,
    voiceoverPath: '',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--intro-text') {
      opts.introText = argv[i + 1] || opts.introText;
      i++;
    } else if (a === '--music-volume') {
      const v = Number(argv[i + 1]);
      if (!isNaN(v) && v >= 0 && v <= 1) opts.musicVolume = v;
      i++;
    } else if (a === '--voiceover') {
      opts.voiceoverPath = argv[i + 1] || '';
      i++;
    }
  }
  return opts;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sayToAiff(text, aiffPath) {
  return new Promise((resolve, reject) => {
    const args = ['-o', aiffPath, text];
    const p = spawn('say', args);
    let stderr = '';
    p.stderr?.on('data', (d) => (stderr += d.toString()));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`say exited with code ${code}: ${stderr}`));
    });
  });
}

function aiffToWav(aiffPath, wavPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-y',
      '-i', aiffPath,
      '-acodec', 'pcm_s16le',
      '-ac', '2',
      '-ar', '44100',
      wavPath,
    ];
    const p = spawn(ffmpegPath, args, { stdio: 'inherit' });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg (aiff->wav) exited with code ${code}`));
    });
  });
}

async function main() {
  const prependPathArg = process.argv[2];
  const maybeOutputArg = process.argv[3];
  const outputPathArg = (maybeOutputArg && !maybeOutputArg.startsWith('--')) ? maybeOutputArg : undefined;
  const opts = parseArgs(process.argv.slice(outputPathArg ? 4 : 3));
  if (!prependPathArg) usageAndExit('Missing prepend clip path');

  const prependPath = path.resolve(prependPathArg);
  const mainPath = path.resolve(path.join(__dirname, '..', 'public', 'demo.mp4'));
  const outputPath = outputPathArg
    ? path.resolve(outputPathArg)
    : path.resolve(path.join(__dirname, '..', 'public', 'demo.tmp.mp4'));

  if (!fs.existsSync(prependPath)) usageAndExit(`Prepend clip not found: ${prependPath}`);
  if (!fs.existsSync(mainPath)) usageAndExit(`Main demo video not found: ${mainPath}`);

  // Ensure ffmpeg binary exists
  if (!ffmpegPath) usageAndExit('ffmpeg-static binary not found');

  console.log('Prepending clip to demo.mp4');
  console.log('  Prepend     :', prependPath);
  console.log('  Main        :', mainPath);
  console.log('  Output      :', outputPath);
  console.log('  Intro text  :', opts.introText);
  console.log('  Music volume:', opts.musicVolume);

  // 1) Ensure an intro voiceover exists (generate via macOS say if not provided)
  let introWavPath = opts.voiceoverPath ? path.resolve(opts.voiceoverPath) : '';
  if (introWavPath && !fs.existsSync(introWavPath)) usageAndExit(`Voiceover not found: ${introWavPath}`);
  if (!introWavPath) {
    const audioDir = path.resolve(path.join(__dirname, '..', 'public', 'demo', 'audio'));
    ensureDir(audioDir);
    const aiffPath = path.join(audioDir, '00-intro.aiff');
    introWavPath = path.join(audioDir, '00-intro.wav');
    console.log('Generating intro voiceover via macOS "say"...');
    await sayToAiff(opts.introText, aiffPath);
    await aiffToWav(aiffPath, introWavPath);
    try { fs.unlinkSync(aiffPath); } catch {}
    console.log('✔ Intro voiceover saved at', introWavPath);
  }

  // 2) Create an intro segment with mixed audio (voiceover + light music)
  const introMixedPath = path.resolve(path.join(__dirname, '..', 'public', 'demo.intro.mixed.mp4'));
  {
    const mv = String(opts.musicVolume);
    const argsIntro = [
      '-hide_banner',
      '-y',
      '-i', prependPath,
      '-i', introWavPath,
      '-f', 'lavfi',
      '-i', `sine=frequency=220:sample_rate=44100:duration=3600`,
      '-filter_complex',
      // voiceover + low-volume sine → aintro
      '[1:a]aformat=sample_rates=44100:channel_layouts=stereo[voice];' +
        '[2:a]aformat=sample_rates=44100:channel_layouts=stereo[music];' +
        `[music]volume=${mv}[music_low];` +
        '[voice][music_low]amix=inputs=2:duration=shortest:normalize=0[aintro]',
      '-map', '0:v',
      '-map', '[aintro]',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      introMixedPath,
    ];
    await new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, argsIntro, { stdio: 'inherit' });
      proc.on('error', reject);
      proc.on('close', code => {
        if (code === 0) resolve(undefined);
        else reject(new Error(`ffmpeg (intro mix) exited with code ${code}`));
      });
    });
    console.log('✔ Built intro segment with mixed audio');
  }

  // 3) Concat intro.mixed + main to final, normalizing video/audio
  const args = [
    '-hide_banner',
    '-y',
    '-i', introMixedPath,
    '-i', mainPath,
    '-filter_complex',
    '[0:v]fps=30,scale=1920:1080,format=yuv420p,setsar=1[v0];' +
      '[1:v]fps=30,scale=1920:1080,format=yuv420p,setsar=1[v1];' +
      '[0:a]aresample=44100[a0];' +
      '[1:a]aresample=44100[a1];' +
      '[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]',
    '-map', '[v]',
    '-map', '[a]',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '22',
    '-c:a', 'aac',
    '-b:a', '192k',
    outputPath,
  ];

  await new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: 'inherit' });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });

  // Replace original demo.mp4 with new output
  const finalPath = path.resolve(path.join(__dirname, '..', 'public', 'demo.mp4'));
  try {
    if (fs.existsSync(finalPath)) {
      // Backup original once
      const backupPath = path.resolve(path.join(__dirname, '..', 'public', 'demo.original.mp4'));
      if (!fs.existsSync(backupPath)) {
        fs.renameSync(finalPath, backupPath);
        console.log('Backed up original demo.mp4 to demo.original.mp4');
      } else {
        // If backup exists, remove current final to allow replace
        fs.unlinkSync(finalPath);
      }
    }
    fs.renameSync(outputPath, finalPath);
    console.log('Updated public/demo.mp4 successfully');
    // Cleanup intro mixed temp
    try { fs.unlinkSync(introMixedPath); } catch {}
  } catch (err) {
    console.error('Failed to finalize output:', err);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});