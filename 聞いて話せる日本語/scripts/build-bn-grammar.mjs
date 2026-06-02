// 文法モードの bn 翻訳を Claude(Sonnet) で生成する。
// 入力: expo-app/data/grammarExamples.json (jp/ne)。
// 出力: expo-app/data/overlays/bn.json の grammarL1[theme] = [bn訳...] (順序維持)。
//
// 使い方:
//   node scripts/build-bn-grammar.mjs            # 全30テーマ
//   node scripts/build-bn-grammar.mjs --theme 1  # テーマ指定
//   (生成済みテーマはスキップ。--force で再生成)

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

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function translateTheme(apiKey, jpArr) {
  const numbered = jpArr.map((jp, i) => `${i + 1}. ${jp}`).join('\n');
  const prompt = `以下の日本語文を自然なベンガル語(বাংলা)に翻訳してください。
日本語学習者(ベンガル語話者)向けの教材です。丁寧で自然な口語表現で。

【日本語】
${numbered}

【出力】JSON配列(文字列)のみ。入力と同じ順序・同じ個数。説明やMarkdown不要。
例: ["翻訳1", "翻訳2", ...]`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = await res.json();
  const it = data.usage?.input_tokens ?? 0, ot = data.usage?.output_tokens ?? 0;
  const cost = it * 3 / 1e6 + ot * 15 / 1e6;
  let text = (data.content?.map(c => c.text || '').join('') || '').replace(/```json\s*|```\s*$/g, '').trim();
  const arr = JSON.parse(text);
  if (!Array.isArray(arr) || arr.length !== jpArr.length) {
    throw new Error(`配列長 不一致: 期待${jpArr.length} 実${Array.isArray(arr) ? arr.length : '非配列'}`);
  }
  return { arr, cost };
}

async function withRetry(fn) {
  let last;
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < MAX_RETRIES) { console.log(`    失敗(${i}/${MAX_RETRIES}): ${e.message}`); await sleep(8000 * i); } }
  }
  throw last;
}

async function main() {
  const apiKey = loadEnv().VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('.env に VITE_ANTHROPIC_API_KEY がありません');
  const grammar = JSON.parse(fs.readFileSync(GRAMMAR_JSON, 'utf8'));
  const overlay = JSON.parse(fs.readFileSync(OVERLAY, 'utf8'));
  overlay.grammarL1 = overlay.grammarL1 || {};

  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const ti = args.indexOf('--theme');
  const themes = ti >= 0 ? [String(parseInt(args[ti + 1], 10))] : Object.keys(grammar);

  let totalCost = 0, done = 0, skip = 0;
  for (const t of themes) {
    const jpArr = (grammar[t] || []).map(e => e.jp);
    if (!jpArr.length) continue;
    if (!force && Array.isArray(overlay.grammarL1[t]) && overlay.grammarL1[t].length === jpArr.length) { skip++; continue; }
    console.log(`[文法テーマ${t}] ${jpArr.length}文`);
    const { arr, cost } = await withRetry(() => translateTheme(apiKey, jpArr));
    overlay.grammarL1[t] = arr;
    fs.writeFileSync(OVERLAY, JSON.stringify(overlay, null, 2));
    totalCost += cost; done++;
    console.log(`  完了 ~$${cost.toFixed(4)}`);
  }
  console.log(`\n生成 ${done} / スキップ ${skip} / コスト ~$${totalCost.toFixed(4)} (約${Math.ceil(totalCost * 150)}円)`);
}

main().catch(e => { console.error('致命的エラー:', e.message); process.exit(1); });
