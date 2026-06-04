// App A: 日本前提の例文を「ネパール没入(人名/地名/文化=ネパール) + 外国語学習=英語」に修正。
// 対象33文の新 jp/ne/en を Opus で生成し、出力JSONに保存(レビュー用)。適用は別ステップ。
// 実行: node scripts/localize-appa.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV = path.join(ROOT, '.env');
const DATA = path.join(ROOT, 'expo-app/data');
const OUT = path.join(ROOT, 'scripts/_appa_localized.json');
const API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-8';

function key(){for(const l of fs.readFileSync(ENV,'utf8').split(/\r?\n/)){const m=l.match(/^\s*VITE_ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/);if(m)return m[1].replace(/^["']|["']$/g,'');}throw new Error('no key');}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const ex=JSON.parse(fs.readFileSync(path.join(DATA,'examples.json'),'utf8'));
const gr=JSON.parse(fs.readFileSync(path.join(DATA,'grammarExamples.json'),'utf8'));

// [src, key, idx(1-based), instruction]
const ITEMS = [
 ['conv','1-1',1,'人名を田中→ラム(Ram)に。'],
 ['conv','1-1',2,'国籍「日本人」→「ネパール人」に。'],
 ['conv','1-1',5,'居住地「東京」→「カトマンズ」に。'],
 ['conv','1-1',13,'出身地「大阪」→「ポカラ」に。'],
 ['conv','1-1',14,'学ぶ外国語「日本語」→「英語」に。'],
 ['conv','1-2',1,'人名「田中健二」→「ラム・シャルマ(Ram Sharma)」、出身「東京」→「カトマンズ」に。'],
 ['conv','1-2',4,'学ぶ外国語「日本語」→「英語」に。'],
 ['conv','1-2',17,'「大阪で生まれ関西で育った」→「ポカラで生まれチトワンで育った」に。'],
 ['conv','4-2',6,'「彼は去年12月に日本へ来た」→「彼は去年12月にカトマンズへ来た」に。'],
 ['conv','4-2',9,'学ぶ外国語「日本語」→「英語」に。'],
 ['conv','4-3',4,'丸ごと差替: 内容を「約束に少し遅れても寛容なのはネパール特有の文化だ(いわゆるネパールタイム)」という趣旨に。元の丁寧さ/長さを保つ。'],
 ['conv','5-3',9,'丸ごと差替: 「チヤ(ミルクティー)を飲むという行為に、ネパール人の温かいもてなしの心を見出すことができる」という趣旨に。'],
 ['conv','8-3',10,'丸ごと差替: 日本の気圧配置でなく「モンスーンが強まると丘陵地帯では豪雨が続き、ヒマラヤ高地では雪になる」というネパールの気候の趣旨に。上級の長さを保つ。'],
 ['conv','23-3',11,'丸ごと差替: 「カトマンズでは断水が頻繁に起こるため、貯水タンクを備えた住宅を選ぶことが快適な暮らしに直結している」という趣旨に。'],
 ['conv','25-3',18,'丸ごと差替: 花火の夏祭り(日本)でなく「無数の灯りが夜を彩るティハールは、ネパールの秋を彩る風物詩として広く親しまれている」という趣旨に。'],
 ['conv','29-3',1,'「神道と仏教は日本の文化」→「ヒンドゥー教と仏教はネパールの文化に深く根ざし、多くの人が両方の宗教行事に参加する」に。'],
 ['conv','29-3',16,'丸ごと差替: お盆(日本)でなく「ガイジャトラの祭りは、亡くなった先祖への敬意を表すと同時に、生と死についてのネパール人独自の死生観を体現している」という趣旨に。'],
 ['gram','5',11,'学ぶ外国語「日本語」→「英語」に。'],
 ['gram','16',7,'「子どもたちは日本語を読める」→「英語を読める」に。'],
 ['gram','16',14,'英語の重複回避:「英語と日本語を話せますか」→「英語とネパール語を話せますか」に。'],
 ['gram','16',19,'「日本語が話せれば友達が作れる」→「英語が話せれば」に。'],
 ['gram','18',14,'「日本語で話してもいいですか」→「英語で話してもいいですか」に。'],
 ['gram','21',1,'「富士山に登ったことがある」→「エベレスト(सगरमाथा)に登ったことがある」に。'],
 ['gram','21',3,'学ぶ外国語「日本語」→「英語」に。'],
 ['gram','21',4,'「東京に行ったことがある」→「ポカラに行ったことがある」に。'],
 ['gram','21',12,'「日本に住んだことがある」→「インド(भारत)に住んだことがある」に。'],
 ['gram','23',8,'「日本語は難しいけれど面白い」→「英語は難しいけれど面白い」に。'],
 ['gram','23',17,'「日本に来てから料理が上手になった」→「カトマンズに来てから料理が上手になった」に。'],
 ['gram','24',15,'学ぶ外国語「日本語」→「英語」に。'],
 ['gram','25',7,'「日本に来てから日本語を勉強し始めた」→「カトマンズに来てから英語を勉強し始めた」に。'],
 ['gram','26',5,'学ぶ外国語「日本語」→「英語」に。'],
 ['gram','26',14,'学ぶ外国語「日本語」→「英語」に。'],
 ['gram','30',18,'「彼は来月日本へ行く予定」→「彼は来月インド(भारत)へ行く予定」に。'],
];

function orig(src,k,idx){const s=src==='conv'?ex:gr;return s[k][idx-1];}

async function gen(apiKey,batch){
 const lines=batch.map((it,n)=>{const o=orig(it[0],it[1],it[2]);return `#${n+1} [${it[0]} ${it[1]}-${it[2]}]\n  現jp: ${o.jp}\n  現ne: ${o.ne}\n  指示: ${it[3]}`;}).join('\n\n');
 const prompt=`あなたはネパール語学習アプリ(聞いて話せるネパール語)の編集者。学習対象はネパール語。
各例文を指示に従い修正し、新しい日本語(jp)・ネパール語(ne, デーヴァナーガリー)・英語(en)を作る。
原則: 自然で文法的に正しいネパール語。jp/ne/enは同じ意味で一致。レベル(初級/中級/上級)の長さ・丁寧さは元と同程度に保つ。固有名詞はネパール式。

${lines}

出力: JSONオブジェクトのみ。キーは "1".."${batch.length}"、各値は {"jp":"...","ne":"...","en":"..."}。説明やMarkdown不要。`;
 const res=await fetch(API,{method:'POST',headers:{'x-api-key':apiKey,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:MODEL,max_tokens:16000,messages:[{role:'user',content:prompt}]})});
 if(!res.ok)throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0,200)}`);
 const data=await res.json();
 const cost=(data.usage?.input_tokens??0)*15/1e6+(data.usage?.output_tokens??0)*75/1e6;
 const text=(data.content?.map(c=>c.text||'').join('')||'').replace(/```json\s*|```\s*$/g,'').trim();
 const obj=JSON.parse(text);
 return {obj,cost};
}
async function withRetry(fn){let last;for(let i=1;i<=4;i++){try{return await fn();}catch(e){last=e;console.log(`  fail(${i}/4): ${e.message}`);if(i<4)await sleep(8000*i);}}throw last;}

const apiKey=key();
const result={};let cost=0;
const B=12;
for(let i=0;i<ITEMS.length;i+=B){
 const batch=ITEMS.slice(i,i+B);
 console.log(`batch ${i+1}-${i+batch.length}...`);
 const {obj,cost:c}=await withRetry(()=>gen(apiKey,batch));
 batch.forEach((it,n)=>{const o=obj[String(n+1)];const id=`${it[0]} ${it[1]}-${it[2]}`;if(!o||!o.jp||!o.ne||!o.en)throw new Error(`missing ${id}`);result[id]={src:it[0],key:it[1],idx:it[2],...o};});
 cost+=c;
}
fs.writeFileSync(OUT,JSON.stringify(result,null,2));
console.log(`\n生成 ${Object.keys(result).length}文 / コスト ~$${cost.toFixed(3)} (~${Math.ceil(cost*150)}円) → ${OUT}`);
