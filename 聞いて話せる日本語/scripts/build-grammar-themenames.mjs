// 新文法テーマ名(ja, i18n)を ne/bn に翻訳し i18n を更新。
// 日本語の文法形(「」内や〜)は保持し、説明語(名詞文/助詞/願望等)のみ訳す。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV = path.join(ROOT, '.env');
const I18N = path.join(ROOT, 'expo-app/src/i18n');
function key(){for(const l of fs.readFileSync(ENV,'utf8').split(/\r?\n/)){const m=l.match(/^\s*VITE_ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/);if(m)return m[1].replace(/^["']|["']$/g,'');}throw new Error('no key');}
const apiKey=key();
const ja=JSON.parse(fs.readFileSync(path.join(I18N,'ja.json'),'utf8'));
const names=ja.grammarThemes; // {1..30: name}
const keys=Object.keys(names).sort((a,b)=>+a-+b);
const list=keys.map(k=>`${k}. ${names[k]}`).join('\n');

async function translate(langName){
 const prompt=`次の「日本語文法レッスンのテーマ名」を${langName}に翻訳してください。
重要: 日本語の文法形・例(「」の中や 〜 記号で示された部分、助詞「は」「が」など)はそのまま日本語で残し、説明語(名詞文/助詞/形容詞/願望/許可/可能/義務/比較/経験/推量/条件/目的/受身/使役 など)だけを${langName}に訳すこと。
学習者(${langName}話者)が「これは日本語の何の文法か」が分かる自然な見出しに。

${list}

【出力】番号キーのJSONのみ。キー"1".."30"を厳密に含む。例: {"1":"...","2":"..."}`;
 const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':apiKey,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:6000,messages:[{role:'user',content:prompt}]})});
 if(!res.ok)throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0,150)}`);
 const d=await res.json();
 const text=(d.content?.map(c=>c.text||'').join('')||'').replace(/```json\s*|```\s*$/g,'').trim();
 const obj=JSON.parse(text);
 const out={}; for(const k of keys){ if(!obj[k])throw new Error(`missing ${k}`); out[k]=obj[k]; }
 return out;
}
for(const [langCode,langName] of [['ne','ネパール語'],['bn','ベンガル語']]){
 const tr=await translate(langName);
 const f=path.join(I18N,`${langCode}.json`);
 const j=JSON.parse(fs.readFileSync(f,'utf8'));
 j.grammarThemes=tr;
 fs.writeFileSync(f,JSON.stringify(j,null,2));
 console.log(`${langCode}.json grammarThemes 更新 (30件)`);
 console.log(`  1: ${tr['1']}`); console.log(`  23: ${tr['23']}`);
}
console.log('完了');
