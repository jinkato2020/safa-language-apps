// 日本語学習用の文法例文を生成 (30テーマ × 20文, jp+ne)。
// 在日外国人向けに最適化。Opusで品質重視。出力JSONに保存。
// 実行: node scripts/build-jp-grammar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV = path.join(ROOT, '.env');
const OUT = path.join(ROOT, 'scripts/_jp_grammar.json');
const API = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.GRAMMAR_MODEL || 'claude-opus-4-8';

function key(){for(const l of fs.readFileSync(ENV,'utf8').split(/\r?\n/)){const m=l.match(/^\s*VITE_ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/);if(m)return m[1].replace(/^["']|["']$/g,'');}throw new Error('no key');}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// [番号, テーマ名, 文法フォーカス]
const THEMES = [
 [1,'名詞文「〜は〜です」','AはBです/じゃありません/でした。自己紹介や物・職業の説明'],
 [2,'助詞「は」と「が」','主題の「は」と主語の「が」の使い分け。〜が好き/上手/ある、〜はどこ'],
 [3,'格助詞「を・に・で・へ・と」','〜を食べる/〜に行く・住む/〜で働く・買う/〜へ帰る/〜と話す'],
 [4,'指示詞「これ/それ/あれ」','これ/それ/あれ、この/その〜、ここ/そこ/あそこ。買い物・道案内'],
 [5,'い形容詞','〜い/〜くない/〜かった/〜くなかった/〜くて。感想・描写'],
 [6,'な形容詞','〜です/〜じゃない/〜でした/〜で/〜な+名詞。便利・大切など'],
 [7,'動詞「ます形」(現在・未来)','〜ます/明日〜ます。日常の動作・予定'],
 [8,'動詞「ます形」(過去・否定)','〜ました/〜ません/〜ませんでした'],
 [9,'「て形」と「〜てください」','〜てください(依頼)、〜て(連結)。手続き・お願い'],
 [10,'「〜ている」(進行・状態・習慣)','今〜ています/結婚しています/毎日〜ています'],
 [11,'存在「ある・いる」と位置','〜があります/います、〜の上/中/となりに。場所説明'],
 [12,'数・助数詞・時間','〜個/〜人/〜枚/〜時/〜円。買い物・予約・受付'],
 [13,'「〜たい」(願望)','〜たいです/たくないです。希望を伝える'],
 [14,'「〜てもいい/〜てはいけない」(許可・禁止)','〜てもいいですか/〜てはいけません。職場・公共の場'],
 [15,'動詞「普通形」(辞書形・ない形・た形)','タメ口・友人との会話の基礎。〜する/〜しない/〜した'],
 [16,'「〜ことができる」可能','〜ことができる/可能形(読める・話せる)'],
 [17,'「〜なければならない/〜なくてもいい」義務','手続き・仕事で必要なこと/不要なこと'],
 [18,'「〜から/〜ので」理由','理由を述べる。丁寧な「ので」も'],
 [19,'比較「より・のほうが・いちばん」','AよりB/〜のほうが/〜がいちばん'],
 [20,'「〜た方がいい」助言','〜た方がいい/〜ない方がいい。アドバイス'],
 [21,'「〜たことがある」経験','〜たことがあります/ありません'],
 [22,'「〜たり〜たり/〜ながら」','〜たり〜たりする/〜ながら(同時動作)'],
 [23,'「〜と思う/〜と言っていた」意見・伝聞','〜と思います/〜と言っていました'],
 [24,'「〜でしょう/〜かもしれない/〜はず」推量','確信度の違い。天気・予測'],
 [25,'条件「と・ば・たら・なら」','4つの条件表現の違い'],
 [26,'「〜ために/〜ように」目的','目的を表す。〜ために/〜ように'],
 [27,'授受表現「あげる・くれる・もらう」','あげる/くれる/もらう、〜てあげる/〜てくれる/〜てもらう'],
 [28,'受身(受動態)','〜られる。「財布を盗まれた」など'],
 [29,'使役・使役受身','〜させる/〜させられる'],
 [30,'敬語(尊敬語・謙譲語・丁寧語)','いらっしゃる/召し上がる/申す/いたす、お〜になる/お〜する'],
];

async function genTheme(apiKey,name,focus){
 const prompt=`あなたは日本語教師。在日外国人(ネパール語話者)向けの日本語学習アプリの文法例文を作る。
テーマ「${name}」(文法: ${focus})の例文を20文。

【ルール】
- 各文がこの文法点を明確に示すこと。20文すべて内容が異なる。
- 在日外国人の実生活(役所/病院/買い物/仕事/学校/近所/交通など)で自然に使える実用的な文。
- やさしい→やや難しい の順。日本語として自然で正しい。
- 各文に自然な口語のネパール語訳(デーヴァナーガリー)を付ける。
【出力】JSONのみ: {"items":[{"jp":"...","ne":"..."} ×20]}`;
 const res=await fetch(API,{method:'POST',headers:{'x-api-key':apiKey,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:MODEL,max_tokens:16000,messages:[{role:'user',content:prompt}]})});
 if(!res.ok)throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0,200)}`);
 const data=await res.json();
 const cost=(data.usage?.input_tokens??0)*15/1e6+(data.usage?.output_tokens??0)*75/1e6;
 const text=(data.content?.map(c=>c.text||'').join('')||'').replace(/```json\s*|```\s*$/g,'').trim();
 const obj=JSON.parse(text);
 if(!Array.isArray(obj.items)||obj.items.length!==20)throw new Error(`items != 20 (${obj.items?.length})`);
 return {items:obj.items,cost};
}
async function withRetry(fn){let last;for(let i=1;i<=4;i++){try{return await fn();}catch(e){last=e;console.log(`  fail(${i}/4): ${e.message}`);if(i<4)await sleep(8000*i);}}throw last;}

const apiKey=key();
const result = fs.existsSync(OUT)?JSON.parse(fs.readFileSync(OUT,'utf8')):{};
let cost=0;
for(const [num,name,focus] of THEMES){
 if(result[num]&&result[num].items?.length===20){console.log(`skip ${num} ${name}`);continue;}
 console.log(`[${num}] ${name} ...`);
 const {items,cost:c}=await withRetry(()=>genTheme(apiKey,name,focus));
 result[num]={num,name,items};
 fs.writeFileSync(OUT,JSON.stringify(result,null,2));
 cost+=c; console.log(`  done ~$${c.toFixed(3)}`);
}
console.log(`\n生成 ${Object.keys(result).length}テーマ / コスト ~$${cost.toFixed(3)} (~${Math.ceil(cost*150)}円) → ${OUT}`);
