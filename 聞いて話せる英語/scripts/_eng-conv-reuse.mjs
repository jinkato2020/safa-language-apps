// 会話例文の流用ベース: App B の英語(overlays/en.json examplesL1)=学習対象 + 日本語(examples.json.jp)=母語 を
//  英語アプリの会話ステージングへ。keyed "T-L" -> [{en, ja}] (3レベル×20)。ローカライズ対象テーマは後段で上書き。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const APPB = path.join(REPO, '聞いて話せる日本語/expo-app');
const ex = JSON.parse(fs.readFileSync(path.join(APPB, 'data/examples.json'), 'utf8'));        // {T-L:[{jp,ne}]}
const en = JSON.parse(fs.readFileSync(path.join(APPB, 'data/overlays/en.json'), 'utf8')).examplesL1; // {T-L:[en...]}
const out = {};
let pairs = 0, miss = 0;
for (let T = 1; T <= 30; T++) for (let L = 1; L <= 3; L++) {
  const k = `${T}-${L}`;
  const jpArr = (ex[k] || []).map(e => e.jp);
  const enArr = en[k] || [];
  const n = Math.max(jpArr.length, enArr.length);
  const arr = [];
  for (let i = 0; i < n; i++) {
    const e = enArr[i] || '', j = jpArr[i] || '';
    if (!e || !j) miss++;
    arr.push({ en: e, ja: j });
  }
  out[k] = arr; pairs += arr.length;
}
fs.writeFileSync(path.join(ROOT, 'scripts/_eng_conv.json'), JSON.stringify(out, null, 2));
console.log(`会話流用ベース作成: ${Object.keys(out).length}キー / ${pairs}文 (欠損ペア ${miss})`);
console.log('サンプル 5-1[0]:', JSON.stringify(out['5-1'][0]));
console.log('サンプル 1-1[0]:', JSON.stringify(out['1-1'][0]));
