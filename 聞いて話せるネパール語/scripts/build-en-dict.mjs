// App A 英語オーバーレイの辞書(vocab/convVocab/grammarVocab)を生成。
// 意味はネパール語の語から英訳(日本語訳は「意図する語義」のヒントに使うだけ)。
// 品詞(pos)・注記(note)は日本語メタなので日本語→英語。rom/構造/sentence_idは保持。
// 効率化: ユニークなネパール語/日本語メタを一括翻訳(重複を1回に)。
// ※ conv / grammar-words 完了後に実行。辞書=Sonnet(既定)。
// 実行: node scripts/build-en-dict.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(ROOT, '.env');
const DATA = path.join(ROOT, 'expo-app/data');
const OVERLAY = path.join(DATA, 'overlays/en.json');
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.DICT_MODEL || 'claude-sonnet-4-6';
const BATCH = 40;

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function callModel(apiKey, prompt) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = await res.json();
  const cost = (data.usage?.input_tokens ?? 0) * 3 / 1e6 + (data.usage?.output_tokens ?? 0) * 15 / 1e6;
  const text = (data.content?.map(c => c.text || '').join('') || '').replace(/```json\s*|```\s*$/g, '').trim();
  return { obj: JSON.parse(text), cost };
}
async function withRetry(fn) {
  let last;
  for (let i = 1; i <= 4; i++) { try { return await fn(); } catch (e) { last = e; if (i < 4) { console.log(`    fail(${i}/4): ${e.message}`); await sleep(8000 * i); } } }
  throw last;
}

// ネパール語の語 → 英語の意味 (日本語訳を語義ヒントに)。
async function translateWords(apiKey, pairs) {
  const numbered = pairs.map((p, i) => `${i + 1}. ${p.ne}  (intended sense: ${p.ja || '?'})`).join('\n');
  const prompt = `Give the concise English meaning of each Nepali word below.
The Japanese gloss in parentheses indicates the intended sense — use it only to pick the right meaning. The English must be the meaning of the NEPALI word.

${numbered}

[Output] A JSON object mapping each number (string key) to the English meaning. EXACTLY keys "1".."${pairs.length}". No explanation.`;
  const { obj, cost } = await callModel(apiKey, prompt);
  const out = pairs.map((_, i) => obj[String(i + 1)]);
  if (out.some(x => typeof x !== 'string' || !x.trim())) throw new Error(`missing keys (${Object.keys(obj).length}/${pairs.length})`);
  return { out, cost };
}
// 日本語メタ(品詞・注記) → 英語。
async function translateMeta(apiKey, arr) {
  const numbered = arr.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const prompt = `Translate these Japanese grammatical labels / short usage notes into concise English.
Use standard English grammar terms for parts of speech (e.g. 名詞=noun, 動詞=verb, 形容詞=adjective).

${numbered}

[Output] A JSON object mapping each number (string key) to its English. EXACTLY keys "1".."${arr.length}". No explanation.`;
  const { obj, cost } = await callModel(apiKey, prompt);
  const out = arr.map((_, i) => obj[String(i + 1)]);
  if (out.some(x => typeof x !== 'string' || !x.trim())) throw new Error(`missing keys (${Object.keys(obj).length}/${arr.length})`);
  return { out, cost };
}

const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));

async function main() {
  const apiKey = loadEnv().VITE_ANTHROPIC_API_KEY;
  const vocab = read('vocab.json');
  const convVocab = read('conv-vocab-context.json');
  const grammarVocab = read('grammar-vocab-context.json');

  // 1) ネパール語の語 → 日本語ヒント (代表値)。vocab優先, 無ければbase_meaning。
  const jaHint = new Map();
  for (const [ne, v] of Object.entries(vocab)) if (!jaHint.has(ne)) jaHint.set(ne, v.ja);
  for (const dict of [convVocab, grammarVocab]) {
    for (const [ne, e] of Object.entries(dict)) if (!jaHint.has(ne)) jaHint.set(ne, e.base_meaning);
  }
  const words = [...jaHint.keys()];

  // 2) 日本語メタ(pos/note)ユニーク集合
  const metaSet = new Set();
  for (const dict of [convVocab, grammarVocab]) {
    for (const e of Object.values(dict)) for (const c of (e.contexts || [])) {
      if (c.pos) metaSet.add(c.pos); if (c.note) metaSet.add(c.note);
    }
  }
  const metas = [...metaSet];
  console.log(`ネパール語 ${words.length}語 / 日本語メタ ${metas.length} (model=${MODEL})`);

  let cost = 0;
  // 3) 語の意味を翻訳
  const meaning = new Map();
  for (let i = 0; i < words.length; i += BATCH) {
    const chunk = words.slice(i, i + BATCH).map(ne => ({ ne, ja: jaHint.get(ne) }));
    const { out, cost: c } = await withRetry(() => translateWords(apiKey, chunk));
    chunk.forEach((p, k) => meaning.set(p.ne, out[k]));
    cost += c;
    if ((i / BATCH) % 10 === 0) console.log(`  words ${i + chunk.length}/${words.length} ~$${cost.toFixed(3)}`);
  }
  // 4) メタを翻訳
  const metaEn = new Map();
  for (let i = 0; i < metas.length; i += BATCH) {
    const chunk = metas.slice(i, i + BATCH);
    const { out, cost: c } = await withRetry(() => translateMeta(apiKey, chunk));
    chunk.forEach((s, k) => metaEn.set(s, out[k]));
    cost += c;
    if ((i / BATCH) % 10 === 0) console.log(`  meta ${i + chunk.length}/${metas.length} ~$${cost.toFixed(3)}`);
  }
  const M = (ne) => meaning.get(ne) ?? '';
  const MT = (s) => (s != null && metaEn.has(s) ? metaEn.get(s) : s);

  // 5) 英語辞書を再構築
  const enVocab = {};
  for (const [ne, v] of Object.entries(vocab)) enVocab[ne] = { ja: M(ne), rom: v.rom };
  const rebuild = (dict) => {
    const out = {};
    for (const [ne, e] of Object.entries(dict)) {
      out[ne] = {
        rom: e.rom, base_form: e.base_form, base_meaning: M(ne),
        contexts: (e.contexts || []).map(c => ({
          sentence_id: c.sentence_id,
          ja: M(ne),
          ...(c.pos != null ? { pos: MT(c.pos) } : {}),
          ...(c.note != null ? { note: MT(c.note) } : {}),
        })),
      };
    }
    return out;
  };

  const overlay = JSON.parse(fs.readFileSync(OVERLAY, 'utf8'));
  overlay.vocab = enVocab;
  overlay.convVocab = rebuild(convVocab);
  overlay.grammarVocab = rebuild(grammarVocab);
  fs.writeFileSync(OVERLAY, JSON.stringify(overlay, null, 2));
  console.log(`\n辞書 完了: vocab ${Object.keys(enVocab).length} / convVocab ${Object.keys(overlay.convVocab).length} / grammarVocab ${Object.keys(overlay.grammarVocab).length}`);
  console.log(`コスト ~$${cost.toFixed(3)} (~${Math.ceil(cost * 150)} yen)`);
}
main().catch(e => { console.error('fatal:', e.message); process.exit(1); });
