// bn サンプル音声を高品質(Wavenet等)・無料枠で生成し、声の品質確認用に書き出す。
// 対象: expo-app/data/overlays/bn.json のサンプル文 (テーマ1のみ・9項目)。
// 出力: expo-app/dist-packs/audio-sample-bn/ に mp3。
// 実行: node scripts/generate-sample-bn-audio.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const OVERLAY_PATH = path.join(PROJECT_ROOT, 'expo-app', 'data', 'overlays', 'bn.json');
// 声を環境変数で固定可能 (例: BN_VOICE=bn-IN-Wavenet-A)。未指定なら最高品質を自動選択。
const FORCE_VOICE = process.env.BN_VOICE;
const OUT_TAG = FORCE_VOICE ? FORCE_VOICE.replace(/^bn-IN-/, '') : 'auto';
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'expo-app', 'dist-packs', `audio-sample-bn-${OUT_TAG}`);

const SYNTHESIZE_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const VOICES_URL = 'https://texttospeech.googleapis.com/v1/voices';
const SPEAKING_RATE = 0.9;

function loadEnv() {
  const text = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function voicePriority(name) {
  if (name.includes('Studio')) return 100;
  if (name.includes('Chirp3-HD')) return 90;
  if (name.includes('Chirp-HD')) return 80;
  if (name.includes('Wavenet')) return 70;
  if (name.includes('Neural2')) return 60;
  if (name.includes('Standard')) return 10;
  return 0;
}

async function selectVoice(apiKey) {
  for (const lang of ['bn-IN', 'bn-BD']) {
    const res = await fetch(`${VOICES_URL}?languageCode=${lang}&key=${apiKey}`);
    if (!res.ok) { console.warn(`  voices(${lang}) HTTP ${res.status}`); continue; }
    const voices = (await res.json()).voices || [];
    if (!voices.length) continue;
    voices.sort((a, b) => voicePriority(b.name) - voicePriority(a.name));
    const p = voices[0];
    return { languageCode: p.languageCodes?.[0] || lang, name: p.name };
  }
  throw new Error('bn の音声が見つかりません (bn-IN / bn-BD)');
}

async function synth(text, voice, apiKey) {
  const res = await fetch(`${SYNTHESIZE_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input: { text }, voice, audioConfig: { audioEncoding: 'MP3', speakingRate: SPEAKING_RATE } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return Buffer.from((await res.json()).audioContent, 'base64');
}

// サンプル文を {id, text} 配列に展開
function collectItems(overlay) {
  const items = [];
  for (const [key, arr] of Object.entries(overlay.examplesL1 || {}))
    arr.forEach((t, i) => items.push({ id: `conv-${key}-${i + 1}`, text: t }));
  for (const [key, arr] of Object.entries(overlay.grammarL1 || {}))
    arr.forEach((t, i) => items.push({ id: `gram-${key}-${i + 1}`, text: t }));
  for (const [key, arr] of Object.entries(overlay.wordsL1 || {}))
    arr.forEach((t, i) => items.push({ id: `word-${key}-${i + 1}`, text: t }));
  return items;
}

async function main() {
  const apiKey = loadEnv().VITE_GOOGLE_TTS_API_KEY;
  if (!apiKey) throw new Error('.env に VITE_GOOGLE_TTS_API_KEY がありません');
  const overlay = JSON.parse(fs.readFileSync(OVERLAY_PATH, 'utf8'));
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const voice = FORCE_VOICE ? { languageCode: 'bn-IN', name: FORCE_VOICE } : await selectVoice(apiKey);
  console.log(`使用音声: ${voice.name} (${voice.languageCode})`);

  const items = collectItems(overlay);
  let chars = 0;
  for (const { id, text } of items) {
    const buf = await synth(text, voice, apiKey);
    const out = path.join(OUTPUT_DIR, `${id}.mp3`);
    fs.writeFileSync(out, buf);
    chars += [...text].length;
    console.log(`  ${id}.mp3  "${text}"`);
  }
  console.log(`\n生成 ${items.length}件 / 合成文字数 ${chars} / 出力: ${OUTPUT_DIR}`);
}

main().catch((e) => { console.error('エラー:', e.message); process.exit(1); });
