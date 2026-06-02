// bn(ベンガル語) 会話音声を Wavenet で生成し、raw配信用に packs/audio/bn/ へ出力する。
// 入力: expo-app/data/overlays/bn.json の examplesL1。
// 出力: <repo>/packs/audio/bn/<theme>-<level>-<index>.mp3  (文IDと一致)
// 既存ファイルはスキップ。実行: node scripts/build-bn-audio.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');                 // 聞いて話せる日本語
const REPO = path.resolve(ROOT, '..');                      // リポジトリ直下
const ENV_PATH = path.join(ROOT, '.env');
const OVERLAY = path.join(ROOT, 'expo-app/data/overlays/bn.json');
const OUT_DIR = path.join(REPO, 'packs/audio/bn');

const VOICE = process.env.BN_VOICE || 'bn-IN-Wavenet-A'; // 高品質・無料枠
const URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const RATE = 0.9;

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
      voice: { languageCode: 'bn-IN', name: VOICE },
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

  let ok = 0, skip = 0, chars = 0;
  console.log(`音声: ${VOICE} / 出力: ${OUT_DIR}`);
  for (const [key, arr] of Object.entries(overlay.examplesL1 || {})) {
    for (let i = 0; i < arr.length; i++) {
      const id = `${key}-${i + 1}`;
      const out = path.join(OUT_DIR, `${id}.mp3`);
      if (fs.existsSync(out) && fs.statSync(out).size > 0) { skip++; continue; }
      const buf = await synth(arr[i], apiKey);
      fs.writeFileSync(out, buf);
      ok++; chars += [...arr[i]].length;
      console.log(`  ${id}.mp3`);
    }
  }
  console.log(`\n生成 ${ok} / スキップ ${skip} / 合成文字数 ${chars}`);
}

main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
