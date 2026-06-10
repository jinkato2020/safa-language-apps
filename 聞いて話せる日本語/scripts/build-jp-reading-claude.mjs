// App B: 日本語文の「かな読み＋ローマ字」を Claude(Sonnet)で生成。
//  App B はターゲット言語=日本語。全母語UI(bn/ne/en/vi)の会話/文法カードで
//  日本語にふりがな(かな)+ローマ字を表示するための読み補助データ。
//  出力: expo-app/data/jp-reading.json  { "<日本語文>": { "kana":"...", "romaji":"..." } }
//  既存はそのまま、欠落文のみ追加(accumulate)。
//  実行: node scripts/build-jp-reading-claude.mjs            (会話+文法 全件の欠落を補完)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'expo-app/data');
const CONV = path.join(DATA, 'examples.json');
const GRAMMAR = path.join(DATA, 'grammarExamples.json');
const OUT = path.join(DATA, 'jp-reading.json');
const API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const BATCH = 50, MAX_RETRY = 4;
const env = {}; for (const l of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*(VITE_\w+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const apiKey = env.VITE_ANTHROPIC_API_KEY;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function analyzeBatch(sentences) {
  const numbered = sentences.map((s, i) => `${i + 1}: ${s}`).join('\n');
  const prompt = `あなたは日本語学習の専門家です(日本語を学ぶ外国人向けの読み補助)。
以下の日本語の文それぞれについて、次の2つを生成してください。
1) "kana": 全文の読み仮名。基本はひらがな。ただし外来語・固有名詞などカタカナで書く語はカタカナのまま。漢字は文脈に応じた正しい読みにする(例: 今日→きょう)。句読点はそのまま残す。
2) "romaji": ヘボン式ローマ字。単語ごとにスペース区切り。助詞は発音どおり(は→wa, を→o, へ→e)。長音は自然な表記でよい。

【入力文】
${numbered}

【出力フォーマット】厳密にこの形の JSON のみ:
{
  "<入力の日本語文をそのまま>": { "kana": "<読み仮名>", "romaji": "<ローマ字>" }
}
【重要】キーは入力の日本語文を一字一句そのまま。全 ${sentences.length} 文を含める。Markdownのコードフェンス不要。JSON単独で出力。
JSONのみ:`;
  const res = await fetch(API, { method: 'POST', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }) });
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200));
  const d = await res.json();
  const cost = (d.usage.input_tokens * 3 + d.usage.output_tokens * 15) / 1e6;
  const text = (d.content.map(c => c.text || '').join('')).replace(/```json\s*|```\s*$/g, '').trim();
  return { reading: JSON.parse(text), cost };
}
async function withRetry(fn) { let last; for (let i = 1; i <= MAX_RETRY; i++) { try { return await fn(); } catch (e) { last = e; if (i < MAX_RETRY) { console.log('  retry ' + i + ': ' + e.message); await sleep(6000 * i); } } } throw last; }

async function main() {
  const sentences = new Set();
  const conv = JSON.parse(fs.readFileSync(CONV, 'utf8'));
  for (const k of Object.keys(conv)) conv[k].forEach(e => e.jp && sentences.add(e.jp));
  const gr = JSON.parse(fs.readFileSync(GRAMMAR, 'utf8'));
  for (const k of Object.keys(gr)) gr[k].forEach(e => e.jp && sentences.add(e.jp));

  const merged = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const missing = [...sentences].filter(s => !merged[s] || !merged[s].kana || !merged[s].romaji);
  console.log(`全 ${sentences.size} 文 / 既存 ${Object.keys(merged).length} / 欠落 ${missing.length} 文を補完 (model=${MODEL})`);
  if (!missing.length) { console.log('欠落なし。終了。'); return; }

  let totalCost = 0, added = 0;
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    let r;
    try { r = await withRetry(() => analyzeBatch(batch)); }
    catch (e) { console.log(`  [skip] batch@${i} 失敗: ${e.message}`); continue; }
    totalCost += r.cost;
    for (const [jp, val] of Object.entries(r.reading)) {
      if (val && val.kana && val.romaji) { merged[jp] = { kana: val.kana, romaji: val.romaji }; added++; }
    }
    fs.writeFileSync(OUT, JSON.stringify(merged, null, 2));
    console.log(`  ${Math.min(i + BATCH, missing.length)}/${missing.length} 追加計${added} ~$${totalCost.toFixed(3)}`);
  }
  console.log(`\n完了: 追加 ${added} / 総数 ${Object.keys(merged).length} 文 / ~$${totalCost.toFixed(3)} (約${Math.ceil(totalCost * 150)}円)`);
}
main().catch(e => { console.error('致命的:', e.message); process.exit(1); });
