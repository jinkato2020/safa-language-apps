// App A 会話themeId を表示順(=themes.json配列順)に改番。文法は不変(別名前空間)。
// 対象: themes.json(id), examples.json(キー tid-level), conv-vocab-context.json(contexts sid),
//       overlays/{en,ja}.json(examplesL1キー + convVocab contexts sid), 音声4ディレクトリ(会話3部名).
// 衝突回避: 音声は2段リネーム(→.RENTMP→確定)。データは新オブジェクト構築。
// usage: node scripts/_renumber-appa-conv.mjs [--apply]   (無印=dry-run)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const APPLY = process.argv.includes('--apply');
const D = p => path.join(ROOT, p);
const themes = JSON.parse(fs.readFileSync(D('expo-app/data/themes.json'),'utf8'));
const arr = Array.isArray(themes)?themes:(themes.themes||Object.values(themes));
const MAP = {}; arr.forEach((t,i)=>MAP[t.id]=i+1);
const news=Object.values(MAP); if(new Set(news).size!==news.length||Math.min(...news)!==1||Math.max(...news)!==arr.length){console.error('MAP not bijection');process.exit(1);}
const log=[]; const note=s=>{log.push(s);console.log(s);};
note(`[${APPLY?'APPLY':'DRY-RUN'}] map: ${Object.entries(MAP).sort((a,b)=>a[0]-b[0]).map(([o,n])=>o+'→'+n).join(' ')}`);

// ---- DATA ----
function writeJson(p,obj){ if(APPLY) fs.writeFileSync(D(p), JSON.stringify(obj,null,2)); }
// themes.json: id=MAP[id] (順序維持)
{ const t=JSON.parse(fs.readFileSync(D('expo-app/data/themes.json'),'utf8'));
  const a=Array.isArray(t)?t:t.themes; a.forEach(x=>x.id=MAP[x.id]); writeJson('expo-app/data/themes.json',t); note('themes.json: id 改番 '+a.length); }
// examples.json: キー tid-level
{ const e=JSON.parse(fs.readFileSync(D('expo-app/data/examples.json'),'utf8')); const out={};
  for(const k of Object.keys(e)){const [tid,lv]=k.split('-'); out[`${MAP[+tid]}-${lv}`]=e[k];}
  // 安定のためソート(新tid,lv昇順)
  const sorted={}; Object.keys(out).sort((a,b)=>{const[at,al]=a.split('-').map(Number);const[bt,bl]=b.split('-').map(Number);return at-bt||al-bl;}).forEach(k=>sorted[k]=out[k]);
  writeJson('expo-app/data/examples.json',sorted); note('examples.json: '+Object.keys(sorted).length+' キー改番'); }
// 3部 sid 改番関数
const re3=/^(\d+)-(\d+)-(\d+)$/;
function mapSid3(sid){const m=re3.exec(sid); if(!m)return sid; return `${MAP[+m[1]]}-${m[2]}-${m[3]}`;}
let sidCount=0;
function remapContexts(obj){ for(const v of Object.values(obj)){ if(v&&Array.isArray(v.contexts)) for(const c of v.contexts){ if(re3.test(c.sentence_id)){c.sentence_id=mapSid3(c.sentence_id);sidCount++;} } } }
// conv-vocab-context.json
{ const c=JSON.parse(fs.readFileSync(D('expo-app/data/conv-vocab-context.json'),'utf8')); remapContexts(c); writeJson('expo-app/data/conv-vocab-context.json',c); note('conv-vocab-context.json: sid改番 '+sidCount); }
// overlays
for(const ov of ['en','ja']){ sidCount=0;
  const o=JSON.parse(fs.readFileSync(D(`expo-app/data/overlays/${ov}.json`),'utf8'));
  if(o.examplesL1){const ne={};for(const k of Object.keys(o.examplesL1)){const[tid,lv]=k.split('-');ne[`${MAP[+tid]}-${lv}`]=o.examplesL1[k];}
    const s={};Object.keys(ne).sort((a,b)=>{const[at,al]=a.split('-').map(Number);const[bt,bl]=b.split('-').map(Number);return at-bt||al-bl;}).forEach(k=>s[k]=ne[k]);o.examplesL1=s;}
  if(o.convVocab) remapContexts(o.convVocab);
  writeJson(`expo-app/data/overlays/${ov}.json`,o); note(`overlay ${ov}: examplesL1キー改番 + convVocab sid改番 ${sidCount}`); }

// ---- AUDIO (2段リネーム) ----
const AUDIO_DIRS=['expo-app/assets/audio/nepali','japanese','audio/ja/conv','audio/en/conv'].map(D);
function renameDir(dir){ if(!fs.existsSync(dir))return '(無)';
  const files=fs.readdirSync(dir).filter(f=>re3.test(f.replace(/\.mp3$/,'')));
  if(!APPLY) return files.length+' (dry)';
  // phase1: → .RENTMP (target名)
  for(const f of files){const m=re3.exec(f.replace(/\.mp3$/,''));const tgt=`${MAP[+m[1]]}-${m[2]}-${m[3]}.mp3`;fs.renameSync(path.join(dir,f),path.join(dir,tgt+'.RENTMP'));}
  // phase2: strip .RENTMP
  for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.RENTMP'))) fs.renameSync(path.join(dir,f),path.join(dir,f.replace(/\.RENTMP$/,'')));
  return files.length+' renamed';
}
for(const d of AUDIO_DIRS) note(`audio ${d.replace(REPO,'.')}: ${renameDir(d)}`);
note(APPLY?'APPLY 完了':'DRY-RUN 完了(書き込みなし)');
