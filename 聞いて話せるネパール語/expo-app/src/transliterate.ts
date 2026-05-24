// デーヴァナーガリー → IAST 簡易変換
// HTML 版 (scripts/build-app.mjs) と同じロジック

const DEVA_CONS: Record<string, string> = {
  'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ṅ',
  'च':'c','छ':'ch','ज':'j','झ':'jh','ञ':'ñ',
  'ट':'ṭ','ठ':'ṭh','ड':'ḍ','ढ':'ḍh','ण':'ṇ',
  'त':'t','थ':'th','द':'d','ध':'dh','न':'n',
  'प':'p','फ':'ph','ब':'b','भ':'bh','म':'m',
  'य':'y','र':'r','ल':'l','व':'v','श':'ś','ष':'ṣ','स':'s','ह':'h',
};
const DEVA_VOWELS: Record<string, string> = {
  'अ':'a','आ':'ā','इ':'i','ई':'ī','उ':'u','ऊ':'ū','ऋ':'ṛ','ए':'e','ऐ':'ai','ओ':'o','औ':'au',
};
const DEVA_VSIGNS: Record<string, string> = {
  'ा':'ā','ि':'i','ी':'ī','ु':'u','ू':'ū','ृ':'ṛ','े':'e','ै':'ai','ो':'o','ौ':'au',
};
const DEVA_VIRAMA = '्';

export function toRomaji(text: string): string {
  if (!text) return '';
  let out = '';
  const s = text;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    const ch3 = s.substr(i, 3);
    if (DEVA_CONS[ch3]) {
      out += DEVA_CONS[ch3];
      const after = s[i + 3];
      if (after === DEVA_VIRAMA) { i += 4; continue; }
      if (after && DEVA_VSIGNS[after]) { out += DEVA_VSIGNS[after]; i += 4; continue; }
      out += 'a'; i += 3; continue;
    }
    if (DEVA_CONS[ch]) {
      out += DEVA_CONS[ch];
      const after = s[i + 1];
      if (after === DEVA_VIRAMA) { i += 2; continue; }
      if (after && DEVA_VSIGNS[after]) { out += DEVA_VSIGNS[after]; i += 2; continue; }
      out += 'a'; i += 1; continue;
    }
    if (DEVA_VOWELS[ch]) { out += DEVA_VOWELS[ch]; i += 1; continue; }
    if (ch === 'ं') { out += 'ṃ'; i += 1; continue; }
    if (ch === 'ः') { out += 'ḥ'; i += 1; continue; }
    if (ch === 'ँ') { out += 'm̐'; i += 1; continue; }
    if (ch === '।') { out += '.'; i += 1; continue; }
    if (ch === '॥') { out += '||'; i += 1; continue; }
    out += ch;
    i += 1;
  }
  return out;
}

export function sentenceToRomaji(neText: string): string {
  if (!neText) return '';
  return neText.split(/(\s+)/).map(tok => {
    if (/^\s+$/.test(tok)) return tok;
    return toRomaji(tok);
  }).join('');
}
