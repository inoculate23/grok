// Node ESM-compatible script to generate voiceovers via Hugging Face Inference API
// Outputs WAV files to public/demo/audio

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { client as gradioClient } from '@gradio/client';

const HF_TOKEN = process.env.HF_TOKEN ?? process.env.VITE_HF_TOKEN;
const HF_TTS_MODEL = process.env.HF_TTS_MODEL || 'facebook/mms-tts';
const HF_TTS_LANG = process.env.HF_TTS_LANG || 'en';
// If set, prefer generating via a Hugging Face Space (e.g., "ResembleAI/Chatterbox")
const HF_SPACE = (process.env.HF_SPACE ?? process.env.VITE_GRADIO_SPACE ?? '').trim();
// Optional Chatterbox tuning params
const CB_EXAG = Number(process.env.HF_CB_EXAG ?? process.env.CHATTERBOX_EXAG ?? 0.5);
const CB_TEMP = Number(process.env.HF_CB_TEMP ?? 0.8);
const CB_SEED = Number(process.env.HF_CB_SEED ?? 0);
const CB_CFGW = Number(process.env.HF_CB_CFGW ?? 0.5);

// Marketing voiceovers (one per slide)
const scenes = [
  {
    key: 'text',
    line: 'Type or paste your text and hear it translated instantly.'
  },
  {
    key: 'audio',
    line: 'Talk naturally; Grok transcribes, translates, and plays it back in a clear voice.'
  },
  {
    key: 'video',
    line: 'Drop in any video; get multilingual captions and a dubbed track ready to share.'
  },
  {
    key: 'camera',
    line: 'Aim your camera at real-world text. Grok reads and translates it in seconds.'
  },
  {
    key: 'history',
    line: 'Everything you translate is saved with search and filters, so nothing gets lost.'
  },
  {
    key: 'tour',
    line: 'Discover nearby places, see routes, and get live turn guidance along the way.'
  },
  {
    key: 'chatgpt',
    line: 'Ask anything. Grok’s agentic AI builds itineraries and solves travel tasks on the fly.'
  }
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

async function ttsToFile(text, outPath) {
  const url = `https://api-inference.huggingface.co/models/${HF_TTS_MODEL}`;

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'audio/wav',
  };
  if (HF_TOKEN) headers['Authorization'] = `Bearer ${HF_TOKEN}`;

  const body = {
    inputs: text,
    parameters: {
      language: HF_TTS_LANG,
    },
    // options: { wait_for_model: true } // optional, uncomment if model is cold
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`HF TTS request failed (${res.status}): ${msg}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
}

async function chatterboxToFile(text, outPath) {
  if (!HF_SPACE) throw new Error('HF_SPACE not set. Provide e.g. "ResembleAI/Chatterbox"');
  const spaceId = HF_SPACE;
  const app = await gradioClient(spaceId, HF_TOKEN ? { hf_token: HF_TOKEN } : undefined);

  // Build payload with available defaults; audio prompt omitted unless provided in future
  const payload = {
    text_input: text,
    exaggeration_input: isFinite(CB_EXAG) ? CB_EXAG : 0.5,
    temperature_input: isFinite(CB_TEMP) ? CB_TEMP : 0.8,
    seed_num_input: isFinite(CB_SEED) ? CB_SEED : 0,
    cfgw_input: isFinite(CB_CFGW) ? CB_CFGW : 0.5,
  };

  // Use the named endpoint if available, else fall back to fn_index=0
  let data;
  try {
    data = await app.predict('/generate_tts_audio', payload);
  } catch (e) {
    const res = await app.predict(0, payload);
    data = res;
  }

  const file = Array.isArray(data?.data) ? data.data[0] : null;
  const url = file?.url;
  if (!url) throw new Error('Chatterbox returned no audio URL');

  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download failed (${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(outPath, buf);
}

function aiffToWav(aiffPath, wavPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-y',
      '-i', aiffPath,
      '-acodec', 'pcm_s16le',
      '-ac', '1',
      '-ar', '22050',
      wavPath,
    ];
    const p = spawn(ffmpegPath, args, { stdio: 'inherit' });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg (AIFF->WAV) exited with code ${code}`));
    });
  });
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


async function ttsFallbackSay(text, outPath) {
  const tmpAiff = outPath.replace(/\.wav$/i, '.aiff');
  await sayToAiff(text, tmpAiff);
  await aiffToWav(tmpAiff, outPath);
  try { fs.unlinkSync(tmpAiff); } catch {}
}

async function main() {
  const outDir = path.join(process.cwd(), 'public', 'demo', 'audio');
  ensureDir(outDir);

  if (HF_SPACE) {
    console.log(`Using Space: ${HF_SPACE} (Gradio)`);
  } else {
    if (!HF_TOKEN) {
      console.warn('[warn] No HF_TOKEN found in env. If the model requires auth, the request may fail. Set HF_TOKEN=hf_... to authenticate.');
    }
    console.log(`Using model: ${HF_TTS_MODEL} | lang: ${HF_TTS_LANG}`);
  }

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const fname = `${String(i + 1).padStart(2, '0')}-${s.key}-${slugify(s.line)}.wav`;
    const outPath = path.join(outDir, fname);
    console.log(`Generating [${s.key}] → ${fname}`);
    try {
      if (HF_SPACE) {
        await chatterboxToFile(s.line, outPath);
      } else {
        await ttsToFile(s.line, outPath);
      }
      const stats = fs.statSync(outPath);
      console.log(`✔ Saved ${fname} (${(stats.size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`✖ Primary TTS failed ${s.key}:`, err.message);
      if (process.platform === 'darwin') {
        try {
          console.log('→ Falling back to macOS "say"');
          await ttsFallbackSay(s.line, outPath);
          const stats = fs.statSync(outPath);
          console.log(`✔ Saved ${fname} via say (${(stats.size / 1024).toFixed(1)} KB)`);
        } catch (fallbackErr) {
          console.error(`✖ Fallback failed ${s.key}:`, fallbackErr.message);
        }
      }
    }
  }

  console.log('Done. Voiceovers are in public/demo/audio');
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});