// 文法モードの bn 文脈辞書を Claude(Sonnet) で生成する。
// 入力: overlays/bn.json の grammarL1 + grammarExamples.json (jp)。
// 出力: overlays/bn.json の grammarVocab (構造B)。sentence_id = "テーマ-番号"。
//
// 使い方:
//   node scripts/build-bn-grammar-vocab.mjs            # 全30テーマ
//   node scripts/build-bn-grammar-vocab.mjs --theme 1

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const GRAMMAR_JSON = path.join(ROOT, 'expo-app/data/grammarExamples.json');
const OVERLAY = path.join(ROOT, 'expo-app/data/overlays/bn.json');

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function analyzeChunk(apiKey, t, bnArr, jaArr, startNum) {
  const numbered = bnArr.map((bn, i) =>
    `${t}-${startNum + i + 1}: ${bn} (${jaArr[startNum + i] ?? ''})`
  ).join('\n');
  const prompt = `あなたはベンガル語(বাংলা)学習辞書の専門家です。
以下のベンガル語例文(括弧内は元の日本語)を解析し、各文の **すべての内容語** を抽出して
**文脈に応じた** 訳語と解説を JSON で出力してください。

【入力 (文法テーマ${t})】
${numbered}

【出力 JSON】
{
  "<ベンガル語単語>": {
    "rom": "<ローマ字(可読性重視)>",
    "base_form": "<動詞/形容詞の基本形>",
    "base_meaning": "<辞書的な基本意味(日本語)>",
    "contexts": [ { "sentence_id": "${t}-${startNum + 1}", "ja": "<文脈での日本語訳>", "pos": "<品詞>", "note": "<短い解説(任意)>" } ]
  }
}
【重要】同じ単語は contexts に複数; 動詞は base_form; ローマ字は ṁ/ñ を避ける; sentence_id は "${t}-<番号>"; JSON単独で出力。
JSONのみ:`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 20000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = await res.json();
  const it = data.usage?.input_tokens ?? 0, ot = data.usage?.output_tokens ?? 0;
  const cost = it * 3 / 1e6 + ot * 15 / 1e6;
  console.log(`    [文${startNum + 1}-${startNum + bnArr.length}] 入${it}/出${ot} ~$${cost.toFixed(4)}`);
  let text = (data.content?.map(c => c.text || '').join('') || '').replace(/```json\s*|```\s*$/g, '').trim();
  return { vocab: JSON.parse(text), cost };
}

async function withRetry(fn) {
  let last;
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < MAX_RETRIES) { console.log(`      失敗(${i}/${MAX_RETRIES}): ${e.message}`); await sleep(8000 * i); } }
  }
  throw last;
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

function hasTheme(vocab, t) {
  const prefix = `${t}-`;
  return Object.values(vocab).some(v => (v.contexts || []).some(c => String(c.sentence_id).startsWith(prefix)));
}

async function main() {
  const apiKey = loadEnv().VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('.env に VITE_ANTHROPIC_API_KEY がありません');
  const grammar = JSON.parse(fs.readFileSync(GRAMMAR_JSON, 'utf8'));
  const overlay = JSON.parse(fs.readFileSync(OVERLAY, 'utf8'));
  const gv = overlay.grammarVocab || {};

  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const ti = args.indexOf('--theme');
  const themes = ti >= 0 ? [String(parseInt(args[ti + 1], 10))] : Object.keys(grammar);

  let totalCost = 0, done = 0, skip = 0;
  for (const t of themes) {
    const bnArr = overlay.grammarL1?.[t] || [];
    const jaArr = (grammar[t] || []).map(e => e.jp);
    if (!bnArr.length) { console.log(`[テーマ${t}] bn訳なし、スキップ`); continue; }
    if (!force && hasTheme(gv, t)) { skip++; continue; }
    console.log(`[文法テーマ${t}] ${bnArr.length}文`);
    for (let s = 0; s < bnArr.length; s += BATCH_SIZE) {
      const r = await withRetry(() => analyzeChunk(apiKey, t, bnArr.slice(s, s + BATCH_SIZE), jaArr, s));
      mergeVocab(gv, r.vocab);
      totalCost += r.cost;
    }
    overlay.grammarVocab = gv;
    fs.writeFileSync(OVERLAY, JSON.stringify(overlay, null, 2));
    done++;
  }
  console.log(`\n生成テーマ ${done} / スキップ ${skip} / 総単語 ${Object.keys(gv).length} / コスト ~$${totalCost.toFixed(4)} (約${Math.ceil(totalCost * 150)}円)`);
}

main().catch(e => { console.error('致命的エラー:', e.message); process.exit(1); });
