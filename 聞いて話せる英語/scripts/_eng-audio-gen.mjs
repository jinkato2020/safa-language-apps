// 英語アプリ音声生成。en(学習対象)=en-US-Neural2-F / ja(母語)=ja-JP-Neural2-B。
//  保存: 聞いて話せる英語/audio/<lang>/{conv,gram}/{id}.mp3。会話id=T-L-i / 文法id=T-i。
//  本文: examples.json(.en/.ja) / grammarExamples.json(.en/.ja)。再開可(既存skip)・並列。Google key は App B .env。
//  usage: node scripts/_eng-audio-gen.mjs <en|ja|all>
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const env = {}; for (const l of fs.readFileSync(path.join(REPO, '聞いて話せる日本語/.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const KEY = env.VITE_GOOGLE_TTS_API_KEY;
const EP = 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + KEY;
const DATA = path.join(ROOT, 'expo-app/data');
const ex = JSON.parse(fs.readFileSync(path.join(DATA, 'examples.json'), 'utf8'));
const gr = JSON.parse(fs.readFileSync(path.join(DATA, 'grammarExamples.json'), 'utf8'));
const VOICE = { en: { languageCode: 'en-US', name: 'en-US-Neural2-F' }, ja: { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B' } };
const AUDIO = path.join(ROOT, 'audio');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function syn(text, voice) {
  for (let a = 1; a <= 6; a++) {
    try {
      const r = await fetch(EP, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: { text }, voice, audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95 } }) });
      if (r.status === 429) { await sleep(3000 * a); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 100));
      return Buffer.from((await r.json()).audioContent, 'base64');
    } catch (e) { if (a < 6) await sleep(2500 * a); else throw e; }
  }
}
function items(lang) {
  const field = lang;            // 'en' or 'ja'
  const out = [];
  for (const k of Object.keys(ex)) ex[k].forEach((e, i) => out.push({ mode: 'conv', id: `${k}-${i + 1}`, text: e[field] }));
  for (const k of Object.keys(gr)) gr[k].forEach((e, i) => out.push({ mode: 'gram', id: `${k}-${i + 1}`, text: e[field] }));
  return out;
}
async function run(lang) {
  for (const m of ['conv', 'gram']) fs.mkdirSync(path.join(AUDIO, lang, m), { recursive: true });
  const its = items(lang).filter(it => it.text && !fs.existsSync(path.join(AUDIO, lang, it.mode, it.id + '.mp3')));
  console.log(`${lang}(${VOICE[lang].name}): 残${its.length}`);
  let ok = 0, fail = 0, n = 0;
  const q = [...its];
  async function worker() {
    while (q.length) {
      const it = q.pop();
      try { const b = await syn(it.text, VOICE[lang]); fs.writeFileSync(path.join(AUDIO, lang, it.mode, it.id + '.mp3'), b); ok++; }
      catch (e) { fail++; console.error('\nFAIL', lang, it.id, e.message); }
      if (++n % 100 === 0) process.stdout.write(`\r${lang}: ${n}/${its.length} (ok${ok} fail${fail})`);
    }
  }
  await Promise.all(Array.from({ length: 6 }, () => worker()));
  console.log(`\n${lang} 完了: ${ok}成功 / ${fail}失敗`);
}
const target = process.argv[2] || 'all';
for (const l of (target === 'all' ? ['en', 'ja'] : [target])) await run(l);
console.log('英語アプリ音声 完了');
