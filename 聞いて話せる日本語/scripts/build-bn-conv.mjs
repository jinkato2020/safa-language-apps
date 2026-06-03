// 会話モードの bn 翻訳を Claude(Sonnet) で生成する。
// 入力: expo-app/data/examples.json ("テーマ-レベル" → [{jp, ne}...])。
// 出力: expo-app/data/overlays/bn.json の examplesL1["テーマ-レベル"] = [bn訳...] (順序維持)。
//
// 使い方:
//   node scripts/build-bn-conv.mjs              # 全キー(生成済みはスキップ)
//   node scripts/build-bn-conv.mjs --theme 2    # テーマ指定 (2-1/2-2/2-3)
//   node scripts/build-bn-conv.mjs --force      # 既存も再生成
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const EXAMPLES_JSON = path.join(ROOT, 'expo-app/data/examples.json');
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

async function translateKey(apiKey, jpArr) {
  const numbered = jpArr.map((jp, i) => `${i + 1}. ${jp}`).join('\n');
  const prompt = `以下の日本語の会話文を自然なベンガル語(বাংলা)に翻訳してください。
日本で生活するベンガル語話者の日本語学習教材です。日常会話として自然で、丁寧すぎない口語表現で訳してください。

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
  const examples = JSON.parse(fs.readFileSync(EXAMPLES_JSON, 'utf8'));
  const overlay = JSON.parse(fs.readFileSync(OVERLAY, 'utf8'));
  overlay.examplesL1 = overlay.examplesL1 || {};

  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const ti = args.indexOf('--theme');
  // キーを (テーマ, レベル) 昇順で
  let keys = Object.keys(examples).sort((a, b) => {
    const [ta, la] = a.split('-').map(Number), [tb, lb] = b.split('-').map(Number);
    return ta - tb || la - lb;
  });
  if (ti >= 0) { const t = String(parseInt(args[ti + 1], 10)); keys = keys.filter(k => k.startsWith(`${t}-`)); }

  let totalCost = 0, done = 0, skip = 0;
  for (const key of keys) {
    const jpArr = (examples[key] || []).map(e => e.jp);
    if (!jpArr.length) continue;
    if (!force && Array.isArray(overlay.examplesL1[key]) && overlay.examplesL1[key].length === jpArr.length) { skip++; continue; }
    console.log(`[会話 ${key}] ${jpArr.length}文`);
    const { arr, cost } = await withRetry(() => translateKey(apiKey, jpArr));
    overlay.examplesL1[key] = arr;
    fs.writeFileSync(OVERLAY, JSON.stringify(overlay, null, 2));
    totalCost += cost; done++;
    console.log(`  完了 ~$${cost.toFixed(4)}`);
  }
  console.log(`\n生成 ${done} / スキップ ${skip} / コスト ~$${totalCost.toFixed(4)} (約${Math.ceil(totalCost * 150)}円)`);
}

main().catch(e => { console.error('致命的エラー:', e.message); process.exit(1); });
