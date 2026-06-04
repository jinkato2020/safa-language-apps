// App A 日本語(ja)オーバーレイを既存同梱データから抽出して overlays/ja.json を生成。
// (App A を全DL化: ne=コア同梱, ja/en=DLパック)。翻訳は不要(既存のjp側をそのまま)。
// 音声は別途 assets/audio/japanese(-grammar) を packs-nepali/audio/ja/ にコピー。
// 実行: node scripts/build-ja-overlay.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'expo-app', 'data');
const OUT = path.join(DATA, 'overlays', 'ja.json');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));

const examples = read('examples.json');          // { "T-L": [{jp, ne}] }
const grammar = read('grammarExamples.json');     // { "T": [{jp, ne}] }
const words = read('words.json');                 // { "cat": [{ja, ne}] }
const vocab = read('vocab.json');                 // { ne: {ja, rom} }
const convVocab = read('conv-vocab-context.json');
const grammarVocab = read('grammar-vocab-context.json');

const pickJp = (m) => Object.fromEntries(Object.entries(m).map(([k, a]) => [k, a.map((e) => e.jp)]));
const pickWordJa = (m) => Object.fromEntries(Object.entries(m).map(([k, a]) => [k, a.map((w) => w.ja)]));

const overlay = {
  l1: 'ja',
  version: 1,
  examplesL1: pickJp(examples),
  grammarL1: pickJp(grammar),
  wordsL1: pickWordJa(words),
  vocab,            // {ne: {ja, rom}} そのまま
  convVocab,        // 日本語の意味/品詞/注記 そのまま
  grammarVocab,
};

fs.writeFileSync(OUT, JSON.stringify(overlay, null, 2));
const ex = Object.values(overlay.examplesL1).reduce((s, a) => s + a.length, 0);
const gr = Object.values(overlay.grammarL1).reduce((s, a) => s + a.length, 0);
console.log(`ja.json: examplesL1 ${Object.keys(overlay.examplesL1).length}キー/${ex}文, grammarL1 ${gr}文, vocab ${Object.keys(vocab).length}, convVocab ${Object.keys(convVocab).length}, grammarVocab ${Object.keys(grammarVocab).length}`);
console.log(`サイズ: ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
