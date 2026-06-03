// App B の会話 文脈辞書(ネパール語)を、指定テーマ(13/25/29/30)だけ再生成し
// conv-vocab-context.json に統合(該当 sentence_id の旧コンテキストを置換)。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV = path.join(ROOT, '.env');
const EXAMPLES = path.join(ROOT, 'expo-app/data/examples.json');
const OUT = path.join(ROOT, 'expo-app/data/conv-vocab-context.json');
const MODEL = 'claude-sonnet-4-6';
const BATCH = 10;
const THEMES = [13, 25, 29, 30];

function key() { for (const l of fs.readFileSync(ENV, 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*VITE_ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/); if (m) return m[1].replace(/^["']|["']$/g, ''); } throw new Error('keyなし'); }
const apiKey = key();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function analyze(t, l, exs, start) {
  const numbered = exs.map((e, i) => `${t}-${l}-${start + i + 1}: ${e.ne} (${e.jp})`).join('\n');
  const prompt = `あなたはネパール語学習辞書の専門家です。以下のネパール語例文(括弧内は日本語)を解析し、各文のすべての内容語を抽出して文脈依存の訳語と解説をJSONで出力。
${numbered}
【JSON】{"<ネパール語単語>":{"rom":"<ローマ字>","base_form":"<基本形>","base_meaning":"<基本意味(日本語)>","contexts":[{"sentence_id":"${t}-${l}-${start + 1}","ja":"<文脈での日本語訳>","pos":"<品詞>","note":"<短い解説(任意)>"}]}}
助詞も含める。同じ単語は contexts に複数。ローマ字は ṁ/ñ を避ける。JSON単独で出力。`;
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: MODEL, max_tokens: 20000, messages: [{ role: 'user', content: prompt }] }) });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const d = await res.json();
  const cost = (d.usage?.input_tokens ?? 0) * 3 / 1e6 + (d.usage?.output_tokens ?? 0) * 15 / 1e6;
  return { vocab: JSON.parse((d.content?.map(c => c.text || '').join('') || '').replace(/```json\s*|```\s*$/g, '').trim()), cost };
}
async function withRetry(fn) { let e; for (let i = 1; i <= 4; i++) { try { return await fn(); } catch (x) { e = x; console.log(`  失敗(${i}/4): ${x.message}`); if (i < 4) await sleep(8000 * i); } } throw e; }
function mergeVocab(dst, src) { for (const [w, info] of Object.entries(src)) { if (!dst[w]) dst[w] = { ...info, contexts: [...(info.contexts || [])] }; else { dst[w].contexts = [...(dst[w].contexts || []), ...(info.contexts || [])]; for (const k of ['rom', 'base_form', 'base_meaning']) if (!dst[w][k] && info[k]) dst[w][k] = info[k]; } } }

const examples = JSON.parse(fs.readFileSync(EXAMPLES, 'utf8'));
const merged = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
let total = 0;
for (const t of THEMES) {
  for (let l = 1; l <= 3; l++) {
    const exs = examples[`${t}-${l}`] || []; if (!exs.length) continue;
    const prefix = `${t}-${l}-`;
    // 旧コンテキスト削除
    for (const w of Object.keys(merged)) { if (Array.isArray(merged[w].contexts)) merged[w].contexts = merged[w].contexts.filter(c => !String(c.sentence_id).startsWith(prefix)); }
    console.log(`[テーマ${t}-${l}] ${exs.length}文`);
    const group = {};
    for (let s = 0; s < exs.length; s += BATCH) { const r = await withRetry(() => analyze(t, l, exs.slice(s, s + BATCH), s)); mergeVocab(group, r.vocab); total += r.cost; }
    mergeVocab(merged, group);
  }
  // 空になった語を削除
  for (const w of Object.keys(merged)) if (!merged[w].contexts || merged[w].contexts.length === 0) delete merged[w];
  fs.writeFileSync(OUT, JSON.stringify(merged, null, 2));
}
console.log(`\n保存。総単語 ${Object.keys(merged).length} / コスト ~$${total.toFixed(4)} (約${Math.ceil(total * 150)}円)`);
