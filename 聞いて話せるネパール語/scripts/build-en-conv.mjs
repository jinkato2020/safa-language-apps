// App A(聞いて話せるネパール語) の英語オーバーレイ(会話)を Claude で生成。
// 入力: expo-app/data/examples.json ("T-L" → [{jp, ne}])。日本語(jp)を英語に翻訳。
// 出力: expo-app/data/overlays/en.json の examplesL1["T-L"] = [en訳...] (順序維持)。
// 英語話者がネパール語を学ぶ際の「母語側(英語)」の訳。
// 使い方:
//   node scripts/build-en-conv.mjs            # 全キー(生成済みスキップ)
//   node scripts/build-en-conv.mjs --theme 1  # テーマ指定
//   node scripts/build-en-conv.mjs --force
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(ROOT, '.env');
const EXAMPLES_JSON = path.join(ROOT, 'expo-app/data/examples.json');
const OVERLAY = path.join(ROOT, 'expo-app/data/overlays/en.json');
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.EN_MODEL || 'claude-sonnet-4-6'; // 文は Opus 推奨: EN_MODEL=claude-opus-4-8
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

async function translateKey(apiKey, neArr) {
  const numbered = neArr.map((ne, i) => `${i + 1}. ${ne}`).join('\n');
  const prompt = `Translate the following Nepali conversational sentences directly into natural, everyday English.
These are shown to English speakers learning Nepali — the English must faithfully convey the meaning of the Nepali. Use natural spoken English, not overly formal. Translate directly from the Nepali (do not paraphrase).

[Nepali]
${numbered}

[Output] A JSON object mapping each item number (as a string key) to its English translation.
Include EXACTLY the keys "1" through "${neArr.length}". No explanation, no Markdown.
e.g. {"1":"...","2":"..."}`;

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
  const obj = JSON.parse(text);
  const arr = neArr.map((_, i) => obj[String(i + 1)]);
  if (arr.some(x => typeof x !== 'string' || !x.trim())) {
    throw new Error(`missing keys (got ${Object.keys(obj).length}/${neArr.length})`);
  }
  return { arr, cost };
}

async function withRetry(fn) {
  let last;
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < MAX_RETRIES) { console.log(`    fail(${i}/${MAX_RETRIES}): ${e.message}`); await sleep(8000 * i); } }
  }
  throw last;
}

async function main() {
  const apiKey = loadEnv().VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('.env に VITE_ANTHROPIC_API_KEY がありません');
  const examples = JSON.parse(fs.readFileSync(EXAMPLES_JSON, 'utf8'));
  fs.mkdirSync(path.dirname(OVERLAY), { recursive: true });
  const overlay = fs.existsSync(OVERLAY) ? JSON.parse(fs.readFileSync(OVERLAY, 'utf8')) : { l1: 'en', version: 1, examplesL1: {}, grammarL1: {} };
  overlay.examplesL1 = overlay.examplesL1 || {};

  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const ti = args.indexOf('--theme');
  let keys = Object.keys(examples).sort((a, b) => {
    const [ta, la] = a.split('-').map(Number), [tb, lb] = b.split('-').map(Number);
    return ta - tb || la - lb;
  });
  if (ti >= 0) { const t = String(parseInt(args[ti + 1], 10)); keys = keys.filter(k => k.startsWith(`${t}-`)); }

  let totalCost = 0, done = 0, skip = 0;
  for (const key of keys) {
    const neArr = (examples[key] || []).map(e => e.ne);
    if (!neArr.length) continue;
    if (!force && Array.isArray(overlay.examplesL1[key]) && overlay.examplesL1[key].length === neArr.length) { skip++; continue; }
    console.log(`[conv ${key}] ${neArr.length} sentences`);
    const { arr, cost } = await withRetry(() => translateKey(apiKey, neArr));
    overlay.examplesL1[key] = arr;
    fs.writeFileSync(OVERLAY, JSON.stringify(overlay, null, 2));
    totalCost += cost; done++;
    console.log(`  done ~$${cost.toFixed(4)}`);
  }
  console.log(`\ngenerated ${done} / skipped ${skip} / cost ~$${totalCost.toFixed(4)} (~${Math.ceil(totalCost * 150)} yen)`);
}

main().catch(e => { console.error('fatal:', e.message); process.exit(1); });
