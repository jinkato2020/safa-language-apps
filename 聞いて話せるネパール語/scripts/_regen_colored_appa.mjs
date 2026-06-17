// App A 着色ID(音声/テキスト不一致)を「他と同じ声」で再生成 → audio/<lang>/{conv,gram}/<id>.mp3。
// ne=Azure HemkalaNeural+prosody-5% / ja=Neural2-B@0.95 / en=Neural2-F@0.95 (+_newthemes_ssml.json 読み対策)。
// 本文: conv=examples.json(.ne/.jp)/overlays-en examplesL1, gram=grammarExamples.json(.ne/.jp)/overlays-en grammarL1。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const rd = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const env = {}; for (const l of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const envB = {}; try { for (const l of fs.readFileSync(path.join(REPO, '聞いて話せる日本語/.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/); if (m) envB[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}
const GKEY = env.VITE_GOOGLE_TTS_API_KEY, AKEY = env.AZURE_SPEECH_KEY || envB.AZURE_SPEECH_KEY, AREG = env.AZURE_SPEECH_REGION || envB.AZURE_SPEECH_REGION;
const GEP = 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + GKEY;
const AEP = `https://${AREG}.tts.speech.microsoft.com/cognitiveservices/v1`;
const ex = rd(path.join(ROOT, 'expo-app/data/examples.json'));
const gr = rd(path.join(ROOT, 'expo-app/data/grammarExamples.json'));
const ovEn = rd(path.join(ROOT, 'expo-app/data/overlays/en.json'));
const _sp = path.join(ROOT, 'scripts/_newthemes_ssml.json');
const ssml = fs.existsSync(_sp) ? rd(_sp) : { ja: {}, en: {} };
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function ssmlBody(text, lang) { const picks = (ssml[lang] || {})[text]; let s = esc(text); if (picks && picks.length) for (const p of picks) { const w = esc(p.word); s = s.split(w).join(`<sub alias="${esc(p.reading)}">${w}</sub>`); } return { body: s, hasPicks: !!(picks && picks.length) }; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GVOICE = { ja: { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B' }, en: { languageCode: 'en-US', name: 'en-US-Neural2-F' } };
async function gSyn(text, lang) {
  const { body, hasPicks } = ssmlBody(text, lang);
  const input = hasPicks ? { ssml: `<speak>${body}</speak>` } : { text };
  for (let a = 1; a <= 6; a++) { try {
    const r = await fetch(GEP, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input, voice: GVOICE[lang], audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95 } }) });
    if (r.status === 429) { await sleep(3000 * a); continue; }
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
    return Buffer.from((await r.json()).audioContent, 'base64');
  } catch (e) { if (a < 6) await sleep(2500 * a); else throw e; } }
}
async function aSyn(text) {
  const x = `<speak version="1.0" xml:lang="ne-NP"><voice name="ne-NP-HemkalaNeural"><prosody rate="-5%">${esc(text)}</prosody></voice></speak>`;
  for (let a = 1; a <= 6; a++) { try {
    const r = await fetch(AEP, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': AKEY, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'safa-tts' }, body: x });
    if (r.status === 429 || r.status === 400) { await sleep(3000 * a); continue; }
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
    return Buffer.from(await r.arrayBuffer());
  } catch (e) { if (a < 6) await sleep(2500 * a); else throw e; } }
}
// 着色ID
const COLORED = {
  conv: { ja: ['3-1-13','4-1-20','5-1-9','15-1-14','19-1-5','30-1-15','30-1-17'], ne: ['3-1-13','8-1-14','16-1-15','26-1-3'], en: ['1-1-7','1-3-8','1-3-10','1-3-11'] },
  gram: { ja: ['9-2','12-2','12-8','16-12'], ne: ['17-3'], en: [] },
};
function getText(id, lang, mode) {
  if (mode === 'conv') { const p = id.split('-'); const key = `${p[0]}-${p[1]}`; const i = +p[2] - 1;
    if (lang === 'en') return ovEn.examplesL1[key]?.[i];
    return ex[key]?.[i]?.[lang === 'ne' ? 'ne' : 'jp']; }
  else { const p = id.split('-'); const key = p[0]; const i = +p[1] - 1;
    if (lang === 'en') return ovEn.grammarL1[key]?.[i];
    return gr[key]?.[i]?.[lang === 'ne' ? 'ne' : 'jp']; }
}
const sub = mode => mode === 'conv' ? 'conv' : 'gram';
let ok = 0, fail = 0;
for (const mode of ['conv', 'gram']) for (const lang of ['ne', 'ja', 'en']) {
  for (const id of COLORED[mode][lang]) {
    const text = getText(id, lang, mode);
    if (!text) { console.error('NO TEXT', mode, lang, id); fail++; continue; }
    try {
      const buf = lang === 'ne' ? await aSyn(text) : await gSyn(text, lang);
      const dir = path.join(ROOT, 'audio', lang, sub(mode)); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, id + '.mp3'), buf);
      console.log(`OK ${mode}/${lang}/${id}  「${text.slice(0,30)}」`); ok++;
    } catch (e) { console.error('FAIL', mode, lang, id, e.message); fail++; }
  }
}
console.log(`\n再生成完了: ${ok}成功 / ${fail}失敗`);
