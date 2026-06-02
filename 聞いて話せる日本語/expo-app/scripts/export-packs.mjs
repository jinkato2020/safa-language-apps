// 母語オーバーレイを GitHub Releases 用に書き出す。
// data/overlays/<l1>.json を読み、dist-packs/overlay-<l1>-v<ver>.json と catalog.json を生成する。
// 使い方: node scripts/export-packs.mjs
//
// 生成物を GitHub Release (タグ packs-v1) にアップロードする:
//   - catalog.json
//   - overlay-bn-v1.json (各言語ぶん)
// catalog.json 内の url はそのタグの asset URL を指す (下の RELEASE_BASE)。

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const overlaysDir = path.join(appDir, 'data', 'overlays');
const outDir = path.join(appDir, 'dist-packs');

// アップロード先 Release のタグ。ここを変えたら Release タグも合わせる。
const RELEASE_TAG = 'packs-v1';
const RELEASE_BASE = `https://github.com/JinKato2020/safa-language-apps/releases/download/${RELEASE_TAG}`;

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
  packs.push({
    l1,
    name: meta.name,
    nameJa: meta.nameJa,
    version,
    access: 'free',
    sizeBytes,
    url: `${RELEASE_BASE}/${outName}`,
  });
  console.log(`wrote ${outName} (${sizeBytes} bytes)`);
}

const catalog = { schema: 1, packs };
writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf8');
console.log(`wrote catalog.json (${packs.length} packs)`);
console.log(`\nアップロード先 Release タグ: ${RELEASE_TAG}`);
console.log(`出力フォルダ: ${outDir}`);
