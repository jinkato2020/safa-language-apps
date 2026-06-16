import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import crypto from 'node:crypto';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BK='C:/Users/jwpsa/Documents/desktop/claude/_backup_themeid_2026-06-16/appA';
const D=p=>path.join(ROOT,p);
let fail=0; const bad=s=>{console.log('  ❌ '+s);fail++;}; const ok=s=>console.log('  ✓ '+s);
// rebuild MAP from current themes (now id=position)
const themes=JSON.parse(fs.readFileSync(D('expo-app/data/themes.json'),'utf8'));const arr=Array.isArray(themes)?themes:themes.themes;
// 1 themes ids
const ids=arr.map(t=>t.id);
(JSON.stringify(ids)===JSON.stringify(arr.map((_,i)=>i+1)))?ok('themes.json id=表示順 1..'+arr.length):bad('themes id != 表示順 '+ids.join(','));
// backup map: old themes order -> oldid; MAP old->new
const bkThemes=JSON.parse(fs.readFileSync(BK+'/themes.json','utf8'));const bkArr=Array.isArray(bkThemes)?bkThemes:bkThemes.themes;
const MAP={};bkArr.forEach((t,i)=>MAP[t.id]=i+1); const INV={};Object.entries(MAP).forEach(([o,n])=>INV[n]=+o);
// 2 examples keys + content vs backup
const ex=JSON.parse(fs.readFileSync(D('expo-app/data/examples.json'),'utf8'));
const bkEx=JSON.parse(fs.readFileSync(BK+'/examples.json','utf8'));
const exKeys=Object.keys(ex);
exKeys.length===90?ok('examples 90キー'):bad('examples キー数 '+exKeys.length);
let contentBad=0,cntBad=0;
for(const k of exKeys){const[nt,lv]=k.split('-').map(Number);
  if(nt<1||nt>30||lv<1||lv>3)bad('不正キー '+k);
  if(ex[k].length!==20)cntBad++;
  const oldKey=`${INV[nt]}-${lv}`;
  if(JSON.stringify(ex[k])!==JSON.stringify(bkEx[oldKey]))contentBad++;
}
cntBad?bad(cntBad+'キーが20文でない'):ok('全キー20文');
contentBad?bad(contentBad+'キーで内容がbackup(old)と不一致=取り違え!'):ok('全90キー 内容=backupの対応old keyと完全一致(取り違えゼロ)');
// 3 audio existence for every example sentence, all 4 dirs + content match (sample full theme)
const DIRS=['expo-app/assets/audio/nepali','japanese','audio/ja/conv','audio/en/conv'].map(D);
let miss=0,leftover=0;
for(const d of DIRS){ const lo=fs.readdirSync(d).filter(f=>f.endsWith('.RENTMP'));leftover+=lo.length;
  for(const k of exKeys){const[t,l]=k.split('-');for(let i=1;i<=ex[k].length;i++){ if(!fs.existsSync(path.join(d,`${t}-${l}-${i}.mp3`)))miss++; }}}
miss?bad(miss+' 音声ファイル欠落'):ok('全例題の音声が4ディレクトリ全てに存在 (90*20*4=7200×?)');
leftover?bad(leftover+' .RENTMP 残存'):ok('.RENTMP 残ゴミなし');
// audio content moved correctly: check moved theme 5→6 (nepali) byte-identical vs backup old 5
const md5=f=>crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
let audioBad=0,checked=0;
for(const nt of [6,28,2,30,12]){ const ot=INV[nt]; for(const lv of [1,2,3]) for(const i of [1,10,20]){
  const cur=D(`expo-app/assets/audio/nepali/${nt}-${lv}-${i}.mp3`); const old=`${BK}/nepali/${ot}-${lv}-${i}.mp3`;
  if(fs.existsSync(cur)&&fs.existsSync(old)){checked++; if(md5(cur)!==md5(old))audioBad++;}
}}
audioBad?bad(audioBad+'/'+checked+' 音声が移動先で内容不一致'):ok(`音声内容 ${checked}件サンプル: 新id音声=backupの対応old id音声と完全一致(取り違えゼロ)`);
// 4 dangling sentence_id in conv-vocab-context + overlays
function checkDangling(label,obj){let dang=0;const re3=/^(\d+)-(\d+)-(\d+)$/;
  for(const v of Object.values(obj)){if(!v||!Array.isArray(v.contexts))continue;for(const c of v.contexts){const m=re3.exec(c.sentence_id);if(!m)continue;const t=+m[1],l=+m[2],i=+m[3];const arr=ex[`${t}-${l}`];if(!arr||i<1||i>arr.length)dang++;}}
  dang?bad(`${label}: dangling sid ${dang}`):ok(`${label}: 全conv sid が実例題を指す(dangなし)`);}
checkDangling('conv-vocab-context',JSON.parse(fs.readFileSync(D('expo-app/data/conv-vocab-context.json'),'utf8')));
for(const ov of ['en','ja']){const o=JSON.parse(fs.readFileSync(D(`expo-app/data/overlays/${ov}.json`),'utf8'));
  checkDangling(`overlay ${ov} convVocab`,o.convVocab||{});
  const same=JSON.stringify(Object.keys(o.examplesL1).sort())===JSON.stringify(exKeys.slice().sort());
  same?ok(`overlay ${ov}: examplesL1キー集合 = examples.json と一致`):bad(`overlay ${ov}: examplesL1キーがexamplesと不一致`);
}
// 5 grammar 不変確認
const ga=JSON.parse(fs.readFileSync(D('expo-app/data/grammarThemes.json'),'utf8'));const gaa=Array.isArray(ga)?ga:ga.themes;
JSON.stringify(gaa.map(t=>t.id))===JSON.stringify(gaa.map((_,i)=>i+1))?ok('grammarThemes 不変(id=表示順)'):bad('grammar id 変化');
console.log(fail?`\n❌ 検証失敗 ${fail}件`:'\n✅ 全検証パス');
process.exit(fail?1:0);
