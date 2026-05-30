// 文法.xlsx から、Claude API を使って文脈依存の辞書を構築するプロトタイプ。
//
// 構造 B: 単語ルート + 文脈配列 (1 単語に複数訳)
//
// 使い方:
//   node scripts/build-grammar-vocab-claude.mjs                  # シート1のみ (プロトタイプ)
//   node scripts/build-grammar-vocab-claude.mjs --sheet 5        # 指定シート
//   node scripts/build-grammar-vocab-claude.mjs --all            # 全 30 シート
//
// 出力:
//   data/grammar-vocab-context.json
//   data/grammar-vocab-context.html (プレビュー)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const XLSX = path.join(ROOT, '..', '..', 'ネパール語瞬間作文', '文法.xlsx');  // 親のシリーズ → ネパール語瞬間作文 (実体)
const ALT_XLSX = path.join(ROOT, '..', '文法.xlsx'); // シリーズ root にあるかも
const OUT_JSON = path.join(ROOT, 'expo-app/data/grammar-vocab-context.json');
const OUT_HTML = path.join(ROOT, 'expo-app/data/grammar-vocab-context.html');

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) throw new Error(`.env not found: ${ENV_PATH}`);
  const text = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

function getCellText(cell) {
  if (cell == null || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (v.richText) return v.richText.map(r => r.text).join('').trim();
  if (v.text) return String(v.text).trim();
  return String(v).trim();
}

// 引数パース
function parseArgs() {
  const args = process.argv.slice(2);
  const sheetIdx = args.indexOf('--sheet');
  const all = args.includes('--all');
  const sheet = sheetIdx >= 0 ? parseInt(args[sheetIdx + 1], 10) : 1;
  return { sheet, all };
}

// Claude API でシート全体の単語を解析
async function analyzeSheet(apiKey, sheetIdx, sheetName, examples) {
  // 例文を整形: theme-sheet-ex 形式の ID で
  const numbered = examples.map((ex, i) =>
    `${sheetIdx}-${i + 1}: ${ex.ne} (${ex.jp})`
  ).join('\n');

  const prompt = `あなたはネパール語学習辞書の専門家です。
以下のネパール語例文リストを解析し、各文に出てくる **すべての内容語** を抽出して
**文脈に応じた** 訳語と解説を JSON で出力してください。

【入力例文 (シート ${sheetIdx}: ${sheetName})】
${numbered}

【出力 JSON フォーマット】
{
  "<ネパール語単語>": {
    "rom": "<ローマ字 (Harvard-Kyoto 風で可読性重視)>",
    "base_form": "<動詞/形容詞なら基本形・不定詞>",
    "base_meaning": "<辞書的な基本意味>",
    "contexts": [
      {
        "sentence_id": "${sheetIdx}-1",
        "ja": "<この文脈での自然な日本語訳>",
        "pos": "<品詞・活用情報>",
        "note": "<文法的な短い解説 (任意、20文字以内)>"
      }
      // 他の文脈で出てきたら配列に追加
    ]
  }
}

【重要】
1. 同じ単語が複数の文脈で出てきたら、contexts 配列に複数エントリ
2. **同じ訳なら sentence_id だけ追加** (note を重複させない)
3. 動詞は base_form (不定詞) を必ず付ける (例: बोल्छु の base_form は बोल्नु)
4. 助詞・後置詞 (मा, बाट, लाई, को, ले 等) も含める
5. ローマ字は学習者が読みやすい形 (ṁ や ñ は避け、m, n などに)
6. 文法的解説は短く (例: "現在形・1人称単数")
7. **必ず JSON 単独で出力**、説明文や Markdown 不要

JSON のみ:`;

  const body = {
    model: MODEL,
    max_tokens: 32000,  // Sonnet 4.6 は最大 64K 出力可。文脈情報がある単語辞書は嵩むので大きめに。
    messages: [{ role: 'user', content: prompt }],
  };

  console.log(`  Claude API 呼び出し中 (シート ${sheetIdx}: ${sheetName})...`);
  const startTime = Date.now();

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  // Sonnet 4.6 料金: $3/1M input, $15/1M output
  const cost = (inputTokens * 3 / 1e6) + (outputTokens * 15 / 1e6);

  console.log(`    所要 ${elapsed}s, 入力 ${inputTokens} tok, 出力 ${outputTokens} tok, ~$${cost.toFixed(4)}`);

  // テキストを抽出
  let text = data.content?.map(c => c.text || '').join('') || '';
  // ```json ... ``` を剥がす
  text = text.replace(/```json\s*|```\s*$/g, '').trim();

  try {
    const parsed = JSON.parse(text);
    return { vocab: parsed, cost, inputTokens, outputTokens };
  } catch (e) {
    console.error('  JSON パースエラー。先頭 500 文字:', text.slice(0, 500));
    throw e;
  }
}

// HTML プレビュー生成
function buildPreviewHtml(sheetData) {
  const sections = sheetData.map(({ sheetIdx, sheetName, examples, vocab }) => {
    const exHtml = examples.map((ex, i) => {
      const sid = `${sheetIdx}-${i + 1}`;
      // この文に登場する単語を vocab から探す
      const words = [];
      for (const [word, info] of Object.entries(vocab)) {
        const ctx = info.contexts?.find(c => c.sentence_id === sid);
        if (ctx) words.push({ word, info, ctx });
      }
      const wordRows = words.map(({ word, info, ctx }) => `
        <tr>
          <td class="ne">${word}</td>
          <td class="rom">${info.rom || ''}</td>
          <td class="ja">${ctx.ja || ''}</td>
          <td class="pos">${ctx.pos || ''}</td>
          <td class="note">${ctx.note || ''}</td>
        </tr>
      `).join('');
      return `
        <div class="example">
          <div class="sid">#${sid}</div>
          <div class="ne-text">${ex.ne}</div>
          <div class="jp-text">${ex.jp}</div>
          <table class="words">
            <thead><tr><th>単語</th><th>ローマ字</th><th>この文での訳</th><th>品詞</th><th>解説</th></tr></thead>
            <tbody>${wordRows}</tbody>
          </table>
        </div>
      `;
    }).join('');
    return `
      <section class="sheet">
        <h2>シート ${sheetIdx}: ${sheetName}</h2>
        <div class="stat">単語エントリ ${Object.keys(vocab).length} 語</div>
        ${exHtml}
      </section>
    `;
  }).join('');

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>文法辞書 (文脈依存版) プレビュー</title>
<style>
  body { font-family: -apple-system, "Helvetica Neue", "Hiragino Sans", sans-serif; margin: 2em; max-width: 900px; }
  h1 { color: #333; }
  h2 { color: #555; border-bottom: 2px solid #ddd; padding-bottom: 8px; }
  .stat { color: #888; font-size: 0.9em; margin-bottom: 1em; }
  .example { background: #f9f9f9; border-radius: 8px; padding: 1em; margin-bottom: 1em; }
  .sid { color: #999; font-family: monospace; font-size: 0.85em; }
  .ne-text { font-size: 1.3em; margin: 0.3em 0; color: #222; }
  .jp-text { color: #666; margin-bottom: 0.6em; }
  table.words { width: 100%; border-collapse: collapse; font-size: 0.9em; background: white; }
  table.words th { background: #eee; padding: 6px 8px; text-align: left; }
  table.words td { padding: 6px 8px; border-top: 1px solid #eee; vertical-align: top; }
  .ne { font-weight: 600; color: #1a1a1a; }
  .rom { color: #777; font-style: italic; font-family: monospace; font-size: 0.9em; }
  .ja { color: #2563eb; }
  .pos { color: #888; font-size: 0.85em; }
  .note { color: #999; font-size: 0.85em; }
</style>
</head>
<body>
<h1>文法辞書 (文脈依存版) プレビュー</h1>
<p>このプレビューは PracticeScreen で実際に表示される内容を再現しています。同じ単語でも文脈ごとに異なる訳が表示される動作を確認してください。</p>
${sections}
</body>
</html>`;
}

async function main() {
  console.log('=== 文法辞書 (文脈依存版) プロトタイプ ===\n');

  const env = loadEnv();
  const apiKey = env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('.env に VITE_ANTHROPIC_API_KEY がありません');

  // 文法.xlsx を見つける (シリーズ root or 旧プロジェクト)
  let xlsxPath = null;
  const candidates = [
    path.join(ROOT, '..', '文法.xlsx'),                                          // シリーズ root
    path.join(ROOT, '..', '..', 'ネパール語瞬間作文', '文法.xlsx'),               // 旧プロジェクト
    path.join(ROOT, '文法.xlsx'),                                                 // App A の root
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) { xlsxPath = p; break; }
  }
  if (!xlsxPath) throw new Error(`文法.xlsx が見つかりません`);
  console.log(`文法.xlsx: ${xlsxPath}\n`);

  const { sheet: targetSheet, all } = parseArgs();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);

  let sheetsToProcess;
  if (all) {
    sheetsToProcess = wb.worksheets.map((s, i) => ({ s, idx: i + 1 }));
  } else {
    const s = wb.worksheets[targetSheet - 1];
    if (!s) throw new Error(`シート ${targetSheet} が存在しません`);
    sheetsToProcess = [{ s, idx: targetSheet }];
  }

  const allResults = [];
  let totalCost = 0;

  for (const { s, idx } of sheetsToProcess) {
    console.log(`\n[シート ${idx}/${all ? 30 : 1}] ${s.name}`);
    // 例文取得
    const examples = [];
    for (let r = 2; r <= s.actualRowCount; r++) {
      const jp = getCellText(s.getRow(r).getCell(1));
      const ne = getCellText(s.getRow(r).getCell(2));
      if (jp && ne) examples.push({ jp, ne });
    }
    console.log(`  例文数: ${examples.length}`);

    const { vocab, cost } = await analyzeSheet(apiKey, idx, s.name, examples);
    totalCost += cost;
    console.log(`  単語エントリ: ${Object.keys(vocab).length}`);

    allResults.push({ sheetIdx: idx, sheetName: s.name, examples, vocab });
  }

  // 既存辞書を読み込み (accumulate: シート単位の追加実行でも他シートを保持)
  let merged = {};
  if (fs.existsSync(OUT_JSON)) {
    try {
      merged = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
      console.log(`\n既存辞書を読込: ${Object.keys(merged).length} 語`);
    } catch (e) {
      console.warn(`既存辞書の読込失敗 (新規作成): ${e.message}`);
      merged = {};
    }
  }

  // 今回処理したシートの prefix を算出し、既存 contexts から該当 prefix を除去
  // (同じシートの再実行を冪等にする)
  const processedPrefixes = new Set(allResults.map(r => String(r.sheetIdx)));
  for (const word of Object.keys(merged)) {
    const info = merged[word];
    if (Array.isArray(info.contexts)) {
      info.contexts = info.contexts.filter(
        c => !processedPrefixes.has(String(c.sentence_id).split('-')[0])
      );
    }
  }
  // contexts が空になった単語は削除
  for (const word of Object.keys(merged)) {
    if (!merged[word].contexts || merged[word].contexts.length === 0) {
      delete merged[word];
    }
  }

  // 今回の結果をマージ (シート跨ぎでも同じ単語をマージ)
  for (const { vocab } of allResults) {
    for (const [word, info] of Object.entries(vocab)) {
      if (!merged[word]) {
        merged[word] = { ...info };
      } else {
        // contexts を統合
        merged[word].contexts = [
          ...(merged[word].contexts || []),
          ...(info.contexts || []),
        ];
        // 基本情報が欠けていれば補完
        if (!merged[word].rom && info.rom) merged[word].rom = info.rom;
        if (!merged[word].base_form && info.base_form) merged[word].base_form = info.base_form;
        if (!merged[word].base_meaning && info.base_meaning) merged[word].base_meaning = info.base_meaning;
      }
    }
  }

  // 出力
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(merged, null, 2));
  console.log(`\n保存: ${OUT_JSON}`);

  const html = buildPreviewHtml(allResults);
  fs.writeFileSync(OUT_HTML, html);
  console.log(`プレビュー: ${OUT_HTML}`);

  console.log(`\n========================================`);
  console.log(`処理シート数:   ${allResults.length}`);
  console.log(`総ユニーク単語: ${Object.keys(merged).length}`);
  console.log(`総コスト:       ~$${totalCost.toFixed(4)} (約 ${Math.ceil(totalCost * 150)} 円)`);
  console.log(`\nHTML プレビューをブラウザで開いて確認してください:`);
  console.log(`  file:///${OUT_HTML.replace(/\\/g, '/')}`);
}

main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
