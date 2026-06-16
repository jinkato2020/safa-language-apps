// App C(英語) 会話themeId を表示順に改番。文法/単語不変。overlay無。
// 対象: expo-app/data/themes.json(id) / examples.json(キー) / dict.json(convVocab contexts sid) /
//       expo-app/src/i18n/{bn,en,ja,ne,vi}.json(themes.*) / audio/{en,ja}/conv(会話3部名)。
// usage: node scripts/_renumber-appc-conv.mjs [--apply]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // 聞いて話せる英語
const APPLY = process.argv.includes('--apply');
const D = p => path.join(ROOT, p);
const themes = JSON.parse(fs.readFileSync(D('expo-app/data/themes.json'),'utf8'));
const arr = Array.isArray(themes)?themes:(themes.themes||Object.values(themes));
const MAP = {}; arr.forEach((t,i)=>MAP[t.id]=i+1);
const news=Object.values(MAP); if(new Set(news).size!==news.length||Math.min(...news)!==1||Math.max(...news)!==arr.length){console.error('MAP not bijection');process.exit(1);}
const note=s=>console.log(s);
note(`[${APPLY?'APPLY':'DRY'}] App C map: ${Object.entries(MAP).sort((a,b)=>a[0]-b[0]).map(([o,n])=>o+'→'+n).join(' ')}`);
const LOCALES=['bn','en','ja','ne','vi'];
function writeJson(p,o){ if(APPLY) fs.writeFileSync(D(p),JSON.stringify(o,null,2)); }
const re3=/^(\d+)-(\d+)-(\d+)$/;
// themes
{ const t=JSON.parse(fs.readFileSync(D('expo-app/data/themes.json'),'utf8'));const a=Array.isArray(t)?t:t.themes;a.forEach(x=>x.id=MAP[x.id]);writeJson('expo-app/data/themes.json',t);note('themes.json id改番 '+a.length); }
// examples
{ const e=JSON.parse(fs.readFileSync(D('expo-app/data/examples.json'),'utf8'));const out={};
  for(const k of Object.keys(e)){const[tid,lv]=k.split('-');out[`${MAP[+tid]}-${lv}`]=e[k];}
  const s={};Object.keys(out).sort((a,b)=>{const[at,al]=a.split('-').map(Number);const[bt,bl]=b.split('-').map(Number);return at-bt||al-bl;}).forEach(k=>s[k]=out[k]);
  writeJson('expo-app/data/examples.json',s);note('examples '+Object.keys(s).length+'キー改番'); }
// dict.json convVocab contexts sid (grammarVocab不変)
{ const d=JSON.parse(fs.readFileSync(D('expo-app/data/dict.json'),'utf8'));let n=0;
  for(const v of Object.values(d.convVocab||{})){if(Array.isArray(v.contexts))for(const c of v.contexts){const m=re3.exec(c.sentence_id);if(m){c.sentence_id=`${MAP[+m[1]]}-${m[2]}-${m[3]}`;n++;}}}
  writeJson('expo-app/data/dict.json',d);note('dict.json convVocab sid改番 '+n); }
// i18n
for(const loc of LOCALES){const p=`expo-app/src/i18n/${loc}.json`;if(!fs.existsSync(D(p))){note('i18n '+loc+' 無');continue;}
  const j=JSON.parse(fs.readFileSync(D(p),'utf8'));
  if(j.themes){const nt={};for(const k of Object.keys(j.themes)){const nk=MAP[+k];if(nk)nt[nk]=j.themes[k];}
    const s={};Object.keys(nt).map(Number).sort((a,b)=>a-b).forEach(k=>s[k]=nt[k]);j.themes=s;writeJson(p,j);note('i18n '+loc+' themes改番');} }
// audio en/ja conv (2段リネーム)
for(const lang of ['en','ja']){const dir=D(`audio/${lang}/conv`);if(!fs.existsSync(dir)){note('audio '+lang+' 無');continue;}
  const files=fs.readdirSync(dir).filter(f=>re3.test(f.replace(/\.mp3$/,'')));
  if(APPLY){for(const f of files){const m=re3.exec(f.replace(/\.mp3$/,''));fs.renameSync(path.join(dir,f),path.join(dir,`${MAP[+m[1]]}-${m[2]}-${m[3]}.mp3.RENTMP`));}
    for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.RENTMP')))fs.renameSync(path.join(dir,f),path.join(dir,f.replace(/\.RENTMP$/,'')));}
  note(`audio ${lang}/conv ${files.length} ${APPLY?'renamed':'(dry)'}`); }
note(APPLY?'APPLY完了':'DRY完了');
