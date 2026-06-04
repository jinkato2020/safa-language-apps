// _appa_localized.json の新jp/ne/en を実データへ適用。
// examples.json/grammarExamples.json の jp,ne を更新、overlays/en.json の en を更新。
// 実行: node scripts/apply-appa.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'expo-app/data');
const res = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/_appa_localized.json'), 'utf8'));

const exP = path.join(DATA, 'examples.json');
const grP = path.join(DATA, 'grammarExamples.json');
const enP = path.join(DATA, 'overlays/en.json');
const ex = JSON.parse(fs.readFileSync(exP, 'utf8'));
const gr = JSON.parse(fs.readFileSync(grP, 'utf8'));
const en = JSON.parse(fs.readFileSync(enP, 'utf8'));

let n = 0;
for (const [id, v] of Object.entries(res)) {
  const i = v.idx - 1;
  if (v.src === 'conv') {
    ex[v.key][i] = { jp: v.jp, ne: v.ne };
    en.examplesL1[v.key][i] = v.en;
  } else {
    gr[v.key][i] = { jp: v.jp, ne: v.ne };
    en.grammarL1[v.key][i] = v.en;
  }
  n++;
}
en.version = 2; // パック再DL用に版上げ
fs.writeFileSync(exP, JSON.stringify(ex, null, 2));
fs.writeFileSync(grP, JSON.stringify(gr, null, 2));
fs.writeFileSync(enP, JSON.stringify(en, null, 2));
console.log(`適用 ${n}文 (examples/grammar jp+ne, overlays/en.json en, en.version=2)`);
