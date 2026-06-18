// App B 母語パックの音声を新声で全2400再生成(声変更=全文)。Google TTS。
//  bn=bn-IN-Chirp3-HD-Aoede / vi=vi-VN-Chirp3-HD-Aoede / en=en-US-Neural2-F。plain text, rate0.95。
//  overlay {lang}.json の examplesL1(会話)+grammarL1(文法) → packs/audio/{lang}/{id}.mp3 上書き。再開可能・並列。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const env = {}; for (const l of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const KEY = env.VITE_GOOGLE_TTS_API_KEY;
const EP = 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + KEY;
const VOICES = {
  bn: { languageCode: 'bn-IN', name: 'bn-IN-Chirp3-HD-Aoede' },
  vi: { languageCode: 'vi-VN', name: 'vi-VN-Chirp3-HD-Aoede' },
  en: { languageCode: 'en-US', name: 'en-US-Neural2-F' },
  zh: { languageCode: 'cmn-CN', name: 'cmn-CN-Chirp3-HD-Aoede' },
  ko: { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Aoede' },  // 多言語に倣う(bn/vi/zh と同じ Chirp3-HD-Aoede)
};
const LANG = process.argv[2];
const VOICE = VOICES[LANG];
if (!VOICE) { console.error('usage: node _regen-appb-voices.mjs <bn|vi|en|zh>'); process.exit(1); }
const ov = JSON.parse(fs.readFileSync(path.join(ROOT, `expo-app/data/overlays/${LANG}.json`), 'utf8'));
const dir = path.join(REPO, 'packs/audio', LANG);

const items = [];
for (const k of Object.keys(ov.examplesL1)) ov.examplesL1[k].forEach((t, i) => items.push({ id: `${k}-${i + 1}`, text: t }));
for (const k of Object.keys(ov.grammarL1)) ov.grammarL1[k].forEach((t, i) => items.push({ id: `${k}-${i + 1}`, text: t }));

const donePath = path.join(ROOT, `scripts/_voice_done_${LANG}.json`);
const done = new Set(fs.existsSync(donePath) ? JSON.parse(fs.readFileSync(donePath, 'utf8')) : []);
const todo = items.filter(it => !done.has(it.id));
console.log(`${LANG}(${VOICE.name}): 全${items.length} / 残${todo.length}`);

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function syn(text) {
  for (let a = 1; a <= 6; a++) {
    try {
      const r = await fetch(EP, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: { text }, voice: VOICE, audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95 } }) });
      if (r.status === 429) { await sleep(3000 * a); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
      return Buffer.from((await r.json()).audioContent, 'base64');
    } catch (e) { if (a < 6) await sleep(2500 * a); else throw e; }
  }
  throw new Error('429 too many retries');
}
let ok = 0, fail = 0, n = 0, save = 0;
const CONC = 5;
async function worker(q) {
  while (q.length) {
    const it = q.pop();
    try { const b = await syn(it.text); fs.writeFileSync(path.join(dir, it.id + '.mp3'), b); done.add(it.id); ok++; }
    catch (e) { fail++; console.error('\nFAIL', it.id, e.message); }
    if (++n % 50 === 0) process.stdout.write(`\r${LANG}: ${n}/${todo.length} (ok${ok} fail${fail})`);
    if (++save % 100 === 0) fs.writeFileSync(donePath, JSON.stringify([...done]));
  }
}
const q = [...todo];
await Promise.all(Array.from({ length: CONC }, () => worker(q)));
fs.writeFileSync(donePath, JSON.stringify([...done]));
console.log(`\n${LANG}(${VOICE.name}) 完了: ${ok}成功 / ${fail}失敗 / 計${done.size}/${items.length}`);
