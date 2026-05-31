// 会話モードの文脈依存辞書を Claude API で生成する (文法版 build-grammar-vocab-claude.mjs の会話版)。
//
// 構造 B: 単語ルート + 文脈配列 (1 単語に複数訳)。
//   sentence_id = `themeId-levelId-exampleNo` (例: "1-1-3" = テーマ1・初級・例題3)
//
// 使い方:
//   node scripts/build-conv-vocab-claude.mjs                       # 初級(level1) テーマ1のみ (試験)
//   node scripts/build-conv-vocab-claude.mjs --theme 5 --level 2   # 指定テーマ・レベル
//   node scripts/build-conv-vocab-claude.mjs --theme 3 --all-levels# テーマ3の全レベル
//   node scripts/build-conv-vocab-claude.mjs --all                 # 全テーマ×全レベル
//   (--force で生成済みグループも再生成。既定は生成済みをスキップ=再開可能)
//
// 出力: expo-app/data/conv-vocab-context.json
//   ※ グループごとに逐次保存。通信失敗は自動リトライし、ダメなら次グループへ継続。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const EXAMPLES_JSON = path.join(ROOT, 'expo-app/data/examples.json');
const OUT_JSON = path.join(ROOT, 'expo-app/data/conv-vocab-context.json');

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const NUM_THEMES = 30;
const NUM_LEVELS = 3;
const MAX_RETRIES = 4;

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
  const all = args.includes('--all');
  const allLevels = args.includes('--all-levels');
  const force = args.includes('--force');
  const ti = args.indexOf('--theme');
  const theme = ti >= 0 ? parseInt(args[ti + 1], 10) : 1;
  const li = args.indexOf('--level');
  const level = li >= 0 ? parseInt(args[li + 1], 10) : 1;
  const mli = args.indexOf('--max-level');
  const maxLevel = mli >= 0 ? parseInt(args[mli + 1], 10) : NUM_LEVELS; // 例: --max-level 2 で上級を除外
  return { all, allLevels, force, theme, level, maxLevel };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function analyzeGroup(apiKey, themeId, levelId, examples) {
  const numbered = examples.map((ex, i) =>
    `${themeId}-${levelId}-${i + 1}: ${ex.ne} (${ex.jp})`
  ).join('\n');

  const prompt = `あなたはネパール語学習辞書の専門家です。
以下のネパール語例文リストを解析し、各文に出てくる **すべての内容語** を抽出して
**文脈に応じた** 訳語と解説を JSON で出力してください。

【入力例文 (会話 テーマ${themeId}・レベル${levelId})】
${numbered}

【出力 JSON フォーマット】
{
  "<ネパール語単語>": {
    "rom": "<ローマ字 (Harvard-Kyoto 風で可読性重視)>",
    "base_form": "<動詞/形容詞なら基本形・不定詞>",
    "base_meaning": "<辞書的な基本意味>",
    "contexts": [
      {
        "sentence_id": "${themeId}-${levelId}-1",
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
7. sentence_id は必ず "${themeId}-${levelId}-<例題番号>" の形式
8. **必ず JSON 単独で出力**、説明文や Markdown 不要

JSON のみ:`;

  const body = { model: MODEL, max_tokens: 32000, messages: [{ role: 'user', content: prompt }] };
  const startTime = Date.now();

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  const cost = (inputTokens * 3 / 1e6) + (outputTokens * 15 / 1e6);
  console.log(`    所要 ${elapsed}s, 入力 ${inputTokens} tok, 出力 ${outputTokens} tok, ~$${cost.toFixed(4)}`);

  let text = data.content?.map(c => c.text || '').join('') || '';
  text = text.replace(/```json\s*|```\s*$/g, '').trim();
  return { vocab: JSON.parse(text), cost };
}

// 通信失敗・一時エラーを自動リトライ
async function analyzeGroupWithRetry(apiKey, t, l, examples) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await analyzeGroup(apiKey, t, l, examples);
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_RETRIES) {
        const wait = 10000 * attempt;
        console.log(`    失敗 (${attempt}/${MAX_RETRIES}): ${e.message} → ${wait / 1000}秒後にリトライ`);
        await sleep(wait);
      }
    }
  }
  throw lastErr;
}

function loadMerged() {
  if (!fs.existsSync(OUT_JSON)) return {};
  try { return JSON.parse(fs.readFileSync(OUT_JSON, 'utf8')); } catch { return {}; }
}

function hasGroup(merged, t, l) {
  const prefix = `${t}-${l}-`;
  return Object.values(merged).some(v => (v.contexts || []).some(c => String(c.sentence_id).startsWith(prefix)));
}

// 1 グループ分を merged に反映 (既存の同グループ contexts は除去してから追加)
function mergeGroup(merged, t, l, vocab) {
  const prefix = `${t}-${l}-`;
  for (const word of Object.keys(merged)) {
    if (Array.isArray(merged[word].contexts)) {
      merged[word].contexts = merged[word].contexts.filter(c => !String(c.sentence_id).startsWith(prefix));
    }
  }
  for (const word of Object.keys(merged)) {
    if (!merged[word].contexts || merged[word].contexts.length === 0) delete merged[word];
  }
  for (const [word, info] of Object.entries(vocab)) {
    if (!merged[word]) {
      merged[word] = { ...info };
    } else {
      merged[word].contexts = [...(merged[word].contexts || []), ...(info.contexts || [])];
      if (!merged[word].rom && info.rom) merged[word].rom = info.rom;
      if (!merged[word].base_form && info.base_form) merged[word].base_form = info.base_form;
      if (!merged[word].base_meaning && info.base_meaning) merged[word].base_meaning = info.base_meaning;
    }
  }
}

async function main() {
  console.log('=== 会話モード 文脈依存辞書 生成 (耐障害版) ===\n');
  const env = loadEnv();
  const apiKey = env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('.env に VITE_ANTHROPIC_API_KEY がありません');

  const EXAMPLES = JSON.parse(fs.readFileSync(EXAMPLES_JSON, 'utf8'));
  const { all, allLevels, force, theme, level, maxLevel } = parseArgs();

  const pairs = [];
  if (all) {
    for (let t = 1; t <= NUM_THEMES; t++) for (let l = 1; l <= maxLevel; l++) pairs.push([t, l]);
  } else if (allLevels) {
    for (let l = 1; l <= maxLevel; l++) pairs.push([theme, l]);
  } else {
    pairs.push([theme, level]);
  }
  if (maxLevel < NUM_LEVELS) console.log(`(レベル ${maxLevel} まで。レベル${maxLevel + 1}以上は保留)\n`);

  let merged = loadMerged();
  if (Object.keys(merged).length) console.log(`既存辞書: ${Object.keys(merged).length} 語\n`);

  let totalCost = 0, done = 0, skipped = 0;
  const failed = [];
  for (const [t, l] of pairs) {
    const examples = EXAMPLES[`${t}-${l}`] ?? [];
    if (examples.length === 0) continue;
    if (!force && hasGroup(merged, t, l)) {
      console.log(`[テーマ${t}・レベル${l}] 生成済み、スキップ`);
      skipped++;
      continue;
    }
    console.log(`\n[テーマ${t}・レベル${l}] 例文数: ${examples.length}`);
    try {
      const { vocab, cost } = await analyzeGroupWithRetry(apiKey, t, l, examples);
      mergeGroup(merged, t, l, vocab);
      fs.writeFileSync(OUT_JSON, JSON.stringify(merged, null, 2)); // 逐次保存
      totalCost += cost;
      done++;
      console.log(`  単語エントリ: ${Object.keys(vocab).length} / 累計総単語: ${Object.keys(merged).length}`);
    } catch (e) {
      console.error(`  [テーマ${t}・レベル${l}] 最終失敗(スキップ): ${e.message}`);
      failed.push(`${t}-${l}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`生成: ${done} / スキップ(生成済): ${skipped} / 失敗: ${failed.length}`);
  if (failed.length) console.log(`失敗グループ: ${failed.join(', ')} (再実行で自動的に続きから)`);
  console.log(`総ユニーク単語: ${Object.keys(merged).length}`);
  console.log(`今回コスト: ~$${totalCost.toFixed(4)} (約 ${Math.ceil(totalCost * 150)} 円)`);
}

main().catch(e => { console.error('致命的エラー:', e.message); process.exit(1); });
