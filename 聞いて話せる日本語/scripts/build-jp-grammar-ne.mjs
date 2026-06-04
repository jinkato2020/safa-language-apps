// 各テーマの例題21-30(items2の先頭10件, 日本語)をネパール語に翻訳し、theme.ne2(10件)に保存。
// 実行: node scripts/build-jp-grammar-ne.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV = path.join(ROOT, '.env');
const SRC = path.join(ROOT, 'scripts/_jp_grammar.json');
const API = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.NE_MODEL || 'claude-sonnet-4-6';

function key(){for(const l of fs.readFileSync(ENV,'utf8').split(/\r?\n/)){const m=l.match(/^\s*VITE_ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/);if(m)return m[1].replace(/^["']|["']$/g,'');}throw new Error('no key');}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function translate(apiKey,jpArr){
 const numbered=jpArr.map((s,i)=>`${i+1}. ${s}`).join('\n');
 const prompt=`次の日本語文を自然なネパール語(デーヴァナーガリー)に翻訳してください。在日外国人向け日本語学習教材の例文です。丁寧で自然な口語で。

【日本語】
${numbered}

【出力】番号キーのJSONオブジェクトのみ。キー"1".."${jpArr.length}"を厳密に含む。例: {"1":"...","2":"..."}`;
 const res=await fetch(API,{method:'POST',headers:{'x-api-key':apiKey,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:MODEL,max_tokens:8000,messages:[{role:'user',content:prompt}]})});
 if(!res.ok)throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0,150)}`);
 const data=await res.json();
 const cost=(data.usage?.input_tokens??0)*3/1e6+(data.usage?.output_tokens??0)*15/1e6;
 const text=(data.content?.map(c=>c.text||'').join('')||'').replace(/```json\s*|```\s*$/g,'').trim();
 const obj=JSON.parse(text);
 const out=jpArr.map((_,i)=>obj[String(i+1)]);
 if(out.some(x=>typeof x!=='string'||!x.trim()))throw new Error(`missing keys (${Object.keys(obj).length}/${jpArr.length})`);
 return {out,cost};
}
async function withRetry(fn){let last;for(let i=1;i<=4;i++){try{return await fn();}catch(e){last=e;console.log(`  fail(${i}/4): ${e.message}`);if(i<4)await sleep(8000*i);}}throw last;}

const apiKey=key();
const data=JSON.parse(fs.readFileSync(SRC,'utf8'));
let cost=0;
for(const num of Object.keys(data).sort((a,b)=>+a-+b)){
 const t=data[num];
 const jp10=(t.items2||[]).slice(0,10).map(s=>typeof s==='string'?s:(s.jp||''));
 if(jp10.length<10){console.log(`skip ${num} (items2<10)`);continue;}
 if(Array.isArray(t.ne2)&&t.ne2.length===10){console.log(`skip ${num} (ne2 done)`);continue;}
 console.log(`[${num}] ${t.name} 21-30 翻訳...`);
 const {out,cost:c}=await withRetry(()=>translate(apiKey,jp10));
 t.ne2=out;
 fs.writeFileSync(SRC,JSON.stringify(data,null,2));
 cost+=c; console.log(`  done ~$${c.toFixed(4)}`);
}
console.log(`\nネパール語(21-30)翻訳完了 / コスト ~$${cost.toFixed(3)} (~${Math.ceil(cost*150)}円)`);
