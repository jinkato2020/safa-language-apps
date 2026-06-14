// _eng_words.json {catId:[{en,ja}]} を words.json {catId:[{ja:英語, ne:日本語}]} に変換。
//  ja フィールド=コア(英語) / ne フィールド=L1(日本語) ※スロットモデルに合わせる。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/_eng_words.json'), 'utf8'));
const cats = JSON.parse(fs.readFileSync(path.join(ROOT, 'expo-app/data/wordCategories.json'), 'utf8'));
const out = {};
let total = 0, warn = 0;
for (const c of cats) {
  const id = String(c.id);
  const arr = src[id] || [];
  if (arr.length !== c.wordCount) { console.warn(`⚠ cat ${id} (${c.name}): ${arr.length} != ${c.wordCount}`); warn++; }
  out[id] = arr.map(w => ({ ja: w.en, ne: w.ja }));   // ja=英語(コア) / ne=日本語(L1)
  total += out[id].length;
}
fs.writeFileSync(path.join(ROOT, 'expo-app/data/words.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`words.json 構築: ${cats.length}カテゴリ / 計${total}語 / 警告${warn}`);
