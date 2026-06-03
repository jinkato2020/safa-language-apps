// 会話.xlsx の 25/29/30 の「上級」のみ、短め(1文・簡潔)に作り直す。初級/中級・既存内容と重複させない。
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const XLSX = path.join(ROOT, '会話.xlsx');
const ENV = path.join(ROOT, '.env');
const MODEL = 'claude-sonnet-4-6';
const THEMES = [{ idx: 25, name: '役所と手続き' }, { idx: 29, name: '病院と体調' }, { idx: 30, name: 'アルバイトと仕事探し' }];

function loadKey() {
  for (const line of fs.readFileSync(ENV, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*VITE_ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/); if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  throw new Error('key なし');
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function gen(apiKey, name, avoid) {
  const prompt = `日本で生活するネパール語話者向け、テーマ「${name}」の「上級」例文を20文作ってください。
【長さ】1文で簡潔に。25〜40字程度(長くても45字)。二文に分けない。複雑な文法・丁寧さは保ちつつ短く。
【内容】20文すべて別の場面。下記の既存文(初級・中級)と内容が重複しないこと。日本での実生活に最適化。
【既存(重複回避)】
${avoid.join(' / ')}
【出力】JSON配列のみ(20件): [{"jp":"...","ne":"..."} ×20]`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = await res.json();
  const cost = (data.usage?.input_tokens ?? 0) * 3 / 1e6 + (data.usage?.output_tokens ?? 0) * 15 / 1e6;
  const arr = JSON.parse((data.content?.map(c => c.text || '').join('') || '').replace(/```json\s*|```\s*$/g, '').trim());
  if (!Array.isArray(arr) || arr.length !== 20) throw new Error(`20件でない (${arr?.length})`);
  return { arr, cost };
}
async function withRetry(fn) { let last; for (let i = 1; i <= 4; i++) { try { return await fn(); } catch (e) { last = e; console.log(`  失敗(${i}/4): ${e.message}`); if (i < 4) await sleep(8000 * i); } } throw last; }

const apiKey = loadKey();
const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(XLSX);
let total = 0;
for (const { idx, name } of THEMES) {
  const s = wb.worksheets[idx - 1];
  const avoid = [];
  for (let r = 2; r <= 21; r++) { avoid.push(s.getRow(r).getCell(1).value, s.getRow(r).getCell(3).value); }
  console.log(`[テーマ${idx} ${name}] 上級を短く再生成...`);
  const { arr, cost } = await withRetry(() => gen(apiKey, name, avoid.filter(Boolean)));
  total += cost;
  for (let i = 0; i < 20; i++) { const row = s.getRow(i + 2); row.getCell(5).value = arr[i].jp; row.getCell(6).value = arr[i].ne; row.commit?.(); }
  console.log(`  完了 ~$${cost.toFixed(4)}`);
}
await wb.xlsx.writeFile(XLSX);
console.log(`\n保存。コスト ~$${total.toFixed(4)} (約${Math.ceil(total * 150)}円)`);
