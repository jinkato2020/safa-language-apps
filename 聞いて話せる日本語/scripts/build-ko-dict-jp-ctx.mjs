// App B 韓国語パック 辞書(全件・最高品質): 日本語文を分解し各語に韓国語の意味+読み+品詞+注記。
//  出力: overlays/ko.json の convVocab/grammarVocab + vocabTokenize='jp'。逐次保存・再開可。
//  モデルは最近の辞書(bn/vi/ne)に倣い Sonnet。
// 実行: node scripts/build-ko-dict-jp-ctx.mjs [conv|grammar]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'expo-app/data');
const OVERLAY = path.join(DATA, 'overlays/ko.json');
const API='https://api.anthropic.com/v1/messages';
const MODEL='claude-sonnet-4-6';
const BATCH=6, MAX_RETRY=4, MAX_TOKENS=16000;
const env={};for(const l of fs.readFileSync(path.join(ROOT,'.env'),'utf8').split(/\r?\n/)){const m=l.match(/^\s*(VITE_\w+)\s*=\s*(.*)\s*$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const apiKey=env.VITE_ANTHROPIC_API_KEY;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hasJa=s=>/[぀-ヿ㐀-鿿]/.test(s||'');

async function analyze(items){
  const list=items.map(it=>it.id+': '+it.jp).join('\n');
  const prompt=`You are a Japanese tokenizer + Japanese-Korean lexicographer (for Korean learners of Japanese).
For each sentence, output a SINGLE left-to-right token sequence that TILES the sentence:
- Concatenating all "word" fields IN ORDER must reproduce the sentence EXACTLY (same characters incl. punctuation). NO overlaps, NO gaps, NO duplicates.
- Each token = shortest meaningful unit: split compounds (思考型→思考+型, 集中力→集中+力), separate particles (は が を に で へ と から まで の も), and separate verb stems from auxiliaries/endings where natural.
- Punctuation (、。?!) is its own token with meaning "".
- EVERY non-punctuation token MUST have a NON-EMPTY meaning. For grammatical tokens — auxiliaries/copula (です ます た ない), te-form connectives (て で), honorific prefixes (お ご), particles — give a SHORT functional Korean gloss (e.g. ます=정중형 어미, で=연결(て형), お=존경 접두사). Only punctuation may have meaning "".
For each token: "word"(exactly as written) / "reading"(romaji Hepburn) / "meaning"(KOREAN, context-correct; particle/auxiliary=short functional gloss, never empty) / "pos" / "note"(Korean or "").
Output ONLY JSON: {"sentences":[{"id":"...","words":[{"word":"","reading":"","meaning":"","pos":"","note":""}]}]}

Sentences:
${list}`;
  const res=await fetch(API,{method:'POST',headers:{'x-api-key':apiKey,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:MODEL,max_tokens:MAX_TOKENS,messages:[{role:'user',content:prompt}]})});
  if(!res.ok)throw new Error('HTTP '+res.status+': '+(await res.text()).slice(0,150));
  const d=await res.json();const cost=(d.usage.input_tokens*3+d.usage.output_tokens*15)/1e6;
  const text=d.content.map(c=>c.text||'').join('').replace(/```json\s*|```\s*$/g,'').trim();
  return {data:JSON.parse(text), cost};
}
async function withRetry(fn){let last;for(let i=1;i<=MAX_RETRY;i++){try{return await fn();}catch(e){last=e;if(i<MAX_RETRY){console.log('  retry '+i+': '+e.message);await sleep(6000*i);}}}throw last;}
function buildSentences(kind){
  const out=[];
  if(kind==='conv'){const ex=JSON.parse(fs.readFileSync(path.join(DATA,'examples.json'),'utf8'));for(const k of Object.keys(ex))ex[k].forEach((e,i)=>{if(e.jp)out.push({group:k,id:k+'-'+(i+1),jp:e.jp});});}
  else{const gr=JSON.parse(fs.readFileSync(path.join(DATA,'grammarExamples.json'),'utf8'));for(const t of Object.keys(gr))gr[t].forEach((e,i)=>{if(e.jp)out.push({group:t,id:t+'-'+(i+1),jp:e.jp});});}
  return out;
}
async function main(){
  const args=process.argv.slice(2);
  const kinds=args.length?args:['conv','grammar'];
  let totalCost=0;
  for(const kind of kinds){
    const field=kind==='conv'?'convVocab':'grammarVocab';
    const sentences=buildSentences(kind);
    const overlay=JSON.parse(fs.readFileSync(OVERLAY,'utf8'));
    let dict=overlay[field]&&typeof overlay[field]==='object'?overlay[field]:{};
    const keys=Object.keys(dict);
    if(keys.length && !hasJa(keys[0])){ console.log(`  旧 ${field}(${keys.length}語, 非日本語キー)を破棄して再構築`); dict={}; }
    const doneIds=new Set();
    for(const w of Object.values(dict)) for(const c of (w.contexts||[])) doneIds.add(c.sentence_id);
    const groups=[...new Set(sentences.map(s=>s.group))];
    console.log(`\n=== ${kind} (${field}): ${sentences.length}文 / model=${MODEL} (ja→ko) ===`);
    let gdone=0;
    for(const g of groups){
      const gItems=sentences.filter(s=>s.group===g && !doneIds.has(s.id));
      for(let i=0;i<gItems.length;i+=BATCH){
        const batch=gItems.slice(i,i+BATCH);
        let data;
        try{({data}=await withRetry(()=>analyze(batch)).then(r=>{totalCost+=r.cost;return r;}));}
        catch(e){console.log('  [skip] '+batch[0].id+'.. '+e.message);continue;}
        for(const s of (data.sentences||[])) for(const w of (s.words||[])){
          if(!w.word||!w.meaning)continue;
          if(!dict[w.word])dict[w.word]={rom:w.reading||'',base_form:w.word,base_meaning:w.meaning,contexts:[]};
          dict[w.word].contexts.push({sentence_id:s.id,ja:w.meaning,pos:w.pos||'',...(w.note?{note:w.note}:{})});
        }
      }
      overlay[field]=dict; overlay.vocabTokenize='jp';
      fs.writeFileSync(OVERLAY, JSON.stringify(overlay,null,2));
      gdone++;
      if(gItems.length) console.log(`  [${kind}] group ${g} (${gdone}/${groups.length}) 語数=${Object.keys(dict).length} 累計~$${totalCost.toFixed(2)}`);
    }
    console.log(`${kind} 完了: ${Object.keys(dict).length}語`);
  }
  console.log(`\n辞書 全完了 / ~$${totalCost.toFixed(2)} (約${Math.ceil(totalCost*150)}円)`);
}
main().catch(e=>{console.error('致命的:',e.message);process.exit(1);});
