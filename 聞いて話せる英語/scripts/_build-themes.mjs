// 聞いて話せる英語: 会話テーマ(App Bベース, 23/25改名)と文法テーマ(英語文法30, 問題数可変)を生成。
//  + i18n ja.json の themes/grammarThemes を同期。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');       // 聞いて話せる英語
const REPO = path.resolve(ROOT, '..');
const ENG = path.join(ROOT, 'expo-app');
const APPB = path.join(REPO, '聞いて話せる日本語/expo-app');

// 1) 会話テーマ: App Bの順序・idを踏襲し、23/25のみ改名(英語学習者向け)
const conv = JSON.parse(fs.readFileSync(path.join(APPB, 'data/themes.json'), 'utf8'));
for (const t of conv) {
  if (t.id === 23) t.name = '家・住まい';            // 旧「家・住まい・ごみ捨て」(日本固有のごみ分別を外す)
  if (t.id === 25) t.name = '手続き・公共サービス';   // 旧「役所と手続き」(海外での銀行/郵便/ビザ等)
}
fs.writeFileSync(path.join(ENG, 'data/themes.json'), JSON.stringify(conv, null, 2));

// 2) 文法テーマ: 英語文法30(難易度順) + 問題数(軽12/標準20/多30)
const GNAMES = {
  1: 'be動詞（現在）', 2: '一般動詞（現在）', 3: '三人称単数現在（三単現）', 4: '名詞の複数形・冠詞（a/an/the）',
  5: '代名詞（主格・目的格・所有格）', 6: '指示詞（this/that/these/those）', 7: '疑問詞（what/who/where/when/why/how）',
  8: '形容詞・副詞', 9: '現在進行形', 10: '過去形（be動詞・一般動詞）', 11: '過去進行形',
  12: '未来表現（will / be going to）', 13: '助動詞①（can / could）', 14: '助動詞②（must / have to / should）',
  15: '助動詞③（may / might / would）', 16: '命令文・感嘆文', 17: 'There is / There are（存在）',
  18: '前置詞（場所・時間・方向）', 19: '比較級・最上級', 20: '不定詞（to + 動詞）', 21: '動名詞（-ing）',
  22: '現在完了（経験・完了・継続）', 23: '過去完了', 24: '受動態（受け身）',
  25: '接続詞（and/but/or・because/when/if）', 26: '関係代名詞（who/which/that）', 27: '関係副詞・関係詞の応用',
  28: '仮定法（if I were… / I wish…）', 29: '分詞（修飾・分詞構文の基礎）', 30: '間接話法・時制の一致',
};
const LIGHT = new Set([3, 4, 5, 6, 16, 17]);            // 12問
const HEAVY = new Set([18, 19, 20, 22, 24, 26, 27, 28, 29, 30]); // 30問
const grammar = [];
for (let id = 1; id <= 30; id++) {
  const exampleCount = LIGHT.has(id) ? 12 : HEAVY.has(id) ? 30 : 20;
  grammar.push({ id, name: GNAMES[id], exampleCount });
}
fs.writeFileSync(path.join(ENG, 'data/grammarThemes.json'), JSON.stringify(grammar, null, 2));

// 3) i18n ja.json の themes/grammarThemes を同期(UI=日本語)
const jaPath = path.join(ENG, 'src/i18n/ja.json');
const ja = JSON.parse(fs.readFileSync(jaPath, 'utf8'));
ja.themes = Object.fromEntries(conv.map(t => [String(t.id), t.name]));
ja.grammarThemes = Object.fromEntries(grammar.map(g => [String(g.id), g.name]));
fs.writeFileSync(jaPath, JSON.stringify(ja, null, 2));

const total = grammar.reduce((a, g) => a + g.exampleCount, 0);
console.log(`会話テーマ ${conv.length} / 文法テーマ ${grammar.length} (問題総数 ${total})`);
console.log('軽12:', grammar.filter(g => g.exampleCount === 12).length, '標準20:', grammar.filter(g => g.exampleCount === 20).length, '多30:', grammar.filter(g => g.exampleCount === 30).length);
