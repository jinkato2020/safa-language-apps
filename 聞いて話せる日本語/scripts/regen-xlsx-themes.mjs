// 会話.xlsx の指定テーマを「60文すべて別内容・話題網羅・長さ階層・日本生活最適化」で再生成。
// Claude(Sonnet)で 初級20/中級20/上級20 を生成→Excellに書き戻し(jp+ne)。
// 実行: node scripts/regen-xlsx-themes.mjs
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const XLSX = path.join(ROOT, '会話.xlsx');
const ENV = path.join(ROOT, '.env');
const MODEL = 'claude-sonnet-4-6';

const THEMES = [
  { idx: 25, name: '役所と手続き',
    topics: '住民登録(転入・転出)、在留カードの受取・住所変更、ビザ(在留資格)の更新・変更・入国管理局での手続き、国民健康保険の加入・脱退、国民年金、マイナンバー、児童手当、住民票・各種証明書、印鑑、住民税、窓口・番号札・必要書類・手数料、やさしい日本語や通訳のお願い' },
  { idx: 29, name: '病院と体調',
    topics: '内科の予約・受付・保険証、症状(熱・頭痛・腹痛・咳など)を伝える、薬と薬局・処方箋、歯医者(歯が痛い・虫歯・予約)、小児科(子供の発熱・予防接種・健診)、アレルギー、検査、診断書、救急車・緊急、入院、会計・次回予約、通訳のお願い' },
  { idx: 30, name: 'アルバイトと仕事探し',
    topics: 'ハローワーク(職業安定所)での相談、求人・応募・面接・履歴書、お給料(時給・月給・締め日・振込)、通勤時間・交通費、勤務時間・シフト、社会保険(健康保険・厚生年金・雇用保険)、福利厚生、初出勤・仕事を教わる、遅刻欠勤の連絡、残業、退職、職場の挨拶・マナー' },
];

function loadKey() {
  for (const line of fs.readFileSync(ENV, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*VITE_ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  throw new Error('VITE_ANTHROPIC_API_KEY なし');
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function genTheme(apiKey, name, topics) {
  const prompt = `あなたは在日外国人向けの日本語学習教材の専門家です。
テーマ「${name}」について、日本で生活するネパール語話者が実際に使う実用的な例文を作ってください。

【必ず含める話題】${topics}

【ルール】
- 初級20文・中級20文・上級20文、合計60文。
- 60文すべて内容が異なること。同じ状況や同じ表現を繰り返さない(行ごとに別の場面)。
- 初級: 短く基本的(目安〜15字)。中級: やや長め・実用的(目安20〜35字)。上級: より長く自然で丁寧(目安35〜65字)。
- 日本の制度・場面に最適化(役所・病院・職場など日本での実生活)。文化的にもネパール固有でなく日本での生活に合わせる。
- 各文に自然な口語のネパール語訳を付ける。
【出力】JSONのみ。説明やMarkdown不要:
{"beginner":[{"jp":"...","ne":"..."} ×20],"intermediate":[×20],"advanced":[×20]}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 16000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const it = data.usage?.input_tokens ?? 0, ot = data.usage?.output_tokens ?? 0;
  const cost = it * 3 / 1e6 + ot * 15 / 1e6;
  let text = (data.content?.map(c => c.text || '').join('') || '').replace(/```json\s*|```\s*$/g, '').trim();
  const obj = JSON.parse(text);
  for (const k of ['beginner', 'intermediate', 'advanced']) {
    if (!Array.isArray(obj[k]) || obj[k].length !== 20) throw new Error(`${k} が20件でない (${obj[k]?.length})`);
  }
  return { obj, cost };
}

async function withRetry(fn) {
  let last;
  for (let i = 1; i <= 4; i++) { try { return await fn(); } catch (e) { last = e; console.log(`  失敗(${i}/4): ${e.message}`); if (i < 4) await sleep(8000 * i); } }
  throw last;
}

const apiKey = loadKey();
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(XLSX);
let totalCost = 0;
for (const { idx, name, topics } of THEMES) {
  console.log(`\n[テーマ${idx} ${name}] 生成中...`);
  const { obj, cost } = await withRetry(() => genTheme(apiKey, name, topics));
  totalCost += cost;
  const s = wb.worksheets[idx - 1];
  s.name = `${String(idx).padStart(2, '0')}_${name}`;
  for (let i = 0; i < 20; i++) {
    const row = s.getRow(i + 2);
    row.getCell(1).value = obj.beginner[i].jp; row.getCell(2).value = obj.beginner[i].ne;
    row.getCell(3).value = obj.intermediate[i].jp; row.getCell(4).value = obj.intermediate[i].ne;
    row.getCell(5).value = obj.advanced[i].jp; row.getCell(6).value = obj.advanced[i].ne;
    row.commit?.();
  }
  console.log(`  完了 ~$${cost.toFixed(4)}`);
}
await wb.xlsx.writeFile(XLSX);
console.log(`\n全テーマ保存。コスト ~$${totalCost.toFixed(4)} (約${Math.ceil(totalCost * 150)}円)`);
