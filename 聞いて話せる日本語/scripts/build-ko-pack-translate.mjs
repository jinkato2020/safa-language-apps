// App B 韓国語パック翻訳: examplesL1/grammarL1/wordsL1 を ja→ko(Opus)。
//  ソース: examples.json(jp), grammarExamples.json(jp), words.json(ja)。
//  逐次保存: scripts/_ko_done.json(再開可)。完成: expo-app/data/overlays/ko.json
//  方針: 他言語(vi等)に倣う。Opus翻訳→別途 Sonnet 逆翻訳検証は後段スクリプトで。
// 実行: node scripts/build-ko-pack-translate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT,'expo-app/data');
const EX=JSON.parse(fs.readFileSync(path.join(DATA,'examples.json'),'utf8'));
const GE=JSON.parse(fs.readFileSync(path.join(DATA,'grammarExamples.json'),'utf8'));
const WD=JSON.parse(fs.readFileSync(path.join(DATA,'words.json'),'utf8'));
const env={};for(const l of fs.readFileSync(path.join(ROOT,'.env'),'utf8').split(/\r?\n/)){const m=l.match(/^\s*(VITE_\w+)\s*=\s*(.*)\s*$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const anthropicKey=env.VITE_ANTHROPIC_API_KEY;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const DONE=path.join(ROOT,'scripts/_ko_done.json');
const done=fs.existsSync(DONE)?JSON.parse(fs.readFileSync(DONE,'utf8')):{};

// 翻訳タスク一覧(未済のみ)
const tasks=[]; // {tag, jp}
for(const[k,arr]of Object.entries(EX)) arr.forEach((e,i)=>{const tag='ex|'+k+'-'+(i+1);if(e.jp&&!done[tag])tasks.push({tag,jp:e.jp});});
for(const[k,arr]of Object.entries(GE)) arr.forEach((e,i)=>{const tag='gr|'+k+'-'+(i+1);if(e.jp&&!done[tag])tasks.push({tag,jp:e.jp});});
for(const[k,arr]of Object.entries(WD)) arr.forEach((w,i)=>{const tag='wd|'+k+'-'+(i+1);const j=w.ja||w.jp;if(j&&!done[tag])tasks.push({tag,jp:j,word:true});});

async function tr(batch,isWord){
  const numbered=batch.map((t,i)=>(i+1)+'. '+t.jp).join('\n');
  const inst=isWord
    ? 'Translate these Japanese vocabulary words into Korean (single word/short phrase each, the common everyday meaning).'
    : 'Translate these Japanese sentences into natural everyday Korean (for Korean speakers learning Japanese in Japan). Translate COMPLETELY (no Japanese left); preserve meaning, questions, numbers, proper nouns. Use natural spoken Korean with appropriate politeness (해요체 default).';
  const prompt=inst+'\n[Output] JSON object keys "1".."'+batch.length+'", each = the Korean. No explanation.\n\n'+numbered;
  for(let a=1;a<=4;a++){
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':anthropicKey,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:'claude-opus-4-8',max_tokens:6000,messages:[{role:'user',content:prompt}]})});
    if(r.ok){const d=await r.json();const cost=(d.usage.input_tokens*15+d.usage.output_tokens*75)/1e6;const t=d.content.map(c=>c.text||'').join('');const m=t.match(/\{[\s\S]*\}/);return {obj:JSON.parse(m?m[0]:t),cost};}
    if(a<4)await sleep(5000*a);else throw new Error('claude '+r.status);
  }
}
(async()=>{
  console.log('未翻訳タスク: '+tasks.length+' (済 '+Object.keys(done).length+')');
  let cost=0,n=0;
  for(let i=0;i<tasks.length;i+=20){
    const batch=tasks.slice(i,i+20);
    // 文と語が混ざらないようsectionで揃える
    const sect=batch[0].tag.split('|')[0]; const homog=batch.filter(t=>t.tag.split('|')[0]===sect);
    let res;try{res=await tr(homog,sect==='wd');}catch(e){console.log('  [skip]@'+i+' '+e.message);continue;}
    cost+=res.cost;
    homog.forEach((t,j)=>{const v=res.obj[String(j+1)];if(v)done[t.tag]=v;});
    n+=homog.length;
    fs.writeFileSync(DONE,JSON.stringify(done));
    if(n%200<20)console.log('  '+n+'/'+tasks.length+' ~$'+cost.toFixed(2));
    await sleep(400);
  }
  fs.writeFileSync(DONE,JSON.stringify(done));
  // 組み立て(未訳は jp フォールバック)
  const overlay={l1:'ko',version:1,examplesL1:{},grammarL1:{},wordsL1:{}};
  for(const[k,arr]of Object.entries(EX)) overlay.examplesL1[k]=arr.map((e,i)=>done['ex|'+k+'-'+(i+1)]||e.jp);
  for(const[k,arr]of Object.entries(GE)) overlay.grammarL1[k]=arr.map((e,i)=>done['gr|'+k+'-'+(i+1)]||e.jp);
  for(const[k,arr]of Object.entries(WD)) overlay.wordsL1[k]=arr.map((w,i)=>done['wd|'+k+'-'+(i+1)]||(w.ja||w.jp));
  fs.writeFileSync(path.join(DATA,'overlays/ko.json'),JSON.stringify(overlay,null,2));
  console.log('\n完了: overlays/ko.json / 翻訳コスト ~$'+cost.toFixed(2)+' (約'+Math.ceil(cost*150)+'円)');
})();
