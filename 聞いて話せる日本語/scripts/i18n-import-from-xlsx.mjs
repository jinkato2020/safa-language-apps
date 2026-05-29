// バイリンガル.xlsx の B 列の値を読み取り、
// expo-app/src/i18n/ne.json に反映する。
//
// 列の前提 (i18n-export-to-xlsx.mjs で生成された形式):
//   A: 日本語 (参照のみ)
//   B: ネパール語 (この値を ne.json に書き込む)
//   C: キー (これに対応する位置に B の値を入れる)
//
// 動作:
//   - C 列のキーをドット区切りで解釈し ne.json の同じ構造の同じ位置に書き込む
//   - B が空文字 / undefined の場合はそのキーは ne.json から削除しない (現状維持)
//     → ja.json の値を翻訳キーがない時にフォールバックする設計のため、空はそのまま
//
// 安全策:
//   - 書き込み前に ne.json を ne.json.backup-{timestamp} としてバックアップ
//
// 実行: node scripts/i18n-import-from-xlsx.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const NE_JSON = path.join(ROOT, 'expo-app', 'src', 'i18n', 'ne.json');
const JA_JSON = path.join(ROOT, 'expo-app', 'src', 'i18n', 'ja.json');
const XLSX_IN = path.join(ROOT, 'バイリンガル.xlsx');

// ja.json と同じ入れ子構造のオブジェクトを作って、key=value を設定する
function setNested(obj, key, value) {
  const parts = key.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== 'object' || cur[p] === null || Array.isArray(cur[p])) {
      cur[p] = {};
    }
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function getCellText(cell) {
  if (cell == null) return '';
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (v.richText) return v.richText.map((r) => r.text).join('').trim();
  if (v.text) return String(v.text).trim();
  return String(v).trim();
}

async function main() {
  if (!fs.existsSync(XLSX_IN)) {
    throw new Error(`Excel ファイルが見つかりません: ${XLSX_IN}`);
  }
  if (!fs.existsSync(NE_JSON)) {
    throw new Error(`ne.json が見つかりません: ${NE_JSON}`);
  }

  // ja.json をベースに新しい ne 構造を作る (ja の全キーが揃うように)
  const ja = JSON.parse(fs.readFileSync(JA_JSON, 'utf8'));
  const oldNe = JSON.parse(fs.readFileSync(NE_JSON, 'utf8'));

  console.log('Excel ファイルを読み込み中...');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_IN);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('シートが見つかりません');
  console.log(`  シート名: ${ws.name}`);
  console.log(`  行数: ${ws.rowCount}`);

  // 新しい ne を ja のコピーから開始 (空の値を保持)
  // ※ あえてここで oldNe ではなく ja を使うのは、未翻訳キーで ja にフォールバックするため
  //   ne.json に未翻訳の値が残ってしまうのを防ぐ
  const newNe = JSON.parse(JSON.stringify(ja));

  let updated = 0;
  let skipped = 0;
  let invalid = 0;

  // 1 行目はヘッダー
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const jaText = getCellText(row.getCell(1));
    const neText = getCellText(row.getCell(2));
    const key = getCellText(row.getCell(3));

    if (!key) {
      // 空行
      continue;
    }

    // ja のリファレンスに対して整合性確認 (注意のみ)
    // const expectedJa = pick(ja, key);
    // if (expectedJa !== jaText) ...

    if (!neText) {
      // 空欄 → 現状の ne 値を残す or ja にフォールバック
      // ja を残しておく方が「未翻訳のままなら ja を表示」できる挙動になる
      // つまり何もしない (newNe には ja のコピーが入っているのでそのまま)
      skipped++;
      continue;
    }

    setNested(newNe, key, neText);
    updated++;
  }

  // バックアップ
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${NE_JSON}.backup-${ts}`;
  fs.copyFileSync(NE_JSON, backupPath);

  // 書き出し
  fs.writeFileSync(NE_JSON, JSON.stringify(newNe, null, 2), 'utf8');

  console.log('');
  console.log('========================================');
  console.log(`更新: ${updated} 件`);
  console.log(`スキップ (B 列空): ${skipped} 件`);
  console.log(`無効 (キー欠落): ${invalid} 件`);
  console.log('');
  console.log(`書き出し: ${NE_JSON}`);
  console.log(`バックアップ: ${backupPath}`);
  console.log('');
  console.log('注意:');
  console.log('  - B 列が空の項目は ja の値が使用されます (i18n フォールバック)');
  console.log('  - これは v1.6 の仕様 (未翻訳キーは ja に自動フォールバック)');
}

main().catch((e) => {
  console.error('エラー:', e.message);
  process.exit(1);
});
