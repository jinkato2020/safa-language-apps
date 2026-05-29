// 追加.xlsx の B列の日本語を読み取り、Google Cloud TTS (ja-JP) で mp3 を生成する。
// A列をファイル名、B列を読み上げテキストとして使用。B列が空の行はスキップ。
//
// 出力先: ./japanese2/{A列の値}.mp3
//
// 既存ファイルはスキップするので、中断後に再実行すれば続きから処理可能。
//
// 実行例:
//   node scripts/generate-audio-tsuika-ja.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const XLSX_PATH = path.join(PROJECT_ROOT, '追加.xlsx');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'japanese2');

const SYNTHESIZE_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const VOICES_URL = 'https://texttospeech.googleapis.com/v1/voices';
const SPEAKING_RATE = 0.95;
const LANGUAGE_CODE = 'ja-JP';

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
  const res = await fetch(`${VOICES_URL}?languageCode=${LANGUAGE_CODE}&key=${apiKey}`);
  if (!res.ok) throw new Error(`voices list HTTP ${res.status}`);
  const data = await res.json();
  const voices = data.voices || [];
  if (voices.length === 0) {
    throw new Error(`${LANGUAGE_CODE} の音声が見つかりません`);
  }
  voices.sort((a, b) => voicePriority(b.name) - voicePriority(a.name));
  const picked = voices[0];
  return {
    languageCode: picked.languageCodes?.[0] || LANGUAGE_CODE,
    name: picked.name,
  };
}

// 日本語テキストを自然な発音のための SSML に変換
// 句読点で適切な長さの休止を入れる
function textToSSML(text) {
  // XML 特殊文字をエスケープ
  let s = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  // 「、」「,」の後に 10ms の軽い休止
  s = s.replace(/[、,]/g, m => `${m}<break time="10ms"/>`);
  // 「。」「.」「！」「？」「!」「?」の後に 300ms の文末休止
  s = s.replace(/([。．！？!?])/g, '$1<break time="300ms"/>');
  return `<speak>${s}</speak>`;
}

async function synthesizeOnce(text, voice, apiKey) {
  const ssml = textToSSML(text);
  const res = await fetch(`${SYNTHESIZE_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      input: { ssml },
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

// ファイル名として不正な文字を除去 + ドットをハイフンに変換
// 例: "2.1.1" → "2-1-1"
function sanitizeFileName(name) {
  return name
    .replace(/[\\\/:*?"<>|]/g, '_')
    .replace(/\./g, '-')
    .trim();
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
  const sheet = workbook.worksheets[0]; // 先頭シートのみ処理
  if (!sheet) {
    throw new Error('シートが見つかりません');
  }
  console.log(`  シート名: ${sheet.name}`);
  console.log(`  行数: ${sheet.rowCount}`);

  console.log('音声を選択中...');
  const voice = await selectVoice(apiKey);
  console.log(`  使用する音声: ${voice.name} (${voice.languageCode})`);
  console.log(`  出力先: ${OUTPUT_DIR}`);
  console.log('');

  const startTime = Date.now();
  let ok = 0;
  let skipped = 0;
  let emptyB = 0;
  let failed = 0;
  let totalChars = 0;
  const failures = [];

  // 行1がヘッダーの可能性を考えて行2から開始する場合は変更してください
  // 今回は行1から処理する想定（ヘッダー無しの場合）
  const START_ROW = 1;
  const lastRow = sheet.rowCount;

  for (let r = START_ROW; r <= lastRow; r++) {
    const aCell = sheet.getRow(r).getCell(1); // A列
    const bCell = sheet.getRow(r).getCell(2); // B列
    const fileNameRaw = getCellText(aCell);
    const text = getCellText(bCell);

    // A列が空の行はスキップ
    if (!fileNameRaw) {
      continue;
    }

    // B列が空の行はスキップ
    if (!text) {
      emptyB++;
      console.log(`  行${r}: SKIP (B列が空) [A=${fileNameRaw}]`);
      continue;
    }

    const fileName = `${sanitizeFileName(fileNameRaw)}.mp3`;
    const outPath = path.join(OUTPUT_DIR, fileName);

    // 既存ファイルはスキップ
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
      skipped++;
      continue;
    }

    try {
      const audio = await synthesizeWithRetry(text, voice, apiKey, `行${r}`);
      fs.writeFileSync(outPath, audio);
      ok++;
      totalChars += text.length;
      console.log(`  ${fileName}: OK (${text.length}文字)`);
    } catch (e) {
      console.log(`  ${fileName}: FAIL - ${e.message}`);
      failures.push({ file: fileName, error: e.message });
      failed++;
    }
  }

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log('');
  console.log('========================================');
  console.log(`総生成: ${ok}件`);
  console.log(`スキップ (既存): ${skipped}件`);
  console.log(`スキップ (B列空): ${emptyB}件`);
  console.log(`失敗: ${failed}件`);
  console.log(`合成文字数: ${totalChars}`);
  console.log(`総実行時間: ${totalSec}秒`);
  console.log(`出力先: ${OUTPUT_DIR}`);

  if (failures.length > 0) {
    console.log('\n失敗一覧:');
    failures.slice(0, 30).forEach((f) => console.log(`  ${f.file}: ${f.error}`));
    if (failures.length > 30) console.log(`  ...他 ${failures.length - 30} 件`);
    console.log('\n再実行で失敗分のみ再試行できます。');
  }
}

main().catch((e) => {
  console.error('エラー:', e.message);
  process.exit(1);
});
