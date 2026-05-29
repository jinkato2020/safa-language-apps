// 30の文法分野 × 20例題 = 600例題を Anthropic API で生成し、
// 文法.xlsx に保存する。各分野が1シートで、A列=日本語, B列=ネパール語。
//
// 実行: npm run generate-grammar-excel
//
// - API呼び出し: 30回（各分野で20例文を1回のリクエストで生成）
// - 想定コスト: 約 $1.20
// - 実行時間: 約5〜10分
// - 分野完了ごとに上書き保存（中断後の再開対応）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const OUTPUT_PATH = path.join(PROJECT_ROOT, '文法.xlsx');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

// 30の文法分野（学習順）
const GRAMMAR_TOPICS = [
  // 基本動詞活用
  '現在形（肯定文）',
  '現在形（否定文）',
  '過去形（肯定文）',
  '過去形（否定文）',
  '未来形',
  // 文の種類
  '疑問文の作り方',
  '命令形と依頼',
  '感嘆文と強調表現',
  // 動詞表現
  '〜したい（願望表現）',
  '〜できる（可能表現）',
  '〜している（進行形）',
  '〜しなければならない（義務）',
  '〜してもいい（許可）',
  '〜したことがある（経験）',
  '〜と思う（推量・意見）',
  '受動表現',
  // 文の繋ぎ方
  '接続詞',
  '〜ながら（同時動作）',
  '〜てから（順序）',
  '〜ために（目的）',
  '条件文（もし〜なら）',
  // 文構造
  '比較表現',
  '間接話法',
  '関係節と複文',
  // 修飾・語形
  '形容詞の使い方',
  '副詞の使い方',
  '代名詞（人称・指示）',
  '数詞と助数詞',
  '格助詞の用法',
  '尊敬語と丁寧語',
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

function buildPrompt(topic) {
  return `ネパール語教師として、文法「${topic}」を学ぶための日本語↔ネパール語例文ペアを20個作成してください。

レベル: 初級〜中級（基本的な文型から少し複雑な文まで）。
要件:
- 各例文がこの文法ポイントを明確に含むこと
- 日本語は自然で実用的な文
- ネパール語はデーヴァナーガリー文字
- 1文目は最もシンプル、徐々に複雑になるよう配置
- 日常会話で使える表現

JSONのみ返してください（コードブロックや前置きは一切不要）:
[{"jp":"日本語文","ne":"ネパール語文"}]`;
}

async function callClaude(prompt, apiKey) {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  let text = data.content.map((c) => c.text || '').join('');
  text = text.replace(/```json|```/g, '').trim();
  const arr = JSON.parse(text);
  if (!Array.isArray(arr)) throw new Error('JSON配列ではない');
  return arr;
}

async function callClaudeWithRetry(prompt, apiKey, label) {
  const MAX_RETRY = 3;
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const arr = await callClaude(prompt, apiKey);
      if (arr.length < 20) {
        throw new Error(`returned ${arr.length} items (need 20)`);
      }
      return arr.slice(0, 20);
    } catch (e) {
      lastErr = e;
      console.log(`    [retry ${attempt}/${MAX_RETRY}] ${label}: ${e.message}`);
      if (attempt < MAX_RETRY) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }
  throw lastErr;
}

function sheetNameFor(idx, topic) {
  // Excelシート名は31文字以内、特殊文字 \/?*[]:不可
  const safe = topic.replace(/[\\/?*[\]:]/g, '_');
  const name = `${String(idx + 1).padStart(2, '0')}_${safe}`;
  return name.slice(0, 31);
}

function applyHeader(sheet) {
  const headerRow = sheet.getRow(1);
  const headers = ['日本語', 'ネパール語'];
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFE4E1' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  sheet.getColumn(1).width = 36;
  sheet.getColumn(2).width = 48;
  headerRow.height = 22;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function writeTopicSheet(workbook, idx, topic, pairs) {
  const name = sheetNameFor(idx, topic);
  // 既存シートがあれば削除（再実行時の上書き対応）
  const existing = workbook.getWorksheet(name);
  if (existing) workbook.removeWorksheet(existing.id);

  const sheet = workbook.addWorksheet(name);
  applyHeader(sheet);

  for (let i = 0; i < 20; i++) {
    const row = sheet.getRow(i + 2);
    const ex = pairs[i] || {};
    row.getCell(1).value = ex.jp || '';
    row.getCell(2).value = ex.ne || '';
    row.alignment = { vertical: 'top', wrapText: true };
  }
}

async function main() {
  const env = loadEnv();
  const apiKey = env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('.env に VITE_ANTHROPIC_API_KEY がありません');
  }

  // 既存ファイルがあれば開いて続きから処理可能
  const workbook = new ExcelJS.Workbook();
  if (fs.existsSync(OUTPUT_PATH)) {
    console.log(`既存の ${OUTPUT_PATH} を開いて続きから処理します`);
    await workbook.xlsx.readFile(OUTPUT_PATH);
  }

  console.log(`出力先: ${OUTPUT_PATH}`);
  console.log(`総分野数: ${GRAMMAR_TOPICS.length} × 20例題 = ${GRAMMAR_TOPICS.length * 20}例題`);
  console.log('');

  const startTime = Date.now();
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < GRAMMAR_TOPICS.length; i++) {
    const topic = GRAMMAR_TOPICS[i];
    const sheetName = sheetNameFor(i, topic);

    // 既存シートに20行データが揃っていればスキップ
    const existingSheet = workbook.getWorksheet(sheetName);
    if (existingSheet) {
      const last = existingSheet.getRow(21);
      if (last.getCell(2).value) {
        console.log(`[${i + 1}/${GRAMMAR_TOPICS.length}] ${topic}: 既に完了済みのためスキップ`);
        continue;
      }
    }

    console.log(`[${i + 1}/${GRAMMAR_TOPICS.length}] ${topic}`);
    process.stdout.write('  生成中... ');

    try {
      const pairs = await callClaudeWithRetry(buildPrompt(topic), apiKey, topic);
      writeTopicSheet(workbook, i, topic, pairs);
      await workbook.xlsx.writeFile(OUTPUT_PATH);
      ok++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`OK (${pairs.length}件、経過 ${elapsed}秒)`);
    } catch (e) {
      fail++;
      console.log(`FAIL: ${e.message}`);
    }
  }

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log('========================================');
  console.log(`完了: 成功 ${ok}分野 / 失敗 ${fail}分野`);
  console.log(`総実行時間: ${totalSec}秒`);
  console.log(`ファイル: ${OUTPUT_PATH}`);
}

main().catch((e) => {
  console.error('エラー:', e.message);
  process.exit(1);
});
