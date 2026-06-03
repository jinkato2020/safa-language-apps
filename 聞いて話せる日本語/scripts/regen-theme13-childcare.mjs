// 会話.xlsx シート13(学校・育児)の育児8行(3,5,7,8,9,14,16,19)を、多様な育児例文で作り直す。
// 初級8/中級8/上級8 をすべて別内容で生成(上級は短め)。残りの学校12行は触らない。
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const XLSX = path.join(ROOT, '会話.xlsx');
const ENV = path.join(ROOT, '.env');
const ROWS = [3, 5, 7, 8, 9, 14, 16, 19]; // 育児に差し替える行

function loadKey() {
  for (const line of fs.readFileSync(ENV, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*VITE_ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/); if (m) return m[1].replace(/^["']|["']$/g, '');
  } throw new Error('key なし');
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function gen(apiKey) {
  const prompt = `日本で子育てするネパール語話者向け、テーマ「育児」の例文を作ってください。
保育園・幼稚園の入園/送り迎え、子供の発熱・病気・病児保育、予防接種・乳幼児健診、給食のアレルギー対応、
持ち物・連絡帳、先生との連絡、行事・授業参観、児童手当、母子手帳、待機児童 などを幅広く。
【ルール】初級8・中級8・上級8、合計24文。すべて別の場面(重複なし)。日本の制度・場面に最適化。
初級: 短く基本(〜15字)。中級: やや長め(20〜35字)。上級: 1文で簡潔(25〜40字)。各文にネパール語訳。
【出力】JSONのみ: {"beginner":[{"jp":"","ne":""}×8],"intermediate":[×8],"advanced":[×8]}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = await res.json();
  const cost = (data.usage?.input_tokens ?? 0) * 3 / 1e6 + (data.usage?.output_tokens ?? 0) * 15 / 1e6;
  const o = JSON.parse((data.content?.map(c => c.text || '').join('') || '').replace(/```json\s*|```\s*$/g, '').trim());
  for (const k of ['beginner', 'intermediate', 'advanced']) if (!Array.isArray(o[k]) || o[k].length !== 8) throw new Error(`${k} が8件でない`);
  return { o, cost };
}
async function withRetry(fn) { let last; for (let i = 1; i <= 4; i++) { try { return await fn(); } catch (e) { last = e; console.log(`失敗(${i}/4): ${e.message}`); if (i < 4) await sleep(8000 * i); } } throw last; }

const apiKey = loadKey();
const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(XLSX);
const { o, cost } = await withRetry(() => gen(apiKey));
const s = wb.worksheets[12];
ROWS.forEach((rn, i) => {
  const row = s.getRow(rn);
  row.getCell(1).value = o.beginner[i].jp; row.getCell(2).value = o.beginner[i].ne;
  row.getCell(3).value = o.intermediate[i].jp; row.getCell(4).value = o.intermediate[i].ne;
  row.getCell(5).value = o.advanced[i].jp; row.getCell(6).value = o.advanced[i].ne;
  row.commit?.();
});
await wb.xlsx.writeFile(XLSX);
console.log(`シート13の育児8行を多様化して保存。コスト ~$${cost.toFixed(4)} (約${Math.ceil(cost * 150)}円)`);
