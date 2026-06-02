// 会話モードの bn(ベンガル語) 文脈依存辞書を Claude(Sonnet) で生成する。
// 入力: data/overlays/bn.json (examplesL1) + data/examples.json (jp)。
// 出力: data/overlays/bn.json の convVocab に統合 (構造B: 単語→contexts配列)。
//
// 使い方:
//   node scripts/build-bn-conv-vocab.mjs                 # テーマ1・全レベル (既定)
//   node scripts/build-bn-conv-vocab.mjs --theme 2       # テーマ指定・全レベル
//   node scripts/build-bn-conv-vocab.mjs --theme 1 --level 2

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const OVERLAY_JSON = path.join(ROOT, 'expo-app/data/overlays/bn.json');
const EXAMPLES_JSON = path.join(ROOT, 'expo-app/data/examples.json');

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const NUM_LEVELS = 3;
const MAX_RETRIES = 4;
const BATCH_SIZE = 10;

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

function parseArgs() {
  const a = process.argv.slice(2);
  const ti = a.indexOf('--theme'); const theme = ti >= 0 ? parseInt(a[ti + 1], 10) : 1;
  const li = a.indexOf('--level'); const level = li >= 0 ? parseInt(a[li + 1], 10) : null;
  return { theme, level };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function analyzeChunk(apiKey, t, l, bnArr, jaArr, startNum) {
  const numbered = bnArr.map((bn, i) =>
    `${t}-${l}-${startNum + i + 1}: ${bn} (${jaArr[startNum + i] ?? ''})`
  ).join('\n');

  const prompt = `あなたはベンガル語(বাংলা)学習辞書の専門家です。
以下のベンガル語例文リストを解析し、各文に出てくる **すべての内容語** を抽出して
**文脈に応じた** 訳語と解説を JSON で出力してください。括弧内は日本語の元文です。

【入力例文 (会話 テーマ${t}・レベル${l})】
${numbered}

【出力 JSON フォーマット】
{
  "<ベンガル語単語>": {
    "rom": "<ローマ字 (可読性重視・IAST記号は避ける)>",
    "base_form": "<動詞/形容詞なら基本形>",
    "base_meaning": "<辞書的な基本意味(日本語)>",
    "contexts": [
      { "sentence_id": "${t}-${l}-${startNum + 1}", "ja": "<この文脈での自然な日本語訳>", "pos": "<品詞>", "note": "<短い文法解説(任意,20字以内)>" }
    ]
  }
}

【重要】
1. 同じ単語が複数文脈で出たら contexts に複数エントリ。同じ訳なら sentence_id だけ追加。
2. 動詞は base_form を付ける。
3. ローマ字は学習者が読みやすい形 (ṁ や ñ は避け m,n に)。
4. 文法解説は短く。
5. sentence_id は必ず "${t}-${l}-<例題番号>" (上の番号を使う)。
6. **必ず JSON 単独で出力**、説明文や Markdown 不要。

JSON のみ:`;

  const body = { model: MODEL, max_tokens: 24000, messages: [{ role: 'user', content: prompt }] };
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const it = data.usage?.input_tokens ?? 0, ot = data.usage?.output_tokens ?? 0;
  const cost = it * 3 / 1e6 + ot * 15 / 1e6;
  console.log(`    [文${startNum + 1}-${startNum + bnArr.length}] 入${it}/出${ot}tok ~$${cost.toFixed(4)}`);
  let text = (data.content?.map(c => c.text || '').join('') || '').replace(/```json\s*|```\s*$/g, '').trim();
  return { vocab: JSON.parse(text), cost };
}

async function analyzeWithRetry(apiKey, t, l, bnArr, jaArr, startNum) {
  let lastErr;
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try { return await analyzeChunk(apiKey, t, l, bnArr, jaArr, startNum); }
    catch (e) { lastErr = e; if (i < MAX_RETRIES) { console.log(`      失敗(${i}/${MAX_RETRIES}): ${e.message}`); await sleep(8000 * i); } }
  }
  throw lastErr;
}

function mergeVocab(dst, src) {
  for (const [w, info] of Object.entries(src)) {
    if (!dst[w]) dst[w] = { ...info, contexts: [...(info.contexts || [])] };
    else {
      dst[w].contexts = [...(dst[w].contexts || []), ...(info.contexts || [])];
      for (const k of ['rom', 'base_form', 'base_meaning']) if (!dst[w][k] && info[k]) dst[w][k] = info[k];
    }
  }
}

async function main() {
  const apiKey = loadEnv().VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('.env に VITE_ANTHROPIC_API_KEY がありません');
  const overlay = JSON.parse(fs.readFileSync(OVERLAY_JSON, 'utf8'));
  const examples = JSON.parse(fs.readFileSync(EXAMPLES_JSON, 'utf8'));
  const { theme, level } = parseArgs();
  const levels = level ? [level] : Array.from({ length: NUM_LEVELS }, (_, i) => i + 1);

  const convVocab = overlay.convVocab || {};
  let totalCost = 0;
  for (const l of levels) {
    const key = `${theme}-${l}`;
    const bnArr = overlay.examplesL1?.[key] || [];
    const jaArr = (examples[key] || []).map(e => e.jp);
    if (!bnArr.length) { console.log(`[${key}] bn文なし、スキップ`); continue; }
    console.log(`\n[テーマ${theme}・レベル${l}] ${bnArr.length}文`);
    for (let s = 0; s < bnArr.length; s += BATCH_SIZE) {
      const r = await analyzeWithRetry(apiKey, theme, l, bnArr.slice(s, s + BATCH_SIZE), jaArr, s);
      mergeVocab(convVocab, r.vocab);
      totalCost += r.cost;
    }
  }
  overlay.convVocab = convVocab;
  fs.writeFileSync(OVERLAY_JSON, JSON.stringify(overlay, null, 2));
  console.log(`\n総単語: ${Object.keys(convVocab).length} / コスト ~$${totalCost.toFixed(4)} (約${Math.ceil(totalCost * 150)}円)`);
  console.log(`保存: ${OVERLAY_JSON}`);
}

main().catch(e => { console.error('致命的エラー:', e.message); process.exit(1); });
