// App Store 申請用に iPhone のスクリーンショットを 1242x2688 px (6.5" Display) に一括リサイズ。
//
// 入力: scripts/screenshots_input/*.png (or .jpg)
// 出力: scripts/screenshots_output/{元のファイル名}_1242x2688.png
//
// 使い方:
//   1. iPhone スクショを scripts/screenshots_input/ に置く
//   2. node scripts/resize-app-store-screenshots.mjs
//   3. scripts/screenshots_output/ の結果を App Store Connect にアップロード

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INPUT_DIR = path.join(__dirname, 'screenshots_input');
const OUTPUT_DIR = path.join(__dirname, 'screenshots_output');

const TARGET_W = 1242;
const TARGET_H = 2688;

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function quote(p) { return `"${p}"`; }

function getDimensions(filePath) {
  // ffprobe で元画像の寸法を取得
  const out = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 ${quote(filePath)}`
  ).toString().trim();
  const [w, h] = out.split(',').map(n => parseInt(n, 10));
  return { width: w, height: h };
}

function resizeImage(inputPath, outputPath) {
  const { width, height } = getDimensions(inputPath);
  const inputRatio = width / height;
  const targetRatio = TARGET_W / TARGET_H;

  // 縦長スクショの場合、アスペクト比がほぼ同じならそのままリサイズで OK
  // 大きく違う場合はクロップで対応
  const ratioDiff = Math.abs(inputRatio - targetRatio);

  let filter;
  if (ratioDiff < 0.02) {
    // ほぼ同比率 → 単純リサイズ
    filter = `scale=${TARGET_W}:${TARGET_H}`;
  } else {
    // 比率が違う → 中央クロップしてからリサイズ
    // 出力比率にトリミングしてから目標サイズに拡縮
    filter = [
      // 入力を出力比率に合わせて中央クロップ
      `crop='min(iw,ih*${TARGET_W}/${TARGET_H})':'min(ih,iw*${TARGET_H}/${TARGET_W})'`,
      // 目標サイズに拡縮
      `scale=${TARGET_W}:${TARGET_H}`,
    ].join(',');
  }

  execSync(
    `ffmpeg -y -i ${quote(inputPath)} -vf "${filter}" -frames:v 1 ${quote(outputPath)}`,
    { stdio: 'pipe' }
  );

  return { originalSize: `${width}x${height}`, ratioDiff: ratioDiff.toFixed(3) };
}

function main() {
  ensureDir(INPUT_DIR);
  ensureDir(OUTPUT_DIR);

  const files = fs.readdirSync(INPUT_DIR)
    .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));

  if (files.length === 0) {
    console.log(`\n[input] フォルダに画像がありません: ${INPUT_DIR}`);
    console.log('iPhone スクショ (.png または .jpg) をここに置いてから再実行してください。\n');
    return;
  }

  console.log(`= App Store 用スクショ リサイズ (${TARGET_W}x${TARGET_H}) =\n`);
  console.log(`入力: ${INPUT_DIR}`);
  console.log(`出力: ${OUTPUT_DIR}\n`);

  let ok = 0, ng = 0;
  for (const file of files) {
    const inPath = path.join(INPUT_DIR, file);
    const baseName = path.parse(file).name;
    const outPath = path.join(OUTPUT_DIR, `${baseName}_${TARGET_W}x${TARGET_H}.png`);

    try {
      const info = resizeImage(inPath, outPath);
      console.log(`  OK: ${file} (${info.originalSize}, ratio diff ${info.ratioDiff}) -> ${path.basename(outPath)}`);
      ok++;
    } catch (e) {
      console.log(`  FAIL: ${file} - ${e.message.slice(0, 100)}`);
      ng++;
    }
  }

  console.log(`\n完了: ${ok} 件成功, ${ng} 件失敗`);
  console.log(`出力先: ${OUTPUT_DIR}`);
}

main();
