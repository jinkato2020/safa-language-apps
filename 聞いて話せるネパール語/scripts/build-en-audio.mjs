// App A 英語(母語側)音声を en-US Wavenet で生成し packs/audio/en/ へ出力。
// 入力: expo-app/data/overlays/en.json の examplesL1(会話) と grammarL1(文法)。
// 出力: <repo>/packs-nepali/audio/en/<id>.mp3 (会話=T-L-i / 文法=T-i)。
// 既存スキップ。実行: node scripts/build-en-audio.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // 聞いて話せるネパール語
const REPO = path.resolve(ROOT, '..');
const ENV_PATH = path.join(ROOT, '.env');
const OVERLAY = path.join(ROOT, 'expo-app/data/overlays/en.json');
const OUT_DIR = path.join(REPO, 'packs-nepali/audio/en');
const VOICE = process.env.EN_VOICE || 'en-US-Wavenet-F';
const URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const RATE = 0.95;

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

async function synth(text, apiKey) {
  const res = await fetch(`${URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'en-US', name: VOICE },
      audioConfig: { audioEncoding: 'MP3', speakingRate: RATE },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 150)}`);
  return Buffer.from((await res.json()).audioContent, 'base64');
}

async function main() {
  const apiKey = loadEnv().VITE_GOOGLE_TTS_API_KEY;
  if (!apiKey) throw new Error('.env に VITE_GOOGLE_TTS_API_KEY がありません');
  const overlay = JSON.parse(fs.readFileSync(OVERLAY, 'utf8'));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const items = [];
  for (const [key, arr] of Object.entries(overlay.examplesL1 || {}))
    arr.forEach((t, i) => items.push({ id: `${key}-${i + 1}`, text: t }));
  for (const [key, arr] of Object.entries(overlay.grammarL1 || {}))
    arr.forEach((t, i) => items.push({ id: `${key}-${i + 1}`, text: t }));

  console.log(`音声: ${VOICE} / 出力: ${OUT_DIR} / 対象 ${items.length}`);
  let ok = 0, skip = 0;
  for (const { id, text } of items) {
    const out = path.join(OUT_DIR, `${id}.mp3`);
    if (fs.existsSync(out) && fs.statSync(out).size > 0) { skip++; continue; }
    fs.writeFileSync(out, await synth(text, apiKey));
    ok++;
    if (ok % 100 === 0) console.log(`  ${ok} generated...`);
  }
  console.log(`\n生成 ${ok} / スキップ ${skip}`);
}
main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
