// japanese-grammar/ と nepali-grammar/ の音声ファイル名を短い形式に変更する。
//
// 旧: {NN_シート名}.{例題No}.mp3
//      例: 01_現在形（肯定文）.1.mp3
//      例: 10_感嘆文.4.mp3
// 新: {シート番号}-{例題No}.mp3 (先頭ゼロなし)
//      例: 1-1.mp3
//      例: 10-4.mp3
//
// 引数 --apply で実行 (デフォルトは dry-run)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const APPLY = process.argv.includes('--apply');

const DIRS = [
  path.join(ROOT, 'japanese-grammar'),
  path.join(ROOT, 'nepali-grammar'),
];

// ファイル名パース: NN_任意.M.mp3 → {sheet: N, ex: M}
function parseName(name) {
  const m = name.match(/^(\d+)_.*?\.(\d+)\.mp3$/);
  if (!m) return null;
  return { sheet: Number(m[1]), ex: Number(m[2]) };
}

function processDir(dir) {
  const dirName = path.basename(dir);
  console.log(`\n=== ${dirName} ===`);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp3'));
  console.log(`  既存ファイル数: ${files.length}`);

  const plan = []; // {from, to}
  const skipped = [];
  for (const f of files) {
    const p = parseName(f);
    if (!p) {
      skipped.push(f);
      continue;
    }
    const newName = `${p.sheet}-${p.ex}.mp3`;
    if (newName === f) continue; // 変更不要
    plan.push({ from: f, to: newName });
  }

  console.log(`  リネーム計画: ${plan.length} 件`);
  if (skipped.length > 0) {
    console.log(`  スキップ (パース失敗): ${skipped.length} 件`);
    skipped.slice(0, 5).forEach(s => console.log(`    ${s}`));
  }

  // サンプル表示
  console.log(`  サンプル:`);
  plan.slice(0, 3).forEach(p => console.log(`    ${p.from} → ${p.to}`));
  if (plan.length > 6) console.log(`    ...`);
  plan.slice(-3).forEach(p => console.log(`    ${p.from} → ${p.to}`));

  // 衝突チェック
  const targets = new Set();
  const collisions = [];
  for (const { to } of plan) {
    if (targets.has(to)) collisions.push(to);
    targets.add(to);
  }
  if (collisions.length > 0) {
    console.log(`  ERROR: リネーム先衝突 ${collisions.length} 件 → ${collisions.slice(0, 3).join(', ')}`);
    return { ok: false };
  }

  if (!APPLY) {
    return { ok: true, plan, applied: false };
  }

  // 衝突回避のため一時名経由
  for (const { from } of plan) {
    fs.renameSync(path.join(dir, from), path.join(dir, '__tmp__' + from));
  }
  for (const { from, to } of plan) {
    fs.renameSync(path.join(dir, '__tmp__' + from), path.join(dir, to));
  }
  console.log(`  ✅ ${plan.length} 件リネーム完了`);
  return { ok: true, plan, applied: true };
}

async function main() {
  if (!APPLY) {
    console.log('=== DRY-RUN モード (実行するには --apply を付けてください) ===');
  } else {
    console.log('=== APPLY モード ===');
  }
  for (const dir of DIRS) {
    if (!fs.existsSync(dir)) {
      console.log(`\n警告: ${dir} が見つかりません`);
      continue;
    }
    const result = processDir(dir);
    if (!result.ok) {
      console.log(`\n${path.basename(dir)} でエラーが発生したため中断します。`);
      process.exit(1);
    }
  }
  if (!APPLY) {
    console.log(`\n=== DRY-RUN 終了。実行するには --apply を付けてください ===`);
  }
}

main().catch(err => { console.error('エラー:', err.message); process.exit(1); });
