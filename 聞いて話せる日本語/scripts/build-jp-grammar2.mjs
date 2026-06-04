// 各30テーマに 例題21-40 (日本語のみ) を追加生成。既存20文と重複させない。
// _jp_grammar.json の各テーマに items2(20文の日本語配列) を追記。
// 実行: node scripts/build-jp-grammar2.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV = path.join(ROOT, '.env');
const SRC = path.join(ROOT, 'scripts/_jp_grammar.json');
const API = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.GRAMMAR_MODEL || 'claude-opus-4-8';

function key(){for(const l of fs.readFileSync(ENV,'utf8').split(/\r?\n/)){const m=l.match(/^\s*VITE_ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/);if(m)return m[1].replace(/^["']|["']$/g,'');}throw new Error('no key');}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const FOCUS = {
 1:'AはBです/じゃありません/でした。自己紹介や物・職業の説明',
 2:'主題の「は」と主語の「が」。〜が好き/上手/ある、〜はどこ',
 3:'〜を/〜に行く・住む/〜で働く・買う/〜へ帰る/〜と話す',
 4:'これ/それ/あれ、この/その〜、ここ/そこ/あそこ。買い物・道案内',
 5:'い形容詞 〜い/〜くない/〜かった/〜くて',
 6:'な形容詞 〜です/〜じゃない/〜で/〜な+名詞',
 7:'動詞ます形(現在・未来) 〜ます/明日〜ます',
 8:'動詞ます形(過去・否定) 〜ました/〜ません/〜ませんでした',
 9:'て形と〜てください(依頼)、〜て(連結)',
 10:'〜ている(進行・状態・習慣)',
 11:'ある・いる、〜の上/中/となりに(位置)',
 12:'数・助数詞・時間 〜個/〜人/〜枚/〜時/〜円',
 13:'〜たい/たくない(願望)',
 14:'〜てもいいですか/〜てはいけません(許可・禁止)',
 15:'普通形(辞書形・ない形・た形)。タメ口',
 16:'〜ことができる/可能形(読める・話せる)',
 17:'〜なければならない/〜なくてもいい(義務)',
 18:'〜から/〜ので(理由)',
 19:'比較 より/のほうが/いちばん',
 20:'〜た方がいい/〜ない方がいい(助言)',
 21:'〜たことがある/ない(経験)',
 22:'〜たり〜たりする/〜ながら(同時動作)',
 23:'〜と思います/〜と言っていました(意見・伝聞)',
 24:'〜でしょう/〜かもしれない/〜はず(推量)',
 25:'条件 と/ば/たら/なら',
 26:'〜ために/〜ように(目的)',
 27:'あげる/くれる/もらう、〜てあげる/〜てくれる/〜てもらう',
 28:'受身 〜られる',
 29:'使役/使役受身 〜させる/〜させられる',
 30:'敬語 いらっしゃる/召し上がる/申す/いたす、お〜になる/お〜する',
};

async function gen(apiKey,name,focus,existing){
 const ex=existing.map((s,i)=>`${i+1}. ${s}`).join('\n');
 const prompt=`日本語教師として、在日外国人(ネパール語話者)向けの文法例文を追加で作る。
テーマ「${name}」(文法: ${focus})の新しい例文を20文。

【既存の20文(これらと重複しないこと)】
${ex}

【ルール】
- 上記と内容が重複しない、新しい20文。この文法点を明確に示す。
- 在日外国人の実生活(役所/病院/買い物/仕事/学校/近所/交通/子育てなど)で自然な実用文。
- やさしい→やや難しい。日本語として自然で正しい。
- 翻訳は不要。日本語のみ。
【出力】JSONのみ: {"items":["日本語文", ... ×20]}`;
 const res=await fetch(API,{method:'POST',headers:{'x-api-key':apiKey,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:MODEL,max_tokens:12000,messages:[{role:'user',content:prompt}]})});
 if(!res.ok)throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0,200)}`);
 const data=await res.json();
 const cost=(data.usage?.input_tokens??0)*15/1e6+(data.usage?.output_tokens??0)*75/1e6;
 const text=(data.content?.map(c=>c.text||'').join('')||'').replace(/```json\s*|```\s*$/g,'').trim();
 const obj=JSON.parse(text);
 if(!Array.isArray(obj.items)||obj.items.length!==20)throw new Error(`items != 20 (${obj.items?.length})`);
 return {items:obj.items.map(x=>typeof x==='string'?x:(x.jp||'')),cost};
}
async function withRetry(fn){let last;for(let i=1;i<=4;i++){try{return await fn();}catch(e){last=e;console.log(`  fail(${i}/4): ${e.message}`);if(i<4)await sleep(8000*i);}}throw last;}

const apiKey=key();
const data=JSON.parse(fs.readFileSync(SRC,'utf8'));
let cost=0;
for(const num of Object.keys(data).sort((a,b)=>+a-+b)){
 const t=data[num];
 if(Array.isArray(t.items2)&&t.items2.length===20){console.log(`skip ${num}`);continue;}
 const existing=t.items.map(it=>it.jp);
 console.log(`[${num}] ${t.name} +20 ...`);
 const {items,cost:c}=await withRetry(()=>gen(apiKey,t.name,FOCUS[num]||'',existing));
 t.items2=items;
 fs.writeFileSync(SRC,JSON.stringify(data,null,2));
 cost+=c; console.log(`  done ~$${c.toFixed(3)}`);
}
console.log(`\n追加生成 完了 / コスト ~$${cost.toFixed(3)} (~${Math.ceil(cost*150)}円)`);
