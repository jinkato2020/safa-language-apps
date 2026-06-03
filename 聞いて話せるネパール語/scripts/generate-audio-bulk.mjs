// 会話.xlsx の30シートから B/D/F 列のネパール語を読み取り、
// Google Cloud TTS（ヒンディー語フォールバック）で mp3 を一括生成する。
//
// 命名規則: {シート番号}-{レベル番号}-{例題番号}.mp3
//   シート番号: 1〜30 (シートの並び順)
//   レベル番号: 1=B列(初級), 2=D列(中級), 3=F列(上級)
//   例題番号: 1〜20 (行2〜21)
//
// 例:
//   1シート目の B2  → 1-1-1.mp3
//   1シート目の D2  → 1-2-1.mp3
//   1シート目の F2  → 1-3-1.mp3
//   2シート目の B3  → 2-1-2.mp3
//
// 既存ファイルはスキップするので、中断後に再実行すれば続きから処理可能。
//
// 実行: npm run generate-audio-bulk

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const XLSX_PATH = path.join(PROJECT_ROOT, '会話.xlsx');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'nepali');

const SYNTHESIZE_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const VOICES_URL = 'https://texttospeech.googleapis.com/v1/voices';
const SPEAKING_RATE = 0.85;

// B/D/F 列(1-indexed)に対応するレベル番号
const LEVEL_COLUMNS = [
  { col: 2, levelIdx: 1, label: '初級' },
  { col: 4, levelIdx: 2, label: '中級' },
  { col: 6, levelIdx: 3, label: '上級' },
];

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`.env が見つかりません: ${ENV_PATH}`);
  }
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
  for (const lang of ['ne-NP', 'hi-IN']) {
    const res = await fetch(`${VOICES_URL}?languageCode=${lang}&key=${apiKey}`);
    if (!res.ok) {
      console.warn(`  voices(${lang}) HTTP ${res.status}`);
      continue;
    }
    const data = await res.json();
    const voices = data.voices || [];
    if (voices.length === 0) continue;
    voices.sort((a, b) => voicePriority(b.name) - voicePriority(a.name));
    const picked = voices[0];
    return { languageCode: picked.languageCodes?.[0] || lang, name: picked.name };
  }
  throw new Error('利用可能な音声が見つかりません (ne-NP / hi-IN)');
}

async function synthesizeOnce(text, voice, apiKey) {
  const res = await fetch(`${SYNTHESIZE_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice,
      audioConfig: { audioEncoding: 'MP3', speakingRate: SPEAKING_RATE },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return Buffer.from(data.audioContent, 'base64');
}

async function synthesizeWithRetry(text, voice, apiKey, label) {
  const MAX_RETRY = 3;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      return await synthesizeOnce(text, voice, apiKey);
    } catch (e) {
      lastErr = e;
      const isRateLimit = /\b429\b/.test(e.message);
      const wait = isRateLimit ? 5000 * attempt : 1500 * attempt;
      if (attempt < MAX_RETRY) {
        console.log(`    [retry ${attempt}/${MAX_RETRY}] ${label}: ${e.message} (${wait}ms待機)`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

function getCellText(cell) {
  if (cell == null) return '';
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (v.richText) return v.richText.map((r) => r.text).join('').trim();
  if (v.text) return String(v.text).trim();
  return String(v).trim();
}

async function main() {
  const env = loadEnv();
  const apiKey = env.VITE_GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    throw new Error('.env に VITE_GOOGLE_TTS_API_KEY がありません');
  }
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`Excelファイルが見つかりません: ${XLSX_PATH}`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Excelファイルを読み込み中...');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(XLSX_PATH);
  const sheets = workbook.worksheets;
  console.log(`  シート数: ${sheets.length}`);

  console.log('音声を選択中...');
  const voice = await selectVoice(apiKey);
  console.log(`  使用する音声: ${voice.name} (${voice.languageCode})`);
  console.log(`  出力先: ${OUTPUT_DIR}`);
  console.log('');

  const startTime = Date.now();
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  let totalChars = 0;
  const failures = [];

  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    const sheetIdx = s + 1;
    console.log(`[シート ${sheetIdx}/${sheets.length}] ${sheet.name}`);

    for (const { col, levelIdx, label } of LEVEL_COLUMNS) {
      for (let r = 0; r < 20; r++) {
        const rowNum = r + 2; // 行2 = 例題1
        const exampleIdx = r + 1;
        const fileName = `${sheetIdx}-${levelIdx}-${exampleIdx}.mp3`;
        const outPath = path.join(OUTPUT_DIR, fileName);

        // 既存ファイルはスキップ
        if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
          skipped++;
          continue;
        }

        const text = getCellText(sheet.getRow(rowNum).getCell(col));
        if (!text) {
          console.log(`  ${fileName}: SKIP (セルが空)`);
          continue;
        }

        try {
          const audio = await synthesizeWithRetry(
            text,
            voice,
            apiKey,
            `${sheetIdx}-${levelIdx}-${exampleIdx}`
          );
          fs.writeFileSync(outPath, audio);
          ok++;
          totalChars += text.length;
        } catch (e) {
          console.log(`  ${fileName}: FAIL - ${e.message}`);
          failures.push({ file: fileName, error: e.message });
          failed++;
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(
      `  シート完了 (累計 OK=${ok} SKIP=${skipped} FAIL=${failed}, 経過 ${elapsed}秒)`
    );
    console.log('');
  }

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log('========================================');
  console.log(`総生成: ${ok}件`);
  console.log(`スキップ (既存): ${skipped}件`);
  console.log(`失敗: ${failed}件`);
  console.log(`合成文字数: ${totalChars}`);
  console.log(`総実行時間: ${totalSec}秒`);
  console.log(`出力先: ${OUTPUT_DIR}`);

  if (failures.length > 0) {
    console.log('\n失敗一覧:');
    failures.slice(0, 30).forEach((f) => console.log(`  ${f.file}: ${f.error}`));
    if (failures.length > 30) console.log(`  ...他 ${failures.length - 30} 件`);
    console.log('\n再実行 (npm run generate-audio-bulk) で失敗分のみ再試行できます。');
  }
}

main().catch((e) => {
  console.error('エラー:', e.message);
  process.exit(1);
});
