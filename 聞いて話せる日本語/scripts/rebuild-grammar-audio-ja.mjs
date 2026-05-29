// japanese-grammar/ の音声ファイルを 文法.xlsx の新並び順に合わせて再構築する。
//
// 旧命名: {旧シート番号}-{例題番号}.mp3 (例: 1-1.mp3 ~ 30-20.mp3)
// 新命名: {新シート名}.{例題番号}.mp3 (例: 01_現在形（肯定文）.1.mp3)
//
// 作業内容:
//   1. 既存ファイルのうち維持する 500 ファイルを新名に rename
//   2. 削除された 5 テーマの 100 ファイルを削除
//   3. 新規追加された 5 テーマの 100 ファイルを Google TTS で生成
//
// 安全のため、最初に dry-run でプランを表示する。引数 --apply で実行。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const XLSX = path.join(ROOT, '文法.xlsx');
const DIR = path.join(ROOT, 'japanese-grammar');

const APPLY = process.argv.includes('--apply');

const SYNTHESIZE_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const VOICES_URL = 'https://texttospeech.googleapis.com/v1/voices';
const SPEAKING_RATE = 0.95;
const LANGUAGE_CODE = 'ja-JP';

// 旧シート番号 → 新シート番号 (1-indexed)
// 削除する 5 テーマは含まれない (旧: 24,27,28,29,30)
const OLD_TO_NEW = {
  1: 1,    // 現在形（肯定文）
  2: 2,    // 現在形（否定文）
  3: 3,    // 過去形（肯定文）
  4: 4,    // 過去形（否定文）
  5: 5,    // 未来形
  6: 6,    // 疑問文
  7: 7,    // 依頼文
  8: 10,   // 感嘆文
  9: 15,   // 〜したい
  10: 16,  // 〜できる
  11: 11,  // 〜している
  12: 17,  // 〜しなければならない
  13: 18,  // 〜してもいい
  14: 21,  // 〜したことがある
  15: 19,  // 〜と思う
  16: 28,  // 受動表現
  17: 23,  // 接続詞
  18: 24,  // 〜ながら
  19: 25,  // 〜てから
  20: 26,  // 〜ために
  21: 27,  // 条件文
  22: 22,  // 比較表現
  23: 30,  // 間接話法
  25: 13,  // 形容詞の使い方
  26: 14,  // 副詞の使い方
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
  const res = await fetch(`${VOICES_URL}?languageCode=${LANGUAGE_CODE}&key=${apiKey}`);
  if (!res.ok) throw new Error(`voices list HTTP ${res.status}`);
  const data = await res.json();
  const voices = (data.voices || []).slice();
  voices.sort((a, b) => voicePriority(b.name) - voicePriority(a.name));
  const picked = voices[0];
  if (!picked) throw new Error(`${LANGUAGE_CODE} の音声が見つかりません`);
  return { languageCode: picked.languageCodes?.[0] || LANGUAGE_CODE, name: picked.name };
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

  // 1. 文法.xlsx を読み込んで新シート一覧を取得
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const sheets = wb.worksheets;
  if (sheets.length !== 30) throw new Error(`シート数異常: ${sheets.length} (30 期待)`);

  // 2. 既存ファイルを列挙
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.mp3'));
  console.log(`既存ファイル数: ${files.length}\n`);

  // 3. リネーム / 削除プラン作成
  const renamePlan = []; // {from, to}
  const deletePlan = []; // {from}
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

  // 4. 新規生成プラン作成 (5 新テーマ × 20 例題)
  const generatePlan = []; // {sheetIdx, exNo, sheetName, text, outName}
  for (let s = 1; s <= 30; s++) {
    if (!NEW_THEMES.has(s)) continue;
    const sheet = sheets[s - 1];
    const sheetName = sheet.name;
    for (let r = 0; r < 20; r++) {
      const exNo = r + 1;
      const text = getCellText(sheet.getRow(r + 2).getCell(1));
      const outName = `${sheetName}.${exNo}.mp3`;
      if (!text) {
        console.log(`  WARN: 空セル ${sheetName} A${r + 2}`);
        continue;
      }
      generatePlan.push({ sheetIdx: s, exNo, sheetName, text, outName });
    }
  }

  // プラン表示
  console.log(`リネーム計画: ${renamePlan.length} 件`);
  console.log(`  最初の 5 件:`);
  renamePlan.slice(0, 5).forEach(p => console.log(`    ${p.from} → ${p.to}`));
  console.log(`  最後の 3 件:`);
  renamePlan.slice(-3).forEach(p => console.log(`    ${p.from} → ${p.to}`));

  console.log(`\n削除計画: ${deletePlan.length} 件 (削除された 5 テーマ分)`);
  const delByPrefix = {};
  deletePlan.forEach(p => {
    const k = p.from.split('-')[0];
    delByPrefix[k] = (delByPrefix[k] || 0) + 1;
  });
  Object.keys(delByPrefix).sort((a, b) => Number(a) - Number(b)).forEach(k => {
    console.log(`    旧シート ${k}: ${delByPrefix[k]} 件`);
  });

  console.log(`\n新規生成計画: ${generatePlan.length} 件 (新規 5 テーマ分)`);
  const genBySheet = {};
  generatePlan.forEach(p => {
    genBySheet[p.sheetName] = (genBySheet[p.sheetName] || 0) + 1;
  });
  Object.entries(genBySheet).forEach(([k, v]) => console.log(`    ${k}: ${v} 件`));

  if (!APPLY) {
    console.log(`\n=== DRY-RUN 終了。実行するには引数 --apply を付けてください ===`);
    return;
  }

  // === APPLY 開始 ===

  // ステップ 1: リネーム (新→旧 で名前衝突しないので直接 rename 可)
  // 念のため一時名を使う
  console.log(`\n[1/3] リネーム実行 (${renamePlan.length} 件)`);
  // 中間名で衝突回避
  for (const { from } of renamePlan) {
    const fromPath = path.join(DIR, from);
    const tmpPath = path.join(DIR, '__tmp__' + from);
    fs.renameSync(fromPath, tmpPath);
  }
  for (const { from, to } of renamePlan) {
    const tmpPath = path.join(DIR, '__tmp__' + from);
    const toPath = path.join(DIR, to);
    fs.renameSync(tmpPath, toPath);
  }
  console.log(`  完了`);

  // ステップ 2: 削除
  console.log(`\n[2/3] 削除実行 (${deletePlan.length} 件)`);
  for (const { from } of deletePlan) {
    fs.unlinkSync(path.join(DIR, from));
  }
  console.log(`  完了`);

  // ステップ 3: 新規生成
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
