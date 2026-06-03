// 会話.xlsx と data/vocab.json から
// HOME(モード選択) → テーマ → レベル → 練習/聞き流し のフローを持つ
// 自己完結HTMLアプリを生成する。
//
// 実行: npm run build-app
// 出力: 聞いて話せるネパール語.html

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const XLSX_PATH = path.join(PROJECT_ROOT, '会話.xlsx');
const WORDS_XLSX_PATH = path.join(PROJECT_ROOT, '単語.xlsx');
const GRAMMAR_XLSX_PATH = path.join(PROJECT_ROOT, '文法.xlsx');
const VOCAB_PATH = path.join(PROJECT_ROOT, 'data', 'vocab.json');
const OUTPUT_PATH = path.join(PROJECT_ROOT, '聞いて話せるネパール語.html');

const THEMES = [
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

async function loadExcelData() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const data = {};
  wb.worksheets.forEach((sheet, sIdx) => {
    const sheetId = sIdx + 1;
    [1, 2, 3].forEach(levelId => {
      const jpCol = (levelId - 1) * 2 + 1;
      const neCol = jpCol + 1;
      const examples = [];
      for (let r = 2; r <= 21; r++) {
        const jp = getCellText(sheet.getRow(r).getCell(jpCol));
        const ne = getCellText(sheet.getRow(r).getCell(neCol));
        if (jp && ne) examples.push({ jp, ne });
      }
      if (examples.length > 0) {
        data[`${sheetId}-${levelId}`] = examples;
      }
    });
  });
  return data;
}

function loadVocab() {
  if (!fs.existsSync(VOCAB_PATH)) {
    console.warn(`警告: ${VOCAB_PATH} が見つかりません。空辞書で続行します。`);
    return {};
  }
  return JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf8'));
}

async function loadWordsExcel() {
  if (!fs.existsSync(WORDS_XLSX_PATH)) {
    console.warn(`警告: ${WORDS_XLSX_PATH} が見つかりません。単語モードは空になります。`);
    return [];
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(WORDS_XLSX_PATH);
  const categories = [];
  wb.worksheets.forEach(sheet => {
    const words = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return; // ヘッダー行をスキップ
      const ja = getCellText(row.getCell(1));
      const ne = getCellText(row.getCell(2));
      if (ja && ne) words.push({ ja, ne });
    });
    if (words.length > 0) {
      categories.push({ name: sheet.name, words });
    }
  });
  return categories;
}

async function loadGrammarExcel() {
  if (!fs.existsSync(GRAMMAR_XLSX_PATH)) {
    console.warn(`警告: ${GRAMMAR_XLSX_PATH} が見つかりません。文法モードは空になります。`);
    return { themes: [], examples: {} };
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(GRAMMAR_XLSX_PATH);
  const themes = [];
  const examples = {};
  wb.worksheets.forEach((sheet, idx) => {
    const sheetId = idx + 1;
    // シート名から先頭の "NN_" を除去（例: "01_現在形（肯定文）" → "現在形（肯定文）"）
    const name = sheet.name.replace(/^\d+_/, '');
    themes.push(name);
    const arr = [];
    for (let r = 2; r <= 21; r++) {
      const jp = getCellText(sheet.getRow(r).getCell(1));
      const ne = getCellText(sheet.getRow(r).getCell(2));
      if (jp && ne) arr.push({ jp, ne });
    }
    if (arr.length > 0) examples[sheetId] = arr;
  });
  return { themes, examples };
}

function buildHtml(examples, vocab, wordsCategories, grammarThemes, grammarExamples) {
  const totalEx = Object.values(examples).reduce((s, arr) => s + arr.length, 0);
  const totalWords = wordsCategories.reduce((s, c) => s + c.words.length, 0);
  const totalGrammarEx = Object.values(grammarExamples).reduce((s, arr) => s + arr.length, 0);
  const themesJson = JSON.stringify(THEMES);
  const levelsJson = JSON.stringify(LEVELS);
  const examplesJson = JSON.stringify(examples);
  const vocabJson = JSON.stringify(vocab);
  const wordsJson = JSON.stringify(wordsCategories);
  const grammarThemesJson = JSON.stringify(grammarThemes);
  const grammarExamplesJson = JSON.stringify(grammarExamples);

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>ネパール語 瞬間作文 — ${totalEx}例題</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;450;500;600;700&family=JetBrains+Mono:wght@300;400;500&family=Noto+Sans+JP:wght@300;400;500;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #ffffff; --bg-soft: #fafafa; --bg-disabled: #f4f4f5;
  --surface: #ffffff;
  --ink: #000000; --ink-soft: #18181b; --ink-mute: #52525b;
  --ink-quiet: #71717a; --ink-faint: #a1a1aa; --ink-trace: #d4d4d8;
  --line: #e4e4e7; --line-soft: #f4f4f5;
  --accent-ja: #2563eb; --accent-ne: #dc143c;
}
:root[data-theme="dark"] {
  --bg: #0a0a0b; --bg-soft: #18181b; --bg-disabled: #27272a;
  --surface: #18181b;
  --ink: #fafafa; --ink-soft: #e4e4e7; --ink-mute: #a1a1aa;
  --ink-quiet: #71717a; --ink-faint: #52525b; --ink-trace: #3f3f46;
  --line: #27272a; --line-soft: #1f1f23;
  --accent-ja: #60a5fa; --accent-ne: #fb7185;
}
:root[data-theme="dark"] .bottom-tabs { background: rgba(10,10,11,0.95); }
:root[data-theme="dark"] .topbar { background: rgba(10,10,11,0.9); }
:root[data-romaji="off"] .word-roman { display: none; }
:root[data-romaji="off"] .card-rom { display: none; }
:root[data-romaji="off"] .sentence-rom { display: none; }
.sentence-rom { font-family: 'JetBrains Mono', monospace; font-size: clamp(13px, 1.3vw, 16px); color: var(--ink-quiet); margin-top: 8px; font-style: italic; letter-spacing: 0.01em; line-height: 1.6; }
.listen-row .sentence-rom { margin-top: 6px; font-size: clamp(13px, 1.2vw, 15px); }
.card-rom-large { font-family: 'JetBrains Mono', monospace; font-size: clamp(13px, 1.4vw, 17px); color: var(--ink-quiet); margin-top: 12px; font-style: italic; }
:root[data-romaji="off"] .card-rom-large { display: none; }
html, body { background: var(--bg); color: var(--ink); font-family: 'Inter', system-ui, sans-serif; min-height: 100%; overflow-x: hidden; -webkit-font-smoothing: antialiased; }

/* ── Splash Screen ───────────────────────────── */
.splash {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, #ffffff 0%, #f5f5f7 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: splashFadeOut 0.35s ease-in 1.15s forwards;
  pointer-events: none;
}
.splash img {
  width: 220px;
  height: 220px;
  animation: splashLogo 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  filter: drop-shadow(0 12px 32px rgba(0, 0, 0, 0.12));
}
@keyframes splashLogo {
  0%   { opacity: 0; transform: scale(0.6) rotate(-8deg); }
  35%  { opacity: 1; transform: scale(1.08) rotate(2deg); }
  55%  { transform: scale(0.96) rotate(-1deg); }
  75%  { transform: scale(1.02) rotate(0deg); }
  100% { opacity: 1; transform: scale(1) rotate(0deg); }
}
@keyframes splashFadeOut {
  to { opacity: 0; visibility: hidden; }
}
.splash.done { display: none; }
:root[data-theme="dark"] .splash {
  background: linear-gradient(135deg, #0a0a0b 0%, #18181b 100%);
}
body { font-feature-settings: 'cv11' 1, 'ss01' 1; }

.topbar { border-bottom: 1px solid var(--line); position: sticky; top: 0; background: rgba(255,255,255,0.9); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); z-index: 10; }
.topbar-inner { max-width: 1200px; margin: 0 auto; padding: 14px 32px; display: flex; align-items: center; }
.crumbs { display: flex; align-items: center; gap: 0; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink); flex-wrap: wrap; }
.crumbs > span, .crumbs > a { padding: 4px 10px; cursor: pointer; transition: color 0.2s; text-decoration: none; color: inherit; }
.crumbs > a:hover { color: var(--ink-mute); }
.crumbs .sep { color: var(--ink-faint); padding: 0 4px; cursor: default; }
.crumbs .current { color: var(--ink); background: var(--bg-soft); border-radius: 4px; cursor: default; }

.layout { max-width: 1080px; margin: 0 auto; padding: 32px 48px 120px; }

/* ── Bottom Tab Navigation ─────────────────── */
.bottom-tabs { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(255,255,255,0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-top: 1px solid var(--line); z-index: 50; padding: 0 0 env(safe-area-inset-bottom, 0); }
.bottom-tabs-inner { max-width: 720px; margin: 0 auto; display: flex; padding: 8px 16px 10px; gap: 4px; }
.bottom-tab { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 8px 4px; background: transparent; border: none; cursor: pointer; color: var(--ink-faint); transition: all 0.2s; border-radius: 12px; font-family: 'Noto Sans JP', sans-serif; }
.bottom-tab:hover { color: var(--ink-mute); background: var(--bg-soft); }
.bottom-tab.active { color: var(--ink); }
.bottom-tab svg { width: 24px; height: 24px; stroke: currentColor; fill: none; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; transition: all 0.2s; }
.bottom-tab.active svg { stroke-width: 2; }
.bottom-tab-label { font-size: 11px; font-weight: 500; letter-spacing: 0.02em; }
.bottom-tab.active .bottom-tab-label { font-weight: 700; }

/* ── Settings Screen ───────────────────────── */
.settings-list { display: flex; flex-direction: column; gap: 32px; max-width: 720px; }
.settings-section { display: flex; flex-direction: column; gap: 4px; }
.settings-section-title { font-family: 'Noto Sans JP', sans-serif; font-size: 13px; font-weight: 700; color: var(--ink-quiet); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; padding: 0 4px; display: flex; align-items: center; gap: 8px; }
.settings-section-title svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }
.settings-item { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; gap: 16px; flex-wrap: wrap; }
.settings-item-label { font-family: 'Noto Sans JP', sans-serif; font-size: 14px; font-weight: 500; color: var(--ink); flex: 1; min-width: 140px; }
.settings-item-desc { font-family: 'Noto Sans JP', sans-serif; font-size: 12px; color: var(--ink-mute); margin-top: 2px; }
.settings-item-control { display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
.settings-pill { padding: 6px 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 99px; cursor: pointer; font-family: 'Noto Sans JP', sans-serif; font-size: 12px; font-weight: 500; color: var(--ink-mute); transition: all 0.2s; user-select: none; }
.settings-pill:hover { border-color: var(--ink); color: var(--ink); }
.settings-pill.on { background: var(--ink); color: white; border-color: var(--ink); }
.settings-toggle { width: 48px; height: 28px; background: var(--line); border-radius: 99px; position: relative; cursor: pointer; transition: background 0.2s; border: none; padding: 0; }
.settings-toggle::after { content: ''; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; background: white; border-radius: 50%; transition: left 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
.settings-toggle.on { background: var(--ink); }
.settings-toggle.on::after { left: 23px; }
.settings-button { padding: 8px 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; cursor: pointer; font-family: 'Noto Sans JP', sans-serif; font-size: 13px; font-weight: 500; color: var(--ink); transition: all 0.2s; }
.settings-button:hover { background: var(--ink); color: white; border-color: var(--ink); }
.settings-button.danger { color: #dc2626; border-color: #fecaca; }
.settings-button.danger:hover { background: #dc2626; color: white; border-color: #dc2626; }
.settings-value { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--ink-mute); }
.settings-link { font-family: 'Noto Sans JP', sans-serif; font-size: 13px; color: var(--accent-ja); text-decoration: none; padding: 6px 10px; border-radius: 6px; transition: background 0.2s; }
.settings-link:hover { background: var(--bg-soft); }
.settings-version { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-quiet); text-align: center; padding: 16px; }
[data-screen] { display: none; animation: fade 0.4s ease-out; }
[data-screen].active { display: block; }
@keyframes fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

.screen-head { margin-bottom: 56px; }
.screen-title { font-size: clamp(28px, 3.4vw, 40px); font-weight: 600; color: var(--ink); letter-spacing: -0.02em; margin-bottom: 12px; }
.screen-desc { font-family: 'Noto Sans JP', sans-serif; font-size: 15px; color: var(--ink-mute); line-height: 1.7; max-width: 640px; }

/* ── Mode (HOME) ────────────────────────────── */
.mode-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; max-width: 1100px; }
.mode-card { padding: 40px 36px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; cursor: pointer; transition: all 0.25s cubic-bezier(0.16,1,0.3,1); }
.mode-card:hover { border-color: var(--ink); transform: translateY(-4px); box-shadow: 0 20px 48px -20px rgba(0,0,0,0.18); background: var(--bg-soft); }
.mode-icon { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin-bottom: 22px; color: var(--ink); }
.mode-icon svg { width: 100%; height: 100%; }
.mode-name { font-family: 'Noto Sans JP', sans-serif; font-size: 28px; font-weight: 700; color: var(--ink); margin-bottom: 8px; letter-spacing: -0.01em; }
.mode-desc { font-family: 'Noto Sans JP', sans-serif; font-size: 14px; color: var(--ink-mute); line-height: 1.75; }
.mode-meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-faint); margin-top: 16px; letter-spacing: 0.04em; }

/* ── Theme ─────────────────────────────────── */
.theme-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.theme-card { padding: 18px 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 14px; }
.theme-card:hover { border-color: var(--ink); background: var(--bg-soft); transform: translateY(-2px); }
.theme-num { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-faint); width: 24px; flex-shrink: 0; }
.theme-card:hover .theme-num { color: var(--ink); }
.theme-name { font-family: 'Noto Sans JP', sans-serif; font-size: 14px; font-weight: 500; color: var(--ink); flex: 1; }
.vocab-cat-count { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-faint); padding: 3px 8px; border: 1px solid var(--line); border-radius: 99px; flex-shrink: 0; margin-left: 8px; }
.vocab-cat-card:hover .vocab-cat-count { border-color: var(--ink); color: var(--ink); }

/* ── Level ─────────────────────────────────── */
.level-settings { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; background: var(--bg-soft); border: 1px solid var(--line); border-radius: 10px; margin-bottom: 24px; max-width: 880px; }
.level-settings .settings-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.level-settings .settings-label { font-family: 'Noto Sans JP', sans-serif; font-size: 13px; color: var(--ink-mute); font-weight: 500; }
.repeat-pills { display: inline-flex; gap: 6px; }
.repeat-pills button { padding: 6px 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 99px; cursor: pointer; font-family: 'Noto Sans JP', sans-serif; font-size: 12px; font-weight: 500; color: var(--ink-mute); transition: all 0.2s; }
.repeat-pills button:hover { border-color: var(--ink); color: var(--ink); }
.repeat-pills button.on { background: var(--ink); color: white; border-color: var(--ink); }
.level-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; max-width: 880px; }
.level-card { padding: 32px 28px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; cursor: pointer; transition: all 0.2s; }
.level-card:hover { border-color: var(--ink); background: var(--bg-soft); transform: translateY(-3px); box-shadow: 0 12px 32px -16px rgba(0,0,0,0.15); }
.level-num { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-faint); letter-spacing: 0.1em; margin-bottom: 8px; }
.level-name { font-family: 'Noto Sans JP', sans-serif; font-size: 26px; font-weight: 700; color: var(--ink); margin-bottom: 6px; letter-spacing: -0.01em; }
.level-desc { font-family: 'Noto Sans JP', sans-serif; font-size: 13px; color: var(--ink-mute); line-height: 1.7; margin-bottom: 14px; }
.level-meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-quiet); }

/* ── Practice meta (shared) ────────────────── */
.practice-meta { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid var(--line); margin-bottom: 48px; font-family: 'JetBrains Mono', monospace; font-size: 12px; gap: 12px; flex-wrap: wrap; }
.practice-meta .info { color: var(--ink-mute); }
.practice-meta .info .current { color: var(--ink); font-weight: 600; }
.practice-meta .nav-mini { display: flex; gap: 8px; }
.practice-meta .nav-mini button { padding: 6px 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 11px; color: var(--ink-mute); transition: all 0.2s; }
.practice-meta .nav-mini button:hover:not(:disabled) { background: var(--ink); color: white; border-color: var(--ink); }
.practice-meta .nav-mini button:disabled { opacity: 0.35; cursor: not-allowed; }

/* ── Conversation: phase-a / phase-b ───────── */
.direction-toggle { display: flex; align-items: center; gap: 8px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.direction-toggle .dir-label { font-family: 'Noto Sans JP', sans-serif; font-size: 12px; color: var(--ink-mute); font-weight: 500; margin-right: 4px; }
.direction-toggle .dir-pill { padding: 6px 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 99px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 500; color: var(--ink-mute); transition: all 0.2s; }
.direction-toggle .dir-pill:hover { border-color: var(--ink); color: var(--ink); }
.direction-toggle .dir-pill.on { background: var(--ink); color: white; border-color: var(--ink); }
.phase-a { transition: all 0.5s cubic-bezier(0.16,1,0.3,1); }
[data-revealed="false"] .phase-a { min-height: calc(100vh - 380px); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
[data-revealed="false"] .phase-a .pa-jp { font-family: 'Noto Sans JP', sans-serif; font-size: clamp(24px, 3.5vw, 42px); font-weight: 400; color: var(--ink); line-height: 1.55; max-width: 820px; margin-bottom: 48px; letter-spacing: -0.005em; }
[data-revealed="false"] .phase-a .pa-ne { font-family: 'Noto Sans Devanagari', sans-serif; font-size: clamp(26px, 3.8vw, 44px); font-weight: 600; color: var(--ink); line-height: 1.45; max-width: 880px; margin-bottom: 48px; letter-spacing: -0.012em; }
[data-revealed="true"] .phase-a { margin-bottom: 56px; padding-bottom: 28px; border-bottom: 1px solid var(--line); }
[data-revealed="true"] .phase-a .pa-jp { font-family: 'Noto Sans JP', sans-serif; font-size: clamp(15px, 1.4vw, 18px); font-weight: 400; color: var(--ink-mute); line-height: 1.7; max-width: 800px; }
[data-revealed="true"] .phase-a .pa-ne { font-family: 'Noto Sans Devanagari', sans-serif; font-size: clamp(16px, 1.5vw, 20px); font-weight: 500; color: var(--ink-mute); line-height: 1.55; max-width: 880px; letter-spacing: -0.005em; }
.ja-sentence { font-family: 'Noto Sans JP', sans-serif; font-size: clamp(24px, 3.4vw, 38px); font-weight: 500; line-height: 1.5; color: var(--ink); margin-bottom: 16px; letter-spacing: -0.005em; }
[data-revealed="true"] .reveal-btn { display: none; }
.phase-a-actions { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; justify-content: center; }
[data-revealed="true"] .phase-a-actions { display: none; }
.reveal-btn { display: inline-flex; align-items: center; gap: 12px; padding: 16px 28px; background: var(--ink); color: white; border: none; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.3s; letter-spacing: 0.02em; }
.reveal-btn:hover { background: var(--ink-soft); transform: translateY(-2px); box-shadow: 0 12px 32px -12px rgba(0,0,0,0.25); }
.reveal-btn .kbd { font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 2px 6px; background: rgba(255,255,255,0.15); border-radius: 4px; letter-spacing: 0.05em; }
.phase-b { display: none; }
[data-revealed="true"] .phase-b { display: block; animation: fade 0.5s 0.1s both ease-out; }

.ne-hero { margin-bottom: 64px; display: grid; grid-template-columns: 200px 1fr; gap: 64px; align-items: start; }
.ne-hero-side { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-faint); display: flex; flex-direction: column; gap: 16px; padding-top: 8px; }
.ne-hero-side-item { display: flex; flex-direction: column; gap: 4px; }
.ne-hero-side-item .key { color: var(--ink-quiet); text-transform: uppercase; letter-spacing: 0.1em; }
.ne-hero-side-item .val { color: var(--ink); font-size: 13px; }
.ne-sentence { font-family: 'Noto Sans Devanagari', sans-serif; font-size: clamp(26px, 3.6vw, 42px); font-weight: 600; line-height: 1.4; color: var(--ink); margin-bottom: 16px; letter-spacing: -0.012em; }
.replay-btn { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 12px; color: var(--ink-mute); transition: all 0.2s; margin-bottom: 24px; }
.replay-btn:hover { background: var(--ink); color: white; border-color: var(--ink); }
.replay-btn svg { width: 12px; height: 12px; fill: currentColor; }

.words { margin-bottom: 80px; border-top: 1px solid var(--line); }
.word-head { display: grid; grid-template-columns: 56px 1fr 1fr; gap: 24px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--line); font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--ink-faint); letter-spacing: 0.1em; }
.word { display: grid; grid-template-columns: 56px 1fr 1fr; gap: 24px; align-items: center; padding: 16px 0; border-bottom: 1px solid var(--line); position: relative; transition: background 0.15s; }
.word.unknown { opacity: 0.55; }
.word-num { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-quiet); }
.word-content { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.word-deva { font-family: 'Noto Sans Devanagari', sans-serif; font-size: 22px; font-weight: 500; color: var(--ink); letter-spacing: -0.01em; }
.word-roman { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-faint); }
.word-meaning { font-family: 'Noto Sans JP', sans-serif; font-size: 14px; color: var(--ink); font-weight: 400; }
.word-meaning.dim { color: var(--ink-faint); font-style: italic; }

.nav-row { margin-top: 40px; padding-top: 28px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 16px; }
.nav-btn { padding: 14px 24px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: var(--ink); transition: all 0.2s; display: flex; align-items: center; gap: 10px; min-width: 160px; }
.nav-btn:hover:not(:disabled) { background: var(--ink); color: white; border-color: var(--ink); transform: translateY(-2px); }
.nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.nav-btn.prev { justify-content: flex-start; }
.nav-btn.next { justify-content: flex-end; margin-left: auto; }

/* ── Listening mode ─────────────────────────── */
.listen-stage { padding: 24px 0 80px; min-height: calc(100vh - 240px); display: flex; flex-direction: column; }
.listen-progress { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-quiet); margin-bottom: 36px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.listen-progress .pos { color: var(--ink); font-weight: 500; }
.listen-progress .bar { flex: 1; height: 3px; background: var(--line); border-radius: 999px; overflow: hidden; max-width: 320px; }
.listen-progress .bar-fill { height: 100%; background: var(--ink); transition: width 0.4s ease; }

.listen-card { flex: 1; display: flex; flex-direction: column; gap: 36px; padding: 48px 0 36px; }
.listen-row { display: grid; grid-template-columns: 90px 1fr; gap: 24px; align-items: start; padding: 24px 28px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; transition: all 0.4s cubic-bezier(0.16,1,0.3,1); }
.listen-row.active { transform: scale(1.005); box-shadow: 0 16px 40px -16px rgba(0,0,0,0.18); }
.listen-row.ja.active { border-color: var(--accent-ja); }
.listen-row.ne.active { border-color: var(--accent-ne); }
.listen-row .lang-tag { display: inline-flex; align-items: center; justify-content: center; padding: 8px 0; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; letter-spacing: 0.12em; background: var(--bg-soft); color: var(--ink-quiet); border: 1px solid var(--line); transition: all 0.3s; }
.listen-row.ja.active .lang-tag { background: var(--accent-ja); color: white; border-color: var(--accent-ja); }
.listen-row.ne.active .lang-tag { background: var(--accent-ne); color: white; border-color: var(--accent-ne); }
.listen-row .text-ja { font-family: 'Noto Sans JP', sans-serif; font-size: clamp(18px, 2vw, 24px); line-height: 1.6; color: var(--ink); letter-spacing: -0.005em; font-weight: 400; }
.listen-row .text-ne { font-family: 'Noto Sans Devanagari', sans-serif; font-size: clamp(22px, 2.4vw, 30px); line-height: 1.55; color: var(--ink); letter-spacing: -0.012em; font-weight: 600; }
.listen-row .pulse-bar { display: inline-flex; gap: 3px; align-items: flex-end; height: 14px; margin-top: 10px; opacity: 0; transition: opacity 0.3s; }
.listen-row.active .pulse-bar { opacity: 1; }
.listen-row .pulse-bar span { width: 3px; background: currentColor; border-radius: 1px; height: 6px; animation: signalWave 1s ease-in-out infinite; }
.listen-row.ja.active .pulse-bar { color: var(--accent-ja); }
.listen-row.ne.active .pulse-bar { color: var(--accent-ne); }
.listen-row .pulse-bar span:nth-child(1) { height: 6px; animation-delay: 0s; }
.listen-row .pulse-bar span:nth-child(2) { height: 12px; animation-delay: 0.15s; }
.listen-row .pulse-bar span:nth-child(3) { height: 9px; animation-delay: 0.3s; }
.listen-row .pulse-bar span:nth-child(4) { height: 14px; animation-delay: 0.45s; }
@keyframes signalWave { 0%,100%{transform:scaleY(0.4)} 50%{transform:scaleY(1)} }

/* Listening controls */
.listen-controls { display: flex; justify-content: center; align-items: center; gap: 20px; padding: 32px 0; border-top: 1px solid var(--line); }
.listen-ctrl-btn { width: 56px; height: 56px; border-radius: 50%; background: var(--surface); border: 1px solid var(--line); color: var(--ink); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 18px; }
.listen-ctrl-btn:hover:not(:disabled) { background: var(--bg-soft); border-color: var(--ink); transform: scale(1.05); }
.listen-ctrl-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.listen-ctrl-btn.play { width: 78px; height: 78px; background: var(--ink); color: white; border-color: var(--ink); font-size: 24px; }
.listen-ctrl-btn.play:hover:not(:disabled) { background: var(--ink-soft); }
.listen-ctrl-btn svg { width: 22px; height: 22px; fill: currentColor; }
.listen-ctrl-btn.play svg { width: 28px; height: 28px; }

.listen-extras { display: flex; justify-content: center; gap: 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-faint); margin-top: 18px; flex-wrap: wrap; }
.listen-extras .pill { padding: 4px 10px; border: 1px solid var(--line); border-radius: 99px; cursor: pointer; transition: all 0.2s; user-select: none; background: var(--surface); }
.listen-extras .pill:hover { background: var(--bg-soft); color: var(--ink); }
.listen-extras .pill.on { background: var(--ink); color: white; border-color: var(--ink); }

/* ── Direction selection (vocab) ────────────── */
.direction-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; max-width: 760px; }
.direction-card { padding: 36px 32px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; cursor: pointer; transition: all 0.25s cubic-bezier(0.16,1,0.3,1); }
.direction-card:hover { border-color: var(--ink); transform: translateY(-3px); box-shadow: 0 20px 48px -20px rgba(0,0,0,0.18); }
.direction-from-to { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
.direction-from-to .lang { font-family: 'Noto Sans JP', sans-serif; font-size: 22px; font-weight: 700; color: var(--ink); }
.direction-from-to .arrow { font-family: 'JetBrains Mono', monospace; font-size: 18px; color: var(--ink-faint); }
.direction-desc { font-family: 'Noto Sans JP', sans-serif; font-size: 13px; color: var(--ink-mute); line-height: 1.7; }

/* ── Flashcard ──────────────────────────────── */
.flashcard-stage { padding: 24px 0 80px; min-height: calc(100vh - 240px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 32px; }
.flashcard { perspective: 1200px; width: 100%; max-width: 640px; aspect-ratio: 16/10; cursor: pointer; user-select: none; }
.flashcard-inner { position: relative; width: 100%; height: 100%; transition: transform 0.65s cubic-bezier(0.16,1,0.3,1); transform-style: preserve-3d; }
.flashcard[data-flipped="true"] .flashcard-inner { transform: rotateY(180deg); }
.card-face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; background: var(--surface); border: 1px solid var(--line); border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; transition: box-shadow 0.3s ease; box-shadow: 0 12px 36px -12px rgba(0,0,0,0.08); }
.flashcard:hover .card-face { box-shadow: 0 24px 48px -16px rgba(0,0,0,0.16); }
.card-back { transform: rotateY(180deg); }
.card-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 20px; }
.card-text-ne { font-family: 'Noto Sans Devanagari', sans-serif; font-size: clamp(34px, 5vw, 56px); font-weight: 600; color: var(--ink); line-height: 1.25; letter-spacing: -0.015em; text-align: center; }
.card-text-ja { font-family: 'Noto Sans JP', sans-serif; font-size: clamp(26px, 4vw, 44px); font-weight: 600; color: var(--ink); line-height: 1.35; letter-spacing: -0.01em; text-align: center; }
.card-hint { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.2em; color: var(--ink-faint); margin-top: 24px; }
.card-rom { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--ink-faint); margin-top: 14px; font-style: italic; }

.card-controls { display: flex; align-items: center; justify-content: center; gap: 16px; }
.card-pos { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--ink-mute); min-width: 100px; text-align: center; }
.card-pos .now { color: var(--ink); font-weight: 600; font-size: 15px; }

.card-extras { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.card-extras .pill { padding: 6px 14px; border: 1px solid var(--line); border-radius: 99px; background: var(--surface); cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-mute); transition: all 0.2s; user-select: none; }
.card-extras .pill:hover { background: var(--bg-soft); color: var(--ink); border-color: var(--ink); }
.card-extras .pill.on { background: var(--ink); color: white; border-color: var(--ink); }

@media (max-width: 900px) {
  .ne-hero { grid-template-columns: 1fr; gap: 24px; }
  .word, .word-head { grid-template-columns: 36px 1fr 1fr; gap: 12px; }
  .listen-row { grid-template-columns: 1fr; padding: 22px 20px; }
  .listen-row .lang-tag { justify-self: start; padding: 4px 12px; }
  .listen-ctrl-btn { width: 48px; height: 48px; }
  .listen-ctrl-btn.play { width: 68px; height: 68px; }
}
</style>
</head>
<body data-revealed="false">
<div class="splash" id="splash">
  <img src="./splash.png" alt="聞いて話せるネパール語" />
</div>
<header class="topbar">
  <div class="topbar-inner">
    <nav class="crumbs" id="crumbs"></nav>
  </div>
</header>

<main class="layout">
  <!-- Settings screen -->
  <section data-screen="settings">
    <div class="screen-head">
      <h1 class="screen-title">設定</h1>
      <p class="screen-desc">学習体験をカスタマイズできます。設定は自動的に保存されます。</p>
    </div>
    <div class="settings-list">
      <!-- 音声設定 -->
      <div class="settings-section">
        <h2 class="settings-section-title">
          <svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
          音声
        </h2>
        <div class="settings-item">
          <div class="settings-item-label">音声再生スピード<div class="settings-item-desc">全モード共通の再生速度</div></div>
          <div class="settings-item-control" id="set-speed">
            <button class="settings-pill" data-speed="0.8">×0.8</button>
            <button class="settings-pill" data-speed="1.0">×1.0</button>
            <button class="settings-pill" data-speed="1.2">×1.2</button>
            <button class="settings-pill" data-speed="1.5">×1.5</button>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-label">ネパール語の繰り返し回数<div class="settings-item-desc">聞き流し時にネパール語を何回再生するか</div></div>
          <div class="settings-item-control" id="set-repeat">
            <button class="settings-pill" data-repeat="1">1回</button>
            <button class="settings-pill" data-repeat="2">2回</button>
            <button class="settings-pill" data-repeat="3">3回</button>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-label">会話の出題方向<div class="settings-item-desc">会話モードのデフォルト翻訳方向</div></div>
          <div class="settings-item-control" id="set-practice-dir">
            <button class="settings-pill" data-pdir="ja2ne">🇯🇵 → 🇳🇵</button>
            <button class="settings-pill" data-pdir="ne2ja">🇳🇵 → 🇯🇵</button>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-label">聞き流しの再生順序<div class="settings-item-desc">聞き流しモードでどちらを先に再生するか</div></div>
          <div class="settings-item-control" id="set-listen-dir">
            <button class="settings-pill" data-ldir="ja2ne">🇯🇵 → 🇳🇵</button>
            <button class="settings-pill" data-ldir="ne2ja">🇳🇵 → 🇯🇵</button>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-label">聞き流しループ再生<div class="settings-item-desc">最後まで再生したら最初に戻る</div></div>
          <div class="settings-item-control">
            <button class="settings-toggle" id="set-loop"></button>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-label">音声間の間隔<div class="settings-item-desc">日本語と次の音声の間の待ち時間</div></div>
          <div class="settings-item-control" id="set-gap">
            <button class="settings-pill" data-gap="short">短め</button>
            <button class="settings-pill" data-gap="normal">標準</button>
            <button class="settings-pill" data-gap="long">長め</button>
          </div>
        </div>
      </div>

      <!-- 表示設定 -->
      <div class="settings-section">
        <h2 class="settings-section-title">
          <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          表示
        </h2>
        <div class="settings-item">
          <div class="settings-item-label">ローマ字表記の表示<div class="settings-item-desc">ネパール語の発音をローマ字で表示</div></div>
          <div class="settings-item-control">
            <button class="settings-toggle" id="set-romaji"></button>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-label">ダークモード<div class="settings-item-desc">画面の配色</div></div>
          <div class="settings-item-control" id="set-theme">
            <button class="settings-pill" data-theme="light">ライト</button>
            <button class="settings-pill" data-theme="dark">ダーク</button>
            <button class="settings-pill" data-theme="system">システム</button>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-label">文字サイズ<div class="settings-item-desc">全体の文字の大きさ</div></div>
          <div class="settings-item-control" id="set-font">
            <button class="settings-pill" data-font="small">小</button>
            <button class="settings-pill" data-font="medium">中</button>
            <button class="settings-pill" data-font="large">大</button>
          </div>
        </div>
      </div>

      <!-- 学習設定 -->
      <div class="settings-section">
        <h2 class="settings-section-title">
          <svg viewBox="0 0 24 24"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
          学習
        </h2>
        <div class="settings-item">
          <div class="settings-item-label">単語フラッシュカード自動反転<div class="settings-item-desc">フラッシュカードを自動で裏返す</div></div>
          <div class="settings-item-control">
            <button class="settings-toggle" id="set-autoflip"></button>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-label">単語シャッフル<div class="settings-item-desc">フラッシュカードを毎回シャッフル</div></div>
          <div class="settings-item-control">
            <button class="settings-toggle" id="set-shuffle"></button>
          </div>
        </div>
      </div>

      <!-- データ管理 -->
      <div class="settings-section">
        <h2 class="settings-section-title">
          <svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          データ管理
        </h2>
        <div class="settings-item">
          <div class="settings-item-label">設定をリセット<div class="settings-item-desc">全設定を初期値に戻す</div></div>
          <div class="settings-item-control">
            <button class="settings-button danger" id="set-reset">リセット</button>
          </div>
        </div>
      </div>

      <!-- アプリ情報 -->
      <div class="settings-section">
        <h2 class="settings-section-title">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          アプリについて
        </h2>
        <div class="settings-item">
          <div class="settings-item-label">バージョン</div>
          <div class="settings-item-control"><span class="settings-value">1.2.0</span></div>
        </div>
        <div class="settings-item">
          <div class="settings-item-label">コンテンツ統計<div class="settings-item-desc">収録されている学習データ</div></div>
          <div class="settings-item-control"><span class="settings-value">${totalEx + totalGrammarEx}例題 / ${totalWords}単語</span></div>
        </div>
        <div class="settings-item">
          <div class="settings-item-label">このアプリを共有</div>
          <div class="settings-item-control">
            <button class="settings-button" id="set-share">共有</button>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-label">プライバシーポリシー</div>
          <div class="settings-item-control">
            <a class="settings-link" id="set-privacy" href="#" target="_blank" rel="noopener">開く ↗</a>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-label">お問い合わせ</div>
          <div class="settings-item-control">
            <a class="settings-link" id="set-contact" href="#">メール ↗</a>
          </div>
        </div>
      </div>

      <div class="settings-version">聞いて話せるネパール語 v1.2.0</div>
    </div>
  </section>

  <!-- Theme -->
  <section data-screen="theme">
    <div class="screen-head">
      <h1 class="screen-title">テーマを選択</h1>
      <p class="screen-desc"><span id="themeScreenDesc">${THEMES.length}のテーマから1つ選んでください。</span></p>
    </div>
    <div class="theme-grid" id="themeGrid"></div>
  </section>

  <!-- Listening: source picker (聞き流しモードのみ) -->
  <section data-screen="listen-source">
    <div class="screen-head">
      <h1 class="screen-title">聞き流しの内容を選択</h1>
      <p class="screen-desc">音声を繰り返し聞いて、自然なネパール語表現を身につけましょう。</p>
    </div>
    <div class="level-settings">
      <div class="settings-row">
        <span class="settings-label">🔊 再生の順序:</span>
        <div class="repeat-pills" id="directionPills">
          <button data-listen-dir="ja2ne">🇯🇵 → 🇳🇵</button>
          <button data-listen-dir="ne2ja">🇳🇵 → 🇯🇵</button>
        </div>
      </div>
      <div class="settings-row">
        <span class="settings-label">🔁 ネパール語の再生回数:</span>
        <div class="repeat-pills" id="repeatPills">
          <button data-repeat="1">1回</button>
          <button data-repeat="2">2回</button>
          <button data-repeat="3">3回</button>
        </div>
      </div>
    </div>
    <div class="mode-grid">
      <div class="mode-card" data-listen-source="conversation">
        <div class="mode-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
        </div>
        <div class="mode-name">会話</div>
        <div class="mode-desc">30テーマ × 3レベル = ${totalEx}例題を聞き流し。<br/>同じレベルで全テーマを横断してから次のレベルへ進みます。</div>
        <div class="mode-meta">${totalEx}例題</div>
      </div>
      <div class="mode-card" data-listen-source="grammar">
        <div class="mode-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5v-15z"/>
            <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20"/>
            <line x1="8" y1="7" x2="16" y2="7"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </div>
        <div class="mode-name">文法</div>
        <div class="mode-desc">${grammarThemes.length}分野 × 20例題 = ${totalGrammarEx}例題を聞き流し。<br/>分野ごとに順番に進みます。</div>
        <div class="mode-meta">${totalGrammarEx}例題</div>
      </div>
    </div>
  </section>

  <!-- Level -->
  <section data-screen="level">
    <div class="screen-head">
      <h1 class="screen-title">レベルを選択</h1>
      <p class="screen-desc"><span id="levelThemeName">—</span> のテーマで、難易度を選んでください。</p>
    </div>
    <div class="level-grid" id="levelGrid"></div>
  </section>

  <!-- Practice (Conversation mode) -->
  <section data-screen="practice">
    <div class="practice-meta">
      <div class="info"><span id="practiceTheme">—</span> · <span id="practiceLevel">—</span> · 例題 <span class="current" id="practiceCurrent">—</span> / <span id="practiceTotal">—</span></div>
      <div class="nav-mini">
        <button id="miniPrev">← Prev</button>
        <button id="miniNext">Next →</button>
      </div>
    </div>
    <div id="practiceBody"></div>
  </section>

  <!-- Listening (Listening mode) -->
  <section data-screen="listening">
    <div class="practice-meta">
      <div class="info"><span id="listenTheme">—</span> · <span id="listenLevel">—</span> · 例題 <span class="current" id="listenCurrent">—</span> / <span id="listenTotal">—</span></div>
      <div class="nav-mini">
        <button id="listenChangeTheme">テーマ変更</button>
      </div>
    </div>
    <div class="listen-stage">
      <div class="listen-progress">
        <span class="pos" id="lpPos">—</span>
        <div class="bar"><div class="bar-fill" id="lpBar"></div></div>
        <span id="lpOverallText">—</span>
      </div>
      <div class="listen-card">
        <div class="listen-row ja" id="rowJa">
          <span class="lang-tag">JA · 日本語</span>
          <div>
            <div class="text-ja" id="textJa">—</div>
            <div class="pulse-bar"><span></span><span></span><span></span><span></span></div>
          </div>
        </div>
        <div class="listen-row ne" id="rowNe">
          <span class="lang-tag">NE · ネパール語</span>
          <div>
            <div class="text-ne" id="textNe">—</div>
            <div class="sentence-rom" id="textNeRom"></div>
            <div class="pulse-bar"><span></span><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>
      <div class="listen-controls">
        <button class="listen-ctrl-btn" id="listenPrev" title="前へ">
          <svg viewBox="0 0 24 24"><rect x="5" y="5" width="2.5" height="14" rx="1.25"/><polygon points="20,5 9,12 20,19"/></svg>
        </button>
        <button class="listen-ctrl-btn play" id="listenPlay" title="再生 / 一時停止">
          <svg viewBox="0 0 24 24" id="playIcon"><path d="M8 5.5v13c0 .8.9 1.3 1.6.9l10.5-6.5c.6-.4.6-1.3 0-1.7L9.6 4.6C8.9 4.2 8 4.7 8 5.5z"/></svg>
        </button>
        <button class="listen-ctrl-btn" id="listenNext" title="次へ">
          <svg viewBox="0 0 24 24"><polygon points="4,5 15,12 4,19"/><rect x="16.5" y="5" width="2.5" height="14" rx="1.25"/></svg>
        </button>
      </div>
      <div class="listen-extras">
        <span class="pill" id="pillLoop" title="テーマ・レベル境界を超えてループ再生">🔁 ノンストップ</span>
        <span class="pill" id="pillSpeed">🐢 速度 ×1.0</span>
      </div>
    </div>
  </section>
</main>

  <!-- Vocab: Category selection -->
  <section data-screen="vocab-category">
    <div class="screen-head">
      <h1 class="screen-title">テーマを選択</h1>
      <p class="screen-desc">テーマを1つ選んで、ネパール語の語彙を増やしましょう。</p>
    </div>
    <div class="theme-grid" id="vocabCategoryGrid"></div>
  </section>

  <!-- Vocab: Direction selection -->
  <section data-screen="vocab-direction">
    <div class="screen-head">
      <h1 class="screen-title">出題方向を選択</h1>
      <p class="screen-desc"><span id="vocabDirCategoryName">—</span> のカードをどちら向きで学習しますか？</p>
    </div>
    <div class="direction-grid">
      <div class="direction-card" data-dir="ne2ja">
        <div class="direction-from-to">
          <span class="lang">🇳🇵 ネパール語</span>
          <span class="arrow">→</span>
          <span class="lang">🇯🇵 日本語</span>
        </div>
        <div class="direction-desc">ネパール語の単語が表示され、クリックで日本語訳を確認します。<br/>読解・理解力を鍛えるのに最適。</div>
      </div>
      <div class="direction-card" data-dir="ja2ne">
        <div class="direction-from-to">
          <span class="lang">🇯🇵 日本語</span>
          <span class="arrow">→</span>
          <span class="lang">🇳🇵 ネパール語</span>
        </div>
        <div class="direction-desc">日本語の意味が表示され、クリックでネパール語を確認します。<br/>瞬発力・産出力を鍛えるのに最適。</div>
      </div>
    </div>
  </section>

  <!-- Vocab: Flashcard -->
  <section data-screen="flashcard">
    <div class="practice-meta">
      <div class="info"><span id="cardCategoryName">—</span> · <span id="cardDirection">—</span> · <span class="current" id="cardCurrent">—</span> / <span id="cardTotal">—</span></div>
      <div class="nav-mini">
        <button id="cardChangeCat">カテゴリ変更</button>
      </div>
    </div>
    <div class="flashcard-stage">
      <div class="flashcard" id="flashcardEl" data-flipped="false">
        <div class="flashcard-inner">
          <div class="card-face card-front" id="cardFront">
            <div class="card-label" id="cardFrontLabel">FRONT</div>
            <div id="cardFrontText"></div>
            <div class="card-hint">クリック / Space で反転</div>
          </div>
          <div class="card-face card-back" id="cardBack">
            <div class="card-label" id="cardBackLabel">BACK</div>
            <div id="cardBackText"></div>
            <div class="card-hint">クリックで戻る</div>
          </div>
        </div>
      </div>
      <div class="card-controls">
        <button class="nav-btn prev" id="cardPrev">← 前へ</button>
        <span class="card-pos"><span class="now" id="cardPosNow">—</span> / <span id="cardPosTotal">—</span></span>
        <button class="nav-btn next" id="cardNext">次へ →</button>
      </div>
      <div class="card-extras">
        <span class="pill" id="pillShuffle">🔀 シャッフル</span>
        <span class="pill" id="pillAutoFlip">⏱ 自動反転 OFF</span>
      </div>
    </div>
  </section>

<audio id="sentenceAudio" preload="auto"></audio>

<!-- Bottom Tab Navigation -->
<nav class="bottom-tabs" id="bottomTabs">
  <div class="bottom-tabs-inner">
    <button class="bottom-tab" data-tab="conversation">
      <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      <span class="bottom-tab-label">会話</span>
    </button>
    <button class="bottom-tab" data-tab="grammar">
      <svg viewBox="0 0 24 24"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5v-15z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      <span class="bottom-tab-label">文法</span>
    </button>
    <button class="bottom-tab" data-tab="listening">
      <svg viewBox="0 0 24 24"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
      <span class="bottom-tab-label">聞き流し</span>
    </button>
    <button class="bottom-tab" data-tab="vocabulary">
      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="14" height="14" rx="2"/><rect x="7" y="7" width="14" height="14" rx="2"/></svg>
      <span class="bottom-tab-label">単語</span>
    </button>
    <button class="bottom-tab" data-tab="settings">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      <span class="bottom-tab-label">設定</span>
    </button>
  </div>
</nav>

<script>
const THEMES = ${themesJson};
const LEVELS = ${levelsJson};
const EXAMPLES = ${examplesJson};
const VOCAB = ${vocabJson};
const WORD_CATEGORIES = ${wordsJson};
const GRAMMAR_THEMES = ${grammarThemesJson};
const GRAMMAR_EXAMPLES = ${grammarExamplesJson};

let state = {
  screen: 'theme',
  mode: 'conversation', // 'conversation' | 'listening' | 'grammar' | 'vocabulary' | 'settings'
  themeId: null,
  levelId: null,
  exampleIdx: 0,
  revealed: false,
  nepaliRepeat: 1,
  practiceDirection: 'ja2ne',  // 'ja2ne' | 'ne2ja' — 会話モードの翻訳方向
  // listening state
  listenPlaying: false,
  listenPhase: 'idle',
  listenDirection: 'ja2ne',   // 'ja2ne' | 'ne2ja' — 聞き流しの再生順
  listenSource: null,         // 'conversation' | 'grammar' — 聞き流しの内容
  loop: true,
  speed: 1.0,
  gapTimer: null,
  nePlayCount: 0,
  // vocab state
  vocabCategoryIdx: null,   // WORD_CATEGORIES index
  vocabDirection: null,     // 'ne2ja' | 'ja2ne'
  cardOrder: [],            // shuffled or sequential indices
  cardCursor: 0,            // position in cardOrder
  cardFlipped: false,
  shuffleOn: false,
  autoFlipTimer: null,
  autoFlipOn: false,
};

const screens = document.querySelectorAll('[data-screen]');
const sentenceAudio = document.getElementById('sentenceAudio');

// ─────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────
function showScreen(name) {
  screens.forEach(s => s.classList.toggle('active', s.dataset.screen === name));
  state.screen = name;
  renderCrumbs();
  updateActiveTab();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateActiveTab() {
  // Determine active tab from state.mode
  const tabFromMode = state.mode || 'conversation';
  document.querySelectorAll('.bottom-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabFromMode);
  });
}

function renderCrumbs() {
  const c = document.getElementById('crumbs');
  c.innerHTML = '';
  const items = [];
  if (state.mode) {
    let modeName = '会話';
    if (state.mode === 'listening') modeName = '聞き流し';
    if (state.mode === 'grammar') modeName = '文法';
    if (state.mode === 'vocabulary') modeName = '単語';
    if (state.mode === 'settings') modeName = '設定';
    const targetScreen = state.mode === 'vocabulary' ? 'vocab-category'
      : state.mode === 'listening' ? 'listen-source'
      : state.mode === 'settings' ? 'settings' : 'theme';
    items.push({ name: modeName, screen: targetScreen });
  }
  // 聞き流しモードのソースをクラム表示
  if (state.mode === 'listening' && state.listenSource &&
      (state.screen === 'theme' || state.screen === 'level' || state.screen === 'listening')) {
    items.push({
      name: state.listenSource === 'grammar' ? '文法' : '会話',
      screen: 'theme',
    });
  }
  if (state.themeId && (state.screen === 'level' || state.screen === 'practice' || state.screen === 'listening')) {
    // 文法モード / 文法聞き流しは theme クリックで practice/listening に戻す
    const isGrammarFlow = state.mode === 'grammar' || (state.mode === 'listening' && state.listenSource === 'grammar');
    const themesArr = isGrammarFlow ? GRAMMAR_THEMES : THEMES;
    let themeTarget = 'level';
    if (state.mode === 'grammar') themeTarget = 'practice';
    else if (state.mode === 'listening' && state.listenSource === 'grammar') themeTarget = 'listening';
    items.push({ name: themesArr[state.themeId - 1], screen: themeTarget });
  }
  if (state.levelId && (state.screen === 'practice' || state.screen === 'listening')) {
    items.push({ name: LEVELS[state.levelId - 1].name, screen: state.screen });
  }
  if (state.mode === 'vocabulary' && state.vocabCategoryIdx !== null &&
      (state.screen === 'vocab-direction' || state.screen === 'flashcard')) {
    items.push({ name: WORD_CATEGORIES[state.vocabCategoryIdx].name, screen: 'vocab-direction' });
  }
  if (state.mode === 'vocabulary' && state.vocabDirection && state.screen === 'flashcard') {
    items.push({ name: state.vocabDirection === 'ne2ja' ? 'ネ→日' : '日→ネ', screen: 'flashcard' });
  }
  items.forEach((it, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'sep'; sep.textContent = '·';
      c.appendChild(sep);
    }
    if (i === items.length - 1) {
      const span = document.createElement('span');
      span.className = 'current'; span.textContent = it.name;
      c.appendChild(span);
    } else {
      const a = document.createElement('a');
      a.textContent = it.name;
      a.onclick = () => goTo(it.screen);
      c.appendChild(a);
    }
  });
}

function goTo(screen) {
  if (state.screen === 'listening' && screen !== 'listening') {
    stopListening();
  }
  if (state.screen === 'flashcard' && screen !== 'flashcard') {
    stopAutoFlip();
  }
  if (screen === 'listen-source') {
    state.listenSource = null; state.themeId = state.levelId = null; state.exampleIdx = 0;
  }
  else if (screen === 'theme') { state.themeId = state.levelId = null; state.exampleIdx = 0; state.revealed = false; }
  else if (screen === 'level') { state.levelId = null; state.exampleIdx = 0; state.revealed = false; }
  else if (screen === 'vocab-category') { state.vocabCategoryIdx = null; state.vocabDirection = null; }
  else if (screen === 'vocab-direction') { state.vocabDirection = null; }
  showScreen(screen);
  if (screen === 'listen-source') renderListenSource();
  if (screen === 'theme') renderThemes();
  if (screen === 'level') renderLevels();
  if (screen === 'practice') renderPractice();
  if (screen === 'listening') renderListening();
  if (screen === 'vocab-category') renderVocabCategories();
  if (screen === 'vocab-direction') renderVocabDirection();
  if (screen === 'flashcard') renderFlashcard();
  if (screen === 'settings') renderSettings();
}

// ─────────────────────────────────────────────
// Bottom Tab Navigation
// ─────────────────────────────────────────────
function switchTab(tab) {
  state.mode = tab;
  // Reset sub-state when switching tabs
  state.themeId = state.levelId = null;
  state.exampleIdx = 0;
  state.revealed = false;
  state.vocabCategoryIdx = null;
  state.vocabDirection = null;
  state.listenSource = null;
  if (state.screen === 'listening') stopListening();
  if (state.screen === 'flashcard') stopAutoFlip();

  if (tab === 'vocabulary') {
    showScreen('vocab-category');
    renderVocabCategories();
  } else if (tab === 'listening') {
    showScreen('listen-source');
    renderListenSource();
  } else if (tab === 'settings') {
    showScreen('settings');
    renderSettings();
  } else {
    // conversation or grammar
    showScreen('theme');
    renderThemes();
  }
}

document.querySelectorAll('[data-tab]').forEach(btn => {
  btn.onclick = () => switchTab(btn.dataset.tab);
});

// 聞き流しソース選択
document.querySelectorAll('[data-listen-source]').forEach(card => {
  card.onclick = () => {
    state.listenSource = card.dataset.listenSource;
    showScreen('theme');
    renderThemes();
  };
});

function renderListenSource() {
  // 設定パネルを反映
  renderRepeatPills();
  renderDirectionPills();
}

// ─────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────
function renderThemes() {
  const isGrammarMode = state.mode === 'grammar';
  const isGrammarListen = state.mode === 'listening' && state.listenSource === 'grammar';
  const useGrammarThemes = isGrammarMode || isGrammarListen;
  const themes = useGrammarThemes ? GRAMMAR_THEMES : THEMES;
  let desc;
  if (isGrammarMode) {
    desc = 'テーマを1つ選んで、文法の構造を学びましょう。';
  } else if (isGrammarListen) {
    desc = \`\${themes.length}の文法分野から1つ選んで聞き流しを始めましょう。\`;
  } else if (state.mode === 'listening') {
    desc = \`聞き流しを始める\${themes.length}のテーマから1つ選んでください。\`;
  } else {
    desc = 'テーマを1つ選んで、会話文を表現する練習を始めましょう。';
  }
  document.getElementById('themeScreenDesc').textContent = desc;
  const grid = document.getElementById('themeGrid');
  grid.innerHTML = '';
  themes.forEach((name, i) => {
    const id = i + 1;
    const card = document.createElement('div');
    card.className = 'theme-card';
    card.innerHTML = '<span class="theme-num">' + String(id).padStart(2,'0') + '</span><span class="theme-name">' + name + '</span>';
    card.onclick = () => {
      state.themeId = id;
      if (isGrammarMode) {
        // 文法モードはレベル選択をスキップして直接練習へ
        state.levelId = null;
        state.exampleIdx = 0;
        state.revealed = false;
        showScreen('practice');
        renderPractice();
      } else if (isGrammarListen) {
        // 文法聞き流し: レベル選択をスキップして直接 listening へ
        state.levelId = null;
        state.exampleIdx = 0;
        showScreen('listening');
        renderListening();
        startListening();
      } else {
        showScreen('level');
        document.getElementById('levelThemeName').textContent = name;
        renderLevels();
      }
    };
    grid.appendChild(card);
  });
}

// ─────────────────────────────────────────────
// LEVEL
// ─────────────────────────────────────────────
function renderRepeatPills() {
  document.querySelectorAll('#repeatPills button').forEach(btn => {
    const n = parseInt(btn.dataset.repeat, 10);
    btn.classList.toggle('on', n === state.nepaliRepeat);
  });
}

function renderDirectionPills() {
  document.querySelectorAll('#directionPills button').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.listenDir === state.listenDirection);
  });
}

document.querySelectorAll('#repeatPills button').forEach(btn => {
  btn.onclick = () => {
    state.nepaliRepeat = parseInt(btn.dataset.repeat, 10);
    renderRepeatPills();
  };
});

document.querySelectorAll('#directionPills button').forEach(btn => {
  btn.onclick = () => {
    state.listenDirection = btn.dataset.listenDir;
    renderDirectionPills();
  };
});

function renderLevels() {
  const grid = document.getElementById('levelGrid');
  grid.innerHTML = '';
  LEVELS.forEach(lv => {
    const card = document.createElement('div');
    card.className = 'level-card';
    const exs = EXAMPLES[state.themeId + '-' + lv.id] || [];
    card.innerHTML = '<div class="level-num">LEVEL ' + lv.id + '</div><div class="level-name">' + lv.name + '</div><div class="level-desc">' + lv.desc + '</div><div class="level-meta">例題 ' + exs.length + ' 問</div>';
    card.onclick = () => {
      state.levelId = lv.id;
      state.exampleIdx = 0;
      if (state.mode === 'listening') {
        showScreen('listening');
        renderListening();
        startListening();
      } else {
        state.revealed = false;
        showScreen('practice');
        renderPractice();
      }
    };
    grid.appendChild(card);
  });
}

// ─────────────────────────────────────────────
// Tokenization helpers
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// デーヴァナーガリー → ローマ字（IAST 簡易版）
// ─────────────────────────────────────────────
const DEVA_CONS = {
  'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ṅ',
  'च':'c','छ':'ch','ज':'j','झ':'jh','ञ':'ñ',
  'ट':'ṭ','ठ':'ṭh','ड':'ḍ','ढ':'ḍh','ण':'ṇ',
  'त':'t','थ':'th','द':'d','ध':'dh','न':'n',
  'प':'p','फ':'ph','ब':'b','भ':'bh','म':'m',
  'य':'y','र':'r','ल':'l','व':'v','श':'ś','ष':'ṣ','स':'s','ह':'h',
  'क्ष':'kṣ','त्र':'tr','ज्ञ':'jñ',
};
const DEVA_VOWELS = {
  'अ':'a','आ':'ā','इ':'i','ई':'ī','उ':'u','ऊ':'ū','ऋ':'ṛ','ए':'e','ऐ':'ai','ओ':'o','औ':'au',
};
const DEVA_VSIGNS = {
  'ा':'ā','ि':'i','ी':'ī','ु':'u','ू':'ū','ृ':'ṛ','े':'e','ै':'ai','ो':'o','ौ':'au',
};
const DEVA_VIRAMA = '\\u094D';

function toRomaji(text) {
  if (!text) return '';
  // 既存の単語辞書 (VOCAB) があれば優先利用
  if (typeof VOCAB !== 'undefined' && VOCAB[text] && VOCAB[text].rom) {
    return VOCAB[text].rom;
  }
  let out = '';
  const s = text;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    const ch2 = s.substr(i, 2);
    const ch3 = s.substr(i, 3);
    // 3文字結合 (क्ष, त्र, ज्ञ)
    if (DEVA_CONS[ch3]) {
      out += DEVA_CONS[ch3];
      const after = s[i + 3];
      if (after === DEVA_VIRAMA) { i += 4; continue; }
      if (after && DEVA_VSIGNS[after]) { out += DEVA_VSIGNS[after]; i += 4; continue; }
      out += 'a'; i += 3; continue;
    }
    if (DEVA_CONS[ch]) {
      out += DEVA_CONS[ch];
      const after = s[i + 1];
      if (after === DEVA_VIRAMA) { i += 2; continue; }
      if (after && DEVA_VSIGNS[after]) { out += DEVA_VSIGNS[after]; i += 2; continue; }
      out += 'a'; i += 1; continue;
    }
    if (DEVA_VOWELS[ch]) { out += DEVA_VOWELS[ch]; i += 1; continue; }
    if (ch === 'ं') { out += 'ṃ'; i += 1; continue; }
    if (ch === 'ः') { out += 'ḥ'; i += 1; continue; }
    if (ch === 'ँ') { out += 'm̐'; i += 1; continue; }
    if (ch === '।') { out += '.'; i += 1; continue; }
    if (ch === '॥') { out += '||'; i += 1; continue; }
    // それ以外（空白・英数字・句読点）はそのまま
    out += ch;
    i += 1;
  }
  return out;
}

function sentenceToRomaji(neText) {
  // 単語単位で分割 → VOCAB 優先で結合
  if (!neText) return '';
  return neText.split(/(\s+)/).map(tok => {
    if (/^\s+$/.test(tok)) return tok;
    return toRomaji(tok);
  }).join('');
}

function tokenize(text) {
  return text
    .replace(/([।॥?!,;:"'"'（）()「」『』])/g, ' $1 ')
    .split(/\\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0);
}
function isPunct(w) {
  return /^[।॥?!,;:"'"'（）()「」『』]+$/.test(w);
}

// ─────────────────────────────────────────────
// PRACTICE (Conversation mode)
// ─────────────────────────────────────────────
function renderPractice() {
  const isGrammar = state.mode === 'grammar';
  const themesArr = isGrammar ? GRAMMAR_THEMES : THEMES;
  const examples = isGrammar
    ? (GRAMMAR_EXAMPLES[state.themeId] || [])
    : (EXAMPLES[state.themeId + '-' + state.levelId] || []);
  if (!examples || examples.length === 0) return;
  const ex = examples[state.exampleIdx];
  const themeName = themesArr[state.themeId - 1];
  const levelName = isGrammar ? '文法' : LEVELS[state.levelId - 1].name;
  const isJa2Ne = state.practiceDirection === 'ja2ne';

  document.getElementById('practiceTheme').textContent = themeName;
  document.getElementById('practiceLevel').textContent = levelName;
  document.getElementById('practiceCurrent').textContent = state.exampleIdx + 1;
  document.getElementById('practiceTotal').textContent = examples.length;
  document.getElementById('miniPrev').disabled = state.exampleIdx === 0;
  document.getElementById('miniNext').disabled = state.exampleIdx >= examples.length - 1;

  document.body.dataset.revealed = state.revealed ? 'true' : 'false';

  const tokens = tokenize(ex.ne).filter(w => !isPunct(w));
  // 問題側(Phase A) / 答え側(Phase B) の音声パス
  // 文法モード: ./japanese-grammar/, ./nepali-grammar/   (例: 1-1.mp3 〜 30-20.mp3)
  // 会話モード: ./japanese/, ./nepali/                   (例: 1-1-1.mp3 〜 30-3-20.mp3)
  const audioBase = isGrammar
    ? state.themeId + '-' + (state.exampleIdx + 1) + '.mp3'
    : state.themeId + '-' + state.levelId + '-' + (state.exampleIdx + 1) + '.mp3';
  const jaFolder = isGrammar ? './japanese-grammar/' : './japanese/';
  const neFolder = isGrammar ? './nepali-grammar/' : './nepali/';
  const questionAudioPath = isJa2Ne ? jaFolder + audioBase : neFolder + audioBase;
  const answerAudioPath = isJa2Ne ? neFolder + audioBase : jaFolder + audioBase;

  // 問題文(Phase A) / 答え(Phase B)
  const questionText = isJa2Ne ? ex.jp : ex.ne;
  const answerText = isJa2Ne ? ex.ne : ex.jp;
  const questionClass = isJa2Ne ? 'pa-jp' : 'pa-ne';
  const answerClass = isJa2Ne ? 'ne-sentence' : 'ja-sentence';
  const revealBtnLabel = isJa2Ne ? 'ネパール語を表示' : '日本語を表示';

  const wordRows = tokens.map((w, i) => {
    const info = VOCAB[w] || {};
    const ja = info.ja || '';
    const rom = info.rom || '';
    const unknown = !ja;
    return '<div class="word' + (unknown ? ' unknown' : '') + '">' +
      '<span class="word-num">' + String(i+1).padStart(2,'0') + '</span>' +
      '<div class="word-content">' +
        '<span class="word-deva">' + w + '</span>' +
        (rom ? '<span class="word-roman">' + rom + '</span>' : '') +
      '</div>' +
      '<span class="word-meaning' + (unknown ? ' dim' : '') + '">' + (ja || '(辞書未登録)') + '</span>' +
    '</div>';
  }).join('');

  // 文法モードは単語辞書のカバレッジが低いため、単語内訳セクションを非表示
  const wordsSection = isGrammar ? '' :
    '<section class="words">' +
      '<div class="word-head"><span>#</span><span>単語</span><span>意味</span></div>' +
      wordRows +
    '</section>';

  const body = document.getElementById('practiceBody');
  body.innerHTML =
    '<div class="direction-toggle">' +
      '<span class="dir-label">出題方向:</span>' +
      '<button class="dir-pill' + (isJa2Ne ? ' on' : '') + '" data-dir="ja2ne">🇯🇵 → 🇳🇵</button>' +
      '<button class="dir-pill' + (!isJa2Ne ? ' on' : '') + '" data-dir="ne2ja">🇳🇵 → 🇯🇵</button>' +
    '</div>' +
    '<div class="phase-a">' +
      '<h1 class="' + questionClass + '">' + questionText + '</h1>' +
      (!isJa2Ne ? '<div class="sentence-rom">' + sentenceToRomaji(ex.ne) + '</div>' : '') +
      '<div class="phase-a-actions">' +
        '<button class="replay-btn" id="questionAudioBtn"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>音声を再生</button>' +
        '<button class="reveal-btn" id="revealBtn">' + revealBtnLabel + '<span class="kbd">Space</span></button>' +
      '</div>' +
    '</div>' +
    '<div class="phase-b">' +
      '<div class="ne-hero">' +
        '<div class="ne-hero-side">' +
          '<div class="ne-hero-side-item"><span class="key">Theme</span><span class="val">' + themeName + '</span></div>' +
          '<div class="ne-hero-side-item"><span class="key">Level</span><span class="val">' + levelName + '</span></div>' +
          '<div class="ne-hero-side-item"><span class="key">Example</span><span class="val">' + (state.exampleIdx + 1) + ' / ' + examples.length + '</span></div>' +
        '</div>' +
        '<div>' +
          '<h2 class="' + answerClass + '">' + answerText + '</h2>' +
          (isJa2Ne ? '<div class="sentence-rom">' + sentenceToRomaji(ex.ne) + '</div>' : '') +
          '<button class="replay-btn" id="replayBtn"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>音声を再生</button>' +
        '</div>' +
      '</div>' +
      wordsSection +
      '<div class="nav-row">' +
        '<button class="nav-btn prev" id="prevBtn">← 前へ</button>' +
        '<button class="nav-btn next" id="nextBtn">次へ →</button>' +
      '</div>' +
    '</div>';

  const revealBtn = document.getElementById('revealBtn');
  if (revealBtn) revealBtn.onclick = () => reveal();
  const questionAudioBtn = document.getElementById('questionAudioBtn');
  if (questionAudioBtn) questionAudioBtn.onclick = () => playPracticeAudio(questionAudioPath);
  const replayBtn = document.getElementById('replayBtn');
  if (replayBtn) replayBtn.onclick = () => playPracticeAudio(answerAudioPath);
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  if (prevBtn) { prevBtn.disabled = state.exampleIdx === 0; prevBtn.onclick = () => navigatePractice(-1); }
  if (nextBtn) { nextBtn.disabled = state.exampleIdx >= examples.length - 1; nextBtn.onclick = () => navigatePractice(1); }

  // 方向切替ピル
  document.querySelectorAll('.dir-pill').forEach(btn => {
    btn.onclick = () => {
      const newDir = btn.dataset.dir;
      if (newDir === state.practiceDirection) return;
      state.practiceDirection = newDir;
      state.revealed = false;
      renderPractice();
    };
  });
}

function playPracticeAudio(audioPath) {
  let count = 0;
  sentenceAudio.onended = () => {
    count++;
    if (count < state.nepaliRepeat) {
      sentenceAudio.currentTime = 0;
      sentenceAudio.play().catch(err => console.warn('audio:', err));
    }
  };
  sentenceAudio.onerror = null;
  sentenceAudio.src = audioPath;
  sentenceAudio.currentTime = 0;
  sentenceAudio.play().catch(err => console.warn('audio:', err));
}

function reveal() {
  state.revealed = true;
  document.body.dataset.revealed = 'true';
  // 自動再生はしない（ユーザーが音声ボタンで明示的に再生）
}

function navigatePractice(delta) {
  const exs = state.mode === 'grammar'
    ? (GRAMMAR_EXAMPLES[state.themeId] || [])
    : (EXAMPLES[state.themeId + '-' + state.levelId] || []);
  const newIdx = state.exampleIdx + delta;
  if (newIdx < 0 || newIdx >= exs.length) return;
  state.exampleIdx = newIdx;
  state.revealed = false;
  renderPractice();
}

// ─────────────────────────────────────────────
// LISTENING (Listening mode)
// ─────────────────────────────────────────────
// 設定で動的に変えるためゲッターで参照する
const getGapJa = () => window.__GAP_AFTER_JA ?? 400;
const getGapNe = () => window.__GAP_AFTER_NE ?? 1200;

function getListenExamples() {
  if (state.listenSource === 'grammar') {
    return GRAMMAR_EXAMPLES[state.themeId] || [];
  }
  return EXAMPLES[state.themeId + '-' + state.levelId] || [];
}

function getListenAudioBase() {
  if (state.listenSource === 'grammar') {
    return state.themeId + '-' + (state.exampleIdx + 1) + '.mp3';
  }
  return state.themeId + '-' + state.levelId + '-' + (state.exampleIdx + 1) + '.mp3';
}

function getListenJaSrc() {
  return (state.listenSource === 'grammar' ? './japanese-grammar/' : './japanese/') + getListenAudioBase();
}

function getListenNeSrc() {
  return (state.listenSource === 'grammar' ? './nepali-grammar/' : './nepali/') + getListenAudioBase();
}

function renderListening() {
  const isGrammarSrc = state.listenSource === 'grammar';
  const examples = getListenExamples();
  if (!examples || examples.length === 0) return;
  const ex = examples[state.exampleIdx];
  const themesArr = isGrammarSrc ? GRAMMAR_THEMES : THEMES;
  const themeName = themesArr[state.themeId - 1];
  const levelName = isGrammarSrc ? '文法' : LEVELS[state.levelId - 1].name;

  document.getElementById('listenTheme').textContent = themeName;
  document.getElementById('listenLevel').textContent = levelName;
  document.getElementById('listenCurrent').textContent = state.exampleIdx + 1;
  document.getElementById('listenTotal').textContent = examples.length;

  const posEl = document.getElementById('lpPos');
  const totalTextEl = document.getElementById('lpOverallText');
  if (isGrammarSrc) {
    posEl.textContent = '分野 ' + state.themeId + ' / ' + GRAMMAR_THEMES.length +
      ' · 例題 ' + (state.exampleIdx + 1) + ' / ' + examples.length;
    const overall = (state.themeId - 1) * 20 + state.exampleIdx + 1;
    const grandTotal = GRAMMAR_THEMES.length * 20;
    totalTextEl.textContent = overall + ' / ' + grandTotal;
    document.getElementById('lpBar').style.width = (overall / grandTotal * 100) + '%';
  } else {
    posEl.textContent = 'テーマ ' + state.themeId + ' / ' + THEMES.length +
      ' · レベル ' + state.levelId + ' / ' + LEVELS.length +
      ' · 例題 ' + (state.exampleIdx + 1) + ' / ' + examples.length;
    const overall = (state.themeId - 1) * 60 + (state.levelId - 1) * 20 + state.exampleIdx + 1;
    totalTextEl.textContent = overall + ' / ${totalEx}';
    document.getElementById('lpBar').style.width = (overall / ${totalEx} * 100) + '%';
  }

  document.getElementById('textJa').textContent = ex.jp;
  document.getElementById('textNe').textContent = ex.ne;
  document.getElementById('textNeRom').textContent = sentenceToRomaji(ex.ne);

  updateListenActiveRow();
  updatePlayIcon();
}

function updateListenActiveRow() {
  const rowJa = document.getElementById('rowJa');
  const rowNe = document.getElementById('rowNe');
  rowJa.classList.toggle('active', state.listenPhase === 'ja');
  rowNe.classList.toggle('active', state.listenPhase === 'ne');
}

function updatePlayIcon() {
  const ic = document.getElementById('playIcon');
  if (state.listenPlaying) {
    // Pause icon (rounded bars)
    ic.innerHTML = '<rect x="6.5" y="5" width="4" height="14" rx="1.5"/><rect x="13.5" y="5" width="4" height="14" rx="1.5"/>';
  } else {
    // Play icon (rounded triangle)
    ic.innerHTML = '<path d="M8 5.5v13c0 .8.9 1.3 1.6.9l10.5-6.5c.6-.4.6-1.3 0-1.7L9.6 4.6C8.9 4.2 8 4.7 8 5.5z"/>';
  }
}

function startListening() {
  state.listenPlaying = true;
  updatePlayIcon();
  playSequenceForCurrent();
}

function stopListening() {
  state.listenPlaying = false;
  state.listenPhase = 'idle';
  sentenceAudio.pause();
  if (state.gapTimer) { clearTimeout(state.gapTimer); state.gapTimer = null; }
  updateListenActiveRow();
  updatePlayIcon();
}

// 方向に応じて 1言語目 → ギャップ → 2言語目 → ギャップ → 次例題 のシーケンスを実行
function playSequenceForCurrent() {
  if (!state.listenPlaying) return;
  if (state.listenDirection === 'ja2ne') {
    playJapanese(() => {
      state.gapTimer = setTimeout(() => {
        playNepaliWithRepeat(() => {
          state.gapTimer = setTimeout(advanceListening, getGapNe());
        });
      }, getGapJa());
    });
  } else {
    // ne2ja
    playNepaliWithRepeat(() => {
      state.gapTimer = setTimeout(() => {
        playJapanese(() => {
          state.gapTimer = setTimeout(advanceListening, getGapNe());
        });
      }, getGapNe());
    });
  }
}

function playJapanese(onComplete) {
  if (!state.listenPlaying) return;
  state.listenPhase = 'ja';
  updateListenActiveRow();
  sentenceAudio.onended = () => {
    if (!state.listenPlaying) return;
    state.listenPhase = 'gap-ja';
    updateListenActiveRow();
    onComplete();
  };
  sentenceAudio.onerror = () => onAudioError();
  sentenceAudio.src = getListenJaSrc();
  sentenceAudio.playbackRate = state.speed;
  sentenceAudio.play().catch(err => onAudioError());
}

function playNepaliWithRepeat(onComplete) {
  if (!state.listenPlaying) return;
  state.listenPhase = 'ne';
  state.nePlayCount = 0;
  updateListenActiveRow();
  sentenceAudio.onended = () => {
    if (!state.listenPlaying) return;
    state.nePlayCount++;
    if (state.nePlayCount < state.nepaliRepeat) {
      sentenceAudio.currentTime = 0;
      sentenceAudio.play().catch(err => onAudioError());
      return;
    }
    state.listenPhase = 'gap-ne';
    updateListenActiveRow();
    onComplete();
  };
  sentenceAudio.onerror = () => onAudioError();
  sentenceAudio.src = getListenNeSrc();
  sentenceAudio.playbackRate = state.speed;
  sentenceAudio.play().catch(err => onAudioError());
}

function onAudioError() {
  // 音声ファイルが見つからない場合、次へ自動スキップ
  console.warn('audio error - skipping to next');
  if (state.listenPlaying) {
    state.gapTimer = setTimeout(() => advanceListening(), 400);
  }
}

// 例題が終了した時の進行ルール
//   会話: テーマを優先して進める（同レベルで全テーマを横断 → 次レベル）
//          分野1の初級 → 分野2の初級 → … → 分野30の初級 → 分野1の中級 → …
//   文法: 分野を順送り（分野1 → 分野2 → … → 分野30 → ループ）
function advanceListening() {
  if (!state.listenPlaying) return;
  state.exampleIdx++;
  const isGrammarSrc = state.listenSource === 'grammar';
  const examples = getListenExamples();
  if (state.exampleIdx >= examples.length) {
    state.exampleIdx = 0;
    if (isGrammarSrc) {
      state.themeId++;
      if (state.themeId > GRAMMAR_THEMES.length) {
        if (state.loop) {
          state.themeId = 1;
        } else {
          state.listenPlaying = false;
          state.listenPhase = 'idle';
          updateListenActiveRow();
          updatePlayIcon();
          return;
        }
      }
    } else {
      // 会話: テーマを優先して送る（テーマ末尾でレベルを送る）
      state.themeId++;
      if (state.themeId > THEMES.length) {
        state.themeId = 1;
        state.levelId++;
        if (state.levelId > LEVELS.length) {
          if (state.loop) {
            state.levelId = 1;
          } else {
            state.listenPlaying = false;
            state.listenPhase = 'idle';
            updateListenActiveRow();
            updatePlayIcon();
            return;
          }
        }
      }
    }
  }
  renderListening();
  playSequenceForCurrent();
}

function listeningNavigate(delta) {
  const wasPlaying = state.listenPlaying;
  if (state.gapTimer) { clearTimeout(state.gapTimer); state.gapTimer = null; }
  sentenceAudio.pause();
  state.listenPlaying = false;

  const isGrammarSrc = state.listenSource === 'grammar';
  const getExs = (t, l) => isGrammarSrc
    ? (GRAMMAR_EXAMPLES[t] || [])
    : (EXAMPLES[t + '-' + l] || []);

  let newIdx = state.exampleIdx + delta;
  let newLevel = state.levelId;
  let newTheme = state.themeId;
  const currentExs = getExs(newTheme, newLevel);

  if (newIdx < 0) {
    // 前のテーマへ（テーマ先頭なら前のレベルへ。会話モードのみ）
    if (isGrammarSrc) {
      newTheme--;
      if (newTheme < 1) newTheme = GRAMMAR_THEMES.length;
    } else {
      newTheme--;
      if (newTheme < 1) {
        newTheme = THEMES.length;
        newLevel--;
        if (newLevel < 1) newLevel = LEVELS.length;
      }
    }
    const prevExs = getExs(newTheme, newLevel);
    newIdx = prevExs.length - 1;
  } else if (newIdx >= currentExs.length) {
    // 次のテーマへ
    if (isGrammarSrc) {
      newTheme++;
      if (newTheme > GRAMMAR_THEMES.length) newTheme = 1;
    } else {
      newTheme++;
      if (newTheme > THEMES.length) {
        newTheme = 1;
        newLevel++;
        if (newLevel > LEVELS.length) newLevel = 1;
      }
    }
    newIdx = 0;
  }
  state.themeId = newTheme;
  state.levelId = newLevel;
  state.exampleIdx = newIdx;
  renderListening();
  if (wasPlaying) {
    state.listenPlaying = true;
    updatePlayIcon();
    playSequenceForCurrent();
  } else {
    updatePlayIcon();
  }
}

function togglePlay() {
  if (state.listenPlaying) {
    state.listenPlaying = false;
    sentenceAudio.pause();
    if (state.gapTimer) { clearTimeout(state.gapTimer); state.gapTimer = null; }
    updatePlayIcon();
  } else {
    startListening();
  }
}

// Listening controls
document.getElementById('listenPlay').onclick = togglePlay;
document.getElementById('listenPrev').onclick = () => listeningNavigate(-1);
document.getElementById('listenNext').onclick = () => listeningNavigate(1);
document.getElementById('listenChangeTheme').onclick = () => goTo('theme');

const pillLoop = document.getElementById('pillLoop');
pillLoop.classList.toggle('on', state.loop);
pillLoop.onclick = () => {
  state.loop = !state.loop;
  pillLoop.classList.toggle('on', state.loop);
};

const pillSpeed = document.getElementById('pillSpeed');
const SPEEDS = [0.8, 1.0, 1.2, 1.5];
pillSpeed.onclick = () => {
  const idx = SPEEDS.indexOf(state.speed);
  state.speed = SPEEDS[(idx + 1) % SPEEDS.length];
  pillSpeed.textContent = '🐢 速度 ×' + state.speed.toFixed(1);
  sentenceAudio.playbackRate = state.speed;
};

// ─────────────────────────────────────────────
// VOCAB: Category selection
// ─────────────────────────────────────────────
function renderVocabCategories() {
  const grid = document.getElementById('vocabCategoryGrid');
  grid.innerHTML = '';
  WORD_CATEGORIES.forEach((cat, i) => {
    const card = document.createElement('div');
    card.className = 'theme-card vocab-cat-card';
    const m = cat.name.match(/^(\\d+)_(.+)$/);
    const num = m ? m[1] : String(i + 1).padStart(2, '0');
    const name = m ? m[2] : cat.name;
    card.innerHTML =
      '<span class="theme-num">' + num + '</span>' +
      '<span class="theme-name">' + name + '</span>' +
      '<span class="vocab-cat-count">' + cat.words.length + '語</span>';
    card.onclick = () => {
      state.vocabCategoryIdx = i;
      showScreen('vocab-direction');
      renderVocabDirection();
    };
    grid.appendChild(card);
  });
}

// ─────────────────────────────────────────────
// VOCAB: Direction selection
// ─────────────────────────────────────────────
function renderVocabDirection() {
  if (state.vocabCategoryIdx === null) return;
  const cat = WORD_CATEGORIES[state.vocabCategoryIdx];
  document.getElementById('vocabDirCategoryName').textContent = cat.name.replace(/^\\d+_/, '');
}

document.querySelectorAll('[data-dir]').forEach(card => {
  card.onclick = () => {
    state.vocabDirection = card.dataset.dir;
    startFlashcards();
  };
});

// ─────────────────────────────────────────────
// VOCAB: Flashcard
// ─────────────────────────────────────────────
function startFlashcards() {
  const cat = WORD_CATEGORIES[state.vocabCategoryIdx];
  state.cardOrder = cat.words.map((_, i) => i);
  if (state.shuffleOn) shuffleArray(state.cardOrder);
  state.cardCursor = 0;
  state.cardFlipped = false;
  showScreen('flashcard');
  renderFlashcard();
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderFlashcard() {
  if (state.vocabCategoryIdx === null) return;
  const cat = WORD_CATEGORIES[state.vocabCategoryIdx];
  if (!state.cardOrder || state.cardOrder.length === 0) {
    state.cardOrder = cat.words.map((_, i) => i);
  }
  const wIdx = state.cardOrder[state.cardCursor];
  const word = cat.words[wIdx];
  const dir = state.vocabDirection;

  const frontIsNe = dir === 'ne2ja';
  const frontText = frontIsNe ? word.ne : word.ja;
  const backText = frontIsNe ? word.ja : word.ne;
  const frontLabel = frontIsNe ? '🇳🇵 NEPALI' : '🇯🇵 JAPANESE';
  const backLabel = frontIsNe ? '🇯🇵 JAPANESE' : '🇳🇵 NEPALI';
  const frontClass = frontIsNe ? 'card-text-ne' : 'card-text-ja';
  const backClass = frontIsNe ? 'card-text-ja' : 'card-text-ne';

  // Romanization for Nepali sides (VOCAB 優先、なければ transliterator)
  const rom = (VOCAB[word.ne] && VOCAB[word.ne].rom) || toRomaji(word.ne);
  let frontExtra = '';
  let backExtra = '';
  if (frontIsNe && rom) frontExtra = '<div class="card-rom">' + rom + '</div>';
  if (!frontIsNe && rom) backExtra = '<div class="card-rom">' + rom + '</div>';

  document.getElementById('cardFrontLabel').textContent = frontLabel;
  document.getElementById('cardBackLabel').textContent = backLabel;
  document.getElementById('cardFrontText').innerHTML = '<div class="' + frontClass + '">' + frontText + '</div>' + frontExtra;
  document.getElementById('cardBackText').innerHTML = '<div class="' + backClass + '">' + backText + '</div>' + backExtra;

  document.getElementById('flashcardEl').dataset.flipped = state.cardFlipped ? 'true' : 'false';

  document.getElementById('cardCategoryName').textContent = cat.name.replace(/^\\d+_/, '');
  document.getElementById('cardDirection').textContent = dir === 'ne2ja' ? 'ネ→日' : '日→ネ';
  document.getElementById('cardCurrent').textContent = state.cardCursor + 1;
  document.getElementById('cardTotal').textContent = state.cardOrder.length;
  document.getElementById('cardPosNow').textContent = state.cardCursor + 1;
  document.getElementById('cardPosTotal').textContent = state.cardOrder.length;

  document.getElementById('cardPrev').disabled = state.cardCursor === 0;
  document.getElementById('cardNext').disabled = state.cardCursor >= state.cardOrder.length - 1;
}

function flipCard() {
  state.cardFlipped = !state.cardFlipped;
  document.getElementById('flashcardEl').dataset.flipped = state.cardFlipped ? 'true' : 'false';
  if (state.autoFlipOn) {
    stopAutoFlip();
    if (state.cardFlipped) {
      // Auto-advance after a moment when flipped
      state.autoFlipTimer = setTimeout(() => {
        if (state.cardCursor < state.cardOrder.length - 1) {
          navigateCard(1);
        }
      }, 2200);
    }
  }
}

function navigateCard(delta) {
  const newIdx = state.cardCursor + delta;
  if (newIdx < 0 || newIdx >= state.cardOrder.length) return;
  state.cardCursor = newIdx;
  state.cardFlipped = false;
  stopAutoFlip();
  renderFlashcard();
  // Auto-flip schedule
  if (state.autoFlipOn) {
    state.autoFlipTimer = setTimeout(() => {
      state.cardFlipped = true;
      document.getElementById('flashcardEl').dataset.flipped = 'true';
      state.autoFlipTimer = setTimeout(() => {
        if (state.cardCursor < state.cardOrder.length - 1) {
          navigateCard(1);
        }
      }, 2200);
    }, 2500);
  }
}

function stopAutoFlip() {
  if (state.autoFlipTimer) { clearTimeout(state.autoFlipTimer); state.autoFlipTimer = null; }
}

document.getElementById('flashcardEl').onclick = flipCard;
document.getElementById('cardPrev').onclick = () => navigateCard(-1);
document.getElementById('cardNext').onclick = () => navigateCard(1);
document.getElementById('cardChangeCat').onclick = () => goTo('vocab-category');

const pillShuffle = document.getElementById('pillShuffle');
pillShuffle.onclick = () => {
  state.shuffleOn = !state.shuffleOn;
  pillShuffle.classList.toggle('on', state.shuffleOn);
  if (state.shuffleOn) shuffleArray(state.cardOrder);
  else {
    const cat = WORD_CATEGORIES[state.vocabCategoryIdx];
    state.cardOrder = cat.words.map((_, i) => i);
  }
  state.cardCursor = 0;
  state.cardFlipped = false;
  renderFlashcard();
};

const pillAutoFlip = document.getElementById('pillAutoFlip');
pillAutoFlip.onclick = () => {
  state.autoFlipOn = !state.autoFlipOn;
  pillAutoFlip.classList.toggle('on', state.autoFlipOn);
  pillAutoFlip.textContent = state.autoFlipOn ? '⏱ 自動反転 ON' : '⏱ 自動反転 OFF';
  if (state.autoFlipOn) {
    // Start cycle immediately
    state.autoFlipTimer = setTimeout(() => {
      state.cardFlipped = true;
      document.getElementById('flashcardEl').dataset.flipped = 'true';
      state.autoFlipTimer = setTimeout(() => {
        if (state.cardCursor < state.cardOrder.length - 1) navigateCard(1);
      }, 2200);
    }, 2500);
  } else {
    stopAutoFlip();
  }
};

// ─────────────────────────────────────────────
// Top-level + keyboard
// ─────────────────────────────────────────────
document.getElementById('miniPrev').onclick = () => navigatePractice(-1);
document.getElementById('miniNext').onclick = () => navigatePractice(1);

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (state.screen === 'practice') {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!state.revealed) reveal();
      // 答え表示後の Space は何もしない（音声は明示的にボタンで）
    } else if (e.code === 'ArrowLeft') { e.preventDefault(); navigatePractice(-1); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); navigatePractice(1); }
  } else if (state.screen === 'listening') {
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); listeningNavigate(-1); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); listeningNavigate(1); }
  } else if (state.screen === 'flashcard') {
    if (e.code === 'Space') { e.preventDefault(); flipCard(); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); navigateCard(-1); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); navigateCard(1); }
  }
});

// ─────────────────────────────────────────────
// Settings (永続化 + 各種ハンドラ)
// ─────────────────────────────────────────────
const SETTINGS_KEY = 'nepali-app-settings';

// 設定の既定値
const DEFAULT_SETTINGS = {
  speed: 1.0,
  repeat: 1,
  practiceDir: 'ja2ne',
  listenDir: 'ja2ne',
  loop: true,
  gap: 'normal',          // 'short' | 'normal' | 'long'
  romaji: true,
  theme: 'system',        // 'light' | 'dark' | 'system'
  font: 'medium',         // 'small' | 'medium' | 'large'
  autoFlip: false,
  shuffle: false,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

function applySettings(s) {
  // state へ反映
  state.speed = s.speed;
  state.nepaliRepeat = s.repeat;
  state.practiceDirection = s.practiceDir;
  state.listenDirection = s.listenDir;
  state.loop = s.loop;
  state.autoFlipOn = s.autoFlip;
  state.shuffleOn = s.shuffle;

  // ギャップ ms
  const gapMap = { short: { ja: 200, ne: 600 }, normal: { ja: 400, ne: 1200 }, long: { ja: 800, ne: 2000 } };
  const g = gapMap[s.gap] || gapMap.normal;
  window.__GAP_AFTER_JA = g.ja;
  window.__GAP_AFTER_NE = g.ne;

  // テーマ
  const root = document.documentElement;
  const wantDark = s.theme === 'dark' || (s.theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = wantDark ? 'dark' : 'light';

  // フォントサイズ
  const fontMap = { small: '14px', medium: '16px', large: '18px' };
  root.style.fontSize = fontMap[s.font] || fontMap.medium;

  // ローマ字表記
  root.dataset.romaji = s.romaji ? 'on' : 'off';

  // 既存の pill UI 同期
  renderRepeatPills();
  renderDirectionPills();
  if (pillLoop) pillLoop.classList.toggle('on', s.loop);
  if (pillShuffle) pillShuffle.classList.toggle('on', s.shuffle);
  if (pillAutoFlip) {
    pillAutoFlip.classList.toggle('on', s.autoFlip);
    pillAutoFlip.textContent = s.autoFlip ? '⏱ 自動反転 ON' : '⏱ 自動反転 OFF';
  }
  if (pillSpeed) pillSpeed.textContent = '🐢 速度 ×' + s.speed.toFixed(1);
}

let __settings = loadSettings();
applySettings(__settings);

function renderSettings() {
  const s = __settings;
  // ピル系の選択状態を反映
  document.querySelectorAll('#set-speed [data-speed]').forEach(b => {
    b.classList.toggle('on', parseFloat(b.dataset.speed) === s.speed);
  });
  document.querySelectorAll('#set-repeat [data-repeat]').forEach(b => {
    b.classList.toggle('on', parseInt(b.dataset.repeat, 10) === s.repeat);
  });
  document.querySelectorAll('#set-practice-dir [data-pdir]').forEach(b => {
    b.classList.toggle('on', b.dataset.pdir === s.practiceDir);
  });
  document.querySelectorAll('#set-listen-dir [data-ldir]').forEach(b => {
    b.classList.toggle('on', b.dataset.ldir === s.listenDir);
  });
  document.querySelectorAll('#set-gap [data-gap]').forEach(b => {
    b.classList.toggle('on', b.dataset.gap === s.gap);
  });
  document.querySelectorAll('#set-theme [data-theme]').forEach(b => {
    b.classList.toggle('on', b.dataset.theme === s.theme);
  });
  document.querySelectorAll('#set-font [data-font]').forEach(b => {
    b.classList.toggle('on', b.dataset.font === s.font);
  });
  document.getElementById('set-loop').classList.toggle('on', s.loop);
  document.getElementById('set-romaji').classList.toggle('on', s.romaji);
  document.getElementById('set-autoflip').classList.toggle('on', s.autoFlip);
  document.getElementById('set-shuffle').classList.toggle('on', s.shuffle);
}

function updateSetting(key, value) {
  __settings[key] = value;
  saveSettings(__settings);
  applySettings(__settings);
  renderSettings();
}

// 各設定項目のイベント
document.querySelectorAll('#set-speed [data-speed]').forEach(b => b.onclick = () => updateSetting('speed', parseFloat(b.dataset.speed)));
document.querySelectorAll('#set-repeat [data-repeat]').forEach(b => b.onclick = () => updateSetting('repeat', parseInt(b.dataset.repeat, 10)));
document.querySelectorAll('#set-practice-dir [data-pdir]').forEach(b => b.onclick = () => updateSetting('practiceDir', b.dataset.pdir));
document.querySelectorAll('#set-listen-dir [data-ldir]').forEach(b => b.onclick = () => updateSetting('listenDir', b.dataset.ldir));
document.querySelectorAll('#set-gap [data-gap]').forEach(b => b.onclick = () => updateSetting('gap', b.dataset.gap));
document.querySelectorAll('#set-theme [data-theme]').forEach(b => b.onclick = () => updateSetting('theme', b.dataset.theme));
document.querySelectorAll('#set-font [data-font]').forEach(b => b.onclick = () => updateSetting('font', b.dataset.font));
document.getElementById('set-loop').onclick = () => updateSetting('loop', !__settings.loop);
document.getElementById('set-romaji').onclick = () => updateSetting('romaji', !__settings.romaji);
document.getElementById('set-autoflip').onclick = () => updateSetting('autoFlip', !__settings.autoFlip);
document.getElementById('set-shuffle').onclick = () => updateSetting('shuffle', !__settings.shuffle);

document.getElementById('set-reset').onclick = () => {
  if (confirm('全ての設定を初期値に戻しますか？')) {
    __settings = { ...DEFAULT_SETTINGS };
    saveSettings(__settings);
    applySettings(__settings);
    renderSettings();
  }
};

document.getElementById('set-share').onclick = async () => {
  const text = '聞いて話せるネパール語 — 日本語からネパール語の瞬間作文トレーニングアプリ';
  if (navigator.share) {
    try { await navigator.share({ title: '聞いて話せるネパール語', text }); } catch {}
  } else {
    try {
      await navigator.clipboard.writeText(text);
      alert('共有用テキストをコピーしました');
    } catch { alert(text); }
  }
};

// システムテーマ変更を検知して反映
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (__settings.theme === 'system') applySettings(__settings);
  });
}

// 初期表示: 会話モード（テーマ一覧）をアクティブに
switchTab('conversation');

// スプラッシュ画面の自動非表示 (1.5s ロゴ + 350ms フェードアウト)
setTimeout(() => {
  const splash = document.getElementById('splash');
  if (splash) splash.classList.add('done');
}, 1550);
</script>
</body>
</html>`;
}

async function main() {
  console.log('Excelデータ読み込み中...');
  const examples = await loadExcelData();
  const exCount = Object.values(examples).reduce((s, arr) => s + arr.length, 0);
  console.log(`  キー数: ${Object.keys(examples).length}`);
  console.log(`  総例題数: ${exCount}`);

  console.log('語彙辞書読み込み中...');
  const vocab = loadVocab();
  console.log(`  登録語数: ${Object.keys(vocab).length}`);

  console.log('単語データ読み込み中...');
  const wordsCategories = await loadWordsExcel();
  const wordsCount = wordsCategories.reduce((s, c) => s + c.words.length, 0);
  console.log(`  カテゴリ数: ${wordsCategories.length}`);
  console.log(`  総単語数: ${wordsCount}`);

  console.log('文法データ読み込み中...');
  const { themes: grammarThemes, examples: grammarExamples } = await loadGrammarExcel();
  const grammarCount = Object.values(grammarExamples).reduce((s, a) => s + a.length, 0);
  console.log(`  文法分野数: ${grammarThemes.length}`);
  console.log(`  文法例題数: ${grammarCount}`);

  console.log('HTML生成中...');
  const html = buildHtml(examples, vocab, wordsCategories, grammarThemes, grammarExamples);
  fs.writeFileSync(OUTPUT_PATH, html);
  const sizeKB = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(`完了: ${OUTPUT_PATH}`);
  console.log(`  ファイルサイズ: ${sizeKB} KB`);
}

main().catch(e => { console.error(e); process.exit(1); });
