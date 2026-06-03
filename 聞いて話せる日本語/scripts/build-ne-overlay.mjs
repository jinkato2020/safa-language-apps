// ne(ネパール語) を DL パック化するため、既存の同梱データから
// expo-app/data/overlays/ne.json を生成する (bn.json と同形式)。
// 音声は別途 packs/audio/ne/ にコピー (build-ne-overlay とは別)。
// 実行: node scripts/build-ne-overlay.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'expo-app', 'data');
const OUT = path.join(DATA, 'overlays', 'ne.json');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));

const examples = read('examples.json');         // { "T-L": [{jp,ne}] }
const grammar = read('grammarExamples.json');    // { "T": [{jp,ne}] }
const words = read('words.json');                // { "cat": [{ja,ne}] }
const vocab = read('vocab.json');                // 単語辞書
const convVocab = read('conv-vocab-context.json');
const grammarVocab = read('grammar-vocab-context.json');

const pickNe = (m) => Object.fromEntries(Object.entries(m).map(([k, a]) => [k, a.map((e) => e.ne)]));
const pickWordNe = (m) => Object.fromEntries(Object.entries(m).map(([k, a]) => [k, a.map((w) => w.ne)]));

const overlay = {
  l1: 'ne',
  version: 1,
  examplesL1: pickNe(examples),
  grammarL1: pickNe(grammar),
  wordsL1: pickWordNe(words),
  vocab,
  convVocab,
  grammarVocab,
};

fs.writeFileSync(OUT, JSON.stringify(overlay, null, 2));
const ex = Object.values(overlay.examplesL1).reduce((s, a) => s + a.length, 0);
const gr = Object.values(overlay.grammarL1).reduce((s, a) => s + a.length, 0);
console.log(`ne.json: examplesL1 ${Object.keys(overlay.examplesL1).length}キー/${ex}文, grammarL1 ${Object.keys(overlay.grammarL1).length}キー/${gr}文, vocab ${Object.keys(vocab).length}, convVocab ${Object.keys(convVocab).length}, grammarVocab ${Object.keys(grammarVocab).length}`);
console.log(`サイズ: ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
