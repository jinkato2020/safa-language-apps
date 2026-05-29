// 既存の Excel/JSON データから Expo アプリ用の JSON ファイルと
// 音声ファイルを書き出す。
//
// 出力:
//   expo-app/data/themes.json           — 30テーマのメタ情報
//   expo-app/data/examples.json         — 無料枠の例題 (テーマ1-5 × 初級)
//   expo-app/data/wordCategories.json   — 30カテゴリのメタ
//   expo-app/data/words.json            — 無料枠の単語 (カテゴリ1-5)
//   expo-app/data/audioMap.ts           — 音声ファイルの require マップ
//   expo-app/assets/audio/nepali/*.mp3  — 無料枠のネパール語音声
//   expo-app/assets/audio/japanese/*.mp3 — 無料枠の日本語音声
//
// 実行: npm run export-to-expo

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXPO_ROOT = path.join(PROJECT_ROOT, 'expo-app');
const SENTENCES_XLSX = path.join(PROJECT_ROOT, '瞬間作文.xlsx');
const WORDS_XLSX = path.join(PROJECT_ROOT, '単語.xlsx');
const GRAMMAR_XLSX = path.join(PROJECT_ROOT, '文法.xlsx');
const NEPALI_AUDIO_SRC = path.join(PROJECT_ROOT, 'nepali');
const JAPANESE_AUDIO_SRC = path.join(PROJECT_ROOT, 'japanese');
const NEPALI_GRAMMAR_SRC = path.join(PROJECT_ROOT, 'nepali-grammar');
const JAPANESE_GRAMMAR_SRC = path.join(PROJECT_ROOT, 'japanese-grammar');

const OUT_DATA = path.join(EXPO_ROOT, 'data');
const OUT_AUDIO_NE = path.join(EXPO_ROOT, 'assets', 'audio', 'nepali');
const OUT_AUDIO_JA = path.join(EXPO_ROOT, 'assets', 'audio', 'japanese');
const OUT_AUDIO_NE_GRAMMAR = path.join(EXPO_ROOT, 'assets', 'audio', 'nepali-grammar');
const OUT_AUDIO_JA_GRAMMAR = path.join(EXPO_ROOT, 'assets', 'audio', 'japanese-grammar');

// 全テーマをエクスポート（アプリ側でロック判定は行わず、全てフリー）
const ALL_IDS = Array.from({ length: 30 }, (_, i) => i + 1);
const FREE_THEMES = ALL_IDS;          // 全30テーマ
const FREE_LEVELS = [1, 2, 3];        // 初級・中級・上級 すべて
const FREE_WORD_CATEGORIES = ALL_IDS; // 全30カテゴリ
const FREE_GRAMMAR_THEMES = ALL_IDS;  // 全30文法テーマ

const THEME_NAMES = [
  '自己紹介','挨拶と礼儀','家族','数字と時間','食べ物と飲み物','買い物','交通と道案内','天気','仕事と職業','趣味と余暇',
  '体と健康','感情と気持ち','学校と勉強','旅行と観光','ホテルと宿泊','レストランと注文','電話と連絡','色と形','動物と自然','スポーツ',
  '音楽と芸術','服と買い物','家と住まい','友達と人間関係','お祝いと行事','緊急と安全','お金と銀行','インターネットとIT','宗教と文化','ネパールの生活'
];

const LEVELS = [
  { id: 1, name: '初級', desc: '基本的な単語と短い文。実用的な日常表現。' },
  { id: 2, name: '中級', desc: '複文や接続詞を含む。会話と説明文。' },
  { id: 3, name: '上級', desc: '抽象的な内容や慣用表現。複雑な文法構造。' },
];

function getCellText(cell) {
  if (cell == null || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (v.richText) return v.richText.map(r => r.text).join('').trim();
  if (v.text) return String(v.text).trim();
  return String(v).trim();
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFileIfExists(src, dst) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    return true;
  }
  return false;
}

async function loadExamples() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SENTENCES_XLSX);
  const examples = {};
  wb.worksheets.forEach((sheet, sIdx) => {
    const themeId = sIdx + 1;
    if (!FREE_THEMES.includes(themeId)) return;
    FREE_LEVELS.forEach(levelId => {
      const jpCol = (levelId - 1) * 2 + 1;
      const neCol = jpCol + 1;
      const arr = [];
      for (let r = 2; r <= 21; r++) {
        const jp = getCellText(sheet.getRow(r).getCell(jpCol));
        const ne = getCellText(sheet.getRow(r).getCell(neCol));
        if (jp && ne) arr.push({ jp, ne });
      }
      if (arr.length > 0) {
        examples[`${themeId}-${levelId}`] = arr;
      }
    });
  });
  return examples;
}

async function loadWordCategories() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(WORDS_XLSX);
  const all = [];
  const freeWords = {};
  wb.worksheets.forEach((sheet, idx) => {
    const id = idx + 1;
    const words = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return;
      const ja = getCellText(row.getCell(1));
      const ne = getCellText(row.getCell(2));
      if (ja && ne) words.push({ ja, ne });
    });
    const name = sheet.name.replace(/^\d+_/, '');
    const free = FREE_WORD_CATEGORIES.includes(id);
    all.push({ id, name, free, wordCount: words.length });
    if (free) freeWords[id] = words;
  });
  return { wordCategories: all, freeWords };
}

async function loadGrammar() {
  if (!fs.existsSync(GRAMMAR_XLSX)) {
    console.warn(`  警告: ${GRAMMAR_XLSX} が見つかりません。文法データを空でエクスポートします。`);
    return { grammarThemes: [], freeGrammarExamples: {} };
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(GRAMMAR_XLSX);
  const themes = [];
  const freeExamples = {};
  wb.worksheets.forEach((sheet, idx) => {
    const id = idx + 1;
    const name = sheet.name.replace(/^\d+_/, '');
    const free = FREE_GRAMMAR_THEMES.includes(id);
    const arr = [];
    for (let r = 2; r <= 21; r++) {
      const jp = getCellText(sheet.getRow(r).getCell(1));
      const ne = getCellText(sheet.getRow(r).getCell(2));
      if (jp && ne) arr.push({ jp, ne });
    }
    themes.push({ id, name, free, exampleCount: arr.length });
    if (free && arr.length > 0) freeExamples[id] = arr;
  });
  return { grammarThemes: themes, freeGrammarExamples: freeExamples };
}

function copyGrammarAudioFiles(freeGrammarExamples) {
  ensureDir(OUT_AUDIO_NE_GRAMMAR);
  ensureDir(OUT_AUDIO_JA_GRAMMAR);

  const nepaliFiles = [];
  const japaneseFiles = [];
  let neOk = 0, neMiss = 0, jaOk = 0, jaMiss = 0;

  for (const themeIdStr of Object.keys(freeGrammarExamples)) {
    const themeId = Number(themeIdStr);
    const exCount = freeGrammarExamples[themeIdStr].length;
    for (let ex = 1; ex <= exCount; ex++) {
      const fileName = `${themeId}-${ex}.mp3`;
      const neSrc = path.join(NEPALI_GRAMMAR_SRC, fileName);
      const jaSrc = path.join(JAPANESE_GRAMMAR_SRC, fileName);
      if (copyFileIfExists(neSrc, path.join(OUT_AUDIO_NE_GRAMMAR, fileName))) {
        nepaliFiles.push(fileName);
        neOk++;
      } else { neMiss++; }
      if (copyFileIfExists(jaSrc, path.join(OUT_AUDIO_JA_GRAMMAR, fileName))) {
        japaneseFiles.push(fileName);
        jaOk++;
      } else { jaMiss++; }
    }
  }

  console.log(`  文法ネパール語音声: ${neOk}件コピー (欠損${neMiss}件)`);
  console.log(`  文法日本語音声:     ${jaOk}件コピー (欠損${jaMiss}件)`);
  return { grammarNepaliFiles: nepaliFiles, grammarJapaneseFiles: japaneseFiles };
}

function copyAudioFiles(examples) {
  ensureDir(OUT_AUDIO_NE);
  ensureDir(OUT_AUDIO_JA);

  const nepaliFiles = [];
  const japaneseFiles = [];
  let neOk = 0, neMiss = 0, jaOk = 0, jaMiss = 0;

  for (const key of Object.keys(examples)) {
    const [themeId, levelId] = key.split('-').map(Number);
    const exCount = examples[key].length;
    for (let ex = 1; ex <= exCount; ex++) {
      const fileName = `${themeId}-${levelId}-${ex}.mp3`;
      const neSrc = path.join(NEPALI_AUDIO_SRC, fileName);
      const jaSrc = path.join(JAPANESE_AUDIO_SRC, fileName);
      if (copyFileIfExists(neSrc, path.join(OUT_AUDIO_NE, fileName))) {
        nepaliFiles.push(fileName);
        neOk++;
      } else { neMiss++; }
      if (copyFileIfExists(jaSrc, path.join(OUT_AUDIO_JA, fileName))) {
        japaneseFiles.push(fileName);
        jaOk++;
      } else { jaMiss++; }
    }
  }

  console.log(`  ネパール語音声: ${neOk}件コピー (欠損${neMiss}件)`);
  console.log(`  日本語音声:     ${jaOk}件コピー (欠損${jaMiss}件)`);
  return { nepaliFiles, japaneseFiles };
}

function writeAudioMap(nepaliFiles, japaneseFiles, grammarNepaliFiles, grammarJapaneseFiles) {
  // React Native の require() は静的パスのみ受け付けるため、
  // 全ファイル名を列挙したマッピングを書き出す

  // 聞き流し用結合音声（scripts/generate-listening-audio.mjs で生成）
  const LISTENING_DIR = path.join(EXPO_ROOT, 'assets', 'audio', 'listening');
  let listeningFiles = [];
  if (fs.existsSync(LISTENING_DIR)) {
    listeningFiles = fs.readdirSync(LISTENING_DIR).filter(f => f.endsWith('.mp3'));
  }

  const lines = [
    '// AUTO-GENERATED by scripts/export-to-expo.mjs. Do not edit by hand.',
    '',
    'export const nepaliAudio: Record<string, number> = {',
    ...nepaliFiles.sort().map(f => {
      const key = f.replace('.mp3', '');
      return `  '${key}': require('../assets/audio/nepali/${f}'),`;
    }),
    '};',
    '',
    'export const japaneseAudio: Record<string, number> = {',
    ...japaneseFiles.sort().map(f => {
      const key = f.replace('.mp3', '');
      return `  '${key}': require('../assets/audio/japanese/${f}'),`;
    }),
    '};',
    '',
    'export const nepaliGrammarAudio: Record<string, number> = {',
    ...grammarNepaliFiles.sort().map(f => {
      const key = f.replace('.mp3', '');
      return `  '${key}': require('../assets/audio/nepali-grammar/${f}'),`;
    }),
    '};',
    '',
    'export const japaneseGrammarAudio: Record<string, number> = {',
    ...grammarJapaneseFiles.sort().map(f => {
      const key = f.replace('.mp3', '');
      return `  '${key}': require('../assets/audio/japanese-grammar/${f}'),`;
    }),
    '};',
    '',
    '// 聞き流しモード用結合音声 (バックグラウンド再生対応)',
    'export const listeningAudio: Record<string, number> = {',
    ...listeningFiles.sort().map(f => {
      const key = f.replace('.mp3', '');
      return `  '${key}': require('../assets/audio/listening/${f}'),`;
    }),
    '};',
    '',
  ];
  fs.writeFileSync(path.join(OUT_DATA, 'audioMap.ts'), lines.join('\n'));
}

async function main() {
  ensureDir(OUT_DATA);

  console.log('例題データを抽出中...');
  const examples = await loadExamples();
  const exCount = Object.values(examples).reduce((s, a) => s + a.length, 0);
  console.log(`  ${Object.keys(examples).length}キー / ${exCount}例題`);

  console.log('単語データを抽出中...');
  const { wordCategories, freeWords } = await loadWordCategories();
  const wordCount = Object.values(freeWords).reduce((s, a) => s + a.length, 0);
  console.log(`  全${wordCategories.length}カテゴリ / 無料${Object.keys(freeWords).length}カテゴリ / ${wordCount}語`);

  console.log('文法データを抽出中...');
  const { grammarThemes, freeGrammarExamples } = await loadGrammar();
  const grammarFreeCount = Object.values(freeGrammarExamples).reduce((s, a) => s + a.length, 0);
  console.log(`  全${grammarThemes.length}分野 / 無料${Object.keys(freeGrammarExamples).length}分野 / ${grammarFreeCount}例題`);

  console.log('会話音声ファイルをコピー中...');
  const { nepaliFiles, japaneseFiles } = copyAudioFiles(examples);

  console.log('文法音声ファイルをコピー中...');
  const { grammarNepaliFiles, grammarJapaneseFiles } = copyGrammarAudioFiles(freeGrammarExamples);

  // テーマメタ情報（30件）
  // free フィールドはクリーンアップで削除済み (Paywall 廃止)
  const themes = THEME_NAMES.map((name, i) => ({
    id: i + 1,
    name,
  }));

  // wordCategories から free フィールドを除く
  const wordCategoriesClean = wordCategories.map(({ free, ...rest }) => rest);
  // grammarThemes から free フィールドを除く
  const grammarThemesClean = grammarThemes.map(({ free, ...rest }) => rest);

  console.log('JSONを書き出し中...');
  fs.writeFileSync(path.join(OUT_DATA, 'themes.json'), JSON.stringify(themes, null, 2));
  fs.writeFileSync(path.join(OUT_DATA, 'levels.json'), JSON.stringify(LEVELS, null, 2));
  fs.writeFileSync(path.join(OUT_DATA, 'examples.json'), JSON.stringify(examples, null, 2));
  fs.writeFileSync(path.join(OUT_DATA, 'wordCategories.json'), JSON.stringify(wordCategoriesClean, null, 2));
  fs.writeFileSync(path.join(OUT_DATA, 'words.json'), JSON.stringify(freeWords, null, 2));
  fs.writeFileSync(path.join(OUT_DATA, 'grammarThemes.json'), JSON.stringify(grammarThemesClean, null, 2));
  fs.writeFileSync(path.join(OUT_DATA, 'grammarExamples.json'), JSON.stringify(freeGrammarExamples, null, 2));

  console.log('audioMap.ts を書き出し中...');
  writeAudioMap(nepaliFiles, japaneseFiles, grammarNepaliFiles, grammarJapaneseFiles);

  console.log('');
  console.log('========================================');
  console.log('完了');
  console.log(`出力先: ${OUT_DATA}`);
  console.log(`音声(ネ): ${OUT_AUDIO_NE}`);
  console.log(`音声(日): ${OUT_AUDIO_JA}`);
}

main().catch(e => { console.error(e); process.exit(1); });
