// App B UI i18n: en.json → ko.json (韓国語)。構造・{{プレースホルダ}}・記号を保持。
// 実行: node scripts/build-ko-ui.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const I18N = path.join(ROOT,'expo-app/src/i18n');
const en=JSON.parse(fs.readFileSync(path.join(I18N,'en.json'),'utf8'));
const env={};for(const l of fs.readFileSync(path.join(ROOT,'.env'),'utf8').split(/\r?\n/)){const m=l.match(/^\s*(VITE_\w+)\s*=\s*(.*)\s*$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const anthropicKey=env.VITE_ANTHROPIC_API_KEY;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const flat=[];
(function f(o,p=''){for(const k in o){const key=p?p+'.'+k:k;if(o[k]&&typeof o[k]==='object')f(o[k],key);else flat.push([key,o[k]]);}})(en);
const nonEmpty=flat.filter(([k,v])=>typeof v==='string'&&v.trim()!=='');

async function tr(batch){
  const numbered=batch.map(([k,v],i)=>(i+1)+'. '+v).join('\n');
  const prompt=`Translate these English app UI strings into natural Korean (mobile language-learning app for Korean people learning Japanese).
RULES: Keep {{placeholders}} EXACTLY as-is. Keep arrows/symbols (← → ·) and numbers. Keep it concise (UI labels). For the app brand "Listen & Speak Japanese" use "듣고 말하는 일본어".
[Output] JSON object keys "1".."${batch.length}", each = the Korean. No explanation.

${numbered}`;
  for(let a=1;a<=4;a++){
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':anthropicKey,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:'claude-opus-4-8',max_tokens:6000,messages:[{role:'user',content:prompt}]})});
    if(r.ok){const d=await r.json();const cost=(d.usage.input_tokens*15+d.usage.output_tokens*75)/1e6;const t=d.content.map(c=>c.text||'').join('');const m=t.match(/\{[\s\S]*\}/);return {obj:JSON.parse(m?m[0]:t),cost};}
    if(a<4)await sleep(5000*a);else throw new Error('claude '+r.status);
  }
}
function setPath(o,key,val){const ks=key.split('.');let c=o;for(let i=0;i<ks.length-1;i++){c[ks[i]]=c[ks[i]]||{};c=c[ks[i]];}c[ks[ks.length-1]]=val;}

(async()=>{
  const out=JSON.parse(JSON.stringify(en));
  let cost=0;
  for(let i=0;i<nonEmpty.length;i+=25){
    const batch=nonEmpty.slice(i,i+25);
    const {obj,cost:c}=await tr(batch);cost+=c;
    batch.forEach(([k],j)=>{const v=obj[String(j+1)];if(v!=null)setPath(out,k,v);});
    console.log('  '+Math.min(i+25,nonEmpty.length)+'/'+nonEmpty.length+' ~$'+cost.toFixed(3));
    await sleep(400);
  }
  fs.writeFileSync(path.join(I18N,'ko.json'),JSON.stringify(out,null,2));
  console.log('完了: i18n/ko.json / ~$'+cost.toFixed(3)+' (約'+Math.ceil(cost*150)+'円)');
})();
