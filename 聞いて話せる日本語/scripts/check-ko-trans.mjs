// App B 韓国語パック 翻訳チェック(全文): Sonnetで ko→ja 逆変換 + ko が jp原文の意味と合うか判定。
//  入力: examples.json/grammarExamples.json(jp) + overlays/ko.json(examplesL1/grammarL1)。
//  出力: scripts/_ko_transcheck.json(全件 + 乖離フラグ + 逆翻訳 + 理由)。逐次保存・再開可。
// 実行: node scripts/check-ko-trans.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT,'expo-app/data');
const EX=JSON.parse(fs.readFileSync(path.join(DATA,'examples.json'),'utf8'));
const GE=JSON.parse(fs.readFileSync(path.join(DATA,'grammarExamples.json'),'utf8'));
const KO=JSON.parse(fs.readFileSync(path.join(DATA,'overlays/ko.json'),'utf8'));
const env={};for(const l of fs.readFileSync(path.join(ROOT,'.env'),'utf8').split(/\r?\n/)){const m=l.match(/^\s*(VITE_\w+)\s*=\s*(.*)\s*$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const apiKey=env.VITE_ANTHROPIC_API_KEY;
const MODEL='claude-sonnet-4-6';
const BATCH=4;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const OUT=path.join(ROOT,'scripts/_ko_transcheck.json');
const out=fs.existsSync(OUT)?JSON.parse(fs.readFileSync(OUT,'utf8')):{};

const items=[];
for(const[k,arr]of Object.entries(EX)) arr.forEach((e,i)=>{const id=k+'-'+(i+1);const ko=KO.examplesL1?.[k]?.[i];if(e.jp&&ko)items.push({id,kind:'会話',jp:e.jp,ko});});
for(const[k,arr]of Object.entries(GE)) arr.forEach((e,i)=>{const id=k+'-'+(i+1);const ko=KO.grammarL1?.[k]?.[i];if(e.jp&&ko)items.push({id,kind:'文法',jp:e.jp,ko});});

async function call(prompt){for(let i=1;i<=4;i++){const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':apiKey,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:MODEL,max_tokens:8000,messages:[{role:'user',content:prompt}]})});if(r.ok){const d=await r.json();const cost=(d.usage.input_tokens*3+d.usage.output_tokens*15)/1e6;const t=d.content.map(c=>c.text||'').join('');const m=t.match(/\[[\s\S]*\]/);return {arr:JSON.parse(m?m[0]:t),cost};}if(i<4)await sleep(5000*i);}throw new Error('fail');}

(async()=>{
  const todo=items.filter(it=>!out[it.id]);
  console.log('全'+items.length+' / 未チェック '+todo.length);
  let cost=0;
  for(let i=0;i<todo.length;i+=BATCH){
    const chunk=todo.slice(i,i+BATCH);
    const lines=chunk.map((c,j)=>`${j+1}. JP(原文): ${c.jp}\n   KO(訳): ${c.ko}`).join('\n');
    const prompt=`あなたは日本語・韓国語の翻訳校正者です。各項目で、韓国語訳(KO)が日本語原文(JP)の意味を正しく伝えているか判定してください。両言語を読めるので直接評価すること。
[判定] 次のときだけ "diverge": 意味の誤り/重要語の欠落/余分な意味/数値・固有名詞の誤り/否定の取り違え/未翻訳。丁寧さ・語順・自然な言い換えは "ok"。
各項目で KO を日本語へ逆翻訳(backJa)も付けてください。

${lines}

[出力] JSON配列のみ。各 {"n":<番号>,"backJa":"<KOの日本語逆翻訳>","verdict":"ok|diverge","severity":"high|med|low","reason":"<日本語簡潔。okなら空>"}`;
    let res;try{res=await call(prompt);}catch(e){console.log('  [skip]@'+i+' '+e.message);continue;}
    cost+=res.cost;
    for(const r of res.arr){const it=chunk[r.n-1];if(it)out[it.id]={kind:it.kind,jp:it.jp,ko:it.ko,backJa:r.backJa||'',verdict:r.verdict,severity:r.severity||'',reason:r.reason||''};}
    fs.writeFileSync(OUT,JSON.stringify(out,null,2));
    const div=Object.values(out).filter(v=>v.verdict==='diverge').length;
    if((i/BATCH)%5===0)console.log('  '+Math.min(i+BATCH,todo.length)+'/'+todo.length+' (乖離計 '+div+') ~$'+cost.toFixed(2));
    await sleep(400);
  }
  fs.writeFileSync(OUT,JSON.stringify(out,null,2));
  const all=Object.values(out);const div=all.filter(v=>v.verdict==='diverge');const sev={high:0,med:0,low:0};for(const v of div)sev[v.severity]=(sev[v.severity]||0)+1;
  console.log('\n=== 韓国語翻訳チェック完了 ===');
  console.log('全'+all.length+'文 / 乖離 '+div.length+'(高'+sev.high+'/中'+sev.med+'/低'+sev.low+') / ~$'+cost.toFixed(2));
})();
