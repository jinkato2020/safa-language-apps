// クリーンアップ後の i18n 内容を バイリンガル.xlsx のシート2 に書き出す。
// シート1（ユーザーが編集中）には触れない。
//
// 列構成:
//   A: 日本語 (ja.json から抽出)
//   B: ネパール語 (ne.json の現在値)
//   C: キー (技術用)

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
const SHEET_NAME = '翻訳_クリーンアップ後';

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

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);

  // 既存の同名シートがあれば一旦削除して作り直す
  const existing = wb.getWorksheet(SHEET_NAME);
  if (existing) wb.removeWorksheet(existing.id);
  const ws = wb.addWorksheet(SHEET_NAME);

  // ヘッダ
  ws.getCell('A1').value = '日本語';
  ws.getCell('B1').value = 'ネパール語';
  ws.getCell('C1').value = 'キー (編集不可)';
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  entries.forEach(([key, jaVal], i) => {
    const row = i + 2;
    ws.getCell(`A${row}`).value = jaVal;
    ws.getCell(`B${row}`).value = pick(ne, key) ?? '';
    ws.getCell(`C${row}`).value = key;
    // C 列は技術用なのでグレーアウト
    ws.getCell(`C${row}`).font = { color: { argb: 'FF888888' }, size: 9 };
  });

  ws.getColumn('A').width = 50;
  ws.getColumn('B').width = 50;
  ws.getColumn('C').width = 36;

  await wb.xlsx.writeFile(XLSX);
  console.log(`シート「${SHEET_NAME}」に ${entries.length} 件書き出しました。`);
  console.log(`場所: ${XLSX}`);
}

main().catch(err => { console.error(err); process.exit(1); });
