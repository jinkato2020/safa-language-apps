// 会話のローカライズ(米国英語基準)。NEW=内容再生成 / MODIFY=既存を単位置換・チップ追加。{en, ja}を上書き。
//  対象: NEW=2,14,15,23,25 / MODIFY=6,7,16,22,26,27。各テーマ3レベル(初級/中級/上級)×20。
//  入出力: scripts/_eng_conv.json。APIキーは App B .env。Opus。再開可(済みは飛ばさず上書きするので--onlyで限定可)。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const env = {}; for (const l of fs.readFileSync(path.join(REPO, '聞いて話せる日本語/.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const KEY = env.VITE_ANTHROPIC_API_KEY;
const convPath = path.join(ROOT, 'scripts/_eng_conv.json');
const conv = JSON.parse(fs.readFileSync(convPath, 'utf8'));
const LV = { 1: '初級(短く平易な文)', 2: '中級(やや長く実用的)', 3: '上級(複文・自然で豊かな表現)' };
const NEW = {
  2: '世界・英語圏の有名な観光地について話す(London/New York/Sydney等の名所、博物館、ビーチ、山、街歩き)。観光地の感想や案内。',
  14: '歴史・経済・政治の中立的な事実(世界/英語圏)。【中立厳守】偏向・党派政治・論争・差別を排除。政治は中立的な統治制度の事実のみ。',
  15: '海外/英語圏での旅行・ホテル・宿泊(予約、チェックイン/アウト、部屋、空港)。【チップ含む】ホテルでのチップ(ベルボーイ、ハウスキーピング、ルームサービス)の表現も入れる。',
  23: '家・住まい(英語圏)。部屋、アパート、家賃、引っ越し・契約、家具、設備(エアコン/水道/電気)、収納、近所付き合い、日当たり、立地。※日本固有のごみ分別は入れない。',
  25: '海外での手続き・公共サービス(銀行口座開設、郵便局、ビザ/入国手続き、携帯契約、図書館カード、市役所)の実用英語。',
};
const MODIFY = {
  6: '米国の買い物文脈に置換: 通貨 円→米ドル(金額は自然に調整)。買い物の言い回し・構造は維持。',
  7: '米国の交通文脈に置換: 地下鉄=subway、ICカード=transit card/MetroCard 等。道案内の表現は維持。',
  16: 'レストラン。注文の言い回しは維持しつつ、通貨→ドル・料理名は一般的/欧米風に置換。さらに【20文中5〜6文を米国の外食文化に差替】: チップ(15〜20%「Should I leave a tip?」)、会計を割る(split the check)、持ち帰り(to go)、水・おかわり無料(free refills)。',
  22: '米国のサイズ表記(S/M/L、US靴サイズ)と通貨ドルに置換。服の買い物の言い回しは維持。',
  26: '緊急番号を米国の911(警察/消防/救急が1番号)に置換(日本の110/119を廃す)。緊急時の表現は維持。',
  27: '米国の通貨ドルに置換(金額は自然に調整)。銀行・お金の言い回しは維持。',
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
for (const T of [2, 14, 15, 23, 25, 6, 7, 16, 22, 26, 27]) {
  for (let L = 1; L <= 3; L++) {
    const k = `${T}-${L}`;
    let prompt;
    if (NEW[T]) {
      prompt = `${base}\nテーマ: ${NEW[T]}\nレベル: ${LV[L]}。このレベルにふさわしい難易度で20文。`;
    } else {
      const cur = conv[k].map((e, i) => `[${i}] en:${e.en} / ja:${e.ja}`).join('\n');
      prompt = `${base}\n下記の既存20文を、次の方針で改訂(原則は維持し必要箇所のみ変更)。\n方針: ${MODIFY[T]}\nレベル: ${LV[L]}。\n既存:\n${cur}\n→ 改訂後の20文を同順で。`;
    }
    conv[k] = await call(prompt);
    fs.writeFileSync(convPath, JSON.stringify(conv, null, 2));
    n++; process.stdout.write(`\r会話ローカライズ ${n}/33 (${k})        `);
  }
}
const cost = (inTok * 15 + outTok * 75) / 1e6;
console.log(`\n会話ローカライズ完了: 11テーマ×3レベル / ~$${cost.toFixed(2)}`);
