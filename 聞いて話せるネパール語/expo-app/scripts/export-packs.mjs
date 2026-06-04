// App A の母語オーバーレイ(en)を raw.githubusercontent.com 配信用に書き出す。
// data/overlays/<l1>.json を読み、リポジトリ直下 packs-nepali/ に
// overlay-<l1>-v<ver>.json と audio-<l1>-v<ver>.zip と catalog.json を生成。
// 使い方: node expo-app/scripts/export-packs.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { zipSync } from 'fflate';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appDir, '..', '..');
const overlaysDir = path.join(appDir, 'data', 'overlays');
const outDir = path.join(repoRoot, 'packs-nepali');

// 実験中は experiment/bangla を指す。本番化時に差し替え。
const RAW_BASE = 'https://raw.githubusercontent.com/JinKato2020/safa-language-apps/refs/heads/experiment/bangla/packs-nepali';

const NAMES = {
  en: { name: 'English', nameJa: 'English' },
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

  let audioZip, audioVersion, audioZipBytes;
  const audioSrcDir = path.join(outDir, 'audio', l1);
  if (existsSync(audioSrcDir)) {
    const entries = {};
    for (const mp3 of readdirSync(audioSrcDir)) {
      if (mp3.endsWith('.mp3')) entries[mp3] = new Uint8Array(readFileSync(path.join(audioSrcDir, mp3)));
    }
    const zipName = `audio-${l1}-v${version}.zip`;
    const zipBuf = zipSync(entries, { level: 0 });
    writeFileSync(path.join(outDir, zipName), zipBuf);
    audioZip = `${RAW_BASE}/${zipName}`;
    audioVersion = version;
    audioZipBytes = zipBuf.length;
    console.log(`wrote ${zipName} (${Object.keys(entries).length} files, ${(zipBuf.length / 1048576).toFixed(2)} MB)`);
  }

  packs.push({
    l1, name: meta.name, nameJa: meta.nameJa, version, access: 'free',
    sizeBytes, url: `${RAW_BASE}/${outName}`, audioZip, audioVersion, audioZipBytes,
  });
  console.log(`wrote ${outName} (${sizeBytes} bytes)`);
}

writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify({ schema: 1, packs }, null, 2), 'utf8');
console.log(`wrote catalog.json (${packs.length} packs)`);
console.log(`\n配信ベース: ${RAW_BASE}`);
