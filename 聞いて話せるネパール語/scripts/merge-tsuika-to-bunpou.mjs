// 追加.xlsx の C列（修正版ネパール語）を 文法.xlsx の該当セル (B列) に反映する。
// 形式: A="T.E" (テーマT.例題E) → 文法.xlsx シートT 行(E+1) 列B
//
// バックアップ: 文法.xlsx.backup-{timestamp}

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const BUNPOU = path.join(ROOT, '文法.xlsx');
const TSUIKA = path.join(ROOT, '追加.xlsx');

function getCellText(cell) {
  if (cell == null || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (v.richText) return v.richText.map((r) => r.text).join('').trim();
  if (v.text) return String(v.text).trim();
  return String(v).trim();
}

function parseAValue(raw) {
  // "12.15" or 12.15 → {theme: 12, ex: 15}
  if (raw == null) return null;
  const s = typeof raw === 'number' ? String(raw) : String(raw).trim();
  const m = s.match(/^(\d+)[.-](\d+)$/);
  if (!m) return null;
  return { theme: Number(m[1]), ex: Number(m[2]) };
}

async function main() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = BUNPOU + '.backup-' + ts;
  fs.copyFileSync(BUNPOU, backup);
  console.log('バックアップ作成:', path.basename(backup));

  const tsuikaWb = new ExcelJS.Workbook();
  await tsuikaWb.xlsx.readFile(TSUIKA);
  const tsuikaSheet = tsuikaWb.worksheets[0];

  const bunpouWb = new ExcelJS.Workbook();
  await bunpouWb.xlsx.readFile(BUNPOU);

  let applied = 0;
  let skipped = 0;
  let notFound = 0;

  for (let r = 1; r <= tsuikaSheet.actualRowCount; r++) {
    const aCell = tsuikaSheet.getRow(r).getCell(1);
    const cCell = tsuikaSheet.getRow(r).getCell(3);
    const aRaw = aCell.value;
    const neText = getCellText(cCell);

    const parsed = parseAValue(aRaw);
    if (!parsed) continue;
    if (!neText) {
      skipped++;
      console.log(`  行${r}: SKIP (C 列が空) [A=${aRaw}]`);
      continue;
    }

    // 文法.xlsx の sheets は新並び順 (theme 1-30)
    const sheet = bunpouWb.worksheets[parsed.theme - 1];
    if (!sheet) {
      notFound++;
      console.log(`  行${r}: シート未発見 (theme=${parsed.theme})`);
      continue;
    }
    // 例題E → row E+1 (row 1 はヘッダ)
    const targetRow = parsed.ex + 1;
    const currentB = getCellText(sheet.getRow(targetRow).getCell(2));
    sheet.getCell(`B${targetRow}`).value = neText;
    applied++;
    console.log(`  ${sheet.name} 行${targetRow} B列: "${currentB.slice(0, 30)}" → "${neText.slice(0, 30)}"`);
  }

  await bunpouWb.xlsx.writeFile(BUNPOU);
  console.log(`\n適用: ${applied} 件 / スキップ: ${skipped} 件 / シート未発見: ${notFound} 件`);
  console.log(`更新: ${BUNPOU}`);
}

main().catch(err => { console.error('エラー:', err.message); process.exit(1); });
