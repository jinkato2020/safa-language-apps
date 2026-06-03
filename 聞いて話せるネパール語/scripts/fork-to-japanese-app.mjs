// 「聞いて話せるネパール語」プロジェクトから「聞いて話せる日本語」用の
// 出発点となるデータを別フォルダにコピーする。
//
// 出力: C:/Users/jwpsa/Documents/desktop/claude/聞いて話せる日本語
//
// 含めるもの:
//   - expo-app/ (node_modules / .expo / .git / .claude 除く)
//   - scripts/ (音声生成・データ加工)
//   - Excel ファイル (テンプレート/データソース)
//   - ドキュメント (PROJECT_SPEC.md, README.md, privacy-policy.md など)
//   - アプリアイコン・スプラッシュ画像
//   - .gitignore, .env.example
//   - 既存音声フォルダ (japanese/, nepali/, japanese-grammar/, nepali-grammar/)
//     → 日本語アプリでも音声リソースを使い回せる
//
// 除外するもの:
//   - .env (シークレット)
//   - .git/ (新規履歴)
//   - node_modules/ (npm install で再生成)
//   - .expo/, .claude/ (ローカルキャッシュ)
//   - *.backup-* (バックアップファイル)
//   - ~$*.xlsx (Excel 開いている時の一時ファイル)
//   - old/, screenshot/ (古い作業ファイル)
//   - credentials*/, *.p8, *.p12, *.mobileprovision (機密)
//   - safa-splash.mp4 (動画は別途検討)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC = path.resolve(__dirname, '..');
const DST = 'C:/Users/jwpsa/Documents/desktop/claude/聞いて話せる日本語';

// パスの一部にマッチする除外パターン
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', '.expo', '.claude',
  'old', 'screenshot', 'credentials',
]);

const EXCLUDE_FILES = (name) => {
  if (name === '.env') return true;
  if (name.startsWith('~$')) return true;             // Excel 一時
  if (name.includes('.backup-')) return true;          // バックアップ
  if (/\.(p8|p12|mobileprovision|cer|pem|jks|key)$/i.test(name)) return true; // 機密鍵
  if (name === 'safa-splash.mp4') return true;
  return false;
};

let copiedFiles = 0;
let copiedBytes = 0;
let skippedFiles = 0;
let skippedDirs = 0;

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyRecursive(srcPath, dstPath, relPath = '') {
  const stat = fs.statSync(srcPath);
  if (stat.isDirectory()) {
    const base = path.basename(srcPath);
    if (EXCLUDE_DIRS.has(base)) {
      skippedDirs++;
      return;
    }
    ensureDir(dstPath);
    const entries = fs.readdirSync(srcPath);
    for (const entry of entries) {
      copyRecursive(
        path.join(srcPath, entry),
        path.join(dstPath, entry),
        relPath ? `${relPath}/${entry}` : entry,
      );
    }
  } else if (stat.isFile()) {
    const base = path.basename(srcPath);
    if (EXCLUDE_FILES(base)) {
      skippedFiles++;
      return;
    }
    ensureDir(path.dirname(dstPath));
    fs.copyFileSync(srcPath, dstPath);
    copiedFiles++;
    copiedBytes += stat.size;
  }
}

const ITEMS = [
  // ── アプリ本体 ──
  { src: 'expo-app',         dst: 'expo-app',         desc: 'React Native アプリ本体' },

  // ── スクリプト ──
  { src: 'scripts',          dst: 'scripts',          desc: '音声生成・データ加工スクリプト' },

  // ── データソース (Excel) ──
  { src: '会話.xlsx',         dst: '会話.xlsx',         desc: '会話例題マスター (テンプレ)' },
  { src: '単語.xlsx',         dst: '単語.xlsx',         desc: '単語マスター (テンプレ)' },
  { src: '文法.xlsx',         dst: '文法.xlsx',         desc: '文法例題マスター (テンプレ)' },
  { src: 'バイリンガル.xlsx', dst: 'バイリンガル.xlsx', desc: 'i18n 翻訳テンプレ' },
  { src: '追加.xlsx',         dst: '追加.xlsx',         desc: '追加修正用 (空でも可)' },
  { src: '文法修正.xlsx',     dst: '文法修正.xlsx',     desc: '文法修正テンプレ' },

  // ── 既存音声 (リソース流用可) ──
  { src: 'japanese',         dst: 'japanese',         desc: '日本語音声 (会話) — 新アプリで target として再利用' },
  { src: 'nepali',           dst: 'nepali',           desc: 'ネパール語音声 (会話) — 新アプリで source として再利用' },
  { src: 'japanese-grammar', dst: 'japanese-grammar', desc: '日本語音声 (文法) — 同上' },
  { src: 'nepali-grammar',   dst: 'nepali-grammar',   desc: 'ネパール語音声 (文法) — 同上' },

  // ── データ ──
  { src: 'data',             dst: 'data',             desc: 'vocab.json などのキャッシュ' },

  // ── デザイン ──
  { src: 'designs',          dst: 'designs',          desc: 'デザイン素材' },

  // ── ドキュメント ──
  { src: 'PROJECT_SPEC.md',  dst: 'PROJECT_SPEC.md',  desc: 'プロジェクト仕様' },
  { src: 'README.md',        dst: 'README.md',        desc: '概要 (要書き換え)' },
  { src: 'privacy-policy.md', dst: 'privacy-policy.md', desc: 'プライバシーポリシー (要書き換え)' },
  { src: '戦略.docx',         dst: '戦略.docx',         desc: '戦略ドキュメント' },

  // ── アプリストア素材 ──
  { src: 'app_icon_android_512.png',      dst: 'app_icon_android_512.png', desc: 'Android アプリアイコン (差し替え用)' },
  { src: 'feature_graphic_1024x500.png',  dst: 'feature_graphic_1024x500.png', desc: 'Play Store フィーチャーグラフィック' },
  { src: 'splash.png',                     dst: 'splash.png',                desc: 'スプラッシュ画像' },

  // ── プロジェクトメタ ──
  { src: 'package.json',     dst: 'package.json',     desc: 'ルート package.json (scripts 実行用)' },
  { src: 'package-lock.json', dst: 'package-lock.json', desc: 'lock ファイル' },
  { src: '.env.example',     dst: '.env.example',     desc: '環境変数テンプレ (.env は手動作成)' },
  { src: '.gitignore',       dst: '.gitignore',       desc: '' },
];

async function main() {
  console.log('=== 「聞いて話せる日本語」用フォーク ===');
  console.log(`コピー元: ${SRC}`);
  console.log(`コピー先: ${DST}`);

  if (fs.existsSync(DST)) {
    const items = fs.readdirSync(DST);
    if (items.length > 0) {
      console.log(`\n⚠️  WARNING: 出力先に既存ファイル ${items.length} 個があります。`);
      console.log(`   既存ファイルは上書きされます。中止するには Ctrl+C。`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  ensureDir(DST);

  console.log('\nコピー開始...\n');
  for (const item of ITEMS) {
    const srcPath = path.join(SRC, item.src);
    const dstPath = path.join(DST, item.dst);
    if (!fs.existsSync(srcPath)) {
      console.log(`  ⊘ ${item.src} (存在しないのでスキップ)`);
      continue;
    }
    const before = copiedFiles;
    const beforeBytes = copiedBytes;
    copyRecursive(srcPath, dstPath);
    const newFiles = copiedFiles - before;
    const newBytes = copiedBytes - beforeBytes;
    const mb = (newBytes / 1024 / 1024).toFixed(1);
    console.log(`  ✓ ${item.src.padEnd(40)} (${newFiles} files, ${mb}MB)${item.desc ? '  — ' + item.desc : ''}`);
  }

  console.log('\n========================================');
  console.log(`コピー完了: ${copiedFiles} ファイル, ${(copiedBytes / 1024 / 1024).toFixed(1)}MB`);
  console.log(`スキップ: ${skippedFiles} ファイル / ${skippedDirs} ディレクトリ`);
  console.log(`出力先: ${DST}`);
}

main().catch(e => { console.error(e); process.exit(1); });
