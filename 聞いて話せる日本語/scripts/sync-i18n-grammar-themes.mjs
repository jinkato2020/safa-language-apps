// 新しい grammarThemes.json の名称順を i18n の ja.json / ne.json に同期する。
// 旧テーマで残るものは旧 Nepali 訳をキャリーオーバー、
// 新規追加 5 テーマは新たに作成した翻訳を当てる。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const GRAMMAR_THEMES_JSON = path.join(ROOT, 'expo-app', 'data', 'grammarThemes.json');
const JA_JSON = path.join(ROOT, 'expo-app', 'src', 'i18n', 'ja.json');
const NE_JSON = path.join(ROOT, 'expo-app', 'src', 'i18n', 'ne.json');

// 新シート ID → 旧 ja 名（旧 ne.json から訳を引き当てるため）
// 旧 ja 名は ja.json grammarThemes に保存されていた値
const NEW_TO_OLD_JA = {
  1: '現在形（肯定文）',
  2: '現在形（否定文）',
  3: '過去形（肯定文）',
  4: '過去形（否定文）',
  5: '未来形',
  6: '疑問文',
  7: '依頼文',
  10: '感嘆文',           // 旧 8
  11: '〜している（進行形）', // 旧 11
  13: '形容詞の使い方',    // 旧 25
  14: '副詞の使い方',      // 旧 26
  15: '〜したい（願望表現）',// 旧 9
  16: '〜できる（可能表現）',// 旧 10
  17: '〜しなければならない（義務）', // 旧 12
  18: '〜してもいい（許可）',// 旧 13
  19: '〜と思う（推量・意見）', // 旧 15
  21: '〜したことがある（経験）', // 旧 14
  22: '比較表現',          // 旧 22
  23: '接続詞',            // 旧 17
  24: '〜ながら（同時動作）', // 旧 18
  25: '〜てから（順序）',  // 旧 19
  26: '〜ために（目的）',  // 旧 20
  27: '条件文（もし〜なら）', // 旧 21
  28: '受動表現',          // 旧 16
  30: '間接話法',          // 旧 23
};

// 新規 5 テーマの Nepali 翻訳
const NEW_NE = {
  8:  'आज्ञार्थक (〜गर्नुहोस्)',
  9:  'निषेधवाचक (〜गर्नुहुँदैन)',
  12: '〜हुनु (अवस्था परिवर्तन)',
  20: '〜हुनसक्छ (सम्भावना)',
  29: 'प्रेरणार्थक (〜लगाउनु)',
};

function main() {
  const themes = JSON.parse(fs.readFileSync(GRAMMAR_THEMES_JSON, 'utf8'));
  const ja = JSON.parse(fs.readFileSync(JA_JSON, 'utf8'));
  const ne = JSON.parse(fs.readFileSync(NE_JSON, 'utf8'));

  // 旧 ja → 旧 Nepali のマップを作成
  const oldJaToNe = {};
  for (const [idStr, jaName] of Object.entries(ja.grammarThemes || {})) {
    const neName = (ne.grammarThemes || {})[idStr];
    if (jaName && neName) oldJaToNe[jaName] = neName;
  }

  // 新 grammarThemes を構築
  const newJa = {};
  const newNe = {};
  for (const theme of themes) {
    const id = String(theme.id);
    newJa[id] = theme.name;  // ja.json は xlsx そのまま

    if (NEW_NE[theme.id]) {
      newNe[id] = NEW_NE[theme.id];
    } else if (NEW_TO_OLD_JA[theme.id]) {
      const oldName = NEW_TO_OLD_JA[theme.id];
      const carried = oldJaToNe[oldName];
      newNe[id] = carried || theme.name;  // 旧 ne がなければ ja のまま
    } else {
      newNe[id] = theme.name;  // フォールバック
    }
  }

  ja.grammarThemes = newJa;
  ne.grammarThemes = newNe;

  fs.writeFileSync(JA_JSON, JSON.stringify(ja, null, 2) + '\n', 'utf8');
  fs.writeFileSync(NE_JSON, JSON.stringify(ne, null, 2) + '\n', 'utf8');

  console.log('更新: ja.json grammarThemes (30 件)');
  console.log('更新: ne.json grammarThemes (30 件)');
  console.log('');
  console.log('新並び:');
  for (const theme of themes) {
    const id = String(theme.id);
    const isNew = NEW_NE[theme.id] ? ' [NEW]' : '';
    console.log(`  ${id.padStart(2, '0')}. ${newJa[id]} / ${newNe[id]}${isNew}`);
  }
}

main();
