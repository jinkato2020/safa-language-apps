// 文法.xlsx をベースに、5 つの不要テーマを削除し、文法修正.xlsx から 5 つの新テーマを追加、
// さらに教育順に並び替えた新ファイルを生成する。
//
// 元ファイル: 文法.xlsx (30 シート)
// 追加元: 文法修正.xlsx (命令形 / 禁止表現 / 使役表現 / かもしれない / 状態変化)
// 出力: 文法.xlsx (上書き) — シート名を「NN_テーマ名」に統一して教育順に並び替え
//
// 削除する 5 テーマ:
//   24_関係節と複文
//   27_代名詞（人称・指示）
//   28_数詞と助数詞
//   29_格助詞の用法
//   30_尊敬語と丁寧語
//
// 追加する 5 テーマ:
//   命令形（〜しなさい）       ← 文法修正.xlsx 「命令形」
//   禁止表現（〜してはいけない）← 文法修正.xlsx 「禁止表現」
//   使役表現（〜させる）       ← 文法修正.xlsx 「使役表現」
//   〜かもしれない（推量・可能性）← 文法修正.xlsx 「かもしれない」
//   〜になる／〜くなる（状態変化）← 文法修正.xlsx 「状態変化」

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, '文法.xlsx');
const ADD = path.join(ROOT, '文法修正.xlsx');
const OUT = path.join(ROOT, '文法.xlsx');

// 並び替え後の最終順序（教育順）
// 各エントリは [新表示名, 取得元のシート名] のペア
const FINAL_ORDER = [
  // 【1-5】動詞の基本時制
  ['現在形（肯定文）',         { file: 'SRC', sheet: '01_現在形（肯定文）' }],
  ['現在形（否定文）',         { file: 'SRC', sheet: '02_現在形（否定文）' }],
  ['過去形（肯定文）',         { file: 'SRC', sheet: '03_過去形（肯定文）' }],
  ['過去形（否定文）',         { file: 'SRC', sheet: '04_過去形（否定文）' }],
  ['未来形',                   { file: 'SRC', sheet: '05_未来形' }],
  // 【6-10】基本文型
  ['疑問文',                   { file: 'SRC', sheet: '06_疑問文' }],
  ['依頼文',                   { file: 'SRC', sheet: '07_依頼文' }],
  ['命令形（〜しなさい）',     { file: 'ADD', sheet: '命令形' }],
  ['禁止表現（〜してはいけない）', { file: 'ADD', sheet: '禁止表現' }],
  ['感嘆文',                   { file: 'SRC', sheet: '08_感嘆文' }],
  // 【11-14】アスペクトと修飾
  ['〜している（進行形）',     { file: 'SRC', sheet: '11_〜している（進行形）' }],
  ['〜になる／〜くなる（状態変化）', { file: 'ADD', sheet: '状態変化' }],
  ['形容詞の使い方',           { file: 'SRC', sheet: '25_形容詞の使い方' }],
  ['副詞の使い方',             { file: 'SRC', sheet: '26_副詞の使い方' }],
  // 【15-20】モダリティ
  ['〜したい（願望表現）',     { file: 'SRC', sheet: '09_〜したい（願望表現）' }],
  ['〜できる（可能表現）',     { file: 'SRC', sheet: '10_〜できる（可能表現）' }],
  ['〜しなければならない（義務）', { file: 'SRC', sheet: '12_〜しなければならない（義務）' }],
  ['〜してもいい（許可）',     { file: 'SRC', sheet: '13_〜してもいい（許可）' }],
  ['〜と思う（推量・意見）',   { file: 'SRC', sheet: '15_〜と思う（推量・意見）' }],
  ['〜かもしれない（推量・可能性）', { file: 'ADD', sheet: 'かもしれない' }],
  // 【21-23】経験・比較・接続
  ['〜したことがある（経験）', { file: 'SRC', sheet: '14_〜したことがある（経験）' }],
  ['比較表現',                 { file: 'SRC', sheet: '22_比較表現' }],
  ['接続詞',                   { file: 'SRC', sheet: '17_接続詞' }],
  // 【24-27】複文
  ['〜ながら（同時動作）',     { file: 'SRC', sheet: '18_〜ながら（同時動作）' }],
  ['〜てから（順序）',         { file: 'SRC', sheet: '19_〜てから（順序）' }],
  ['〜ために（目的）',         { file: 'SRC', sheet: '20_〜ために（目的）' }],
  ['条件文（もし〜なら）',     { file: 'SRC', sheet: '21_条件文（もし〜なら）' }],
  // 【28-30】高度な構造
  ['受動表現',                 { file: 'SRC', sheet: '16_受動表現' }],
  ['使役表現（〜させる）',     { file: 'ADD', sheet: '使役表現' }],
  ['間接話法',                 { file: 'SRC', sheet: '23_間接話法' }],
];

async function main() {
  if (FINAL_ORDER.length !== 30) {
    throw new Error(`順序リストは 30 件であるべき、現在 ${FINAL_ORDER.length} 件`);
  }

  // バックアップ
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = SRC + '.backup-' + ts;
  fs.copyFileSync(SRC, backup);
  console.log('バックアップ作成:', path.basename(backup));

  // 元ファイルを読む
  const srcWb = new ExcelJS.Workbook();
  await srcWb.xlsx.readFile(SRC);

  // 追加元ファイルを読む
  const addWb = new ExcelJS.Workbook();
  await addWb.xlsx.readFile(ADD);

  // 新しいワークブックを作成
  const outWb = new ExcelJS.Workbook();

  for (let i = 0; i < FINAL_ORDER.length; i++) {
    const [displayName, { file, sheet }] = FINAL_ORDER[i];
    const srcSheet = (file === 'SRC' ? srcWb : addWb).getWorksheet(sheet);
    if (!srcSheet) {
      throw new Error(`シート「${sheet}」が ${file} に見つかりません`);
    }

    const newName = String(i + 1).padStart(2, '0') + '_' + displayName;
    const dst = outWb.addWorksheet(newName);

    // セル単位でコピー
    const maxRow = srcSheet.actualRowCount;
    for (let r = 1; r <= maxRow; r++) {
      const aVal = srcSheet.getCell('A' + r).value;
      const bVal = srcSheet.getCell('B' + r).value;
      if (aVal != null) dst.getCell('A' + r).value = aVal;
      if (bVal != null) dst.getCell('B' + r).value = bVal;
    }
    // 1 行目を太字に
    dst.getRow(1).font = { bold: true };
    dst.getColumn('A').width = 36;
    dst.getColumn('B').width = 48;
    console.log(`  ${newName.padEnd(32)} ← ${file === 'SRC' ? '文法.xlsx' : '文法修正.xlsx'} / ${sheet}`);
  }

  await outWb.xlsx.writeFile(OUT);
  console.log(`\n書き出し完了: ${OUT}`);
  console.log(`シート数: ${outWb.worksheets.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
