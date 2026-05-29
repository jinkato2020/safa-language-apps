// nepali-grammar/ の音声ファイルを 文法.xlsx の新並び順に合わせて再構築する。
// 日本語版 (rebuild-grammar-audio-ja.mjs) のネパール語版。
//
// 旧命名: {旧シート番号}-{例題番号}.mp3
// 新命名: {新シート名}.{例題番号}.mp3
//
// 作業内容:
//   1. 既存ファイルのうち維持する 500 ファイルを新名に rename
//   2. 削除された 5 テーマの 100 ファイルを削除
//   3. 新規追加された 5 テーマの 100 ファイルを Google TTS (ne-NP / hi-IN) で生成
//
// 引数 --apply で実行 (デフォルトは dry-run)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const XLSX = path.join(ROOT, '文法.xlsx');
const DIR = path.join(ROOT, 'nepali-grammar');

const APPLY = process.argv.includes('--apply');

const SYNTHESIZE_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const VOICES_URL = 'https://texttospeech.googleapis.com/v1/voices';
const SPEAKING_RATE = 0.85;  // ネパール語は少し遅め

// 旧シート番号 → 新シート番号 (1-indexed)
const OLD_TO_NEW = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5,
  6: 6, 7: 7, 8: 10, 9: 15, 10: 16,
  11: 11, 12: 17, 13: 18, 14: 21, 15: 19,
  16: 28, 17: 23, 18: 24, 19: 25, 20: 26,
  21: 27, 22: 22, 23: 30, 25: 13, 26: 14,
  // 24,27,28,29,30 → DELETE
};

// 新シート番号 (1-30) のうち、新規生成が必要なもの (新規追加 5 テーマ)
const NEW_THEMES = new Set([8, 9, 12, 20, 29]);

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) throw new Error(`.env が見つかりません: ${ENV_PATH}`);
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
  // ne-NP → hi-IN フォールバック
  for (const lang of ['ne-NP', 'hi-IN']) {
    const res = await fetch(`${VOICES_URL}?languageCode=${lang}&key=${apiKey}`);
    if (!res.ok) {
      console.warn(`  voices(${lang}) HTTP ${res.status}`);
      continue;
    }
    const data = await res.json();
    const voices = (data.voices || []).slice();
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
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await synthesizeOnce(text, voice, apiKey);
    } catch (e) {
      lastErr = e;
      const isRateLimit = /\b429\b/.test(e.message);
      const wait = isRateLimit ? 5000 * attempt : 1500 * attempt;
      if (attempt < 3) {
        console.log(`    [retry ${attempt}/3] ${label}: ${e.message} (${wait}ms 待機)`);
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
  if (!APPLY) {
    console.log('=== DRY-RUN モード (実行するには --apply を付けてください) ===\n');
  } else {
    console.log('=== APPLY モード (実行します) ===\n');
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const sheets = wb.worksheets;
  if (sheets.length !== 30) throw new Error(`シート数異常: ${sheets.length} (30 期待)`);

  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.mp3'));
  console.log(`既存ファイル数: ${files.length}\n`);

  const renamePlan = [];
  const deletePlan = [];
  for (const f of files) {
    const m = f.match(/^(\d+)-(\d+)\.mp3$/);
    if (!m) {
      console.log(`  WARN: 未知のファイル形式 ${f}`);
      continue;
    }
    const oldIdx = Number(m[1]);
    const exNo = Number(m[2]);
    if (OLD_TO_NEW[oldIdx] != null) {
      const newIdx = OLD_TO_NEW[oldIdx];
      const newSheetName = sheets[newIdx - 1].name;
      const newName = `${newSheetName}.${exNo}.mp3`;
      renamePlan.push({ from: f, to: newName });
    } else {
      deletePlan.push({ from: f });
    }
  }

  const generatePlan = [];
  for (let s = 1; s <= 30; s++) {
    if (!NEW_THEMES.has(s)) continue;
    const sheet = sheets[s - 1];
    const sheetName = sheet.name;
    for (let r = 0; r < 20; r++) {
      const exNo = r + 1;
      const text = getCellText(sheet.getRow(r + 2).getCell(2));  // B列 = ネパール語
      const outName = `${sheetName}.${exNo}.mp3`;
      if (!text) {
        console.log(`  WARN: 空セル ${sheetName} B${r + 2}`);
        continue;
      }
      generatePlan.push({ sheetIdx: s, exNo, sheetName, text, outName });
    }
  }

  console.log(`リネーム計画: ${renamePlan.length} 件`);
  console.log(`  サンプル:`);
  renamePlan.slice(0, 3).forEach(p => console.log(`    ${p.from} → ${p.to}`));

  console.log(`\n削除計画: ${deletePlan.length} 件`);
  const delByPrefix = {};
  deletePlan.forEach(p => {
    const k = p.from.split('-')[0];
    delByPrefix[k] = (delByPrefix[k] || 0) + 1;
  });
  Object.keys(delByPrefix).sort((a, b) => Number(a) - Number(b)).forEach(k => {
    console.log(`    旧シート ${k}: ${delByPrefix[k]} 件`);
  });

  console.log(`\n新規生成計画: ${generatePlan.length} 件`);
  const genBySheet = {};
  generatePlan.forEach(p => {
    genBySheet[p.sheetName] = (genBySheet[p.sheetName] || 0) + 1;
  });
  Object.entries(genBySheet).forEach(([k, v]) => console.log(`    ${k}: ${v} 件`));

  if (!APPLY) {
    console.log(`\n=== DRY-RUN 終了。実行するには --apply を付けてください ===`);
    return;
  }

  // === APPLY ===
  console.log(`\n[1/3] リネーム実行 (${renamePlan.length} 件)`);
  for (const { from } of renamePlan) {
    fs.renameSync(path.join(DIR, from), path.join(DIR, '__tmp__' + from));
  }
  for (const { from, to } of renamePlan) {
    fs.renameSync(path.join(DIR, '__tmp__' + from), path.join(DIR, to));
  }
  console.log(`  完了`);

  console.log(`\n[2/3] 削除実行 (${deletePlan.length} 件)`);
  for (const { from } of deletePlan) {
    fs.unlinkSync(path.join(DIR, from));
  }
  console.log(`  完了`);

  if (generatePlan.length === 0) {
    console.log(`\n[3/3] 新規生成なし`);
    return;
  }
  console.log(`\n[3/3] 新規生成実行 (${generatePlan.length} 件)`);
  const env = loadEnv();
  const apiKey = env.VITE_GOOGLE_TTS_API_KEY;
  if (!apiKey) throw new Error('.env に VITE_GOOGLE_TTS_API_KEY がありません');

  const voice = await selectVoice(apiKey);
  console.log(`  使用する音声: ${voice.name} (${voice.languageCode})`);

  const startTime = Date.now();
  let ok = 0, skipped = 0, failed = 0, totalChars = 0;
  const failures = [];
  for (const item of generatePlan) {
    const outPath = path.join(DIR, item.outName);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
      skipped++;
      continue;
    }
    try {
      const audio = await synthesizeWithRetry(item.text, voice, apiKey, `${item.sheetName}.${item.exNo}`);
      fs.writeFileSync(outPath, audio);
      ok++;
      totalChars += item.text.length;
      if (ok % 10 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(`  進捗: OK=${ok} SKIP=${skipped} FAIL=${failed} (${elapsed}秒)`);
      }
    } catch (e) {
      console.log(`  ${item.outName}: FAIL - ${e.message}`);
      failures.push({ file: item.outName, error: e.message });
      failed++;
    }
  }
  const totalSec = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n========================================`);
  console.log(`生成: ${ok} 件 / スキップ: ${skipped} 件 / 失敗: ${failed} 件`);
  console.log(`合成文字数: ${totalChars}`);
  console.log(`所要時間: ${totalSec} 秒`);
  if (failures.length > 0) {
    console.log(`\n失敗一覧:`);
    failures.forEach(f => console.log(`  ${f.file}: ${f.error}`));
  }
}

main().catch(err => { console.error('エラー:', err.message); process.exit(1); });
