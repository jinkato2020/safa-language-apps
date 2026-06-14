// 英語アプリ 単語モード用の語彙を Opus で生成。
//  各カテゴリ wordCount 語の英単語 + 日本語語釈。{en, ja}。
//  出力: scripts/_eng_words.json { "<catId>": [{en, ja}, ...] }。再開可能。
//  APIキーは App B の .env から取得。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const env = {}; for (const l of fs.readFileSync(path.join(REPO, '聞いて話せる日本語/.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const KEY = env.VITE_ANTHROPIC_API_KEY;
const cats = JSON.parse(fs.readFileSync(path.join(ROOT, 'expo-app/data/wordCategories.json'), 'utf8'));
const outPath = path.join(ROOT, 'scripts/_eng_words.json');
const out = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
let inTok = 0, outTok = 0;

async function gen(name, n) {
  const prompt = `あなたは日本人学習者向け英語教材の語彙作成者です。カテゴリ「${name}」に属する、実用的で頻出の英単語を【ちょうど${n}語】挙げてください。
【質】そのカテゴリの代表的な語を、易しい順を意識しつつ網羅的に。固有名詞は避け、一般的な語。重複や同義の言い換えは避ける。語は基本形(原形・単数)で。
【訳】各英単語に簡潔で自然な日本語語釈を1つ付ける(必要なら品詞が分かる程度に短く)。
出力はJSONのみ: {"items":[{"en":"word","ja":"日本語語釈"}, ...]} ちょうど${n}件。`;
  for (let a = 1; a <= 5; a++) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(); if (j.usage) { inTok += j.usage.input_tokens; outTok += j.usage.output_tokens; }
      const arr = JSON.parse(j.content.map(c => c.text || '').join('').match(/\{[\s\S]*\}/)[0]).items;
      if (!Array.isArray(arr) || arr.length < n) throw new Error('len ' + (arr?.length));
      return arr.slice(0, n);
    } catch (e) { if (a < 5) await sleep(4000 * a); else throw e; }
  }
}
let done = 0;
for (const c of cats) {
  const id = String(c.id);
  if (out[id] && out[id].length === c.wordCount) { done++; continue; }
  out[id] = await gen(c.name, c.wordCount);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  done++; process.stdout.write(`\r単語生成 ${done}/${cats.length} (${c.name} ${out[id].length}語)            `);
}
const cost = (inTok * 15 + outTok * 75) / 1e6;
console.log(`\n単語 完了: ${cats.length}カテゴリ / 計${Object.values(out).reduce((a, v) => a + v.length, 0)}語 / ~$${cost.toFixed(2)}`);
