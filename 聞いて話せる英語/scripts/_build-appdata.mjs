// 英語アプリのデータファイルをステージングから生成。en=学習対象コア / ja=母語L1。全同梱。
//  examples.json: {"T-L":[{en,ja}]}  grammarExamples.json: {"T":[{en,ja}]}
//  levels.json は App B から流用。words系/読みは当面空(後でwords/辞書/音声を追加)。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const DATA = path.join(ROOT, 'expo-app/data');
const APPB = path.join(REPO, '聞いて話せる日本語/expo-app');
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const wr = (f, o) => fs.writeFileSync(path.join(DATA, f), JSON.stringify(o, null, 2));

const conv = rd(path.join(ROOT, 'scripts/_eng_conv.json'));   // {"T-L":[{en,ja}]}
wr('examples.json', conv);
const gram = rd(path.join(ROOT, 'scripts/_eng_grammar.json')); // {"T":[{en,ja}]}
wr('grammarExamples.json', gram);
wr('levels.json', rd(path.join(APPB, 'data/levels.json')));
wr('wordCategories.json', []);
wr('words.json', {});
wr('words-reading.json', {});
wr('jp-reading.json', {});

const cc = Object.values(conv).reduce((a, v) => a + v.length, 0);
const gc = Object.values(gram).reduce((a, v) => a + v.length, 0);
console.log(`examples.json: ${Object.keys(conv).length}キー/${cc}文 / grammarExamples: ${Object.keys(gram).length}テーマ/${gc}文`);
console.log('sample 5-1[0]:', JSON.stringify(conv['5-1'][0]));
