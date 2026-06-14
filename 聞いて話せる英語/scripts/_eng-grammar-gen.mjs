// 英語アプリ 文法例文を Opus で生成。各テーマ exampleCount 文、易→難に並べる。{en, ja}。
//  出力: scripts/_eng_grammar.json { "<themeId>": [{en, ja}, ...] }。再開可能。
//  APIキーは App B の .env から取得(英語アプリには .env 無し)。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const env = {}; for (const l of fs.readFileSync(path.join(REPO, '聞いて話せる日本語/.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const KEY = env.VITE_ANTHROPIC_API_KEY;
const themes = JSON.parse(fs.readFileSync(path.join(ROOT, 'expo-app/data/grammarThemes.json'), 'utf8'));
const outPath = path.join(ROOT, 'scripts/_eng_grammar.json');
const out = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
let inTok = 0, outTok = 0;
async function gen(name, n) {
  const prompt = `あなたは日本人学習者向け英語教材の作成者です。英文法項目「${name}」を学ぶための英語例文を【ちょうど${n}文】作成してください。
【難易度】易→難の順に並べる。前半は最も単純な形、中盤は疑問文・否定文・語順変化、後半は複文や実際の会話での自然な使用。文が進むほど難しく。
【質】自然で実用的な英語。各文に文法項目「${name}」が明確に現れること。文どうしで語彙・構文・場面が重複しないよう多様に。固有名詞や数値は自然に。
【訳】各英文に自然な日本語訳を付ける。
出力はJSONのみ: {"items":[{"en":"English sentence.","ja":"日本語訳。"}, ...]} ちょうど${n}件。`;
  for (let a = 1; a <= 5; a++) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 5000, messages: [{ role: 'user', content: prompt }] }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(); if (j.usage) { inTok += j.usage.input_tokens; outTok += j.usage.output_tokens; }
      const arr = JSON.parse(j.content.map(c => c.text || '').join('').match(/\{[\s\S]*\}/)[0]).items;
      if (!Array.isArray(arr) || arr.length < n) throw new Error('len ' + (arr?.length));
      return arr.slice(0, n);
    } catch (e) { if (a < 5) await sleep(4000 * a); else throw e; }
  }
}
let done = 0;
for (const t of themes) {
  const id = String(t.id);
  if (out[id] && out[id].length === t.exampleCount) { done++; continue; }
  out[id] = await gen(t.name, t.exampleCount);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  done++; process.stdout.write(`\r文法生成 ${done}/${themes.length} (${t.name} ${out[id].length}文)        `);
}
const cost = (inTok * 15 + outTok * 75) / 1e6;
console.log(`\n文法例文 完了: ${themes.length}テーマ / 計${Object.values(out).reduce((a, v) => a + v.length, 0)}文 / ~$${cost.toFixed(2)}`);
