// 英語アプリ辞書(GPT-4o): 英文を単語分解し日本語語釈を付与(学習対象=英語/母語=日本語)。
//  会話 examples.json(.en) + 文法 grammarExamples.json(.en)。id: 会話=T-L-i / 文法=g-T-i。
//  出力 raw: scripts/_gpt4o_eng.json {id:[{word,base,meaning,pos,note}]}。再開可・並列。OPENAI_API_KEY は App B .env。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const env = {}; for (const l of fs.readFileSync(path.join(REPO, '聞いて話せる日本語/.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const KEY = env.OPENAI_API_KEY;
const ex = JSON.parse(fs.readFileSync(path.join(ROOT, 'expo-app/data/examples.json'), 'utf8'));
const gr = JSON.parse(fs.readFileSync(path.join(ROOT, 'expo-app/data/grammarExamples.json'), 'utf8'));
const items = [];
for (const k of Object.keys(ex)) ex[k].forEach((e, i) => items.push({ id: `${k}-${i + 1}`, en: e.en }));
for (const k of Object.keys(gr)) gr[k].forEach((e, i) => items.push({ id: `g-${k}-${i + 1}`, en: e.en }));
const outPath = path.join(ROOT, 'scripts/_gpt4o_eng.json');
const out = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
const todo = items.filter(it => !out[it.id]);
console.log(`英語辞書GPT-4o: 全${items.length} / 残${todo.length}`);

const sys = `You are an English tokenizer and English→Japanese lexicographer for a learning app (Japanese learners of English).
For each sentence, split it into a left-to-right token sequence covering EVERY word (content and function words):
- Keep contractions whole (I'm, don't, it's, we'll). Each punctuation mark (. , ? ! " ' : ; -) is its OWN token with meaning "".
- Split possessives naturally; keep multiword proper nouns as one token when natural (New York).
Fields per token: "word"(English surface exactly as in the sentence) / "base"(lemma 原形, e.g. went→go, books→book, better→good; same as word if none) / "meaning"(Japanese gloss, concise, context-correct; NEVER empty for non-punctuation) / "pos"(Japanese 品詞: 名詞/動詞/形容詞/副詞/前置詞/冠詞/代名詞/接続詞/助動詞/間投詞 等) / "note"(Japanese short note or "").
For function words (a, the, of, to, is, are, do, will, can...) give a short Japanese functional gloss + note (冠詞/前置詞/be動詞/助動詞 等).
Output ONLY JSON: {"sentences":[{"id":"...","words":[{"word":"","base":"","meaning":"","pos":"","note":""}]}]}`;

const sleep = ms => new Promise(r => setTimeout(r, ms));
let inTok = 0, outTok = 0;
async function call(batch) {
  const body = { model: 'gpt-4o', temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: 'Sentences:\n' + batch.map(s => s.id + ': ' + s.en).join('\n') }] };
  for (let a = 1; a <= 6; a++) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (r.status === 429) { await sleep(5000 * a); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 150));
      const j = await r.json(); if (j.usage) { inTok += j.usage.prompt_tokens || 0; outTok += j.usage.completion_tokens || 0; }
      return JSON.parse(j.choices[0].message.content).sentences || [];
    } catch (e) { if (a < 6) await sleep(3000 * a); else throw e; }
  }
}
const BATCH = 15;
const batches = []; for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
let done = items.length - todo.length, bi = 0;
async function worker() {
  while (bi < batches.length) {
    const grp = batches[bi++];
    try {
      const res = await call(grp);
      const byId = Object.fromEntries(res.map(s => [s.id, s]));
      for (const it of grp) if (byId[it.id]) out[it.id] = byId[it.id].words;
      fs.writeFileSync(outPath, JSON.stringify(out));
    } catch (e) { console.error('\nbatch fail', grp[0].id, e.message); }
    done += grp.length;
    process.stdout.write(`\r英語辞書: ${done}/${items.length}`);
  }
}
await Promise.all(Array.from({ length: 3 }, () => worker()));
const cost = (inTok * 2.5 + outTok * 10) / 1e6;
console.log(`\n英語辞書GPT-4o 完了: ${Object.keys(out).length}/${items.length} / ~$${cost.toFixed(2)}`);
