// App B 17-1-14「メールで送ります。」を ja/ne/en/bn/vi/zh 再生成 → audio/<lang>/conv/17-1-14.mp3
// 声は他と同一: ja=Neural2-B@0.95 / en=Neural2-F@0.95 / ne=Azure HemkalaNeural+prosody-5%
//             bn=bn-IN-Chirp3-HD-Aoede / vi=vi-VN-Chirp3-HD-Aoede / zh=cmn-CN-Chirp3-HD-Aoede (rate0.95)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const env = {}; for (const l of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const GKEY = env.VITE_GOOGLE_TTS_API_KEY, AKEY = env.AZURE_SPEECH_KEY, AREG = env.AZURE_SPEECH_REGION;
const GEP = 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + GKEY;
const AEP = `https://${AREG}.tts.speech.microsoft.com/cognitiveservices/v1`;
const ex = rd(path.join(ROOT, 'expo-app/data/examples.json'));
const ov = l => rd(path.join(ROOT, `expo-app/data/overlays/${l}.json`));
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GVOICE = {
  ja: { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B' },
  en: { languageCode: 'en-US', name: 'en-US-Neural2-F' },
  bn: { languageCode: 'bn-IN', name: 'bn-IN-Chirp3-HD-Aoede' },
  vi: { languageCode: 'vi-VN', name: 'vi-VN-Chirp3-HD-Aoede' },
  zh: { languageCode: 'cmn-CN', name: 'cmn-CN-Chirp3-HD-Aoede' },
};
async function gSyn(text, lang) {
  for (let a = 1; a <= 6; a++) { try {
    const r = await fetch(GEP, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: { text }, voice: GVOICE[lang], audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95 } }) });
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
const ID = '17-1-14', KEY = '17-1', I = 13;
const TEXT = { ja: ex[KEY][I].jp, ne: ov('ne').examplesL1[KEY][I], en: ov('en').examplesL1[KEY][I],
               bn: ov('bn').examplesL1[KEY][I], vi: ov('vi').examplesL1[KEY][I], zh: ov('zh').examplesL1[KEY][I] };
let ok = 0;
for (const lang of ['ja', 'ne', 'en', 'bn', 'vi', 'zh']) {
  const text = TEXT[lang];
  const buf = lang === 'ne' ? await aSyn(text) : await gSyn(text, lang);
  const dir = path.join(ROOT, 'audio', lang, 'conv'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, ID + '.mp3'), buf);
  console.log(`OK conv/${lang}/${ID}  「${text}」  ${buf.length}B`); ok++;
}
console.log(`\n再生成完了: ${ok}/6`);
