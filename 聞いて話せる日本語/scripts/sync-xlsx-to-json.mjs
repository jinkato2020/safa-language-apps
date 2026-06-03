// 会話.xlsx → expo-app/data/examples.json と themes.json を同期。
// 列: A/B=初級(jp/ne), C/D=中級, E/F=上級 / 行2-21。シート名 "NN_名前" からテーマ名も更新。
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const XLSX = path.join(ROOT, '会話.xlsx');
const DATA = path.join(ROOT, 'expo-app', 'data');

function cell(c) {
  const v = c?.value; if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (v.richText) return v.richText.map(r => r.text).join('').trim();
  if (v.text) return String(v.text).trim();
  return String(v).trim();
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(XLSX);
const examples = {};
const themes = [];
wb.worksheets.forEach((s, idx) => {
  const themeId = idx + 1;
  themes.push({ id: themeId, name: s.name.replace(/^\d+_/, '') });
  for (let level = 1; level <= 3; level++) {
    const jpCol = (level - 1) * 2 + 1, neCol = jpCol + 1;
    const arr = [];
    for (let r = 2; r <= 21; r++) {
      const jp = cell(s.getRow(r).getCell(jpCol)), ne = cell(s.getRow(r).getCell(neCol));
      if (jp && ne) arr.push({ jp, ne });
    }
    if (arr.length) examples[`${themeId}-${level}`] = arr;
  }
});

fs.writeFileSync(path.join(DATA, 'examples.json'), JSON.stringify(examples, null, 2));
fs.writeFileSync(path.join(DATA, 'themes.json'), JSON.stringify(themes, null, 2));
const total = Object.values(examples).reduce((s, a) => s + a.length, 0);
console.log(`examples.json: ${Object.keys(examples).length}キー / ${total}例題`);
console.log('themes.json テーマ名:', [13, 25, 29, 30].map(i => `${i}:${themes[i - 1].name}`).join(' / '));
