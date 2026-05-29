// 追加.xlsx の C列ネパール語を 文法.xlsx に反映する。
// A値 "N.M" = N シート目の例題M に該当 → 文法.xlsx の sheet[N-1], row(M+1), col B を更新。
// 併せて japanese2/{N}-{M}.mp3 を nepali-grammar/{N}-{M}.mp3 に上書きコピー。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SRC_XLSX = path.join(ROOT, '追加.xlsx');
const DST_XLSX = path.join(ROOT, '文法.xlsx');
const NEPALI2 = path.join(ROOT, 'japanese2');
const NEPALI_GRAMMAR = path.join(ROOT, 'nepali-grammar');

function cellText(cell) {
  if (cell == null) return '';
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (v.richText) return v.richText.map(r => r.text).join('').trim();
  if (v.text) return String(v.text).trim();
  return String(v).trim();
}

function parseId(raw) {
  // "8.15" or 8.15 → {sheet:8, ex:15}
  // "12.16" with two-digit ex → need careful parsing
  const s = String(raw).trim();
  const dot = s.indexOf('.');
  if (dot < 0) return null;
  const sheet = parseInt(s.slice(0, dot), 10);
  const ex = parseInt(s.slice(dot + 1), 10);
  if (!Number.isInteger(sheet) || !Number.isInteger(ex)) return null;
  return { sheet, ex };
}

async function main() {
  console.log('追加.xlsx を読み込み中...');
  const srcWb = new ExcelJS.Workbook();
  await srcWb.xlsx.readFile(SRC_XLSX);
  const srcSheet = srcWb.worksheets[0];

  // 修正リストを集める
  const updates = [];
  for (let r = 1; r <= srcSheet.actualRowCount; r++) {
    const a = cellText(srcSheet.getRow(r).getCell(1));
    const c = cellText(srcSheet.getRow(r).getCell(3));
    if (!a || !c) continue;
    const id = parseId(a);
    if (!id) {
      console.log(`  WARN: A=${a} を解析できません (行${r})`);
      continue;
    }
    updates.push({ row: r, a, sheet: id.sheet, ex: id.ex, ne: c });
  }

  console.log(`  修正対象: ${updates.length} 件`);
  updates.forEach(u => console.log(`    A=${u.a}: シート${u.sheet} 例題${u.ex} → "${u.ne}"`));

  // 文法.xlsx をバックアップしてから修正
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = DST_XLSX + '.backup-' + ts;
  fs.copyFileSync(DST_XLSX, backup);
  console.log(`\nバックアップ作成: ${path.basename(backup)}`);

  console.log('文法.xlsx を読み込み中...');
  const dstWb = new ExcelJS.Workbook();
  await dstWb.xlsx.readFile(DST_XLSX);

  console.log(`シート数: ${dstWb.worksheets.length}`);
  if (dstWb.worksheets.length !== 30) {
    throw new Error(`シート数が 30 でない: ${dstWb.worksheets.length}`);
  }

  let xlsxApplied = 0;
  let xlsxFailed = 0;
  for (const u of updates) {
    if (u.sheet < 1 || u.sheet > 30) {
      console.log(`  FAIL: シート ${u.sheet} は範囲外 (A=${u.a})`);
      xlsxFailed++;
      continue;
    }
    const sheet = dstWb.worksheets[u.sheet - 1];
    const row = u.ex + 1; // ヘッダ + 例題番号
    const before = cellText(sheet.getRow(row).getCell(2));
    sheet.getRow(row).getCell(2).value = u.ne;
    console.log(`  シート${u.sheet}「${sheet.name}」 行${row} B列: "${before}" → "${u.ne}"`);
    xlsxApplied++;
  }
  await dstWb.xlsx.writeFile(DST_XLSX);
  console.log(`\nExcel 修正完了: ${xlsxApplied} 件 (失敗: ${xlsxFailed} 件)`);

  // 音声ファイルを上書きコピー
  console.log(`\n音声ファイルをコピー中...`);
  let audioOk = 0;
  let audioMiss = 0;
  for (const u of updates) {
    const fileName = `${u.sheet}-${u.ex}.mp3`;
    const src = path.join(NEPALI2, fileName);
    const dst = path.join(NEPALI_GRAMMAR, fileName);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      console.log(`  ${fileName} (japanese2 → nepali-grammar) OK`);
      audioOk++;
    } else {
      console.log(`  ${fileName} japanese2 に存在せず - SKIP`);
      audioMiss++;
    }
  }
  console.log(`\n音声コピー: ${audioOk} 件成功 / ${audioMiss} 件欠損`);
}

main().catch(err => { console.error(err); process.exit(1); });
