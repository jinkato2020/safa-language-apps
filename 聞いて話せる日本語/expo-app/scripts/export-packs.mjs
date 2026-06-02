// 母語オーバーレイを raw.githubusercontent.com 配信用に書き出す。
// data/overlays/<l1>.json を読み、リポジトリ直下 packs/ に
// overlay-<l1>-v<ver>.json と catalog.json を生成する (= そのまま commit/push して raw配信)。
// 使い方: node scripts/export-packs.mjs
//
// 配信URLは下の RAW_BASE。packs/ をコミットしているブランチを指す。
// ※ 実験中は experiment/bangla を指す。本番化時は main に packs/ を移し RAW_BASE も差し替える。

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { zipSync } from 'fflate';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appDir, '..', '..');
const overlaysDir = path.join(appDir, 'data', 'overlays');
const outDir = path.join(repoRoot, 'packs');

// raw配信のベースURL (packs/ を置くブランチ)。
const RAW_BASE = 'https://raw.githubusercontent.com/JinKato2020/safa-language-apps/refs/heads/experiment/bangla/packs';

// 言語コード → 表示名
const NAMES = {
  bn: { name: 'বাংলা', nameJa: 'ベンガル語' },
  ne: { name: 'नेपाली', nameJa: 'ネパール語' },
};

mkdirSync(outDir, { recursive: true });

const packs = [];
for (const file of readdirSync(overlaysDir)) {
  if (!file.endsWith('.json')) continue;
  const overlay = JSON.parse(readFileSync(path.join(overlaysDir, file), 'utf8'));
  const l1 = overlay.l1;
  const version = overlay.version ?? 1;
  const outName = `overlay-${l1}-v${version}.json`;
  const outPath = path.join(outDir, outName);
  writeFileSync(outPath, JSON.stringify(overlay), 'utf8');
  const sizeBytes = statSync(outPath).size;
  const meta = NAMES[l1] ?? { name: l1, nameJa: l1 };

  // 母語音声を1個のzipにまとめる (660ファイルの逐次DLを1回に)。
  let audioZip, audioVersion, audioZipBytes;
  const audioSrcDir = path.join(outDir, 'audio', l1);
  if (existsSync(audioSrcDir)) {
    const entries = {};
    for (const mp3 of readdirSync(audioSrcDir)) {
      if (mp3.endsWith('.mp3')) entries[mp3] = new Uint8Array(readFileSync(path.join(audioSrcDir, mp3)));
    }
    const zipName = `audio-${l1}-v${version}.zip`;
    const zipBuf = zipSync(entries, { level: 0 }); // mp3は圧縮済みなので無圧縮(高速)
    writeFileSync(path.join(outDir, zipName), zipBuf);
    audioZip = `${RAW_BASE}/${zipName}`;
    audioVersion = version;
    audioZipBytes = zipBuf.length;
    console.log(`wrote ${zipName} (${Object.keys(entries).length} files, ${(zipBuf.length / 1048576).toFixed(2)} MB)`);
  }

  packs.push({
    l1,
    name: meta.name,
    nameJa: meta.nameJa,
    version,
    access: 'free',
    sizeBytes,
    url: `${RAW_BASE}/${outName}`,
    audioZip,       // 母語音声 zip (1ファイル)。展開して <文ID>.mp3 を得る
    audioVersion,   // 音声zipの版 (overlay版に同期)
    audioZipBytes,
  });
  console.log(`wrote ${outName} (${sizeBytes} bytes)`);
}

const catalog = { schema: 1, packs };
writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf8');
console.log(`wrote catalog.json (${packs.length} packs)`);
console.log(`\n配信ベース: ${RAW_BASE}`);
console.log(`出力フォルダ (commit/push して raw配信): ${outDir}`);
