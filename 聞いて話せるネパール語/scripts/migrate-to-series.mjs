// 「ネパール語瞬間作文」と「聞いて話せる日本語」を、新しい「聞いて話せるシリーズ」配下にコピーする。
//
// 配置:
//   聞いて話せるシリーズ/
//     ├ 共通アセット/   ← safa-splash.mp4 / designs/
//     ├ 聞いて話せるネパール語/  ← ネパール語瞬間作文 のコピー
//     └ 聞いて話せる日本語/      ← 聞いて話せる日本語 のコピー
//
// 各アプリは現状のフォルダ構造をそのまま維持 (内部スクリプトの相対パスが壊れないように)。
//
// 除外:
//   - node_modules/ (npm install で再生成)
//   - .expo/ (キャッシュ)
//   - *.backup-* (バックアップ)
//   - ~$*.xlsx (Excel 一時)
//   - old/ (古い作業)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_A = path.resolve(__dirname, '..');                                                     // ネパール語瞬間作文
const SOURCE_B = 'C:/Users/jwpsa/Documents/desktop/claude/聞いて話せる日本語';
const DEST_ROOT = 'C:/Users/jwpsa/Documents/desktop/claude/聞いて話せるシリーズ';
const DEST_A = path.join(DEST_ROOT, '聞いて話せるネパール語');
const DEST_B = path.join(DEST_ROOT, '聞いて話せる日本語');
const SHARED = path.join(DEST_ROOT, '共通アセット');

const EXCLUDE_DIRS = new Set(['node_modules', '.expo', 'old']);
const EXCLUDE_FILE = (name) => {
  if (name.startsWith('~$')) return true;
  if (name.includes('.backup-')) return true;
  return false;
};

let copied = 0;
let copiedBytes = 0;
let skippedDirs = 0;
let skippedFiles = 0;

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function copyRecursive(srcPath, dstPath) {
  const stat = fs.statSync(srcPath);
  if (stat.isDirectory()) {
    const base = path.basename(srcPath);
    if (EXCLUDE_DIRS.has(base)) { skippedDirs++; return; }
    ensureDir(dstPath);
    for (const entry of fs.readdirSync(srcPath)) {
      copyRecursive(path.join(srcPath, entry), path.join(dstPath, entry));
    }
  } else if (stat.isFile()) {
    if (EXCLUDE_FILE(path.basename(srcPath))) { skippedFiles++; return; }
    ensureDir(path.dirname(dstPath));
    fs.copyFileSync(srcPath, dstPath);
    copied++;
    copiedBytes += stat.size;
  }
}

function copyTopLevel(srcRoot, dstRoot, label) {
  console.log(`\n[${label}] ${srcRoot}\n  → ${dstRoot}`);
  ensureDir(dstRoot);
  const before = copied;
  const beforeBytes = copiedBytes;
  const entries = fs.readdirSync(srcRoot);
  for (const entry of entries) {
    const srcEntry = path.join(srcRoot, entry);
    const dstEntry = path.join(dstRoot, entry);
    copyRecursive(srcEntry, dstEntry);
  }
  const newFiles = copied - before;
  const mb = ((copiedBytes - beforeBytes) / 1024 / 1024).toFixed(1);
  console.log(`  ✓ ${newFiles} files, ${mb}MB`);
}

async function main() {
  console.log('=== 聞いて話せるシリーズ 移行スクリプト ===');

  if (!fs.existsSync(DEST_ROOT)) {
    console.log(`シリーズフォルダがありません。作成します: ${DEST_ROOT}`);
    ensureDir(DEST_ROOT);
  }

  // App A 移行
  copyTopLevel(SOURCE_A, DEST_A, 'App A: ネパール語瞬間作文 → 聞いて話せるネパール語');

  // App B 移行
  copyTopLevel(SOURCE_B, DEST_B, 'App B: 聞いて話せる日本語 → 聞いて話せる日本語');

  // 共通アセットの抽出
  console.log(`\n[共通アセット] ${SHARED}`);
  ensureDir(SHARED);
  // safa-splash.mp4 (App A にのみある)
  const splashSrc = path.join(SOURCE_A, 'safa-splash.mp4');
  if (fs.existsSync(splashSrc)) {
    fs.copyFileSync(splashSrc, path.join(SHARED, 'safa-splash.mp4'));
    console.log(`  ✓ safa-splash.mp4 (App A から)`);
  }
  // designs/
  const designsSrc = path.join(SOURCE_A, 'designs');
  if (fs.existsSync(designsSrc)) {
    copyRecursive(designsSrc, path.join(SHARED, 'designs'));
    console.log(`  ✓ designs/`);
  }

  console.log('\n========================================');
  console.log(`総コピー: ${copied} ファイル, ${(copiedBytes / 1024 / 1024).toFixed(1)}MB`);
  console.log(`除外ディレクトリ: ${skippedDirs} / 除外ファイル: ${skippedFiles}`);
}

main().catch(e => { console.error(e); process.exit(1); });
