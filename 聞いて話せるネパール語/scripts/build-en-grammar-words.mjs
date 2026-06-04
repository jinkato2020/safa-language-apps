// App A 英語オーバーレイの「文法文」と「単語(vocabモード)」を生成。
// 入力: grammarExamples.json ("T"→[{jp,ne}]) / words.json ("cat"→[{ja,ne}])。
// 出力: overlays/en.json の grammarL1["T"] と wordsL1["cat"]。
// 実行: node scripts/build-en-grammar-words.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(ROOT, '.env');
const DATA = path.join(ROOT, 'expo-app/data');
const OVERLAY = path.join(DATA, 'overlays/en.json');
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.EN_MODEL || 'claude-sonnet-4-6'; // 文は Opus 推奨: EN_MODEL=claude-opus-4-8

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function translate(apiKey, jpArr, kind) {
  const numbered = jpArr.map((s, i) => `${i + 1}. ${s}`).join('\n');
  // 番号キー付きオブジェクトで返させる(件数ズレに強い: indexで対応)。
  const prompt = `Translate each Nepali ${kind} directly into natural English.
Shown to English speakers learning Nepali — the English must faithfully convey the Nepali meaning. Natural, concise English.

[Nepali]
${numbered}

[Output] A JSON object mapping each item number (as a string key) to its English translation.
Include EXACTLY the keys "1" through "${jpArr.length}". No explanation, no Markdown.
e.g. {"1":"...","2":"..."}`;
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = await res.json();
  const cost = (data.usage?.input_tokens ?? 0) * 3 / 1e6 + (data.usage?.output_tokens ?? 0) * 15 / 1e6;
  const text = (data.content?.map(c => c.text || '').join('') || '').replace(/```json\s*|```\s*$/g, '').trim();
  const obj = JSON.parse(text);
  const arr = jpArr.map((_, i) => obj[String(i + 1)]);
  if (arr.some(x => typeof x !== 'string' || !x.trim())) throw new Error(`missing keys (got ${Object.keys(obj).length}/${jpArr.length})`);
  return { arr, cost };
}
async function withRetry(fn) {
  let last;
  for (let i = 1; i <= 4; i++) { try { return await fn(); } catch (e) { last = e; if (i < 4) { console.log(`    fail(${i}/4): ${e.message}`); await sleep(8000 * i); } } }
  throw last;
}

async function main() {
  const apiKey = loadEnv().VITE_ANTHROPIC_API_KEY;
  const force = process.argv.includes('--force');
  const grammar = JSON.parse(fs.readFileSync(path.join(DATA, 'grammarExamples.json'), 'utf8'));
  const words = JSON.parse(fs.readFileSync(path.join(DATA, 'words.json'), 'utf8'));
  const overlay = fs.existsSync(OVERLAY) ? JSON.parse(fs.readFileSync(OVERLAY, 'utf8')) : { l1: 'en', version: 1, examplesL1: {} };
  overlay.grammarL1 = overlay.grammarL1 || {};
  overlay.wordsL1 = overlay.wordsL1 || {};
  let cost = 0;

  // 文法文 (ne→en)
  for (const t of Object.keys(grammar)) {
    const ne = (grammar[t] || []).map(e => e.ne);
    if (!ne.length) continue;
    if (!force && overlay.grammarL1[t]?.length === ne.length) continue;
    console.log(`[grammar ${t}] ${ne.length}`);
    const r = await withRetry(() => translate(apiKey, ne, 'grammar example sentences'));
    overlay.grammarL1[t] = r.arr; cost += r.cost;
    fs.writeFileSync(OVERLAY, JSON.stringify(overlay, null, 2));
  }
  // 単語 (ne→en)
  for (const c of Object.keys(words)) {
    const ne = (words[c] || []).map(w => w.ne);
    if (!ne.length) continue;
    if (!force && overlay.wordsL1[c]?.length === ne.length) continue;
    console.log(`[words ${c}] ${ne.length}`);
    const r = await withRetry(() => translate(apiKey, ne, 'vocabulary words'));
    overlay.wordsL1[c] = r.arr; cost += r.cost;
    fs.writeFileSync(OVERLAY, JSON.stringify(overlay, null, 2));
  }
  console.log(`\ngrammar+words done / cost ~$${cost.toFixed(4)} (~${Math.ceil(cost * 150)} yen)`);
}
main().catch(e => { console.error('fatal:', e.message); process.exit(1); });
