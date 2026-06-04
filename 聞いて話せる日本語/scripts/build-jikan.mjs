// 時の表現「〜とき・〜まえに・〜あとで」の例題20文(jp+ne)を生成。出力: scripts/_jikan.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV = path.join(ROOT, '.env');
const OUT = path.join(ROOT, 'scripts/_jikan.json');
function key(){for(const l of fs.readFileSync(ENV,'utf8').split(/\r?\n/)){const m=l.match(/^\s*VITE_ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/);if(m)return m[1].replace(/^["']|["']$/g,'');}throw new Error('no key');}
const apiKey=key();
const prompt=`日本語教師として、在日外国人(ネパール語話者)向けの「時の表現」の例文を20文作る。
文法フォーカス: 「〜とき(when)」「〜まえに(before)」「〜あとで(after)」の3パターンをバランスよく。
【ルール】
- 各文がいずれかのパターンを明確に示す。20文すべて内容が異なる。
- 在日外国人の実生活(役所/病院/買い物/仕事/学校/近所/交通/子育て/料理など)で自然で実用的。
- やさしい→やや難しい。日本語として自然で正しい。
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
console.log(`生成 20文 ~$${cost.toFixed(4)} → ${OUT}`);
obj.items.slice(0,5).forEach((it,i)=>console.log(`  ${i+1}. ${it.jp} / ${it.ne}`));
