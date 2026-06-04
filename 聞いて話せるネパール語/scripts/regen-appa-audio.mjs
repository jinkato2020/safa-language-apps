// 修正した33文の音声を ne/ja/en で再生成(上書き)。
// ne → assets/audio/nepali|nepali-grammar (同梱) / ja,en → packs-nepali/audio/{ja,en} (パック)。
// 実行: node scripts/regen-appa-audio.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const ENV = path.join(ROOT, '.env');
const res = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/_appa_localized.json'), 'utf8'));
const TTS = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const VOICES = 'https://texttospeech.googleapis.com/v1/voices';

function key(){for(const l of fs.readFileSync(ENV,'utf8').split(/\r?\n/)){const m=l.match(/^\s*VITE_GOOGLE_TTS_API_KEY\s*=\s*(.*)\s*$/);if(m)return m[1].replace(/^["']|["']$/g,'');}throw new Error('no tts key');}
const apiKey = key();
const prio = (n) => n.includes('Wavenet') ? 70 : n.includes('Neural2') ? 60 : n.includes('Standard') ? 10 : 0;

async function pickVoice(langs){
  for (const lang of langs){
    const r = await fetch(`${VOICES}?languageCode=${lang}&key=${apiKey}`);
    if (!r.ok) continue;
    const vs = (await r.json()).voices || [];
    if (vs.length){ vs.sort((a,b)=>prio(b.name)-prio(a.name)); return { lang: vs[0].languageCodes?.[0]||lang, name: vs[0].name }; }
  }
  throw new Error(`no voice for ${langs}`);
}
async function synth(text, voice, rate){
  const r = await fetch(`${TTS}?key=${apiKey}`,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({input:{text},voice:{languageCode:voice.lang,name:voice.name},audioConfig:{audioEncoding:'MP3',speakingRate:rate}})});
  if(!r.ok) throw new Error(`TTS ${r.status}: ${(await r.text().catch(()=>'')).slice(0,120)}`);
  return Buffer.from((await r.json()).audioContent,'base64');
}

const neVoice = await pickVoice(['ne-NP','hi-IN']);
const jaVoice = await pickVoice(['ja-JP']);
const enVoice = { lang:'en-US', name:'en-US-Wavenet-F' };
console.log(`ne=${neVoice.name} ja=${jaVoice.name} en=${enVoice.name}`);

const NE_CONV = path.join(ROOT,'expo-app/assets/audio/nepali');
const NE_GRAM = path.join(ROOT,'expo-app/assets/audio/nepali-grammar');
const JA_DIR = path.join(REPO,'packs-nepali/audio/ja');
const EN_DIR = path.join(REPO,'packs-nepali/audio/en');

let n=0;
for (const [id,v] of Object.entries(res)){
  const fid = `${v.key}-${v.idx}`; // conv: T-L-i / gram: T-i
  const neDir = v.src==='conv' ? NE_CONV : NE_GRAM;
  fs.writeFileSync(path.join(neDir,`${fid}.mp3`), await synth(v.ne, neVoice, 0.85));
  fs.writeFileSync(path.join(JA_DIR,`${fid}.mp3`), await synth(v.jp, jaVoice, 0.95));
  fs.writeFileSync(path.join(EN_DIR,`${fid}.mp3`), await synth(v.en, enVoice, 0.95));
  n++; console.log(`  ${id} (${fid}) ne/ja/en`);
}
console.log(`\n再生成 ${n}文 × 3言語 = ${n*3} mp3`);
