// テーマ28(受身)の例題41-60(20文, 比較的短め, jp+ne)を生成。既存1-40と重複させない。
// 出力: scripts/_t28_4160.json (文法2.xlsxは触らない)。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV = path.join(ROOT, '.env');
const SRC = path.join(ROOT, 'scripts/_jp_grammar.json');
const OUT = path.join(ROOT, 'scripts/_t28_4160.json');
function key(){for(const l of fs.readFileSync(ENV,'utf8').split(/\r?\n/)){const m=l.match(/^\s*VITE_ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/);if(m)return m[1].replace(/^["']|["']$/g,'');}throw new Error('no key');}
const apiKey=key();
const data=JSON.parse(fs.readFileSync(SRC,'utf8'));
const t=data['28'];
const existing=[...t.items.map(x=>x.jp), ...t.items2.map(x=>typeof x==='string'?x:x.jp)];
const numbered=existing.map((s,i)=>`${i+1}. ${s}`).join('\n');
const prompt=`日本語教師として、在日外国人(ネパール語話者)向けの「受身(受動態)」の例文を20文(例題41-60)作る。
【重要】比較的短めの文にすること(目安10〜18字程度、シンプルな受身)。
【既存40文(重複禁止)】
${numbered}

【ルール】
- 上記40文と内容が重複しない、新しい20文。受身(〜られる/〜された)を明確に示す。
- 在日外国人の実生活(役所/病院/買い物/仕事/学校/近所/交通/子育て等)で自然。短く実用的に。
- 各文に自然な口語のネパール語訳(デーヴァナーガリー)。
【出力】JSONのみ: {"items":[{"jp":"...","ne":"..."} ×20]}`;
const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':apiKey,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:'claude-opus-4-8',max_tokens:8000,messages:[{role:'user',content:prompt}]})});
if(!res.ok)throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0,150)}`);
const d=await res.json();
const cost=(d.usage?.input_tokens??0)*15/1e6+(d.usage?.output_tokens??0)*75/1e6;
const text=(d.content?.map(c=>c.text||'').join('')||'').replace(/```json\s*|```\s*$/g,'').trim();
const obj=JSON.parse(text);
if(!Array.isArray(obj.items)||obj.items.length!==20)throw new Error(`items != 20 (${obj.items?.length})`);
fs.writeFileSync(OUT,JSON.stringify(obj.items,null,2));
console.log(`生成 20文 (41-60) ~$${cost.toFixed(4)} → ${OUT}`);
obj.items.forEach((it,i)=>console.log(`  ${41+i}. ${it.jp}  /  ${it.ne}`));
