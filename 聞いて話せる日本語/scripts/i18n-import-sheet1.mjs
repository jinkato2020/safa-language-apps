// バイリンガル.xlsx シート「翻訳」の B列ネパール語を ne.json に反映する。
// クリーンアップ後の ja.json に存在するキーだけを書き戻す（削除済みキーは無視）。
// バックアップ: ne.json.backup-{timestamp}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const JA_JSON = path.join(ROOT, 'expo-app', 'src', 'i18n', 'ja.json');
const NE_JSON = path.join(ROOT, 'expo-app', 'src', 'i18n', 'ne.json');
const XLSX = path.join(ROOT, 'バイリンガル.xlsx');
const SOURCE_SHEET = '翻訳';

// JSON のキーパス（"a.b.c"）が存在するか
function hasKey(obj, key) {
  const parts = key.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !(p in cur)) return false;
    cur = cur[p];
  }
  return true;
}

// JSON にキーパスで書き込み
function setKey(obj, key, value) {
  const parts = key.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

// 順序保持・空オブジェクトを残さない・ネスト構造保持の整形済み再構築
function rebuildLikeJa(ja, ne) {
  const out = {};
  for (const k of Object.keys(ja)) {
    const v = ja[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = rebuildLikeJa(v, (ne && ne[k]) || {});
    } else {
      out[k] = (ne && k in ne) ? ne[k] : '';
    }
  }
  return out;
}

// Excel セル値を文字列に正規化（数値や数式オブジェクトに対応）
function cellToString(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map(rt => rt.text).join('');
    if ('result' in v) return String(v.result ?? '');
    if ('text' in v) return String(v.text ?? '');
  }
  return String(v);
}

async function main() {
  const ja = JSON.parse(fs.readFileSync(JA_JSON, 'utf8'));
  const ne = JSON.parse(fs.readFileSync(NE_JSON, 'utf8'));

  // バックアップ
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = NE_JSON + '.backup-' + ts;
  fs.copyFileSync(NE_JSON, backup);
  console.log('バックアップ作成:', path.basename(backup));

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const ws = wb.getWorksheet(SOURCE_SHEET);
  if (!ws) throw new Error(`シート「${SOURCE_SHEET}」が見つかりません`);

  let applied = 0;
  let skippedDeletedKey = 0;
  let skippedEmpty = 0;

  for (let r = 2; r <= ws.actualRowCount; r++) {
    const key = cellToString(ws.getCell('C' + r).value).trim();
    const neVal = cellToString(ws.getCell('B' + r).value).trim();
    if (!key) continue;

    // ja.json (cleanup 後) に存在しないキーはスキップ（paywall などの削除済み）
    if (!hasKey(ja, key)) {
      skippedDeletedKey++;
      continue;
    }
    if (neVal === '') {
      skippedEmpty++;
      continue;
    }
    setKey(ne, key, neVal);
    applied++;
  }

  // ja.json と同じ構造順・同じネスト形に整える
  const rebuilt = rebuildLikeJa(ja, ne);

  fs.writeFileSync(NE_JSON, JSON.stringify(rebuilt, null, 2) + '\n', 'utf8');
  console.log(`書き戻し完了: ${applied} 件適用`);
  console.log(`  - 削除済みキーをスキップ: ${skippedDeletedKey} 件`);
  console.log(`  - 空セルをスキップ: ${skippedEmpty} 件`);
  console.log(`更新: ${NE_JSON}`);
}

main().catch(err => { console.error(err); process.exit(1); });
