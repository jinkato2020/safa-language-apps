// expo-app/src/i18n/ja.json と ne.json の全エントリを抽出し、
// バイリンガル.xlsx に並べて書き出す。
//
// 列構成:
//   A: 日本語 (ja.json から抽出)
//   B: ネパール語 (ne.json の現在値。ユーザーが上書き編集する)
//   C: キー (技術用、ユーザーは編集しない)
//
// ユーザーが B 列を編集したあと、
// scripts/i18n-import-from-xlsx.mjs を実行すると ne.json が更新される。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const JA_JSON = path.join(ROOT, 'expo-app', 'src', 'i18n', 'ja.json');
const NE_JSON = path.join(ROOT, 'expo-app', 'src', 'i18n', 'ne.json');
const XLSX_OUT = path.join(ROOT, 'バイリンガル.xlsx');

// 入れ子オブジェクトをフラットなキー=値のリストにする
// 例: { a: { b: "x" } } → [["a.b", "x"]]
function flatten(obj, prefix = '') {
  const out = [];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flatten(v, key));
    } else {
      out.push([key, v]);
    }
  }
  return out;
}

function pick(obj, key) {
  const parts = key.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

async function main() {
  const ja = JSON.parse(fs.readFileSync(JA_JSON, 'utf8'));
  const ne = JSON.parse(fs.readFileSync(NE_JSON, 'utf8'));

  const entries = flatten(ja);
  console.log(`日本語エントリ抽出: ${entries.length} 件`);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('翻訳');

  // ヘッダー行
  ws.addRow(['日本語 (A)', 'ネパール語 (B 編集してください)', 'キー (C 編集禁止)']);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' },
  };

  // 列幅
  ws.getColumn(1).width = 50;
  ws.getColumn(2).width = 50;
  ws.getColumn(3).width = 35;
  ws.getColumn(1).alignment = { wrapText: true, vertical: 'top' };
  ws.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
  ws.getColumn(3).font = { color: { argb: 'FF888888' } };

  // C 列のキーで現在値を取得し、ja → A、現在の ne → B、key → C
  for (const [key, jaVal] of entries) {
    const neVal = pick(ne, key) ?? '';
    ws.addRow([jaVal, neVal, key]);
  }

  // C 列を保護っぽくグレーアウト
  for (let r = 2; r <= entries.length + 1; r++) {
    ws.getCell(r, 3).font = { color: { argb: 'FF888888' }, size: 9 };
  }

  // 最初の行をフリーズ
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  await wb.xlsx.writeFile(XLSX_OUT);

  console.log(`書き出し完了: ${XLSX_OUT}`);
  console.log('');
  console.log('次のステップ:');
  console.log('  1. Excel を開いて B 列のネパール語を確認・編集');
  console.log('  2. C 列 (キー) は絶対に編集しない');
  console.log('  3. 編集後、ファイルを保存');
  console.log('  4. node scripts/i18n-import-from-xlsx.mjs を実行で ne.json に反映');
}

main().catch((e) => {
  console.error('エラー:', e.message);
  process.exit(1);
});
