// 瞬間作文.xlsx の全シートからネパール語の単語を抽出し、
// Google翻訳の公開エンドポイントで日本語訳・ローマ字を取得して
// data/vocab.json に保存する。
//
// 1回だけ実行すればOK。再実行時は既存キャッシュをスキップ。
// 実行: npm run build-vocab

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const XLSX_PATH = path.join(PROJECT_ROOT, '瞬間作文.xlsx');
const VOCAB_PATH = path.join(PROJECT_ROOT, 'data', 'vocab.json');

const GTRANS_URL = 'https://translate.googleapis.com/translate_a/single';
const NEPALI_COLS = [2, 4, 6]; // B(初級) / D(中級) / F(上級)
const REQUEST_DELAY_MS = 150;
const SAVE_EVERY = 50;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ネパール語文を語にトークン化
// 句読点・コンマ・ダンダで分割、空白でも分割
function tokenize(text) {
  if (!text) return [];
  return text
    .replace(/[।॥?!,;:"'"'（）()「」『』‍]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0);
}

function getCellText(cell) {
  if (cell == null || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (v.richText) return v.richText.map(r => r.text).join('').trim();
  if (v.text) return String(v.text).trim();
  return String(v).trim();
}

async function translateWord(word) {
  // dt=t (翻訳) + dt=rm (ローマ字)
  const url = `${GTRANS_URL}?client=gtx&sl=ne&tl=ja&dt=t&dt=rm&q=${encodeURIComponent(word)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  // data[0] は翻訳セグメントの配列
  // data[0][i][0] = 翻訳テキスト、data[0][i][1] = 原文 など
  // ローマ字は data[0] の末尾要素にあることが多い: [null, null, "romanization", "source-lang-name"]
  let translation = '';
  let romanization = '';
  // data[0] には翻訳セグメントとメタセグメントが並ぶ
  //   翻訳セグメント: ["翻訳文", "原文", null, null, ...]
  //   メタセグメント: [null, null, "ターゲット側のローマ字", "ソース側のローマ字"]
  //                  ※ 3要素の場合もある: [null, null, "ソース側のローマ字"]
  if (Array.isArray(data) && Array.isArray(data[0])) {
    for (const seg of data[0]) {
      if (!Array.isArray(seg)) continue;
      if (typeof seg[0] === 'string') {
        translation += seg[0];
      } else if (seg[0] === null && seg[1] === null) {
        // メタセグメント — ソース側(ネパール語)のローマ字を取得
        // seg[3] があればそれ（ターゲットRom + ソースRom の両方ある形式）
        // なければ seg[2]（ソースRomのみの3要素形式）
        const candidate = (typeof seg[3] === 'string' && seg[3]) || (typeof seg[2] === 'string' && seg[2]);
        if (candidate) romanization = candidate;
      }
    }
  }
  return { ja: translation.trim(), rom: romanization.trim() };
}

async function main() {
  if (!fs.existsSync(XLSX_PATH)) throw new Error(`Excel が見つかりません: ${XLSX_PATH}`);

  console.log('Excel を読み込み中...');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);

  // 全シートからネパール語を抽出
  const uniqueWords = new Set();
  for (const sheet of wb.worksheets) {
    for (let r = 2; r <= 21; r++) {
      for (const col of NEPALI_COLS) {
        const text = getCellText(sheet.getRow(r).getCell(col));
        tokenize(text).forEach(w => uniqueWords.add(w));
      }
    }
  }

  console.log(`  シート数: ${wb.worksheets.length}`);
  console.log(`  ユニーク単語数: ${uniqueWords.size}`);

  // 既存キャッシュをロード
  fs.mkdirSync(path.dirname(VOCAB_PATH), { recursive: true });
  let cache = {};
  if (fs.existsSync(VOCAB_PATH)) {
    cache = JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf8'));
    console.log(`  既存キャッシュ: ${Object.keys(cache).length}語`);
  }

  // 翻訳が必要な語だけ抽出（未翻訳 + エラーで失敗した語をリトライ）
  const todo = [...uniqueWords].filter(w => !cache[w] || cache[w].error);
  const retryCount = todo.filter(w => cache[w] && cache[w].error).length;
  console.log(`  翻訳対象: ${todo.length}語（うち再試行 ${retryCount}語）`);
  console.log('');

  if (todo.length === 0) {
    console.log('すべての語が既にキャッシュ済みです。');
    return;
  }

  const startTime = Date.now();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const word of todo) {
    processed++;
    try {
      const result = await translateWord(word);
      cache[word] = result;
      succeeded++;
      if (succeeded % SAVE_EVERY === 0) {
        fs.writeFileSync(VOCAB_PATH, JSON.stringify(cache, null, 2));
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(`  [${processed}/${todo.length}] saved (${succeeded}件成功 ${failed}件失敗 / 経過${elapsed}秒)`);
      }
    } catch (e) {
      failed++;
      cache[word] = { ja: '', rom: '', error: e.message };
      if (failed % 20 === 0) {
        console.log(`  [${processed}/${todo.length}] FAIL: ${word} (${e.message})`);
        // 連続失敗が多ければ少し長めに待機
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
  }

  fs.writeFileSync(VOCAB_PATH, JSON.stringify(cache, null, 2));
  const totalSec = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log('');
  console.log('========================================');
  console.log(`完了: 成功 ${succeeded}語 / 失敗 ${failed}語`);
  console.log(`総実行時間: ${totalSec}秒`);
  console.log(`保存先: ${VOCAB_PATH}`);
}

main().catch(e => {
  console.error('エラー:', e.message);
  process.exit(1);
});
