// App B: 新文法(30x20)と会話5修正の音声を ja/ne/bn で再生成(上書き)。
//  ja  → expo-app/assets/audio/{japanese-grammar,japanese} (同梱)
//  ne  → <repo>/packs/audio/ne   bn → <repo>/packs/audio/bn  (パック)
// 入力: grammarExamples.json(jp), overlays/ne.json, overlays/bn.json, examples.json(jp conv)
// 実行: node scripts/regen-appb-audio.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const ENV = path.join(ROOT, '.env');
const DATA = path.join(ROOT, 'expo-app/data');
const TTS = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const VOICES = 'https://texttospeech.googleapis.com/v1/voices';
function key(){for(const l of fs.readFileSync(ENV,'utf8').split(/\r?\n/)){const m=l.match(/^\s*VITE_GOOGLE_TTS_API_KEY\s*=\s*(.*)\s*$/);if(m)return m[1].replace(/^["']|["']$/g,'');}throw new Error('no tts key');}
const apiKey=key();
const prio=(n)=>n.includes('Wavenet')?70:n.includes('Neural2')?60:n.includes('Standard')?10:0;
async function pickVoice(langs){for(const lang of langs){const r=await fetch(`${VOICES}?languageCode=${lang}&key=${apiKey}`);if(!r.ok)continue;const vs=(await r.json()).voices||[];if(vs.length){vs.sort((a,b)=>prio(b.name)-prio(a.name));return {lang:vs[0].languageCodes?.[0]||lang,name:vs[0].name};}}throw new Error(`no voice ${langs}`);}
async function synth(text,voice,rate){const r=await fetch(`${TTS}?key=${apiKey}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input:{text},voice:{languageCode:voice.lang,name:voice.name},audioConfig:{audioEncoding:'MP3',speakingRate:rate}})});if(!r.ok)throw new Error(`TTS ${r.status}: ${(await r.text().catch(()=>'')).slice(0,100)}`);return Buffer.from((await r.json()).audioContent,'base64');}
async function withRetry(fn){let last;for(let i=1;i<=4;i++){try{return await fn();}catch(e){last=e;if(i<4)await new Promise(r=>setTimeout(r,4000*i));}}throw last;}

const grammar=JSON.parse(fs.readFileSync(path.join(DATA,'grammarExamples.json'),'utf8'));
const ne=JSON.parse(fs.readFileSync(path.join(DATA,'overlays/ne.json'),'utf8'));
const bn=JSON.parse(fs.readFileSync(path.join(DATA,'overlays/bn.json'),'utf8'));
const ex=JSON.parse(fs.readFileSync(path.join(DATA,'examples.json'),'utf8'));

const JA_G=path.join(ROOT,'expo-app/assets/audio/japanese-grammar');
const JA_C=path.join(ROOT,'expo-app/assets/audio/japanese');
const NE_D=path.join(REPO,'packs/audio/ne');
const BN_D=path.join(REPO,'packs/audio/bn');
for(const d of [JA_G,JA_C,NE_D,BN_D]) fs.mkdirSync(d,{recursive:true});

const jaV=await pickVoice(['ja-JP']);
const neV=await pickVoice(['ne-NP','hi-IN']);
const bnV={lang:'bn-IN',name:'bn-IN-Wavenet-A'};
console.log(`ja=${jaV.name} ne=${neV.name} bn=${bnV.name}`);

let n=0;
async function gen(file,text,voice,rate){ if(!text)return; fs.writeFileSync(file, await withRetry(()=>synth(text,voice,rate))); n++; if(n%100===0)console.log(`  ${n} ...`); }

// 文法 (T-I): 全30x20
for(const t of Object.keys(grammar)){
 const arr=grammar[t];
 for(let i=0;i<arr.length;i++){
  const id=`${t}-${i+1}`;
  await gen(path.join(JA_G,`${id}.mp3`), arr[i].jp, jaV, 0.95);
  await gen(path.join(NE_D,`${id}.mp3`), (ne.grammarL1[t]||[])[i], neV, 0.85);
  await gen(path.join(BN_D,`${id}.mp3`), (bn.grammarL1[t]||[])[i], bnV, 0.9);
 }
}
// 会話5修正 (T-L-I)
const CONV=[['1-2',10],['1-2',15],['5-2',20],['19-2',14],['25-2',15]];
for(const [k,idx] of CONV){
 const id=`${k}-${idx}`;
 await gen(path.join(JA_C,`${id}.mp3`), ex[k][idx-1].jp, jaV, 0.95);
 await gen(path.join(NE_D,`${id}.mp3`), (ne.examplesL1[k]||[])[idx-1], neV, 0.85);
 await gen(path.join(BN_D,`${id}.mp3`), (bn.examplesL1[k]||[])[idx-1], bnV, 0.9);
}
console.log(`\n再生成 ${n} mp3 (文法600x3 + 会話5x3)`);
