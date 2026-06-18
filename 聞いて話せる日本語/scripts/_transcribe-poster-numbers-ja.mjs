import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIR=path.join(ROOT,'expo-app/assets/poster/numbers/audio');
const env={};for(const l of fs.readFileSync(path.join(ROOT,'.env'),'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const KEY=env.OPENAI_API_KEY;
const ids=[...Array(20)].map((_,i)=>String(i+1).padStart(2,'0'));
const out={};
for(const id of ids){const f=path.join(DIR,id+'_ja.mp3');if(!fs.existsSync(f)){console.log('skip',id);continue;}
const fd=new FormData();fd.append('file',new Blob([fs.readFileSync(f)],{type:'audio/mpeg'}),id+'.mp3');fd.append('model','whisper-1');fd.append('language','ja');fd.append('response_format','text');
const r=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{'Authorization':'Bearer '+KEY},body:fd});
const t=(await r.text()).trim();out[id]=t;console.log(id,'=>',JSON.stringify(t));}
fs.writeFileSync(path.join(ROOT,'scripts/_poster_numbers_ja.json'),JSON.stringify(out,null,2));
