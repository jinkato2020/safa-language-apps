// ポスター numbers の英語音声(01-20)を語尾が切れないよう再生成。
//  voice=en-US-Neural2-F、SSMLで末尾break(語を完全に発話させる)→ 24kHz mono 32k + apad。
//  日英文字起こしで確定した数: 0,1..11,20,30,100,200,1000,2000,10000,20000。
// 実行: node scripts/build-poster-numbers-en.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'expo-app/assets/poster/numbers/audio');
const env={};for(const l of fs.readFileSync(path.join(ROOT,'.env'),'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const KEY=env.VITE_GOOGLE_TTS_API_KEY;
const FFMPEG = 'C:/ffmpeg/bin/ffmpeg.exe';
const VOICE={languageCode:'en-US',name:'en-US-Neural2-F'};
const WORDS={'01':'zero','02':'one','03':'two','04':'three','05':'four','06':'five','07':'six','08':'seven','09':'eight','10':'nine','11':'ten','12':'eleven','13':'twenty','14':'thirty','15':'one hundred','16':'two hundred','17':'one thousand','18':'two thousand','19':'ten thousand','20':'twenty thousand'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function synth(word){
  const ssml=`<speak>${word}<break time="300ms"/></speak>`;
  for(let a=1;a<=4;a++){
    const r=await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key='+KEY,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input:{ssml},voice:VOICE,audioConfig:{audioEncoding:'MP3',speakingRate:0.95}})});
    if(r.ok)return Buffer.from((await r.json()).audioContent,'base64');
    await sleep(2500*a);
  }
  throw new Error('TTS fail '+word);
}
let n=0;
for(const [id,word] of Object.entries(WORDS)){
  const raw=await synth(word);
  const tmp=path.join(DIR, '_tmp_'+id+'.mp3');
  fs.writeFileSync(tmp, raw);
  const out=path.join(DIR, id+'_en.mp3');
  // 24kHz mono 32k + 末尾0.2s pad(SSML break 0.3s と合わせ十分な余白)
  execFileSync(FFMPEG, ['-y','-loglevel','error','-i',tmp,'-ar','24000','-ac','1','-b:a','32k','-map_metadata','-1','-af','apad=pad_dur=0.2', out]);
  fs.unlinkSync(tmp);
  n++; console.log(id, word, '->', id+'_en.mp3');
  await sleep(120);
}
console.log('\n完了:', n, '件 再生成 (en-US-Neural2-F, SSML+pad, 32k)');
