// App B 韓国語: 検証(_ko_transcheck.json)で diverge(high/med)になった文を Opus で再翻訳し overlays/ko.json を修正。
//  受身/使役受身は受身の被害ニュアンスを保持。固有名詞・専門語は正しい韓国語慣用語に。
//  逐次保存: scripts/_ko_fixes.json。完成で overlays/ko.json の examplesL1/grammarL1 を上書き。
// 実行: node scripts/fix-ko-retranslate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT,'expo-app/data');
const KO_PATH = path.join(DATA,'overlays/ko.json');
const CHECK = JSON.parse(fs.readFileSync(path.join(ROOT,'scripts/_ko_transcheck.json'),'utf8'));
const env={};for(const l of fs.readFileSync(path.join(ROOT,'.env'),'utf8').split(/\r?\n/)){const m=l.match(/^\s*(VITE_\w+)\s*=\s*(.*)\s*$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const apiKey=env.VITE_ANTHROPIC_API_KEY;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const FIXES=path.join(ROOT,'scripts/_ko_fixes.json');
const fixes=fs.existsSync(FIXES)?JSON.parse(fs.readFileSync(FIXES,'utf8')):{};

// high/med の diverge を対象(low は許容範囲の語感差として据置)
const targets=Object.entries(CHECK).filter(([id,v])=>v.verdict==='diverge'&&(v.severity==='high'||v.severity==='med'));

async function retr(jp,ko,reason){
  const prompt=`You are an expert Japanese→Korean translator for a Japanese-learning app (Korean native speakers).
A draft Korean translation has a problem. Produce a CORRECTED, natural everyday Korean translation of the Japanese.
Rules:
- Preserve the EXACT meaning, grammar voice and nuance of the Japanese. If the Japanese is PASSIVE (〜られる/受身) or CAUSATIVE-PASSIVE (〜させられる), the Korean MUST keep that passive/adversative ("被害") nuance — do NOT make it active.
- Use the correct established Korean term for proper nouns / institutions / domain terms (e.g. 住民票=주민등록등본, 紹介状=진료의뢰서/소개서, 病児保育=아픈 아이 보육/병children).
- Natural spoken Korean, 해요체 politeness by default. Output Korean only, no quotes, no explanation.

Japanese: ${jp}
Draft Korean (has issue): ${ko}
Problem: ${reason}

Corrected Korean:`;
  for(let a=1;a<=4;a++){
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':apiKey,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:'claude-opus-4-8',max_tokens:500,messages:[{role:'user',content:prompt}]})});
    if(r.ok){const d=await r.json();const cost=(d.usage.input_tokens*15+d.usage.output_tokens*75)/1e6;const t=d.content.map(c=>c.text||'').join('').trim().replace(/^["「]|["」]$/g,'');return{ko:t.split('\n')[0].trim(),cost};}
    if(a<4)await sleep(4000*a);else throw new Error('claude '+r.status);
  }
}
(async()=>{
  console.log('修正対象(high/med): '+targets.length+' / 済 '+Object.keys(fixes).length);
  let cost=0,n=0;
  for(const[id,v]of targets){
    if(fixes[id]){n++;continue;}
    let res;try{res=await retr(v.jp,v.ko,v.reason);}catch(e){console.log('  [skip] '+id+' '+e.message);continue;}
    cost+=res.cost; fixes[id]={jp:v.jp,old:v.ko,new:res.ko,severity:v.severity,reason:v.reason};
    fs.writeFileSync(FIXES,JSON.stringify(fixes,null,2));
    n++; console.log('  ['+v.severity+'] '+id+'\n    旧: '+v.ko+'\n    新: '+res.ko);
    await sleep(300);
  }
  // overlays/ko.json に適用(id = group-index, examplesL1 or grammarL1)
  const ko=JSON.parse(fs.readFileSync(KO_PATH,'utf8'));
  let applied=0;
  for(const[id,f]of Object.entries(fixes)){
    const v=CHECK[id]; if(!v)continue;
    const m=id.match(/^(.+)-(\d+)$/); if(!m)continue;
    const group=m[1], idx=parseInt(m[2],10)-1;
    const field=v.kind==='文法'?'grammarL1':'examplesL1';
    if(ko[field]?.[group]?.[idx]!==undefined){ ko[field][group][idx]=f.new; applied++; }
  }
  fs.writeFileSync(KO_PATH,JSON.stringify(ko,null,2));
  console.log('\n完了: 再翻訳 '+Object.keys(fixes).length+' / ko.json適用 '+applied+' / ~$'+cost.toFixed(2)+' (約'+Math.ceil(cost*150)+'円)');
})();
