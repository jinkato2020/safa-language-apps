// 会話30テーマ × 3レベル(初級/中級/上級) × 20例文 = 1,800文を
// Anthropic API で生成し、Excelファイルに保存する。
// テーマごとに1シートを作り、各シートは A〜F 列の 20 行構成。
//
// 列レイアウト:
//   A: 初級 日本語  B: 初級 ネパール語
//   C: 中級 日本語  D: 中級 ネパール語
//   E: 上級 日本語  F: 上級 ネパール語
//
// 実行: npm run generate-excel
//
// 注意:
//  - API呼び出し: 30テーマ × 3レベル = 90回
//  - 想定コスト: 約$2.5〜$3.5
//  - テーマ完了ごとに上書き保存するので途中中断しても続きから再開可能

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const OUTPUT_PATH = path.join(PROJECT_ROOT, '会話.xlsx');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

const THEMES = [
  '自己紹介', '挨拶と礼儀', '家族', '数字と時間', '食べ物と飲み物',
  '買い物', '交通と道案内', '天気', '仕事と職業', '趣味と余暇',
  '体と健康', '感情と気持ち', '学校と勉強', '旅行と観光', 'ホテルと宿泊',
  'レストランと注文', '電話と連絡', '色と形', '動物と自然', 'スポーツ',
  '音楽と芸術', '服と買い物', '家と住まい', '友達と人間関係', 'お祝いと行事',
  '緊急と安全', 'お金と銀行', 'インターネットとIT', '宗教と文化', 'ネパールの生活',
];

const LEVELS = [
  {
    key: 'beginner',
    label: '初級',
    desc: '基本的な単語と短い文、日本語10〜15文字程度。語彙は最重要のみ。',
  },
  {
    key: 'intermediate',
    label: '中級',
    desc: '実用的な会話表現、日本語15〜30文字程度。複文や接続詞を含む。',
  },
  {
    key: 'advanced',
    label: '上級',
    desc: '抽象的な内容や慣用表現、日本語30〜60文字程度。複雑な文法構造を含む。',
  },
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

function buildPrompt(theme, level) {
  return `ネパール語教師として、テーマ「${theme}」の日本語↔ネパール語例文ペアを20個作成してください。
レベル: ${level.label}（${level.desc}）

要件:
- 日本語は自然で実用的な文
- ネパール語はデーヴァナーガリー文字
- テーマに沿った内容

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

function sheetNameFor(idx, theme) {
  // Excelシート名は31文字以内、特殊文字 \/?*[]:不可
  const safe = theme.replace(/[\\/?*[\]:]/g, '_');
  const name = `${String(idx + 1).padStart(2, '0')}_${safe}`;
  return name.slice(0, 31);
}

function applyHeader(sheet) {
  const headerRow = sheet.getRow(1);
  const headers = [
    '初級 日本語', '初級 ネパール語',
    '中級 日本語', '中級 ネパール語',
    '上級 日本語', '上級 ネパール語',
  ];
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
  sheet.getColumn(1).width = 28;
  sheet.getColumn(2).width = 38;
  sheet.getColumn(3).width = 32;
  sheet.getColumn(4).width = 44;
  sheet.getColumn(5).width = 40;
  sheet.getColumn(6).width = 52;
  headerRow.height = 22;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function writeThemeSheet(workbook, idx, theme, pairsByLevel) {
  const name = sheetNameFor(idx, theme);
  // 既存シートがあれば削除（再実行時の上書き対応）
  const existing = workbook.getWorksheet(name);
  if (existing) workbook.removeWorksheet(existing.id);

  const sheet = workbook.addWorksheet(name);
  applyHeader(sheet);

  for (let i = 0; i < 20; i++) {
    const row = sheet.getRow(i + 2);
    const beg = pairsByLevel.beginner[i] || {};
    const mid = pairsByLevel.intermediate[i] || {};
    const adv = pairsByLevel.advanced[i] || {};
    row.getCell(1).value = beg.jp || '';
    row.getCell(2).value = beg.ne || '';
    row.getCell(3).value = mid.jp || '';
    row.getCell(4).value = mid.ne || '';
    row.getCell(5).value = adv.jp || '';
    row.getCell(6).value = adv.ne || '';
    row.alignment = { vertical: 'top', wrapText: true };
  }
}

async function main() {
  const env = loadEnv();
  const apiKey = env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('.env に VITE_ANTHROPIC_API_KEY がありません');
  }

  // 既存ファイルがあれば開いて続きから処理可能にする
  const workbook = new ExcelJS.Workbook();
  if (fs.existsSync(OUTPUT_PATH)) {
    console.log(`既存の ${OUTPUT_PATH} を開いて続きから処理します`);
    await workbook.xlsx.readFile(OUTPUT_PATH);
  }

  console.log(`出力先: ${OUTPUT_PATH}`);
  console.log(`総テーマ数: ${THEMES.length} × 3レベル × 20例 = ${THEMES.length * 3 * 20}文`);
  console.log('');

  const startTime = Date.now();
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < THEMES.length; i++) {
    const theme = THEMES[i];
    const sheetName = sheetNameFor(i, theme);

    // 既存シートに20行データが揃っていればスキップ
    const existingSheet = workbook.getWorksheet(sheetName);
    if (existingSheet) {
      const last = existingSheet.getRow(21);
      if (last.getCell(2).value && last.getCell(4).value && last.getCell(6).value) {
        console.log(`[${i + 1}/30] ${theme}: 既に完了済みのためスキップ`);
        continue;
      }
    }

    console.log(`[${i + 1}/30] ${theme}`);
    const pairs = { beginner: [], intermediate: [], advanced: [] };
    let themeOk = true;

    for (const level of LEVELS) {
      process.stdout.write(`  ${level.label}を生成中... `);
      try {
        const arr = await callClaudeWithRetry(
          buildPrompt(theme, level),
          apiKey,
          `${theme}/${level.label}`
        );
        pairs[level.key] = arr;
        console.log(`OK (${arr.length}件)`);
      } catch (e) {
        console.log(`FAIL: ${e.message}`);
        themeOk = false;
        fail++;
        break;
      }
    }

    if (themeOk) {
      writeThemeSheet(workbook, i, theme, pairs);
      await workbook.xlsx.writeFile(OUTPUT_PATH);
      ok++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  → 保存しました (経過 ${elapsed}秒)`);
    }
    console.log('');
  }

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('========================================');
  console.log(`完了: 成功 ${ok}テーマ / 失敗 ${fail}テーマ`);
  console.log(`総実行時間: ${totalSec}秒`);
  console.log(`ファイル: ${OUTPUT_PATH}`);
}

main().catch((e) => {
  console.error('エラー:', e.message);
  process.exit(1);
});
