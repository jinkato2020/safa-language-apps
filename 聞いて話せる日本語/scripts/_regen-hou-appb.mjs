// App B ja「方→ほう」21件を再生成(SSML <sub>適用) → audio/ja/{conv,gram}/<id>.mp3
//  ja=Neural2-B@0.95。読みは ../聞いて話せるネパール語/scripts/_newthemes_ssml.json(ja)。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPA = path.resolve(ROOT, '..', '聞いて話せるネパール語');
const rd = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const env = {}; for (const l of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const GEP = 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + env.VITE_GOOGLE_TTS_API_KEY;
const VOICE = { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B' };
const SSML_JA = (rd(path.join(APPA, 'scripts/_newthemes_ssml.json')).ja) || {};
const ex = rd(path.join(ROOT, 'expo-app/data/examples.json'));
const gr = rd(path.join(ROOT, 'expo-app/data/grammarExamples.json'));
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
function info(id) {
  const p = id.split('-');
  if (p.length === 3) return { mode: 'conv', text: ex[`${p[0]}-${p[1]}`][+p[2] - 1].jp };
  const e = gr[p[0]][+p[1] - 1]; return { mode: 'gram', text: (typeof e === 'string' ? e : e.jp) };
}
const IDS = ['1-3-16','7-3-4','10-3-8','10-3-18','12-3-10','17-3-7',
             '18-1','18-2','18-4','18-6','18-7','18-8','18-9','18-11','18-12','18-14','18-15','18-16','18-18','18-19','18-20'];
let ok = 0;
for (const id of IDS) {
  const { mode, text } = info(id);
  const { ssml } = inputFor(text);
  const buf = await syn(text);
  const dir = path.join(ROOT, 'audio', 'ja', mode); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, id + '.mp3'), buf);
  console.log(`OK ${mode}/${id} ${ssml ? '[SSML]' : '[plain]'} 「${text.slice(0, 26)}」 ${buf.length}B`); ok++;
}
console.log(`\n再生成完了: ${ok}/${IDS.length}`);
