// GPT-4o生raw(_gpt4o_eng.json)を convVocab/grammarVocab へ集約 → expo-app/data/dict.json。
//  会話id=T-L-i→convVocab / 文法id=g-T-i→g除去しT-i→grammarVocab。句読点/空意味は除外。英単語surfaceキー。
//  PracticeScreen Path A(vocabTokenize:'jp') が ex.jp(=英文) 内の出現位置で並べるので surface キーで良い。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/_gpt4o_eng.json'), 'utf8'));
const isPunct = w => /^[\s.,!?;:"'()\[\]\-…—–]+$/.test(w);
const conv = {}, gram = {};
let skipped = 0;
for (const [id, words] of Object.entries(raw)) {
  const isG = id.startsWith('g-');
  const sid = isG ? id.slice(2) : id;
  const dict = isG ? gram : conv;
  for (const w of (words || [])) {
    const word = w.word;
    if (!word || isPunct(word) || !w.meaning) { if (word && !isPunct(word) && !w.meaning) skipped++; continue; }
    if (!dict[word]) dict[word] = { rom: '', base_form: w.base || word, base_meaning: w.meaning, contexts: [] };
    const ctx = { sentence_id: sid, ja: w.meaning, pos: w.pos || '' };
    if (w.note) ctx.note = w.note;
    dict[word].contexts.push(ctx);
  }
}
fs.writeFileSync(path.join(ROOT, 'expo-app/data/dict.json'), JSON.stringify({ convVocab: conv, grammarVocab: gram }, null, 2));
const cvc = Object.values(conv).reduce((a, v) => a + v.contexts.length, 0);
const gvc = Object.values(gram).reduce((a, v) => a + v.contexts.length, 0);
console.log(`集約完了: convVocab ${Object.keys(conv).length}語/${cvc}文脈 / grammarVocab ${Object.keys(gram).length}語/${gvc}文脈 (空意味除外${skipped})`);
console.log('→ expo-app/data/dict.json');
