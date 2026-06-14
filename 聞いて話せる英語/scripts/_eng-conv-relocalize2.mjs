// 追加再ローカライズ(米国英語): 30アルバイト/仕事探し・13学校育児を全面再生成、25の残存も再生成。NEW mode。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const env = {}; for (const l of fs.readFileSync(path.join(REPO, '聞いて話せる日本語/.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const KEY = env.VITE_ANTHROPIC_API_KEY;
const convPath = path.join(ROOT, 'scripts/_eng_conv.json');
const conv = JSON.parse(fs.readFileSync(convPath, 'utf8'));
const LV = { 1: '初級(短く平易な文)', 2: '中級(やや長く実用的)', 3: '上級(複文・自然で豊かな表現)' };
const NEW = {
  13: '米国の学校・育児文脈。先生、宿題、成績/通知表(report card)、放課後の活動・個別指導(tutoring/after-school)、保護者面談(parent-teacher conference)、給食/弁当、遠足やfield day、PTA。※日本固有の「塾・授業参観・運動会」の直訳は避け、米国の自然な表現に。円は使わない。',
  25: '海外/英語圏での手続き・公共サービス(銀行口座開設、郵便局、ビザ/入国手続き、携帯契約、図書館カード、市役所/DMV)の実用英語。円・日本固有制度は使わない。',
  30: '米国の求人・仕事/アルバイト探し。求人サイト(Indeed/LinkedIn)、応募、resume/CV・カバーレター、面接、時給($)・最低賃金、シフト、パート/フルタイム、推薦状(reference)、採用通知、給与・税(W-2等は軽く)、職場マナー(Western)。※日本固有(ハローワーク/在留カード/厚生年金/雇用保険/103万円/源泉徴収/確定申告/労働基準監督署/お疲れ様/先輩/ブラックバイト)は一切使わない。円も使わない。',
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
let inTok = 0, outTok = 0;
async function call(prompt) {
  for (let a = 1; a <= 6; a++) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }) });
      if (r.status === 429) { await sleep(5000 * a); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(); if (j.usage) { inTok += j.usage.input_tokens; outTok += j.usage.output_tokens; }
      const arr = JSON.parse(j.content.map(c => c.text || '').join('').match(/\{[\s\S]*\}/)[0]).items;
      if (!Array.isArray(arr) || arr.length < 20) throw new Error('len ' + (arr?.length));
      return arr.slice(0, 20);
    } catch (e) { if (a < 6) await sleep(4000 * a); else throw e; }
  }
}
const base = `語学学習アプリの会話例文(学習対象=英語/母語=日本語)。米国英語を基準。各文は自然で実用的。場面・語彙・構文が重複しないよう多様に。出力はJSONのみ {"items":[{"en":"English.","ja":"日本語訳。"}, ...]} ちょうど20件。`;
let n = 0;
for (const T of [13, 25, 30]) {
  for (let L = 1; L <= 3; L++) {
    const k = `${T}-${L}`;
    conv[k] = await call(`${base}\nテーマ: ${NEW[T]}\nレベル: ${LV[L]}。このレベルにふさわしい難易度で20文。`);
    fs.writeFileSync(convPath, JSON.stringify(conv, null, 2));
    n++; process.stdout.write(`\r再ローカライズ ${n}/9 (${k})        `);
  }
}
const cost = (inTok * 15 + outTok * 75) / 1e6;
console.log(`\n追加再ローカライズ完了: 13/25/30 × 3レベル / ~$${cost.toFixed(2)}`);
