// 日本語文の「かな読み＋ローマ字」を Claude API で生成する。
// ネパール語話者が日本語を学ぶための読み補助 (聞き流し/練習の日本語カード用)。
//
// 使い方:
//   node scripts/build-jp-reading-claude.mjs --grammar --theme 1   # 文法テーマ1のみ (試験)
//   node scripts/build-jp-reading-claude.mjs --grammar --all       # 文法全30テーマ
//   node scripts/build-jp-reading-claude.mjs --conv --all          # 会話全部
//
// 出力: expo-app/data/jp-reading.json   { "<日本語文>": { "kana": "...", "romaji": "..." } }
//   ※ 日本語文をキーにして重複を自動統合 (accumulate)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const GRAMMAR_JSON = path.join(ROOT, 'expo-app/data/grammarExamples.json');
const CONV_JSON = path.join(ROOT, 'expo-app/data/examples.json');
const OUT_JSON = path.join(ROOT, 'expo-app/data/jp-reading.json');

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) throw new Error(`.env not found: ${ENV_PATH}`);
  const env = {};
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const conv = args.includes('--conv');
  const grammar = args.includes('--grammar') || !conv; // 既定は文法
  const all = args.includes('--all');
  const ti = args.indexOf('--theme');
  const theme = ti >= 0 ? parseInt(args[ti + 1], 10) : 1;
  return { conv, grammar, all, theme };
}

async function analyzeBatch(apiKey, sentences) {
  const numbered = sentences.map((s, i) => `${i + 1}: ${s}`).join('\n');
  const prompt = `あなたは日本語学習の専門家です（ネパール語話者向けの読み補助）。
以下の日本語の文それぞれについて、次の2つを生成してください。
1) "kana": 全文の読み仮名。基本はひらがな。ただし**外来語・固有名詞などカタカナで書く語はカタカナのまま**。漢字は**文脈に応じた正しい読み**にする(例: 今日→きょう)。句読点はそのまま残す。
2) "romaji": ヘボン式ローマ字。**単語ごとにスペース区切り**。助詞は発音どおり (は→wa, を→o, へ→e)。長音は母音を重ねるか伸ばす自然な表記でよい。

【入力文】
${numbered}

【出力フォーマット】厳密にこの形の JSON のみ:
{
  "<入力の日本語文をそのまま>": { "kana": "<読み仮名>", "romaji": "<ローマ字>" }
}

【重要】
- キーは入力の日本語文を**一字一句そのまま**使う
- 全 ${sentences.length} 文すべてを含める
- 説明文や Markdown のコードフェンスは不要。**JSON 単独**で出力

JSONのみ:`;

  const body = { model: MODEL, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] };
  const startTime = Date.now();
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Claude API HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const inTok = data.usage?.input_tokens ?? 0;
  const outTok = data.usage?.output_tokens ?? 0;
  const cost = (inTok * 3 / 1e6) + (outTok * 15 / 1e6);
  console.log(`  所要 ${elapsed}s, 入力 ${inTok} tok, 出力 ${outTok} tok, ~$${cost.toFixed(4)}`);
  let text = (data.content?.map(c => c.text || '').join('') || '').replace(/```json\s*|```\s*$/g, '').trim();
  try { return { reading: JSON.parse(text), cost }; }
  catch (e) { console.error('  JSON パースエラー 先頭500字:', text.slice(0, 500)); throw e; }
}

async function main() {
  console.log('=== 日本語 かな読み＋ローマ字 生成 (Claude) ===\n');
  const env = loadEnv();
  const apiKey = env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('.env に VITE_ANTHROPIC_API_KEY がありません');

  const { conv, grammar, all, theme } = parseArgs();

  // 対象の日本語文を収集
  const sentences = new Set();
  if (grammar) {
    const ge = JSON.parse(fs.readFileSync(GRAMMAR_JSON, 'utf8'));
    const keys = all ? Object.keys(ge) : [String(theme)];
    for (const k of keys) (ge[k] || []).forEach(x => x.jp && sentences.add(x.jp));
    console.log(`文法: ${all ? '全テーマ' : 'テーマ ' + theme} → ${sentences.size} 文`);
  }
  if (conv) {
    const ce = JSON.parse(fs.readFileSync(CONV_JSON, 'utf8'));
    const keys = all ? Object.keys(ce) : Object.keys(ce).filter(k => k.startsWith(`${theme}-`));
    for (const k of keys) (ce[k] || []).forEach(x => x.jp && sentences.add(x.jp));
    console.log(`会話: ${sentences.size} 文 (累計)`);
  }

  const list = [...sentences];
  if (list.length === 0) throw new Error('対象文が0件です');

  // 既存を読み込み (accumulate)
  let merged = {};
  if (fs.existsSync(OUT_JSON)) {
    try { merged = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8')); console.log(`既存読み込み: ${Object.keys(merged).length} 文`); } catch {}
  }

  // 50 文ずつバッチ
  const BATCH = 50;
  let totalCost = 0, added = 0;
  for (let i = 0; i < list.length; i += BATCH) {
    const batch = list.slice(i, i + BATCH);
    console.log(`\n[バッチ ${Math.floor(i / BATCH) + 1}] ${batch.length} 文`);
    const { reading, cost } = await analyzeBatch(apiKey, batch);
    totalCost += cost;
    for (const [jp, val] of Object.entries(reading)) {
      if (val && val.kana && val.romaji) { merged[jp] = { kana: val.kana, romaji: val.romaji }; added++; }
    }
  }

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(merged, null, 2));
  console.log(`\n保存: ${OUT_JSON}`);
  console.log(`========================================`);
  console.log(`今回処理: ${list.length} 文 / 追加・更新: ${added}`);
  console.log(`辞書総数: ${Object.keys(merged).length} 文`);
  console.log(`総コスト: ~$${totalCost.toFixed(4)} (約 ${Math.ceil(totalCost * 150)} 円)`);
}

main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
