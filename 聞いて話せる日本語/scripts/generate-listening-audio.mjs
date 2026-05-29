// 聞き流しモード用に、テーマ×レベル×方向ごとに 20例題を結合した
// 1つの長い MP3 を生成する。これによりバックグラウンド再生時に
// JavaScript の介入なしで連続再生が可能になる。
//
// 出力:
//   expo-app/assets/audio/listening/conv-{theme}-{level}-{direction}.mp3
//   expo-app/assets/audio/listening/gram-{theme}-{direction}.mp3
//   expo-app/assets/audio/listening/_metadata.json
//
// 構成: 各 (theme, level, direction) ファイルは以下の構造
//   first_1 + 400ms無音 + second_1 + 1200ms無音 + first_2 + 400ms無音 + second_2 + ... + second_20
// direction='ja2ne' なら first=JA, second=NE
// direction='ne2ja' なら first=NE, second=JA
//
// 実行: node scripts/generate-listening-audio.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'expo-app', 'assets', 'audio');
const OUT_DIR = path.join(ASSETS_DIR, 'listening');
const SILENCE_DIR = path.join(OUT_DIR, '_silence');
const META_PATH = path.join(PROJECT_ROOT, 'expo-app', 'data', 'listeningMetadata.json');

const SILENCE_FIRST = path.join(SILENCE_DIR, 'silence-400.mp3');
const SILENCE_BETWEEN = path.join(SILENCE_DIR, 'silence-1200.mp3');

const THEMES_CONV = 30;
const THEMES_GRAM = 30;
const LEVELS = [1, 2, 3];
const DIRECTIONS = ['ja2ne', 'ne2ja'];
const GAP_FIRST_MS = 400;
const GAP_BETWEEN_MS = 1200;
const EXAMPLES_PER_THEME = 20;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function quote(p) {
  return `"${p}"`;
}

function generateSilence(durationMs, outPath) {
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) return;
  ensureDir(path.dirname(outPath));
  execSync(
    `ffmpeg -y -f lavfi -i "anullsrc=r=24000:cl=mono" -t ${durationMs / 1000} -b:a 32k -ar 24000 -ac 1 ${quote(outPath)}`,
    { stdio: 'pipe' }
  );
}

function getDuration(filePath) {
  const out = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${quote(filePath)}`
  ).toString().trim();
  return parseFloat(out);
}

function concatAudio(inputs, outputPath) {
  ensureDir(path.dirname(outputPath));
  const listPath = path.join(path.dirname(outputPath), `_list_${process.pid}_${Date.now()}.txt`);
  // concat demuxer 用のリストファイル: 各行 file 'path'
  const backslashRe = new RegExp(String.fromCharCode(92, 92), 'g');
  const aposRe = new RegExp("'", 'g');
  const listContent = inputs
    .map(p => "file '" + p.replace(backslashRe, '/').replace(aposRe, "'\\''") + "'")
    .join('\n');
  fs.writeFileSync(listPath, listContent, 'utf8');
  try {
    execSync(
      `ffmpeg -y -f concat -safe 0 -i ${quote(listPath)} -c copy ${quote(outputPath)}`,
      { stdio: 'pipe' }
    );
  } finally {
    if (fs.existsSync(listPath)) fs.unlinkSync(listPath);
  }
}

function buildInputsForTheme(getJa, getNe, direction) {
  // 戻り値: { inputs: string[], examplePositions: number[] }
  const inputs = [];
  const examplePositions = []; // 各例題の開始時刻（秒）
  let currentTime = 0;

  for (let i = 1; i <= EXAMPLES_PER_THEME; i++) {
    const ja = getJa(i);
    const ne = getNe(i);
    if (!ja || !ne || !fs.existsSync(ja) || !fs.existsSync(ne)) continue;

    const first = direction === 'ja2ne' ? ja : ne;
    const second = direction === 'ja2ne' ? ne : ja;

    examplePositions.push(currentTime);

    inputs.push(first);
    currentTime += getDuration(first);

    inputs.push(SILENCE_FIRST);
    currentTime += GAP_FIRST_MS / 1000;

    inputs.push(second);
    currentTime += getDuration(second);

    if (i < EXAMPLES_PER_THEME) {
      inputs.push(SILENCE_BETWEEN);
      currentTime += GAP_BETWEEN_MS / 1000;
    }
  }

  return { inputs, examplePositions };
}

async function main() {
  console.log('= 聞き流し用結合音声生成 =\n');

  console.log('1. 無音 MP3 を生成');
  generateSilence(GAP_FIRST_MS, SILENCE_FIRST);
  generateSilence(GAP_BETWEEN_MS, SILENCE_BETWEEN);
  console.log(`  ${SILENCE_FIRST}`);
  console.log(`  ${SILENCE_BETWEEN}\n`);

  ensureDir(OUT_DIR);

  const metadata = {
    conv: {}, // 'conv-{theme}-{level}-{direction}' -> examplePositions
    gram: {}, // 'gram-{theme}-{direction}' -> examplePositions
  };

  console.log('2. 会話結合音声を生成');
  let convOk = 0, convSkip = 0;
  const convTotal = THEMES_CONV * LEVELS.length * DIRECTIONS.length;
  for (let theme = 1; theme <= THEMES_CONV; theme++) {
    for (const level of LEVELS) {
      for (const direction of DIRECTIONS) {
        const key = `conv-${theme}-${level}-${direction}`;
        const outPath = path.join(OUT_DIR, `${key}.mp3`);

        const { inputs, examplePositions } = buildInputsForTheme(
          (i) => path.join(ASSETS_DIR, 'japanese', `${theme}-${level}-${i}.mp3`),
          (i) => path.join(ASSETS_DIR, 'nepali', `${theme}-${level}-${i}.mp3`),
          direction
        );

        if (inputs.length === 0) {
          convSkip++;
          continue;
        }

        try {
          concatAudio(inputs, outPath);
          metadata.conv[key] = examplePositions;
          convOk++;
        } catch (e) {
          console.log(`  ${key}: FAIL - ${e.message.slice(0, 100)}`);
        }

        process.stdout.write(`\r  進捗: ${convOk}/${convTotal} (skip: ${convSkip})`);
      }
    }
  }
  console.log(`\n  会話: ${convOk} 生成, ${convSkip} スキップ\n`);

  console.log('3. 文法結合音声を生成');
  let gramOk = 0, gramSkip = 0;
  const gramTotal = THEMES_GRAM * DIRECTIONS.length;
  for (let theme = 1; theme <= THEMES_GRAM; theme++) {
    for (const direction of DIRECTIONS) {
      const key = `gram-${theme}-${direction}`;
      const outPath = path.join(OUT_DIR, `${key}.mp3`);

      const { inputs, examplePositions } = buildInputsForTheme(
        (i) => path.join(ASSETS_DIR, 'japanese-grammar', `${theme}-${i}.mp3`),
        (i) => path.join(ASSETS_DIR, 'nepali-grammar', `${theme}-${i}.mp3`),
        direction
      );

      if (inputs.length === 0) {
        gramSkip++;
        continue;
      }

      try {
        concatAudio(inputs, outPath);
        metadata.gram[key] = examplePositions;
        gramOk++;
      } catch (e) {
        console.log(`  ${key}: FAIL - ${e.message.slice(0, 100)}`);
      }

      process.stdout.write(`\r  進捗: ${gramOk}/${gramTotal} (skip: ${gramSkip})`);
    }
  }
  console.log(`\n  文法: ${gramOk} 生成, ${gramSkip} スキップ\n`);

  console.log('4. メタデータを書き出し');
  ensureDir(path.dirname(META_PATH));
  fs.writeFileSync(META_PATH, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`  ${META_PATH}\n`);

  console.log('完了');
  console.log(`  会話結合: ${convOk} 個`);
  console.log(`  文法結合: ${gramOk} 個`);
  console.log(`  出力先: ${OUT_DIR}`);
}

main().catch((e) => {
  console.error('エラー:', e.message);
  process.exit(1);
});
