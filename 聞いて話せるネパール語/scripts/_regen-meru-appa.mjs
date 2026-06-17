// App A 15-1-14「メールで送ります。」を ne/ja/en 再生成 → audio/<lang>/conv/15-1-14.mp3
// 声は他と同一: ne=Azure HemkalaNeural+prosody-5% / ja=Neural2-B@0.95 / en=Neural2-F@0.95 (+SSML読み対策)
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
const ID = '15-1-14', KEY = '15-1', I = 13;
const TEXT = { ne: ex[KEY][I].ne, ja: ex[KEY][I].jp, en: ovEn.examplesL1[KEY][I] };
let ok = 0;
for (const lang of ['ne', 'ja', 'en']) {
  const text = TEXT[lang];
  const buf = lang === 'ne' ? await aSyn(text) : await gSyn(text, lang);
  const dir = path.join(ROOT, 'audio', lang, 'conv'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, ID + '.mp3'), buf);
  console.log(`OK conv/${lang}/${ID}  「${text}」  ${buf.length}B`); ok++;
}
console.log(`\n再生成完了: ${ok}/3`);
