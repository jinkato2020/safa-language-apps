// App B 日本語(学習対象)の読み誤り修正＋例題変更分を再生成 → audio/ja/conv/<id>.mp3
//  ja-JP-Neural2-B @0.95。読み修正は ../聞いて話せるネパール語/scripts/_newthemes_ssml.json(ja) の <sub alias>。
//  対象: 読み修正10件(4-2-1は意図的に除外=テストピース) + テキスト変更 29-1-19。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPA = path.resolve(ROOT, '..', '聞いて話せるネパール語');
const rd = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const env = {}; for (const l of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const GEP = 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + env.VITE_GOOGLE_TTS_API_KEY;
const VOICE = { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B' };
const SSML_JA = (rd(path.join(APPA, 'scripts/_newthemes_ssml.json')).ja) || {};
const ex = rd(path.join(ROOT, 'expo-app/data/examples.json'));
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sleep = ms => new Promise(r => setTimeout(r, ms));
function inputFor(text) {
  const picks = SSML_JA[text];
  if (!picks || !picks.length) return { input: { text }, ssml: false };
  let s = esc(text);
  for (const p of picks) { const w = esc(p.word); s = s.split(w).join(`<sub alias="${esc(p.reading)}">${w}</sub>`); }
  return { input: { ssml: `<speak>${s}</speak>` }, ssml: true };
}
async function syn(text) {
  const { input } = inputFor(text);
  for (let a = 1; a <= 6; a++) { try {
    const r = await fetch(GEP, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input, voice: VOICE, audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95 } }) });
    if (r.status === 429) { await sleep(3000 * a); continue; }
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
    return Buffer.from((await r.json()).audioContent, 'base64');
  } catch (e) { if (a < 6) await sleep(2500 * a); else throw e; } }
}
const IDS = ['4-2-6','6-2-1','6-2-5','8-2-6','10-2-9','10-2-10','12-1-5','15-1-9','25-1-19','26-1-15','29-1-19'];
const dir = path.join(ROOT, 'audio', 'ja', 'conv'); fs.mkdirSync(dir, { recursive: true });
let ok = 0;
for (const id of IDS) {
  const [a, b, c] = id.split('-'); const text = ex[`${a}-${b}`][+c - 1].jp;
  const { ssml } = inputFor(text);
  const buf = await syn(text);
  fs.writeFileSync(path.join(dir, id + '.mp3'), buf);
  console.log(`OK ${id} ${ssml ? '[SSML]' : '[plain]'} 「${text}」 ${buf.length}B`); ok++;
}
console.log(`\n再生成完了: ${ok}/${IDS.length}`);
