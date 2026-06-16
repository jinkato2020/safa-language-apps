// App B 会話themeId を表示順に改番(自己紹介/id17は不変, 文法不変・別名前空間)。
// 対象: themes.json(id) / examples.json(キー) / conv-vocab-context.json(sid) /
//       overlays/{bn,en,vi,ne,zh}.json(examplesL1キー+convVocab sid) / i18n/{bn,en,ja,ne,vi,zh}.json(themes.*) /
//       assets/audio/japanese(会話3部名, 同梱ターゲット音声)。 grammar/japanese-grammar/単語は不変。
// usage: node scripts/_renumber-appb-conv.mjs [--apply]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'expo-app');
const APPLY = process.argv.includes('--apply');
const D = p => path.join(ROOT, p);
const themes = JSON.parse(fs.readFileSync(D('data/themes.json'),'utf8'));
const arr = Array.isArray(themes)?themes:(themes.themes||Object.values(themes));
const MAP = {}; arr.forEach((t,i)=>MAP[t.id]=i+1);
const news=Object.values(MAP); if(new Set(news).size!==news.length||Math.min(...news)!==1||Math.max(...news)!==arr.length){console.error('MAP not bijection');process.exit(1);}
const note=s=>console.log(s);
note(`[${APPLY?'APPLY':'DRY-RUN'}] App B map: ${Object.entries(MAP).sort((a,b)=>a[0]-b[0]).map(([o,n])=>o+'→'+n).join(' ')}`);
const OVERLAYS=['bn','en','vi','ne','zh'], LOCALES=['bn','en','ja','ne','vi','zh'];
function writeJson(p,obj){ if(APPLY) fs.writeFileSync(D(p), JSON.stringify(obj,null,2)); }
// themes.json
{ const t=JSON.parse(fs.readFileSync(D('data/themes.json'),'utf8')); const a=Array.isArray(t)?t:t.themes; a.forEach(x=>x.id=MAP[x.id]); writeJson('data/themes.json',t); note('themes.json: id 改番 '+a.length); }
// examples.json keys
{ const e=JSON.parse(fs.readFileSync(D('data/examples.json'),'utf8')); const out={};
  for(const k of Object.keys(e)){const[tid,lv]=k.split('-'); out[`${MAP[+tid]}-${lv}`]=e[k];}
  const s={};Object.keys(out).sort((a,b)=>{const[at,al]=a.split('-').map(Number);const[bt,bl]=b.split('-').map(Number);return at-bt||al-bl;}).forEach(k=>s[k]=out[k]);
  writeJson('data/examples.json',s); note('examples.json: '+Object.keys(s).length+' キー改番'); }
const re3=/^(\d+)-(\d+)-(\d+)$/;
function remapContexts(obj){let n=0;for(const v of Object.values(obj)){if(v&&Array.isArray(v.contexts))for(const c of v.contexts){if(re3.test(c.sentence_id)){const m=re3.exec(c.sentence_id);c.sentence_id=`${MAP[+m[1]]}-${m[2]}-${m[3]}`;n++;}}}return n;}
// conv-vocab-context
{ const c=JSON.parse(fs.readFileSync(D('data/conv-vocab-context.json'),'utf8')); const n=remapContexts(c); writeJson('data/conv-vocab-context.json',c); note('conv-vocab-context: sid改番 '+n); }
// overlays
for(const ov of OVERLAYS){ const p=`data/overlays/${ov}.json`; if(!fs.existsSync(D(p))){note('overlay '+ov+' 無 skip');continue;}
  const o=JSON.parse(fs.readFileSync(D(p),'utf8'));
  if(o.examplesL1){const ne={};for(const k of Object.keys(o.examplesL1)){const[tid,lv]=k.split('-');ne[`${MAP[+tid]}-${lv}`]=o.examplesL1[k];}
    const s={};Object.keys(ne).sort((a,b)=>{const[at,al]=a.split('-').map(Number);const[bt,bl]=b.split('-').map(Number);return at-bt||al-bl;}).forEach(k=>s[k]=ne[k]);o.examplesL1=s;}
  const n=o.convVocab?remapContexts(o.convVocab):0;
  writeJson(p,o); note(`overlay ${ov}: examplesL1キー改番 + convVocab sid改番 ${n}`); }
// i18n themes.* (会話のみ)
for(const loc of LOCALES){ const p=`src/i18n/${loc}.json`; if(!fs.existsSync(D(p))){note('i18n '+loc+' 無 skip');continue;}
  const j=JSON.parse(fs.readFileSync(D(p),'utf8'));
  if(j.themes){const nt={};for(const k of Object.keys(j.themes)){const nk=MAP[+k];if(nk)nt[nk]=j.themes[k];}
    const s={};Object.keys(nt).map(Number).sort((a,b)=>a-b).forEach(k=>s[k]=nt[k]);j.themes=s;writeJson(p,j);note(`i18n ${loc}: themes キー改番`);} }
// audio (同梱 japanese, 2段リネーム)
const dir=D('assets/audio/japanese');
if(fs.existsSync(dir)){
  const files=fs.readdirSync(dir).filter(f=>re3.test(f.replace(/\.mp3$/,'')));
  if(APPLY){
    for(const f of files){const m=re3.exec(f.replace(/\.mp3$/,''));fs.renameSync(path.join(dir,f),path.join(dir,`${MAP[+m[1]]}-${m[2]}-${m[3]}.mp3.RENTMP`));}
    for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.RENTMP')))fs.renameSync(path.join(dir,f),path.join(dir,f.replace(/\.RENTMP$/,'')));
  }
  note(`audio assets/audio/japanese: ${files.length} ${APPLY?'renamed':'(dry)'}`);
}
note(APPLY?'APPLY 完了':'DRY-RUN 完了');
