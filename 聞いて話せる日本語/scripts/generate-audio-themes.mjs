// 指定テーマ(13/25/29/30)の会話音声(日本語+ネパール語)を会話.xlsxから再生成し、
// assets/audio/{japanese,nepali}/<T-L-i>.mp3 を上書き。Wavenetで統一(既存と同等・無料枠)。
// 実行: node scripts/generate-audio-themes.mjs
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const XLSX = path.join(ROOT, '会話.xlsx');
const ENV = path.join(ROOT, '.env');
const OUT_JA = path.join(ROOT, 'expo-app/assets/audio/japanese');
const OUT_NE = path.join(ROOT, 'expo-app/assets/audio/nepali');
const THEMES = [13, 25, 29, 30];
const RATE = 0.9;

function key() { for (const l of fs.readFileSync(ENV, 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*VITE_GOOGLE_TTS_API_KEY\s*=\s*(.*)\s*$/); if (m) return m[1].replace(/^["']|["']$/g, ''); } throw new Error('TTSキーなし'); }
const apiKey = key();

async function pickWavenet(langCodes) {
  for (const lc of langCodes) {
    const r = await fetch(`https://texttospeech.googleapis.com/v1/voices?languageCode=${lc}&key=${apiKey}`);
    if (!r.ok) continue;
    const v = ((await r.json()).voices || []).filter(x => x.name.includes('Wavenet'));
    if (v.length) return { languageCode: v[0].languageCodes?.[0] || lc, name: v[0].name };
  }
  throw new Error('Wavenet音声なし: ' + langCodes.join(','));
}
async function synth(text, voice) {
  for (let a = 1; a <= 3; a++) {
    const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: { text }, voice, audioConfig: { audioEncoding: 'MP3', speakingRate: RATE } }),
    });
    if (r.ok) return Buffer.from((await r.json()).audioContent, 'base64');
    if (a === 3) throw new Error(`HTTP ${r.status}`);
    await new Promise(s => setTimeout(s, 1500 * a));
  }
}
function cell(c) { const v = c?.value; if (v == null) return ''; if (typeof v === 'string') return v.trim(); if (v.richText) return v.richText.map(r => r.text).join('').trim(); if (v.text) return String(v.text).trim(); return String(v).trim(); }

const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(XLSX);
fs.mkdirSync(OUT_JA, { recursive: true }); fs.mkdirSync(OUT_NE, { recursive: true });
const jaVoice = await pickWavenet(['ja-JP']);
const neVoice = await pickWavenet(['ne-NP', 'hi-IN']);
console.log(`日本語=${jaVoice.name} / ネパール語=${neVoice.name}`);

let n = 0;
for (const t of THEMES) {
  const s = wb.worksheets[t - 1];
  for (let level = 1; level <= 3; level++) {
    const jpCol = (level - 1) * 2 + 1, neCol = jpCol + 1;
    for (let r = 2; r <= 21; r++) {
      const jp = cell(s.getRow(r).getCell(jpCol)), ne = cell(s.getRow(r).getCell(neCol));
      if (!jp || !ne) continue;
      const id = `${t}-${level}-${r - 1}`;
      fs.writeFileSync(path.join(OUT_JA, `${id}.mp3`), await synth(jp, jaVoice));
      fs.writeFileSync(path.join(OUT_NE, `${id}.mp3`), await synth(ne, neVoice));
      n++;
    }
  }
  console.log(`テーマ${t} 完了 (累計${n}対)`);
}
console.log(`\n音声 ${n}対 (日本語+ネパール語) を再生成・上書き`);
